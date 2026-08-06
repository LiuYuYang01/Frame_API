import { Injectable, Logger } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { QiniuConfig, getQiniuUploadUrl } from './config';
import { EnvConfigService } from '@/web/env_config/service';
import {
  DEFAULT_SLIM_MAX_LONG_EDGE,
  DEFAULT_SLIM_QUALITY,
  PFOP_MAX_WAIT_MS,
  PFOP_POLL_INTERVAL_MS,
} from '@/constants/image_slim';
import { stripImageProcessing } from '@/utils/image';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface QiniuSdkContext {
  qiniuConfig: QiniuConfig;
  mac: qiniu.auth.digest.Mac;
  config: qiniu.conf.Config;
  bucketManager: qiniu.rs.BucketManager;
}

interface QiniuSdkResponse {
  data: any;
  resp: { statusCode: number };
}

interface PfopStatus {
  code: number;
  desc: string;
  items?: Array<{ code: number; desc: string; error?: string }>;
}

export interface SlimImageOptions {
  maxLongEdge?: number;
  quality?: number;
  pipeline?: string;
}

@Injectable()
export class QiniuService {
  private readonly logger = new Logger(QiniuService.name);

  constructor(private readonly envConfigService: EnvConfigService) {}

  private async getSdkContext(): Promise<QiniuSdkContext> {
    const qiniuConfig = await this.envConfigService.getQiniuStorageConfigAsync();
    const mac = new qiniu.auth.digest.Mac(qiniuConfig.accessKey, qiniuConfig.secretKey);
    const config = new qiniu.conf.Config();
    const zone = (qiniu.zone as Record<string, qiniu.conf.Zone>)[qiniuConfig.zone];
    config.zone = zone;

    return {
      qiniuConfig,
      mac,
      config,
      bucketManager: new qiniu.rs.BucketManager(mac, config),
    };
  }

