import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';

@Injectable()
export class StatisService {
  private readonly logger = new Logger(StatisService.name);

  constructor(
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
  ) {}

  /**
   * 获取统计信息
   */
  async getStatistics() {
    // 统计相册数量
    const albumCount = await this.albumRepository.count();

    // 统计照片数量
    const photoCount = await this.photoRepository.count();

    // 统计照片总大小（字节）
    const photoSizeResult = await this.photoRepository.createQueryBuilder('photo').select('SUM(photo.size)', 'totalSize').getRawOne();
    const totalPhotoSize = parseInt(photoSizeResult?.totalSize || '0', 10);

    return {
      album: {
        count: albumCount,
      },
      photo: {
        count: photoCount,
        totalSize: totalPhotoSize,
        totalSizeFormatted: this.formatBytes(totalPhotoSize),
      },
    };
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
