import { ConfigService } from '@nestjs/config';

export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  zone: string;
}

/**
 * 从环境变量创建七牛云配置
 * @param configService ConfigService 实例
 * @returns QiniuConfig 配置对象
 * @throws Error 如果必需的环境变量未设置
 */
export function createQiniuConfig(configService: ConfigService): QiniuConfig {
  const accessKey = configService.get<string>('QINIU_ACCESS_KEY');
  const secretKey = configService.get<string>('QINIU_SECRET_KEY');
  const bucket = configService.get<string>('QINIU_BUCKET');
  const domain = configService.get<string>('QINIU_DOMAIN');
  const zone = configService.get<string>('QINIU_ZONE');

  if (!accessKey) {
    throw new Error('环境变量 QINIU_ACCESS_KEY 未设置');
  }
  if (!secretKey) {
    throw new Error('环境变量 QINIU_SECRET_KEY 未设置');
  }
  if (!bucket) {
    throw new Error('环境变量 QINIU_BUCKET 未设置');
  }
  if (!domain) {
    throw new Error('环境变量 QINIU_DOMAIN 未设置');
  }
  if (!zone) {
    throw new Error('环境变量 QINIU_ZONE 未设置');
  }

  return {
    accessKey,
    secretKey,
    bucket,
    domain,
    zone,
  };
}
