import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';
import { createQiniuConfig } from '@/web/upload/config';
import * as qiniu from 'qiniu';

@Injectable()
export class StatisService {
  private readonly logger = new Logger(StatisService.name);
  private readonly qiniuConfig: ReturnType<typeof createQiniuConfig>;
  private readonly mac: qiniu.auth.digest.Mac;
  private readonly config: qiniu.conf.Config;
  private readonly bucketManager: qiniu.rs.BucketManager;

  constructor(
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly configService: ConfigService,
  ) {
    // 初始化七牛云配置
    this.qiniuConfig = createQiniuConfig(this.configService);
    this.mac = new qiniu.auth.digest.Mac(this.qiniuConfig.accessKey, this.qiniuConfig.secretKey);
    this.config = new qiniu.conf.Config();
    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
  }

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

    // 获取七牛云存储信息
    const qiniuStorage = await this.getQiniuStorageInfo();

    // 获取七牛云流量信息
    const qiniuTraffic = await this.getQiniuTrafficInfo();

    return {
      album: {
        count: albumCount,
      },
      photo: {
        count: photoCount,
        totalSize: totalPhotoSize,
        totalSizeFormatted: this.formatBytes(totalPhotoSize),
      },
      qiniu: {
        storage: qiniuStorage,
        traffic: qiniuTraffic,
      },
    };
  }

  /**
   * 获取七牛云存储空间信息
   */
  private async getQiniuStorageInfo(): Promise<{
    used: number;
    usedFormatted: string;
    available?: number;
    availableFormatted?: string;
    total?: number;
    totalFormatted?: string;
    usagePercent?: number;
  }> {
    try {
      // 通过 bucketManager 获取存储空间信息
      // getBucketInfo 是回调函数，不返回 Promise
      return new Promise((resolve) => {
        void this.bucketManager.getBucketInfo(
          this.qiniuConfig.bucket,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: Error | undefined, respBody: any, respInfo: any) => {
            if (err) {
              this.logger.error(`获取七牛云存储信息失败: ${err.message}`);
              // 如果获取失败，返回基于数据库的估算值
              void this.getStorageInfoFromDatabase()
                .then(resolve)
                .catch(() => {
                  resolve({ used: 0, usedFormatted: '0 B' });
                });
              return;
            }

            if (respInfo.statusCode === 200) {
              // respBody 包含存储空间信息
              // 注意：七牛云 API 返回的存储信息格式可能不同
              // 这里需要根据实际 API 响应调整
              const used = respBody.space?.used || 0;
              const total = respBody.space?.total || 0;
              const available = total > 0 ? total - used : undefined;

              resolve({
                used,
                usedFormatted: this.formatBytes(used),
                available: available !== undefined ? available : undefined,
                availableFormatted: available !== undefined ? this.formatBytes(available) : undefined,
                total: total > 0 ? total : undefined,
                totalFormatted: total > 0 ? this.formatBytes(total) : undefined,
                usagePercent: total > 0 ? Math.round((used / total) * 100 * 100) / 100 : undefined,
              });
            } else {
              this.logger.error(`获取七牛云存储信息失败: ${respInfo.statusCode}`);
              void this.getStorageInfoFromDatabase()
                .then(resolve)
                .catch(() => {
                  resolve({ used: 0, usedFormatted: '0 B' });
                });
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(`获取七牛云存储信息异常: ${error.message}`);
      return await this.getStorageInfoFromDatabase();
    }
  }

  /**
   * 从数据库估算存储使用量（基于照片总大小）
   */
  private async getStorageInfoFromDatabase(): Promise<{
    used: number;
    usedFormatted: string;
  }> {
    const photoSizeResult = await this.photoRepository.createQueryBuilder('photo').select('SUM(photo.size)', 'totalSize').getRawOne();
    const used = parseInt(photoSizeResult?.totalSize || '0', 10);

    return {
      used,
      usedFormatted: this.formatBytes(used),
    };
  }

  /**
   * 获取七牛云流量信息
   * 注意：七牛云的流量统计需要通过统计 API 获取，需要相应的权限
   */
  private async getQiniuTrafficInfo(): Promise<{
    used?: number;
    usedFormatted?: string;
    available?: number;
    availableFormatted?: string;
    total?: number;
    totalFormatted?: string;
    usagePercent?: number;
    note?: string;
  }> {
    try {
      // 获取当前月份的流量统计
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const beginDate = `${year}${String(month).padStart(2, '0')}01`;
      const endDate = `${year}${String(month).padStart(2, '0')}${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      // 构建统计 API 请求 URL
      const statUrl = `https://api.qiniu.com/v6/stat?bucket=${this.qiniuConfig.bucket}&begin=${beginDate}&end=${endDate}`;

      // 生成访问令牌
      const accessToken = qiniu.util.generateAccessToken(this.mac, statUrl, '');

      // 使用 fetch 调用七牛云统计 API
      const response = await fetch(statUrl, {
        method: 'GET',
        headers: {
          Authorization: `QBox ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // 根据七牛云 API 响应格式解析流量数据
        // 注意：实际响应格式可能需要根据七牛云文档调整
        const traffic = data.traffic || data.flow || 0;

        return {
          used: traffic,
          usedFormatted: this.formatBytes(traffic),
        };
      } else {
        this.logger.warn(`获取七牛云流量信息失败: ${response.status} ${response.statusText}`);
        return {
          note: '流量统计需要相应的 API 权限，当前无法获取',
        };
      }
    } catch (error) {
      this.logger.error(`获取七牛云流量信息异常: ${error.message}`);
      return {
        note: '流量统计获取失败，可能需要相应的 API 权限',
      };
    }
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
