import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Footprint } from '@/entity/footprint';
import { CreateFootprintDto } from './dto/create_footprint';
import { UpdateFootprintDto } from './dto/update_footprint';
import { QueryFootprintDto } from './dto/query_footprint';
import { CustomException } from '@/execption/global_exception_handler';

@Injectable()
export class FootprintService {
  private readonly logger = new Logger(FootprintService.name);

  constructor(
    @InjectRepository(Footprint)
    private readonly footprintRepository: Repository<Footprint>,
  ) {}

  /**
   * 创建足迹
   */
  async createFootprint(data: CreateFootprintDto) {
    const footprint = this.footprintRepository.create(data);
    const result = await this.footprintRepository.save(footprint);

    this.logger.log(`创建足迹成功: ${result.id} - ${result.title}`);

    return result;
  }

  /**
   * 查询足迹列表（分页）
   */
  async getFootprintList(query: QueryFootprintDto) {
    const { page = 1, limit = 10, keyword } = query;

    // 使用 QueryBuilder 进行分页查询，按创建时间倒序
    const queryBuilder = this.footprintRepository
      .createQueryBuilder('footprint')
      .orderBy('footprint.create_time', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // 如果有关键词，添加标题或地址搜索条件
    if (keyword) {
      queryBuilder.where('(footprint.title LIKE :keyword OR footprint.address LIKE :keyword)', { keyword: `%${keyword}%` });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    this.logger.log(`查询足迹列表成功，共 ${total} 条，当前第 ${page} 页`);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * 根据ID查询足迹详情
   */
  async getFootprintDetail(id: number) {
    const footprint = await this.footprintRepository.findOne({
      where: { id },
    });

    if (!footprint) {
      throw new CustomException(404, `足迹 ID ${id} 不存在`);
    }

    return footprint;
  }

  /**
   * 更新足迹
   */
  async updateFootprint(id: number, data: UpdateFootprintDto) {
    const footprint = await this.getFootprintDetail(id);

    Object.assign(footprint, data);
    const result = await this.footprintRepository.save(footprint);

    this.logger.log(`更新足迹成功: ${result.id} - ${result.title}`);

    return result;
  }

  /**
   * 删除足迹
   */
  async deleteFootprint(id: number) {
    const footprint = await this.getFootprintDetail(id);

    await this.footprintRepository.remove(footprint);
    this.logger.log(`删除足迹成功: ${id}`);
  }
}
