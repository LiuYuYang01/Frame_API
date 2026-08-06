import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Footprint } from '@/entity/footprint';
import { Album } from '@/entity/album';
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
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
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
   * 批量为足迹列表填充关联相册信息（相册名、封面）
   */
  private async enrichWithAlbum(items: Footprint[]) {
    const albumIds = [...new Set(items.map((f) => f.album_id).filter((id): id is number => id != null))];
    if (albumIds.length === 0) {
      return items.map((footprint) => ({ ...footprint, album_name: null, album_cover: null }));
    }

    const albums = await this.albumRepository.find({ where: { id: In(albumIds) } });
    const albumMap = new Map(albums.map((a) => [a.id, a]));

    return items.map((footprint) => {
      const album = footprint.album_id ? albumMap.get(footprint.album_id) : null;
      return {
        ...footprint,
        album_name: album?.name || null,
        album_cover: album?.cover || null,
      };
    });
  }

  /**
   * 查询足迹列表（不传 page/limit 则返回全部，传则分页）
   */
  async getFootprintList(query: QueryFootprintDto) {
    const { page, limit, keyword } = query;
    const shouldPaginate = page != null && limit != null;

    const queryBuilder = this.footprintRepository
      .createQueryBuilder('footprint')
      .orderBy('footprint.create_time', 'DESC');

    if (keyword) {
      queryBuilder.where('(footprint.title LIKE :keyword OR footprint.address LIKE :keyword)', { keyword: `%${keyword}%` });
    }

    if (shouldPaginate) {
      queryBuilder.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    const itemsWithAlbum = await this.enrichWithAlbum(items);

    this.logger.log(
      shouldPaginate ? `查询足迹列表成功，共 ${total} 条，当前第 ${page} 页` : `查询足迹列表成功，共 ${total} 条（全量）`,
    );

    return {
      items: itemsWithAlbum,
      total,
      page: page ?? 1,
      limit: limit ?? total,
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

    const [enriched] = await this.enrichWithAlbum([footprint]);
    return enriched;
  }

  /**
   * 更新足迹
   */
  async updateFootprint(id: number, data: UpdateFootprintDto) {
    // 查询原始实体用于更新（避免 enriched 对象含非实体字段干扰 save）
    const footprint = await this.footprintRepository.findOne({ where: { id } });
    if (!footprint) {
      throw new CustomException(404, `足迹 ID ${id} 不存在`);
    }

    Object.assign(footprint, data);
    const result = await this.footprintRepository.save(footprint);

    this.logger.log(`更新足迹成功: ${result.id} - ${result.title}`);

    const [enriched] = await this.enrichWithAlbum([result]);
    return enriched;
  }

  /**
   * 删除足迹
   */
  async deleteFootprint(id: number) {
    const footprint = await this.footprintRepository.findOne({
      where: { id },
    });

    if (!footprint) {
      throw new CustomException(404, `足迹 ID ${id} 不存在`);
    }

    await this.footprintRepository.remove(footprint);
    this.logger.log(`删除足迹成功: ${id}`);
  }
}
