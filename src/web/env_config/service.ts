import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvConfig } from '@/entity/env_config';
import { CustomException } from '@/execption/global_exception_handler';

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
}
