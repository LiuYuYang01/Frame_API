import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';
import { UpdateAlbumDto } from './dto/update_album';
import { QueryAlbumDto } from './dto/query_album';
import { CreateAlbumDto } from './dto/create_album';
import { CustomException } from '@/execption/global_exception_handler';
import { FEATURED_ALBUM_NAME } from '@/constants/featured';

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
   * 查询相册列表（不传 page/limit 则返回全部）- 公开接口，支持随机排序
   */
  async getAlbumListPublic(query: QueryAlbumDto) {
    const { page, limit, keyword } = query;
    const shouldPaginate = page != null && limit != null;
    const pageNum = page ?? 1;

    const featuredAlbum = await this.albumRepository.findOne({ where: { name: FEATURED_ALBUM_NAME } });
    let featuredItem: Awaited<ReturnType<typeof this.findOneWithCount>> | null = null;
    if (featuredAlbum && (!keyword || featuredAlbum.name.includes(keyword))) {
      featuredItem = await this.findOneWithCount(featuredAlbum.id);
    }

    const queryBuilder = this.albumRepository
      .createQueryBuilder('album')
      .where('album.name != :featuredName', { featuredName: FEATURED_ALBUM_NAME })
      .orderBy('RAND()');

    if (keyword) {
      queryBuilder.andWhere('album.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (shouldPaginate) {
      queryBuilder.skip((pageNum - 1) * limit).take(limit);
    }

    const [items, total] = await queryBuilder.getManyAndCount();

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

    const resultItems = featuredItem && pageNum === 1 ? [featuredItem, ...itemsWithCount] : itemsWithCount;
    const resultTotal = total + (featuredItem ? 1 : 0);

    this.logger.log(
      shouldPaginate
        ? `查询相册列表成功，共 ${resultTotal} 条，当前第 ${pageNum} 页`
        : `查询相册列表成功，共 ${resultTotal} 条（全量）`,
    );

    return {
      items: resultItems,
      total: resultTotal,
      page: pageNum,
      limit: limit ?? resultTotal,
    };
  }

  /**
   * 查询相册列表（不传 page/limit 则返回全部）- 管理接口，按创建时间排序
   */
  async getAlbumList(query: QueryAlbumDto) {
    const { page, limit, keyword } = query;
    const shouldPaginate = page != null && limit != null;

    const queryBuilder = this.albumRepository
      .createQueryBuilder('album')
      .orderBy('album.create_time', 'DESC');

    if (keyword) {
      queryBuilder.where('album.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (shouldPaginate) {
      queryBuilder.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await queryBuilder.getManyAndCount();

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

    this.logger.log(
      shouldPaginate ? `查询相册列表成功，共 ${total} 条，当前第 ${page} 页` : `查询相册列表成功，共 ${total} 条（全量）`,
    );

    return {
      items: itemsWithCount,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }

  /**
   * 创建相册
   */
  async createAlbum(data: CreateAlbumDto) {
    const album = this.albumRepository.create(data);
    const result = await this.albumRepository.save(album);

    this.logger.log(`创建相册成功: ${result.id} - ${result.name}`);

    // 返回带照片数量的结果
    return this.findOneWithCount(result.id);
  }

  /**
   * 根据ID查询相册详情（不加载照片列表）
   */
  async getAlbumDetail(id: number) {
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
    const album = await this.getAlbumDetail(id);

    const count = await this.albumRepository.createQueryBuilder('album').leftJoin('album.photos', 'photo').where('album.id = :id', { id: album.id }).select('COUNT(photo.id)', 'count').getRawOne();

    return {
      ...album,
      photo_count: parseInt(count.count) || 0,
    };
  }

  /**
   * 根据ID查询相册（包含照片关系，用于内部操作）
   */
  private async getAlbumWithPhotos(id: number) {
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
  async updateAlbum(id: number, data: UpdateAlbumDto) {
    const album = await this.getAlbumDetail(id);

    Object.assign(album, data);
    const result = await this.albumRepository.save(album);

    this.logger.log(`更新相册成功: ${result.id} - ${result.name}`);

    // 返回带照片数量的结果
    return this.findOneWithCount(result.id);
  }

  /**
   * 删除相册
   */
  async delAlbum(id: number) {
    const album = await this.findOneWithCount(id);

    if (album.photo_count > 0) {
      throw new CustomException(400, `相册内仍有 ${album.photo_count} 张绑定的照片，请先解除绑定后再删除`);
    }

    await this.albumRepository.remove(album);
    this.logger.log(`删除相册成功: ${id}`);
  }

  /**
   * 获取或创建收藏相册
   */
  async getOrCreateFeaturedAlbum() {
    let album = await this.albumRepository.findOne({ where: { name: FEATURED_ALBUM_NAME } });
    if (!album) {
      album = this.albumRepository.create({
        name: FEATURED_ALBUM_NAME,
        description: '收藏照片合集',
      });
      album = await this.albumRepository.save(album);
      this.logger.log(`创建收藏相册: ${album.id}`);
    }
    return album;
  }

  /**
   * 向相册添加照片
   */
  async addPhotos(albumId: number, photoIds: number[]) {
    const album = await this.getAlbumWithPhotos(albumId);

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
  async delPhotos(albumId: number, photoIds: number[]) {
    const album = await this.getAlbumWithPhotos(albumId);

    // 过滤掉要移除的照片
    const photoIdsSet = new Set(photoIds);
    album.photos = album.photos.filter((photo) => !photoIdsSet.has(photo.id));

    await this.albumRepository.save(album);
    this.logger.log(`从相册 ${albumId} 移除 ${photoIds.length} 张照片成功`);

    if (album.name === FEATURED_ALBUM_NAME) {
      await this.photoRepository.update({ id: In(photoIds) }, { is_featured: false });
    }
  }

  /**
   * 查询相册中的照片（不传 page/limit 则返回全部）- 公开接口
   * albumId 为 0 时查询所有照片，按创建时间倒序（便于时间线分页懒加载，避免随机排序导致翻页重复）
   * @param albumId 相册ID，为0时表示查询所有照片
   */
  async getPhotosPaginatedPublic(albumId: number, page?: number, limit?: number) {
    const shouldPaginate = page != null && limit != null;

    // 如果 albumId 为 0，查询所有照片
    if (albumId === 0) {
      // 用 id 作为次级排序键，避免 create_time 相同时分页跨页重复
      const query = this.photoRepository
        .createQueryBuilder('photo')
        .orderBy('photo.create_time', 'DESC')
        .addOrderBy('photo.id', 'DESC');

      if (shouldPaginate) {
        query.skip((page - 1) * limit).take(limit);
      }

      const [items, total] = await query.getManyAndCount();

      this.logger.log(
        shouldPaginate
          ? `查询所有照片成功，共 ${total} 张，当前第 ${page} 页`
          : `查询所有照片成功，共 ${total} 张（全量）`,
      );

      return {
        items,
        total,
        page: page ?? 1,
        limit: limit ?? total,
      };
    }

    // 先验证相册是否存在
    await this.getAlbumDetail(albumId);

    const query = this.photoRepository
      .createQueryBuilder('photo')
      .innerJoin('photo.albums', 'album')
      .where('album.id = :albumId', { albumId })
      .orderBy('RAND()');

    if (shouldPaginate) {
      query.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await query.getManyAndCount();

    this.logger.log(
      shouldPaginate
        ? `查询相册 ${albumId} 的照片成功，共 ${total} 张，当前第 ${page} 页`
        : `查询相册 ${albumId} 的照片成功，共 ${total} 张（全量）`,
    );

    return {
      items,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }

  /**
   * 查询相册中的照片（不传 page/limit 则返回全部）- 管理接口，按创建时间排序
   * @param albumId 相册ID，为0时表示查询所有照片
   */
  async getPhotosPaginated(albumId: number, page?: number, limit?: number) {
    const shouldPaginate = page != null && limit != null;

    // 如果 albumId 为 0，查询所有照片
    if (albumId === 0) {
      // 用 id 作为次级排序键，避免 create_time 相同时分页跨页重复
      const query = this.photoRepository
        .createQueryBuilder('photo')
        .orderBy('photo.create_time', 'DESC')
        .addOrderBy('photo.id', 'DESC');

      if (shouldPaginate) {
        query.skip((page - 1) * limit).take(limit);
      }

      const [items, total] = await query.getManyAndCount();

      this.logger.log(
        shouldPaginate ? `查询所有照片成功，共 ${total} 张，当前第 ${page} 页` : `查询所有照片成功，共 ${total} 张（全量）`,
      );

      return {
        items,
        total,
        page: page ?? 1,
        limit: limit ?? total,
      };
    }

    // 先验证相册是否存在
    await this.getAlbumDetail(albumId);

    const query = this.photoRepository
      .createQueryBuilder('photo')
      .innerJoin('photo.albums', 'album')
      .where('album.id = :albumId', { albumId })
      .orderBy('photo.create_time', 'DESC')
      .addOrderBy('photo.id', 'DESC');

    if (shouldPaginate) {
      query.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await query.getManyAndCount();

    this.logger.log(
      shouldPaginate
        ? `查询相册 ${albumId} 的照片成功，共 ${total} 张，当前第 ${page} 页`
        : `查询相册 ${albumId} 的照片成功，共 ${total} 张（全量）`,
    );

    return {
      items,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }

  /**
   * 查询可绑定照片（不传 page/limit 则返回全部）
   * @param unboundOnly 为 true 时仅返回未绑定任何相册的照片；否则返回未加入当前相册的照片
   */
  async getPhotosExcludingAlbum(albumId: number, page?: number, limit?: number, keyword?: string, unboundOnly?: boolean) {
    const shouldPaginate = page != null && limit != null;

    // 确认相册存在
    await this.getAlbumDetail(albumId);

    const query = this.photoRepository.createQueryBuilder('photo');

    if (unboundOnly) {
      query.where(`
        NOT EXISTS (
          SELECT 1 FROM album_photo ap
          WHERE ap.photo_id = photo.id
        )
      `);
    } else {
      query.where(`
        NOT EXISTS (
          SELECT 1 FROM album_photo ap
          WHERE ap.photo_id = photo.id AND ap.album_id = :albumId
        )
      `, { albumId });
    }

    if (keyword) {
      query.andWhere('photo.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    query.orderBy('photo.create_time', 'DESC');

    if (shouldPaginate) {
      query.skip((page - 1) * limit).take(limit);
    }

    const [items, total] = await query.getManyAndCount();

    const scope = unboundOnly ? '未绑定任何相册' : `未加入相册 ${albumId}`;
    this.logger.log(
      shouldPaginate
        ? `查询${scope}的照片成功，共 ${total} 张，当前第 ${page} 页${keyword ? `，关键词: ${keyword}` : ''}`
        : `查询${scope}的照片成功，共 ${total} 张（全量）${keyword ? `，关键词: ${keyword}` : ''}`,
    );

    return {
      items,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }
}
