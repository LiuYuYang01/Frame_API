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

export const QINIU_ZONE_OPTIONS = [
  'Zone_z0',
  'Zone_cn_east_2',
  'Zone_z1',
  'Zone_z2',
  'Zone_na0',
  'Zone_as0',
] as const;

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

export function isValidQiniuZone(zone: string): boolean {
  return QINIU_ZONE_OPTIONS.includes(zone as (typeof QINIU_ZONE_OPTIONS)[number]);
}
