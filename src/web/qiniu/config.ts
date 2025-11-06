export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  zone: string;
}

export const qiniuConfig: QiniuConfig = {
  accessKey:
    process.env.QINIU_ACCESS_KEY || 'ga4bLt2LD1T-hP6sqf3QG3N9bSwfYWwP-fVcv9n6',
  secretKey:
    process.env.QINIU_SECRET_KEY || '-1yPaVCWQP1P5SjwmITo5yMWe2LEp_6ohpxsRp8z',
  bucket: process.env.QINIU_BUCKET || 'liuyuyang',
  domain:
    process.env.QINIU_DOMAIN || 'http(s)://liuyuyang.s3.cn-south-1.qiniucs.com',
  zone: process.env.QINIU_ZONE || 'Zone_z2',
};
