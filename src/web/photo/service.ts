import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Photo } from '../../entity/photo';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { QueryPhotoDto } from './dto/query_photo';

@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);

  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
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
   * 查询照片列表（分页）
   */
  async findAll(query: QueryPhotoDto): Promise<{
    items: Photo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, keyword } = query;

    const whereCondition = keyword ? { name: Like(`%${keyword}%`) } : {};

    const [items, total] = await this.photoRepository.findAndCount({
      where: whereCondition,
      skip: (page - 1) * limit,
      take: limit,
      order: {
        create_time: 'DESC',
      },
    });

    this.logger.log(`查询照片列表成功，共 ${total} 条，当前第 ${page} 页`);

    return {
      items,
      total,
      page,
      limit,
    };
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
   * 删除照片
   */
  async remove(id: number): Promise<void> {
    const photo = await this.findOne(id);

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
