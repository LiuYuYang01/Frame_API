import { Injectable, Logger } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { QiniuConfig } from './config';
import { EnvConfigService } from '@/web/env_config/service';
import * as path from 'path';
import * as fs from 'fs';

interface QiniuSdkContext {
  qiniuConfig: QiniuConfig;
  mac: qiniu.auth.digest.Mac;
  config: qiniu.conf.Config;
  bucketManager: qiniu.rs.BucketManager;
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
    if (zone) {
      config.zone = zone;
    } else {
      this.logger.warn(`未识别的七牛云区域配置: ${qiniuConfig.zone}，将使用 SDK 动态区域查询`);
    }

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

  /**
   * 上传文件
   */
  async uploadFile(localFile: string, key?: string): Promise<{ hash: string; key: string }> {
    const { qiniuConfig, mac, config } = await this.getSdkContext();

    if (!key) {
      const ext = path.extname(localFile);
      key = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    }

    const token = this.createUploadToken(mac, qiniuConfig.bucket, key);
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    return new Promise((resolve, reject) => {
      this.swallowSdkPromiseRejection(
        formUploader.putFile(
          token,
          key,
          localFile,
          putExtra,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: Error | undefined, body: any, info: any) => {
            if (err) {
              const formatted = this.formatQiniuError('上传文件', { err });
              this.logger.error(`文件上传失败: ${formatted.message}`);
              reject(formatted);
              return;
            }

            if (info.statusCode === 200) {
              this.logger.log(`文件上传成功: ${key}`);
              resolve({
                hash: body.hash,
                key: body.key,
              });
            } else {
              const formatted = this.formatQiniuError('上传文件', { statusCode: info.statusCode, respBody: body });
              this.logger.error(`文件上传失败: ${formatted.message}`);
              reject(formatted);
            }
          },
        ),
      );
    });
  }

  /**
   * 删除文件
   */
  async delFile(key: string): Promise<void> {
    const { qiniuConfig, bucketManager } = await this.getSdkContext();

    return new Promise((resolve, reject) => {
      this.swallowSdkPromiseRejection(
        bucketManager.delete(
          qiniuConfig.bucket,
          key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: Error | undefined, respBody: any, respInfo: any) => {
            if (err) {
              const formatted = this.formatQiniuError('删除文件', { err });
              this.logger.error(`文件删除失败: ${formatted.message}`);
              reject(formatted);
              return;
            }

            if (respInfo.statusCode === 200) {
              this.logger.log(`文件删除成功: ${key}`);
              resolve();
            } else {
              const formatted = this.formatQiniuError('删除文件', {
                statusCode: respInfo.statusCode,
                respBody,
              });
              this.logger.error(`文件删除失败: ${formatted.message}`);
              reject(formatted);
            }
          },
        ),
      );
    });
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key: string): Promise<{
    fsize: number;
    hash: string;
    mimeType: string;
    putTime: number;
    type: number;
  }> {
    const { qiniuConfig, bucketManager } = await this.getSdkContext();

    return new Promise((resolve, reject) => {
      this.swallowSdkPromiseRejection(
        bucketManager.stat(
          qiniuConfig.bucket,
          key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: Error | undefined, respBody: any, respInfo: any) => {
            if (err) {
              const formatted = this.formatQiniuError('获取文件信息', { err });
              this.logger.error(`获取文件信息失败: ${formatted.message}`);
              reject(formatted);
              return;
            }

            if (respInfo.statusCode === 200) {
              this.logger.log(`获取文件信息成功: ${key}`);
              resolve(respBody);
            } else {
              const formatted = this.formatQiniuError('获取文件信息', {
                statusCode: respInfo.statusCode,
                respBody,
              });
              this.logger.error(`获取文件信息失败: ${formatted.message}`);
              reject(formatted);
            }
          },
        ),
      );
    });
  }

  /**
   * 生成公开空间访问链接
   */
  async getPublicDownloadUrl(key: string): Promise<string> {
    const { qiniuConfig } = await this.getSdkContext();
    return `${qiniuConfig.domain}/${key}`;
  }

  /**
   * 获取图片信息（宽高等）
   */
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

  /**
   * 分片上传文件（支持断点续传）
   */
  async uploadFileByChunks(localFile: string, key?: string, resumeRecordFile?: string): Promise<{ hash: string; key: string }> {
    const { qiniuConfig, mac, config } = await this.getSdkContext();

    if (!key) {
      const ext = path.extname(localFile);
      key = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    }

    const token = this.createUploadToken(mac, qiniuConfig.bucket, key);
    const resumeUploader = new qiniu.resume_up.ResumeUploader(config);
    const putExtra = new qiniu.resume_up.PutExtra();

    if (resumeRecordFile) {
      putExtra.resumeRecordFile = resumeRecordFile;
    }

    return new Promise((resolve, reject) => {
      this.swallowSdkPromiseRejection(
        resumeUploader.putFile(
          token,
          key,
          localFile,
          putExtra,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: Error | undefined, body: any, info: any) => {
            if (err) {
              const formatted = this.formatQiniuError('上传文件', { err });
              this.logger.error(`分片上传失败: ${formatted.message}`);
              reject(formatted);
              return;
            }

            if (info.statusCode === 200) {
              this.logger.log(`分片上传成功: ${key}, hash: ${body.hash}`);
              resolve({
                hash: body.hash,
                key: body.key,
              });
            } else {
              const formatted = this.formatQiniuError('上传文件', { statusCode: info.statusCode, respBody: body });
              this.logger.error(`分片上传失败: ${formatted.message}`);
              reject(formatted);
            }
          },
        ),
      );
    });
  }

  /**
   * 上传文件分片（用于前端分片上传）
   */
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
      return '七牛云 AccessKey 不存在，请检查后台配置';
    }
    if (sdkMessage.includes('Query regions failed')) {
      return '七牛云配置有误，请检查 AccessKey、Bucket 和区域（Zone）设置';
    }
    return sdkMessage;
  }

  private getStatusCodeHint(statusCode: number): string | undefined {
    const hints: Record<number, string> = {
      401: '七牛云密钥认证失败，请检查 AccessKey 和 SecretKey',
      403: '七牛云无权限执行此操作',
      404: '文件在七牛云中不存在',
      612: '七牛云 AccessKey 不存在，请检查后台配置',
      631: '七牛云存储空间不存在，请检查 Bucket 配置',
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

  private swallowSdkPromiseRejection(promise: Promise<unknown>): void {
    void promise.catch(() => {});
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
