import { ConfigService } from '@nestjs/config';

export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  zone: string;
}

export interface QiniuStorageEnvValue {
  access_key: string;
  secret_key: string;
  bucket_name: string;
  domain: string;
  zone: string;
}

export function normalizeQiniuDomain(domain: string): string {
  let value = domain.trim();
  if (!value) {
    return value;
  }
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`;
  }
  if (value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

export function mapEnvValueToQiniuConfig(value: QiniuStorageEnvValue): QiniuConfig {
  return {
    accessKey: value.access_key.trim(),
    secretKey: value.secret_key.trim(),
    bucket: value.bucket_name.trim(),
    domain: normalizeQiniuDomain(value.domain),
    zone: value.zone.trim(),
  };
}

export function loadQiniuConfigFromEnv(configService: ConfigService): QiniuConfig | null {
  const accessKey = configService.get<string>('QINIU_ACCESS_KEY')?.trim();
  const secretKey = configService.get<string>('QINIU_SECRET_KEY')?.trim();
  const bucket = configService.get<string>('QINIU_BUCKET')?.trim();
  const domain = configService.get<string>('QINIU_DOMAIN')?.trim();
  const zone = configService.get<string>('QINIU_ZONE')?.trim();

  if (!accessKey || !secretKey || !bucket || !domain || !zone) {
    return null;
  }

  return {
    accessKey,
    secretKey,
    bucket,
    domain: normalizeQiniuDomain(domain),
    zone,
  };
}
