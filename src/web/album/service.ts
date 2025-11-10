import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';
import { UpdateAlbumDto } from './dto/update_album';
import { QueryAlbumDto } from './dto/query_album';
import { CustomException } from '@/execption/global_exception_handler';

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name);

  constructor(
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
  ) {}

  /**
   * 查询相册列表（分页）
   */
  async findAll(query: QueryAlbumDto) {
    const { page = 1, limit = 10, keyword } = query;

    const whereCondition = keyword ? { name: Like(`%${keyword}%`) } : {};

    const [items, total] = await this.albumRepository.findAndCount({
      where: whereCondition,
      skip: (page - 1) * limit,
      take: limit,
      order: {
        create_time: 'DESC',
      },
      // 不加载photos关系，提升性能
    });

    // 为每个相册查询照片数量
    const itemsWithCount = await Promise.all(
      items.map(async (album) => {
        const count = await this.albumRepository.createQueryBuilder('album').leftJoin('album.photos', 'photo').where('album.id = :id', { id: album.id }).select('COUNT(photo.id)', 'count').getRawOne();

        return {
          ...album,
          photo_count: parseInt(count.count) || 0,
        };
      }),
    );

    this.logger.log(`查询相册列表成功，共 ${total} 条，当前第 ${page} 页`);

    return {
      items: itemsWithCount,
      total,
      page,
      limit,
    };
  }

  /**
   * 根据ID查询相册详情（不加载照片列表）
   */
  async findOne(id: number) {
    const album = await this.albumRepository.findOne({
      where: { id },
    });

    if (!album) {
      throw new CustomException(404, `相册 ID ${id} 不存在`);
    }

    return album;
  }

  /**
   * 根据ID查询相册详情（包含照片数量）
   */
  async findOneWithCount(id: number) {
    const album = await this.findOne(id);

    const count = await this.albumRepository.createQueryBuilder('album').leftJoin('album.photos', 'photo').where('album.id = :id', { id: album.id }).select('COUNT(photo.id)', 'count').getRawOne();

    return {
      ...album,
      photo_count: parseInt(count.count) || 0,
    };
  }

  /**
   * 根据ID查询相册（包含照片关系，用于内部操作）
   */
  private async findOneWithPhotos(id: number) {
    const album = await this.albumRepository.findOne({
      where: { id },
      relations: ['photos'],
    });

    if (!album) {
      throw new CustomException(404, `相册 ID ${id} 不存在`);
    }

    return album;
  }

  /**
   * 更新相册
   */
  async update(id: number, updateAlbumDto: UpdateAlbumDto) {
    const album = await this.findOne(id);

    Object.assign(album, updateAlbumDto);
    const result = await this.albumRepository.save(album);

    this.logger.log(`更新相册成功: ${result.id} - ${result.name}`);

    // 返回带照片数量的结果
    return this.findOneWithCount(result.id);
  }

  /**
   * 删除相册
   */
  async remove(id: number) {
    const album = await this.findOne(id);

    await this.albumRepository.remove(album);
    this.logger.log(`删除相册成功: ${id}`);
  }

  /**
   * 向相册添加照片
   */
  async addPhotos(albumId: number, photoIds: number[]) {
    const album = await this.findOneWithPhotos(albumId);

    // 查询要添加的照片
    const photosToAdd = await this.photoRepository.find({
      where: { id: In(photoIds) },
    });

    if (photosToAdd.length !== photoIds.length) {
      throw new CustomException(404, '部分照片不存在');
    }

    // 合并照片（避免重复）
    const existingPhotoIds = new Set(album.photos.map((p) => p.id));
    const newPhotos = photosToAdd.filter((p) => !existingPhotoIds.has(p.id));

    album.photos.push(...newPhotos);

    await this.albumRepository.save(album);
    this.logger.log(`向相册 ${albumId} 添加 ${newPhotos.length} 张照片成功`);
  }

  /**
   * 从相册移除照片
   */
  async removePhotos(albumId: number, photoIds: number[]) {
    const album = await this.findOneWithPhotos(albumId);

    // 过滤掉要移除的照片
    const photoIdsSet = new Set(photoIds);
    album.photos = album.photos.filter((photo) => !photoIdsSet.has(photo.id));

    await this.albumRepository.save(album);
    this.logger.log(`从相册 ${albumId} 移除 ${photoIds.length} 张照片成功`);
  }

  /**
   * 分页查询相册中的照片
   */
  async getPhotosPaginated(albumId: number, page: number = 1, limit: number = 10) {
    // 先验证相册是否存在
    await this.findOne(albumId);

    // 使用 QueryBuilder 进行分页查询
    const query = this.photoRepository
      .createQueryBuilder('photo')
      .innerJoin('photo.albums', 'album')
      .where('album.id = :albumId', { albumId })
      .orderBy('photo.create_time', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await query.getManyAndCount();

    this.logger.log(`查询相册 ${albumId} 的照片成功，共 ${total} 张，当前第 ${page} 页`);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
