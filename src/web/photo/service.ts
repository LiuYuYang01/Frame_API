import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Photo } from '../../entity/photo';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { QiniuService } from '../upload/service';

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
  async create(createPhotoDto: CreatePhotoDto): Promise<Photo> {
    const photo = this.photoRepository.create(createPhotoDto);
    const result = await this.photoRepository.save(photo);
    this.logger.log(`创建照片成功: ${result.id} - ${result.name}`);
    return result;
  }

  /**
   * 根据ID查询照片详情
   */
  async findOne(id: number): Promise<Photo> {
    const photo = await this.photoRepository.findOne({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundException(`照片 ID ${id} 不存在`);
    }

    return photo;
  }

  /**
   * 更新照片
   */
  async update(id: number, updatePhotoDto: UpdatePhotoDto): Promise<Photo> {
    const photo = await this.findOne(id);

    Object.assign(photo, updatePhotoDto);
    const result = await this.photoRepository.save(photo);

    this.logger.log(`更新照片成功: ${result.id} - ${result.name}`);
    return result;
  }

  /**
   * 删除照片（同时删除七牛云文件）
   */
  async remove(id: number): Promise<void> {
    const photo = await this.findOne(id);

    // 从 URL 中提取七牛云文件的 key
    let key: string;
    try {
      const url = new URL(photo.url);
      key = url.pathname.substring(1); // 去掉开头的 '/'
    } catch (error) {
      this.logger.error(`解析照片 URL 失败: ${error.message}`);
      throw new Error(`无法解析照片 URL: ${photo.url}`);
    }

    // 先从七牛云删除文件，如果失败则抛出异常
    if (!key) {
      throw new Error('无法从 URL 中提取文件 key');
    }

    try {
      await this.qiniuService.deleteFile(key);
      this.logger.log(`七牛云文件删除成功: ${key}`);
    } catch (error) {
      this.logger.error(`七牛云文件删除失败: ${error.message}`);
      throw new Error(`七牛云文件删除失败: ${error.message}`);
    }

    // 七牛云删除成功后，再删除数据库记录
    await this.photoRepository.remove(photo);
    this.logger.log(`删除照片成功: ${id}`);
  }

  /**
   * 批量创建照片
   */
  async createBatch(createPhotoDtos: CreatePhotoDto[]): Promise<Photo[]> {
    const photos = this.photoRepository.create(createPhotoDtos);
    const results = await this.photoRepository.save(photos);
    this.logger.log(`批量创建照片成功，共 ${results.length} 张`);
    return results;
  }

  /**
   * 根据多个ID查询照片
   */
  async findByIds(ids: number[]): Promise<Photo[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const photos = await this.photoRepository.find({
      where: { id: In(ids) },
    });
    return photos;
  }
}