  private createUploadToken(mac: qiniu.auth.digest.Mac, bucket: string, key?: string): string {
    const options = {
      scope: key ? `${bucket}:${key}` : bucket,
      expires: 3600,
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    return putPolicy.uploadToken(mac);
  }

  private isFormattedQiniuError(error: Error): boolean {
    return error.message.startsWith('七牛云') || error.message.includes('未配置') || error.message.includes('配置无效');
  }

  private handleQiniuFailure(action: string, error: unknown): never {
    if (error instanceof Error && this.isFormattedQiniuError(error)) {
      this.logger.error(`${action}失败: ${error.message}`);
      throw error;
    }

    const formatted = this.formatQiniuError(action, {
      err: error instanceof Error ? error : new Error(String(error)),
    });
    this.logger.error(`${action}失败: ${formatted.message}`);
    throw formatted;
  }

  private assertSuccess(action: string, statusCode: number, respBody?: unknown): void {
    if (statusCode === 200) {
      return;
    }
    throw this.formatQiniuError(action, { statusCode, respBody });
  }

  async uploadFile(localFile: string, key?: string): Promise<{ hash: string; key: string }> {
    const { qiniuConfig, mac, config } = await this.getSdkContext();

    if (!key) {
      key = this.buildObjectKey(localFile);
    }

    const token = this.createUploadToken(mac, qiniuConfig.bucket, key);
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    try {
      const { data, resp } = (await formUploader.putFile(token, key, localFile, putExtra)) as QiniuSdkResponse;
      this.assertSuccess('上传文件', resp.statusCode, data);
      this.logger.log(`文件上传成功: ${key}`);
      return {
        hash: data.hash,
        key: data.key,
      };
    } catch (error) {
      this.handleQiniuFailure('上传文件', error);
    }
  }

  async delFile(key: string): Promise<void> {
    const { qiniuConfig, bucketManager } = await this.getSdkContext();

    try {
      const { resp } = (await bucketManager.delete(qiniuConfig.bucket, key)) as QiniuSdkResponse;
      this.assertSuccess('删除文件', resp.statusCode);
      this.logger.log(`文件删除成功: ${key}`);
    } catch (error) {
      this.handleQiniuFailure('删除文件', error);
    }
  }

  async getFileInfo(key: string): Promise<{
    fsize: number;
    hash: string;
    mimeType: string;
    putTime: number;
    type: number;
  }> {
    const { qiniuConfig, bucketManager } = await this.getSdkContext();

    try {
      const { data, resp } = (await bucketManager.stat(qiniuConfig.bucket, key)) as QiniuSdkResponse;
      this.assertSuccess('获取文件信息', resp.statusCode, data);
      this.logger.log(`获取文件信息成功: ${key}`);
      return data;
    } catch (error) {
      this.handleQiniuFailure('获取文件信息', error);
    }
  }

  async getPublicDownloadUrl(key: string): Promise<string> {
    const { qiniuConfig } = await this.getSdkContext();
    return `${qiniuConfig.domain}/${key}`;
  }

  extractKeyFromUrl(url: string): string {
    const cleanUrl = stripImageProcessing(url);
    const parsed = new URL(cleanUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  }

  buildTempSlimKey(key: string): string {
    return `${key}.frame.slim.tmp`;
  }

  async slimImageByPfop(
    key: string,
    options: SlimImageOptions = {},
  ): Promise<{ fsize: number; hash: string; mimeType: string }> {
    const maxLongEdge = options.maxLongEdge ?? DEFAULT_SLIM_MAX_LONG_EDGE;
    const quality = options.quality ?? DEFAULT_SLIM_QUALITY;
    const pipeline = options.pipeline ?? '';
    const { qiniuConfig, mac, config } = await this.getSdkContext();
    const bucket = qiniuConfig.bucket;
    const tempKey = this.buildTempSlimKey(key);
    const saveasEntry = qiniu.util.urlsafeBase64Encode(`${bucket}:${tempKey}`);
    const fops = [
      `imageMogr2/auto-orient/thumbnail/${maxLongEdge}x${maxLongEdge}>/strip/quality/${quality}/format/jpg|saveas/${saveasEntry}`,
    ];

    await this.deleteFileIfExists(tempKey);

    const opManager = new qiniu.fop.OperationManager(mac, config);
    const { persistentId } = await this.runPfop(opManager, bucket, key, fops, pipeline);
    await this.waitPfop(opManager, persistentId);

    try {
      await this.moveFile(bucket, tempKey, bucket, key, true);
    } catch (error) {
      await this.deleteFileIfExists(tempKey);
      throw error;
    }

    const stat = await this.getFileInfo(key);
    return {
      fsize: stat.fsize,
      hash: stat.hash,
      mimeType: stat.mimeType,
    };
  }

  private async runPfop(
    opManager: qiniu.fop.OperationManager,
    bucket: string,
    key: string,
    fops: string[],
    pipeline: string,
  ): Promise<{ persistentId: string }> {
    return new Promise((resolve, reject) => {
      opManager.pfop(bucket, key, fops, pipeline, null, (err, body, respInfo) => {
        if (err) {
          reject(err);
          return;
        }
        if (!respInfo || respInfo.statusCode !== 200) {
          reject(this.formatQiniuError('持久化图片处理', { statusCode: respInfo?.statusCode, respBody: body }));
          return;
        }
        if (!body?.persistentId) {
          reject(new Error('七牛云未返回持久化处理 ID'));
          return;
        }
        resolve({ persistentId: body.persistentId });
      });
    });
  }

  private async waitPfop(opManager: qiniu.fop.OperationManager, persistentId: string): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < PFOP_MAX_WAIT_MS) {
      const status = await this.queryPfop(opManager, persistentId);

      // 七牛 prefop 状态码：0 成功，1 等待处理，2 正在处理，3 处理失败，4 回调失败
      if (status.code === 0) {
        const failedItem = status.items?.find((item) => item.code !== 0);
        if (failedItem) {
          throw new Error(failedItem.error || failedItem.desc || '七牛云图片处理失败');
        }
        return;
      }

      if (status.code === 1 || status.code === 2) {
        await this.sleep(PFOP_POLL_INTERVAL_MS);
        continue;
      }

      if (status.code === 3) {
        const failedItem = status.items?.find((item) => item.error || item.code === 3);
        throw new Error(failedItem?.error || status.desc || '七牛云图片处理失败');
      }

      if (status.code === 4) {
        const failedItem = status.items?.find((item) => item.code !== 0);
        if (failedItem) {
          throw new Error(failedItem.error || failedItem.desc || status.desc || '七牛云图片处理失败');
        }
        return;
      }

      await this.sleep(PFOP_POLL_INTERVAL_MS);
    }

    throw new Error('七牛云图片处理超时，请稍后重试');
  }

