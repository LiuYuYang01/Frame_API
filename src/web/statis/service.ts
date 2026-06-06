import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';
import { EnvConfigService } from '@/web/env_config/service';
import { CustomException } from '@/execption/global_exception_handler';

type BaiduStatisType = 'basic' | 'overview' | 'new-visitor' | 'basic-overview';

@Injectable()
export class StatisService {
  private readonly logger = new Logger(StatisService.name);
  private static readonly BASE_API_URL = 'https://openapi.baidu.com/rest/2.0/tongji/report/getData';

  constructor(
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly envConfigService: EnvConfigService,
  ) {}

  /**
   * 获取统计信息
   */
  async getStatistics() {
    const albumCount = await this.albumRepository.count();
    const photoCount = await this.photoRepository.count();
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
   * 获取百度统计数据
   */
  async getBaiduStatistics(type: BaiduStatisType, startDate?: string, endDate?: string) {
    switch (type) {
      case 'basic':
        return this.callBaiduStatisticsApi('pv_count,ip_count', 'overview/getTimeTrendRpt', null, startDate, endDate, '基础统计数据');
      case 'overview':
        return this.callBaiduStatisticsApi('pv_count,ip_count,bounce_ratio,avg_visit_time', 'overview/getTimeTrendRpt', null, startDate, endDate, '概览时间趋势报表');
      case 'new-visitor':
        return this.callBaiduStatisticsApi('new_visitor_count,new_visitor_ratio', 'trend/time/a', 'gran=day&area=', startDate, endDate, '新访客趋势报表');
      case 'basic-overview':
        return this.callBaiduStatisticsApi('pv_count,ip_count', 'overview/getTimeTrendRpt', null, startDate, endDate, '基础概览时间趋势报表');
      default:
        throw new CustomException(400, `不支持的统计类型: ${type}`);
    }
  }

  private normalizeDate(date?: string): string {
    const today = this.formatDate(new Date());
    if (!date) return today;
    const normalized = date.replace(/\//g, '').replace(/-/g, '');
    return normalized.length === 8 ? normalized : today;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private async callBaiduStatisticsApi(
    metrics: string,
    method: string,
    additionalParams: string | null,
    startDate?: string,
    endDate?: string,
    apiName = '百度统计',
  ) {
    const config = await this.envConfigService.getBaiduStatisConfigAsync();

    if (!config.access_token) {
      throw new CustomException(600, '无有效的 access token，请先配置百度统计');
    }

    const processedStartDate = this.normalizeDate(startDate);
    const processedEndDate = this.normalizeDate(endDate);

    const params = new URLSearchParams({
      access_token: config.access_token,
      site_id: String(config.site_id),
      start_date: processedStartDate,
      end_date: processedEndDate,
      metrics,
      method,
    });

    if (additionalParams) {
      additionalParams.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key) params.append(key, value ?? '');
      });
    }

    const url = `${StatisService.BASE_API_URL}?${params.toString()}`;
    this.logger.log(`调用${apiName}API`);

    try {
      const response = await fetch(url);
      const data = (await response.json()) as Record<string, unknown>;

      if (data.error_code) {
        const errorMsg = String(data.error_msg || '未知错误');
        this.logger.error(`${apiName}API调用失败: ${errorMsg}`);
        throw new CustomException(600, `获取数据失败: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      if (error instanceof CustomException) throw error;
      this.logger.error(`调用${apiName}API失败`, error);
      throw new CustomException(600, error instanceof Error ? error.message : '获取数据失败');
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
