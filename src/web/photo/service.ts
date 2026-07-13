import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Photo } from '@/entity/photo';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { SlimPhotoDto, SlimPhotoQueryDto } from './dto/slim_photo';
import { QiniuService } from '@/web/upload/service';
import { CustomException } from '@/execption/global_exception_handler';
import { stripImageProcessing } from '@/utils/image';
import {
  DEFAULT_SLIM_MAX_LONG_EDGE,
  DEFAULT_SLIM_MIN_SIZE_BYTES,
  DEFAULT_SLIM_QUALITY,
} from '@/constants/image_slim';

const SKIP_SLIM_MIME_TYPES = new Set(['image/gif']);

export type SlimPhotoStatus = 'success' | 'skipped' | 'failed';

export interface SlimPhotoItemResult {
  id: number;
  name: string;
  status: SlimPhotoStatus;
  beforeSize: number;
  afterSize?: number;
  savedBytes?: number;
  error?: string;
}

export interface SlimPhotosSummary {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  results: SlimPhotoItemResult[];
}

export interface SlimPhotoPreview {
  count: number;
  totalSize: number;
  photoIds: number[];
  items: Array<{
    id: number;
    name: string;
    size: number;
    width?: number;
    height?: number;
  }>;
}

@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);

  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly qiniuService: QiniuService,
  ) {}

  /**
   * 创建照片
   */
  async createPhoto(data: CreatePhotoDto) {
    const photo = this.photoRepository.create(data);
    const result = await this.photoRepository.save(photo);
    this.logger.log(`创建照片成功: ${result.id} - ${result.name}`);
    return result;
  }

  /**
   * 根据ID查询照片详情
   */
  async getPhotoDetail(id: number) {
    const photo = await this.photoRepository.findOne({
      where: { id },
    });

    if (!photo) {
      throw new CustomException(404, `照片 ID ${id} 不存在`);
    }

    return photo;
  }

  /**
   * 更新照片
   */
  async updatePhoto(id: number, data: UpdatePhotoDto) {
    const photo = await this.getPhotoDetail(id);

    Object.assign(photo, data);
    const result = await this.photoRepository.save(photo);

    this.logger.log(`更新照片成功: ${result.id} - ${result.name}`);
    return result;
  }

  /**
   * 删除照片（同时删除七牛云文件）
   */
  async delPhoto(id: number) {
    const photo = await this.getPhotoDetail(id);

    let key: string;
    try {
      key = this.qiniuService.extractKeyFromUrl(photo.url);
    } catch (error) {
      this.logger.error(`解析照片 URL 失败: ${error.message}`);
      throw new CustomException(400, `无法解析照片 URL: ${photo.url}`);
    }

    // 先从七牛云删除文件，如果失败则抛出异常
    if (!key) {
      throw new CustomException(400, '无法从 URL 中提取文件 key');
    }

    try {
      await this.qiniuService.delFile(key);
      this.logger.log(`七牛云文件删除成功: ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '七牛云文件删除失败';
      this.logger.error(message);
      throw new CustomException(500, message);
    }

    // 七牛云删除成功后，再删除数据库记录
    await this.photoRepository.remove(photo);
    this.logger.log(`删除照片成功: ${id}`);
  }

  /**
   * 批量删除照片
   */
  async delPhotos(ids: number[]) {
    if (!ids || ids.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(ids));
    for (const id of uniqueIds) {
      await this.delPhoto(id);
    }
    this.logger.log(`批量删除照片成功，共 ${uniqueIds.length} 张`);
  }

  /**
   * 批量创建照片
   */
  async createBatch(data: CreatePhotoDto[]) {
    const photos = this.photoRepository.create(data);
    const results = await this.photoRepository.save(photos);
    this.logger.log(`批量创建照片成功，共 ${results.length} 张`);
    return results;
  }

  /**
   * 根据 URL 查询照片
   */
  async findByUrl(url: string) {
    return this.photoRepository.findOne({
      where: { url },
    });
  }

  /**
   * 根据 hash 查询照片（用于秒传）
   */
  async findByHash(hash: string) {
    return this.photoRepository.findOne({
      where: { hash },
    });
  }

  /**
   * 根据多个ID查询照片
   */
  async findByIds(ids: number[]) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const photos = await this.photoRepository.find({
      where: { id: In(ids) },
    });
    return photos;
  }

  /**
   * 直接删除数据库记录（不删除七牛云文件）
   * 用于回滚操作，避免重复删除七牛云文件
   */
  async deletePhotoDirectly(id: number) {
    const photo = await this.photoRepository.findOne({
      where: { id },
    });

    if (!photo) {
      this.logger.warn(`照片 ID ${id} 不存在，跳过删除`);
      return;
    }

    await this.photoRepository.remove(photo);
    this.logger.log(`直接删除照片记录成功: ${id}`);
  }

  async previewSlimPhotos(query: SlimPhotoQueryDto): Promise<SlimPhotoPreview> {
    this.assertSlimScope(query);
    const minSizeBytes = query.minSizeBytes ?? DEFAULT_SLIM_MIN_SIZE_BYTES;
    const ignoreSizeThreshold = Boolean(query.ids?.length);
    const photos = await this.findPhotosForSlim(query);

    const candidates = photos.filter((photo) => this.shouldSlimPhoto(photo, minSizeBytes, ignoreSizeThreshold));
    const totalSize = candidates.reduce((sum, photo) => sum + photo.size, 0);

    return {
      count: candidates.length,
      totalSize,
      photoIds: candidates.map((photo) => photo.id),
      items: candidates.map((photo) => ({
        id: photo.id,
        name: photo.name,
        size: photo.size,
        width: photo.width,
        height: photo.height,
      })),
    };
  }

  async slimPhotos(query: SlimPhotoDto): Promise<SlimPhotosSummary> {
    this.assertSlimScope(query);
    const minSizeBytes = query.minSizeBytes ?? DEFAULT_SLIM_MIN_SIZE_BYTES;
    const maxLongEdge = query.maxLongEdge ?? DEFAULT_SLIM_MAX_LONG_EDGE;
    const quality = query.quality ?? DEFAULT_SLIM_QUALITY;
    const ignoreSizeThreshold = Boolean(query.ids?.length);
    const photos = await this.findPhotosForSlim(query);

    const results: SlimPhotoItemResult[] = [];
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const photo of photos) {
      if (!this.shouldSlimPhoto(photo, minSizeBytes, ignoreSizeThreshold)) {
        skipped += 1;
        results.push({
          id: photo.id,
          name: photo.name,
          status: 'skipped',
          beforeSize: photo.size,
          error:
            photo.size < minSizeBytes && !ignoreSizeThreshold
              ? '文件体积未超过阈值'
              : '不支持的图片类型',
        });
        continue;
      }

      try {
        const key = this.qiniuService.extractKeyFromUrl(photo.url);
        const beforeSize = photo.size;
        const stat = await this.qiniuService.slimImageByPfop(key, { maxLongEdge, quality });
        const imageInfo = await this.qiniuService.getImageInfo(stripImageProcessing(photo.url));

        photo.size = stat.fsize;
        photo.hash = stat.hash;
        photo.type = stat.mimeType || 'image/jpeg';

        if (imageInfo) {
          photo.width = imageInfo.width;
          photo.height = imageInfo.height;
        }

        await this.photoRepository.save(photo);

        const savedBytes = Math.max(beforeSize - stat.fsize, 0);
        success += 1;
        results.push({
          id: photo.id,
          name: photo.name,
          status: 'success',
          beforeSize,
          afterSize: stat.fsize,
          savedBytes,
        });
        this.logger.log(`照片瘦身成功: ${photo.id}, ${beforeSize} -> ${stat.fsize}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : '图片瘦身失败';
        results.push({
          id: photo.id,
          name: photo.name,
          status: 'failed',
          beforeSize: photo.size,
          error: message,
        });
        this.logger.error(`照片瘦身失败: ${photo.id}, ${message}`);
      }
    }

    return {
      total: photos.length,
      success,
      skipped,
      failed,
      results,
    };
  }

  private assertSlimScope(query: SlimPhotoQueryDto): void {
    if (!query.albumId && (!query.ids || query.ids.length === 0)) {
      throw new CustomException(400, '请指定 albumId 或 ids');
    }
  }

  private shouldSlimPhoto(photo: Photo, minSizeBytes: number, ignoreSizeThreshold = false): boolean {
    if (!ignoreSizeThreshold && photo.size < minSizeBytes) {
      return false;
    }
    if (SKIP_SLIM_MIME_TYPES.has(photo.type)) {
      return false;
    }
    return true;
  }

  private async findPhotosForSlim(query: SlimPhotoQueryDto): Promise<Photo[]> {
    const qb = this.photoRepository.createQueryBuilder('photo');

    if (query.albumId) {
      qb.innerJoin('photo.albums', 'album').andWhere('album.id = :albumId', { albumId: query.albumId });
    }

    if (query.ids?.length) {
      qb.andWhere('photo.id IN (:...ids)', { ids: Array.from(new Set(query.ids)) });
    }

    qb.orderBy('photo.id', 'ASC');
    return qb.getMany();
  }

  /**
   * 查询未绑定任何相册的照片（不传 page/limit 则返回全部）
   */
  async getUnboundPhotos(page?: number, limit?: number, keyword?: string) {
    const shouldPaginate = page != null && limit != null;

    const query = this.photoRepository.createQueryBuilder('photo').where(`
      NOT EXISTS (
        SELECT 1 FROM album_photo ap
        WHERE ap.photo_id = photo.id
      )
    `);

    if (keyword) {
      query.andWhere('photo.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    query.orderBy('photo.create_time', 'DESC');

    if (shouldPaginate) {
      query.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await query.getManyAndCount();

    this.logger.log(
      shouldPaginate
        ? `查询未绑定任何相册的照片成功，共 ${total} 张，当前第 ${page} 页${keyword ? `，关键词: ${keyword}` : ''}`
        : `查询未绑定任何相册的照片成功，共 ${total} 张（全量）${keyword ? `，关键词: ${keyword}` : ''}`,
    );

    return {
      items,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }
}