  private queryPfop(opManager: qiniu.fop.OperationManager, persistentId: string): Promise<PfopStatus> {
    return new Promise((resolve, reject) => {
      opManager.prefop(persistentId, (err, body, respInfo) => {
        if (err) {
          reject(err);
          return;
        }
        if (!respInfo || respInfo.statusCode !== 200) {
          reject(this.formatQiniuError('查询持久化处理进度', { statusCode: respInfo?.statusCode, respBody: body }));
          return;
        }
        resolve(body as PfopStatus);
      });
    });
  }

  async moveFile(
    srcBucket: string,
    srcKey: string,
    destBucket: string,
    destKey: string,
    force = false,
  ): Promise<void> {
    const { bucketManager } = await this.getSdkContext();

    return new Promise((resolve, reject) => {
      bucketManager.move(srcBucket, srcKey, destBucket, destKey, { force }, (err, _body, respInfo) => {
        if (err) {
          reject(err);
          return;
        }
        if (!respInfo || respInfo.statusCode !== 200) {
          reject(this.formatQiniuError('移动文件', { statusCode: respInfo?.statusCode }));
          return;
        }
        resolve();
      });
    });
  }

  private async deleteFileIfExists(key: string): Promise<void> {
    try {
      await this.delFile(key);
    } catch {
      // 临时文件不存在时忽略
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getDirectUploadCredentials(key: string): Promise<{
    uploadToken: string;
    key: string;
    uploadUrl: string;
  }> {
    const { qiniuConfig, mac } = await this.getSdkContext();
    const uploadToken = this.createUploadToken(mac, qiniuConfig.bucket, key);

    return {
      uploadToken,
      key,
      uploadUrl: getQiniuUploadUrl(qiniuConfig.zone),
    };
  }

  /** 生成 10 位随机对象名（小写字母+数字） */
  generateRandomObjectName(length = 10): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /** 对象 key：10 位随机值 + 原扩展名 */
  buildObjectKey(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    return `${this.generateRandomObjectName()}${ext}`;
  }

  /** 校验对象 key 是否为「10 位随机名 + 与 fileName 一致的扩展名」 */
  isValidObjectKey(fileName: string, key: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    if (!ext || path.extname(key).toLowerCase() !== ext) {
      return false;
    }
    const baseName = path.basename(key, path.extname(key));
    return /^[0-9a-z]{10}$/.test(baseName);
  }

  async getImageInfo(url: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    colorModel: string;
  } | null> {
    try {
      const imageInfoUrl = `${url}?imageInfo`;
      const response = await fetch(imageInfoUrl);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`获取图片信息失败: ${response.status} ${response.statusText}, 响应内容: ${errorText}`);
        return null;
      }

      const info = JSON.parse(await response.text());
      return {
        width: info.width,
        height: info.height,
        format: info.format,
        size: info.size,
        colorModel: info.colorModel,
      };
    } catch (error) {
      this.logger.error(`获取图片信息失败: ${error.message}, 错误栈: ${error.stack}`);
      return null;
    }
  }

  async uploadFileByChunks(localFile: string, key?: string, resumeRecordFile?: string): Promise<{ hash: string; key: string }> {
    const { qiniuConfig, mac, config } = await this.getSdkContext();

    if (!key) {
      key = this.buildObjectKey(localFile);
    }

    const token = this.createUploadToken(mac, qiniuConfig.bucket, key);
    const resumeUploader = new qiniu.resume_up.ResumeUploader(config);
    const putExtra = new qiniu.resume_up.PutExtra();

    if (resumeRecordFile) {
      putExtra.resumeRecordFile = resumeRecordFile;
    }

    try {
      const { data, resp } = (await resumeUploader.putFile(token, key, localFile, putExtra)) as QiniuSdkResponse;
      this.assertSuccess('上传文件', resp.statusCode, data);
      this.logger.log(`分片上传成功: ${key}, hash: ${data.hash}`);
      return {
        hash: data.hash,
        key: data.key,
      };
    } catch (error) {
      this.handleQiniuFailure('上传文件', error);
    }
  }

