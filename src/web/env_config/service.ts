import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvConfig } from '@/entity/env_config';
import { CustomException } from '@/execption/global_exception_handler';
import {
  isValidQiniuZone,
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
          access_key: '',
          secret_key: '',
          bucket_name: '',
          domain: '',
          zone: 'Zone_z2',
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
    const value = config?.value ?? {};

    return {
      access_key: String(value.access_key || ''),
      secret_key: String(value.secret_key || ''),
      bucket_name: String(value.bucket_name || ''),
      domain: String(value.domain || ''),
      zone: String(value.zone || 'Zone_z2'),
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
    if (!isValidQiniuZone(qiniuConfig.zone)) {
      throw new CustomException(500, `七牛云区域配置无效: ${qiniuConfig.zone}，请在管理端系统配置中修改`);
    }

    return qiniuConfig;
  }
}
