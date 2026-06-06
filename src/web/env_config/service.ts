import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvConfig } from '@/entity/env_config';
import { CustomException } from '@/execption/global_exception_handler';
import {
  loadQiniuConfigFromEnv,
  mapEnvValueToQiniuConfig,
  QiniuConfig,
  QiniuStorageEnvValue,
} from '@/web/upload/config';

export interface BaiduStatisConfig {
  site_id: number;
  access_token: string;
}

@Injectable()
export class EnvConfigService implements OnModuleInit {
  private readonly logger = new Logger(EnvConfigService.name);

  constructor(
    @InjectRepository(EnvConfig)
    private readonly envConfigRepository: Repository<EnvConfig>,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    await this.ensureDefaultConfigs();
  }

  private async ensureDefaultConfigs() {
    const defaults: Array<{ name: string; value: Record<string, unknown>; notes: string }> = [
      {
        name: 'baidu_statis',
        value: { site_id: 0, access_token: '' },
        notes: '百度统计配置',
      },
      {
        name: 'qiniu_storage',
        value: {
          access_key: this.configService.get<string>('QINIU_ACCESS_KEY') || '',
          secret_key: this.configService.get<string>('QINIU_SECRET_KEY') || '',
          bucket_name: this.configService.get<string>('QINIU_BUCKET') || '',
          domain: this.configService.get<string>('QINIU_DOMAIN') || '',
          zone: this.configService.get<string>('QINIU_ZONE') || 'Zone_z2',
        },
        notes: '七牛云存储配置',
      },
    ];

    for (const item of defaults) {
      const existing = await this.getByName(item.name);
      if (!existing) {
        await this.envConfigRepository.save(item);
        this.logger.log(`已初始化配置项: ${item.name}`);
      }
    }
  }

  async list() {
    return this.envConfigRepository.find({ order: { id: 'ASC' } });
  }

  async getByName(name: string) {
    return this.envConfigRepository.findOne({ where: { name } });
  }

  async updateJsonValue(id: number, value: Record<string, unknown>) {
    const config = await this.envConfigRepository.findOne({ where: { id } });
    if (!config) {
      throw new CustomException(400, '配置不存在');
    }
    config.value = value;
    await this.envConfigRepository.save(config);
    return true;
  }

  async getBaiduStatisConfigAsync(): Promise<BaiduStatisConfig> {
    const config = await this.getByName('baidu_statis');
    if (!config?.value) {
      return { site_id: 0, access_token: '' };
    }
    return {
      site_id: Number(config.value.site_id) || 0,
      access_token: String(config.value.access_token || ''),
    };
  }

  async getQiniuStorageEnvValueAsync(): Promise<QiniuStorageEnvValue> {
    const config = await this.getByName('qiniu_storage');
    const envFallback = loadQiniuConfigFromEnv(this.configService);
    const value = config?.value ?? {};

    return {
      access_key: String(value.access_key || envFallback?.accessKey || ''),
      secret_key: String(value.secret_key || envFallback?.secretKey || ''),
      bucket_name: String(value.bucket_name || envFallback?.bucket || ''),
      domain: String(value.domain || envFallback?.domain || ''),
      zone: String(value.zone || envFallback?.zone || 'Zone_z2'),
    };
  }

  async getQiniuStorageConfigAsync(): Promise<QiniuConfig> {
    const envValue = await this.getQiniuStorageEnvValueAsync();
    const qiniuConfig = mapEnvValueToQiniuConfig(envValue);

    if (!qiniuConfig.accessKey) {
      throw new CustomException(500, '七牛云 AccessKey 未配置，请在管理端系统配置中填写');
    }
    if (!qiniuConfig.secretKey) {
      throw new CustomException(500, '七牛云 SecretKey 未配置，请在管理端系统配置中填写');
    }
    if (!qiniuConfig.bucket) {
      throw new CustomException(500, '七牛云存储桶未配置，请在管理端系统配置中填写');
    }
    if (!qiniuConfig.domain) {
      throw new CustomException(500, '七牛云访问域名未配置，请在管理端系统配置中填写');
    }
    if (!qiniuConfig.zone) {
      throw new CustomException(500, '七牛云区域未配置，请在管理端系统配置中填写');
    }

    return qiniuConfig;
  }
}