  async uploadChunk(
    chunkData: Buffer,
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fileSize: number,
  ): Promise<{ uploaded: number[]; completed: boolean; key?: string; hash?: string }> {
    const tempDir = path.join(process.cwd(), 'temp', 'chunks', uploadId);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    await fs.promises.writeFile(chunkPath, chunkData);

    let finalKey = key;
    if (!finalKey || finalKey.trim() === '') {
      finalKey = `${uploadId}.tmp`;
    }

    const uploadedChunks: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(tempDir, `chunk_${i}`);
      if (await this.fileExists(chunkFile)) {
        uploadedChunks.push(i);
      }
    }

    if (uploadedChunks.length === totalChunks) {
      try {
        const mergedFilePath = path.join(tempDir, 'merged');
        const writeStream = fs.createWriteStream(mergedFilePath);

        for (let i = 0; i < totalChunks; i++) {
          const chunkFile = path.join(tempDir, `chunk_${i}`);
          const chunkBuffer = await fs.promises.readFile(chunkFile);
          writeStream.write(chunkBuffer);
        }
        writeStream.end();

        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const resumeRecordFile = path.join(tempDir, 'resume_record');
        const uploadResult = await this.uploadFileByChunks(mergedFilePath, finalKey, resumeRecordFile);
        await fs.promises.rm(tempDir, { recursive: true, force: true });

        return {
          uploaded: uploadedChunks,
          completed: true,
          key: uploadResult.key,
          hash: uploadResult.hash,
        };
      } catch (error) {
        this.logger.error(`合并分片失败: ${error.message}`);
        throw error;
      }
    }

    return {
      uploaded: uploadedChunks,
      completed: false,
    };
  }

  private formatQiniuError(
    action: string,
    options: { err?: Error; statusCode?: number; respBody?: unknown },
  ): Error {
    const { err, statusCode, respBody } = options;

    if (err?.message) {
      return new Error(this.resolveQiniuMessage(err.message));
    }

    const bodyError = this.extractResponseError(respBody);
    const statusHint = statusCode !== undefined ? this.getStatusCodeHint(statusCode) : undefined;

    if (statusHint) {
      return new Error(bodyError ? `${statusHint}（${bodyError}）` : statusHint);
    }

    if (statusCode !== undefined) {
      return new Error(bodyError ? `${action}失败（HTTP ${statusCode}：${bodyError}）` : `${action}失败（HTTP ${statusCode}）`);
    }

    return new Error(`${action}失败`);
  }

  private resolveQiniuMessage(sdkMessage: string): string {
    if (sdkMessage.includes('app/accesskey is not found')) {
      return '七牛云 AccessKey 不存在，请检查管理端系统配置';
    }
    return sdkMessage;
  }

  private getStatusCodeHint(statusCode: number): string | undefined {
    const hints: Record<number, string> = {
      401: '七牛云密钥认证失败，请检查管理端系统配置中的 AccessKey 和 SecretKey',
      403: '七牛云无权限执行此操作',
      404: '文件在七牛云中不存在',
      612: '文件在七牛云中不存在，请确认 Bucket 与照片 URL 所属存储空间一致',
      631: '七牛云存储空间不存在，请检查管理端系统配置中的 Bucket',
    };
    return hints[statusCode];
  }

  private extractResponseError(respBody: unknown): string | undefined {
    if (!respBody || typeof respBody !== 'object') {
      return undefined;
    }
    const error = (respBody as { error?: string }).error;
    return typeof error === 'string' ? error : undefined;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async checkFileByHash(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hash: string,
  ): Promise<{ key: string; fsize: number; mimeType: string } | null> {
    return Promise.resolve(null);
  }

  async getUploadProgress(uploadId: string): Promise<number[]> {
    const tempDir = path.join(process.cwd(), 'temp', 'chunks', uploadId);
    const uploadedChunks: number[] = [];

    try {
      const files = await fs.promises.readdir(tempDir);
      for (const file of files) {
        if (file.startsWith('chunk_')) {
          const chunkIndex = parseInt(file.replace('chunk_', ''), 10);
          if (!isNaN(chunkIndex)) {
            uploadedChunks.push(chunkIndex);
          }
        }
      }
    } catch {
      return [];
    }

    return uploadedChunks.sort((a, b) => a - b);
  }

  async cancelUpload(uploadId: string): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp', 'chunks', uploadId);
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      this.logger.log(`已取消上传并清理临时文件: ${uploadId}`);
    } catch (error) {
      this.logger.error(`清理临时文件失败: ${error.message}`);
    }
  }
}
