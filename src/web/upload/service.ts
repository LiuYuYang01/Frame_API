import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qiniu from 'qiniu';
import { createQiniuConfig, QiniuConfig } from './config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class QiniuService {
  private readonly logger = new Logger(QiniuService.name);
  private readonly qiniuConfig: QiniuConfig;
  private mac: qiniu.auth.digest.Mac;
  private config: qiniu.conf.Config;
  private bucketManager: qiniu.rs.BucketManager;

  constructor(private readonly configService: ConfigService) {
    // 从环境变量初始化七牛云配置
    this.qiniuConfig = createQiniuConfig(this.configService);
    this.mac = new qiniu.auth.digest.Mac(this.qiniuConfig.accessKey, this.qiniuConfig.secretKey);

    this.config = new qiniu.conf.Config();
    // 根据配置设置区域
    // this.config.zone = qiniu.zone[this.qiniuConfig.zone];

    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
  }

  /**
   * 生成上传凭证
   * @param key 文件key
   * @returns 上传凭证
   */
  getUploadToken(key?: string): string {
    const options = {
      scope: key ? `${this.qiniuConfig.bucket}:${key}` : this.qiniuConfig.bucket,
      expires: 3600, // 1小时过期
    };

    const putPolicy = new qiniu.rs.PutPolicy(options);
    return putPolicy.uploadToken(this.mac);
  }

  /**
   * 上传文件
   * @param localFile 本地文件路径
   * @param key 保存到七牛云的文件名
   * @returns Promise
   */
  async uploadFile(localFile: string, key?: string): Promise<{ hash: string; key: string }> {
    return new Promise((resolve, reject) => {
      // 生成文件名（如果未指定）
      if (!key) {
        const ext = path.extname(localFile);
        key = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
      }

      const token = this.getUploadToken(key);
      const formUploader = new qiniu.form_up.FormUploader(this.config);
      const putExtra = new qiniu.form_up.PutExtra();

      void formUploader.putFile(
        token,
        key,
        localFile,
        putExtra,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, body: any, info: any) => {
          if (err) {
            this.logger.error(`文件上传失败: ${err.message}`);
            reject(err);
            return;
          }

          if (info.statusCode === 200) {
            this.logger.log(`文件上传成功: ${key}`);
            resolve({
              hash: body.hash,

              key: body.key,
            });
          } else {
            this.logger.error(`文件上传失败: ${info.statusCode}`);

            reject(new Error(`上传失败: ${info.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 删除文件
   * @param key 文件key
   * @returns Promise
   */
  async delFile(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.delete(
        this.qiniuConfig.bucket,
        key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, respBody: any, respInfo: any) => {
          if (err) {
            this.logger.error(`文件删除失败: ${err.message}`);
            reject(err);
            return;
          }

          if (respInfo.statusCode === 200) {
            this.logger.log(`文件删除成功: ${key}`);
            resolve();
          } else {
            this.logger.error(`文件删除失败: ${respInfo.statusCode}`);

            reject(new Error(`删除失败: ${respInfo.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 获取文件信息
   * @param key 文件key
   * @returns Promise
   */
  async getFileInfo(key: string): Promise<{
    fsize: number;
    hash: string;
    mimeType: string;
    putTime: number;
    type: number;
  }> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.stat(
        this.qiniuConfig.bucket,
        key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, respBody: any, respInfo: any) => {
          if (err) {
            this.logger.error(`获取文件信息失败: ${err.message}`);
            reject(err);
            return;
          }

          if (respInfo.statusCode === 200) {
            this.logger.log(`获取文件信息成功: ${key}`);

            resolve(respBody);
          } else {
            this.logger.error(`获取文件信息失败: ${respInfo.statusCode}`);

            reject(new Error(`获取文件信息失败: ${respInfo.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 生成公开空间访问链接
   * @param key 文件key
   * @returns 访问链接
   */
  getPublicDownloadUrl(key: string): string {
    return `${this.qiniuConfig.domain}/${key}`;
  }

  /**
   * 获取图片信息（宽高等）
   * @param url 图片URL
   * @returns Promise
   */
  async getImageInfo(url: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    colorModel: string;
  } | null> {
    try {
      // 使用七牛云的图片信息接口
      const imageInfoUrl = `${url}?imageInfo`;

      // 使用 fetch 或其他 HTTP 客户端获取图片信息
      const response = await fetch(imageInfoUrl);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`获取图片信息失败: ${response.status} ${response.statusText}, 响应内容: ${errorText}`);
        return null;
      }

      const responseText = await response.text();

      const info = JSON.parse(responseText);

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
   * @param localFile 本地文件路径
   * @param key 保存到七牛云的文件名
   * @param resumeRecordFile 断点续传记录文件路径（可选）
   * @returns Promise
   */
  async uploadFileByChunks(localFile: string, key?: string, resumeRecordFile?: string): Promise<{ hash: string; key: string }> {
    return new Promise((resolve, reject) => {
      // 生成文件名（如果未指定）
      if (!key) {
        const ext = path.extname(localFile);
        key = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
      }

      const token = this.getUploadToken(key);
      const resumeUploader = new qiniu.resume_up.ResumeUploader(this.config);
      const putExtra = new qiniu.resume_up.PutExtra();

      // 设置断点续传记录文件
      if (resumeRecordFile) {
        putExtra.resumeRecordFile = resumeRecordFile;
      }

      void resumeUploader.putFile(
        token,
        key,
        localFile,
        putExtra,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, body: any, info: any) => {
          if (err) {
            this.logger.error(`分片上传失败: ${err.message}`);
            reject(err);
            return;
          }

          if (info.statusCode === 200) {
            this.logger.log(`分片上传成功: ${key}, hash: ${body.hash}`);
            resolve({
              hash: body.hash,
              key: body.key,
            });
          } else {
            this.logger.error(`分片上传失败: ${info.statusCode}`);
            reject(new Error(`上传失败: ${info.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 上传文件分片（用于前端分片上传）
   * @param chunkData 分片数据（Buffer）
   * @param uploadId 上传ID（用于标识同一个文件的上传会话）
   * @param chunkIndex 分片索引（从0开始）
   * @param totalChunks 总分片数
   * @param key 文件key
   * @param fileSize 文件总大小
   * @returns Promise 返回已上传的分片信息
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

    // 如果 key 为空，生成一个基于 uploadId 的 key
    let finalKey = key;
    if (!finalKey || finalKey.trim() === '') {
      finalKey = `${uploadId}.tmp`;
    }

    // 检查是否所有分片都已上传
    const uploadedChunks: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(tempDir, `chunk_${i}`);
      if (await this.fileExists(chunkFile)) {
        uploadedChunks.push(i);
      }
    }

    // 如果所有分片都已上传，合并并上传到七牛云
    if (uploadedChunks.length === totalChunks) {
      try {
        // 合并分片
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

        // 上传合并后的文件
        const resumeRecordFile = path.join(tempDir, 'resume_record');
        const uploadResult = await this.uploadFileByChunks(mergedFilePath, finalKey, resumeRecordFile);

        // 清理临时文件
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

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 通过 hash 检查文件是否已存在于七牛云
   * @param _hash 文件hash（etag）
   * @returns Promise 如果存在返回文件信息，否则返回null
   */

  async checkFileByHash(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hash: string,
  ): Promise<{ key: string; fsize: number; mimeType: string } | null> {
    // 七牛云不直接支持通过hash查询，需要通过list接口查找
    // 这里返回null，由业务层通过数据库查询
    return Promise.resolve(null);
  }

  /**
   * 获取上传进度（用于断点续传）
   * @param uploadId 上传ID
   * @returns Promise 返回已上传的分片索引数组
   */
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
      // 目录不存在，返回空数组
      return [];
    }

    return uploadedChunks.sort((a, b) => a - b);
  }

  /**
   * 取消上传（清理临时文件）
   * @param uploadId 上传ID
   */
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
