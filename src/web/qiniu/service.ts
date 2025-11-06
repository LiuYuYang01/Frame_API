import { Injectable, Logger } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { qiniuConfig } from './config';
import * as path from 'path';

@Injectable()
export class QiniuService {
  private readonly logger = new Logger(QiniuService.name);
  private mac: qiniu.auth.digest.Mac;
  private config: qiniu.conf.Config;
  private bucketManager: qiniu.rs.BucketManager;

  constructor() {
    // 初始化七牛云配置
    this.mac = new qiniu.auth.digest.Mac(
      qiniuConfig.accessKey,
      qiniuConfig.secretKey,
    );

    this.config = new qiniu.conf.Config();
    // 根据配置设置区域
    // this.config.zone = qiniu.zone[qiniuConfig.zone];

    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
  }

  /**
   * 生成上传凭证
   * @param key 文件key
   * @returns 上传凭证
   */
  getUploadToken(key?: string): string {
    const options = {
      scope: key ? `${qiniuConfig.bucket}:${key}` : qiniuConfig.bucket,
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
  async uploadFile(
    localFile: string,
    key?: string,
  ): Promise<{ hash: string; key: string }> {
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
   * 批量上传文件
   * @param files 文件路径数组
   * @returns Promise
   */
  async uploadFiles(files: string[]): Promise<{ hash: string; key: string }[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file));
    return Promise.all(uploadPromises);
  }

  /**
   * 删除文件
   * @param key 文件key
   * @returns Promise
   */
  async deleteFile(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.delete(
        qiniuConfig.bucket,
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
        qiniuConfig.bucket,
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
   * 列举文件（分页）
   * @param prefix 前缀
   * @param marker 上次列举返回的位置标记
   * @param limit 每次返回的最大列举文件数量
   * @returns Promise
   */

  async listFiles(
    prefix: string = '',
    marker: string = '',
    limit: number = 10,
  ): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[];
    marker: string;
    commonPrefixes: string[];
  }> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.listPrefix(
        qiniuConfig.bucket,
        {
          prefix: prefix,
          limit: limit,
          marker: marker,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, respBody: any, respInfo: any) => {
          if (err) {
            this.logger.error(`列举文件失败: ${err.message}`);
            reject(err);
            return;
          }

          if (respInfo.statusCode === 200) {
            this.logger.log(`列举文件成功，共 ${respBody.items.length} 个`);
            resolve({
              items: respBody.items,

              marker: respBody.marker || '',

              commonPrefixes: respBody.commonPrefixes || [],
            });
          } else {
            this.logger.error(`列举文件失败: ${respInfo.statusCode}`);

            reject(new Error(`列举文件失败: ${respInfo.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 生成私有空间下载链接
   * @param key 文件key
   * @param expires 过期时间（秒）
   * @returns 下载链接
   */
  getPrivateDownloadUrl(key: string, expires: number = 3600): string {
    const bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    const deadline = Math.floor(Date.now() / 1000) + expires;
    return bucketManager.privateDownloadUrl(qiniuConfig.domain, key, deadline);
  }

  /**
   * 生成公开空间访问链接
   * @param key 文件key
   * @returns 访问链接
   */
  getPublicDownloadUrl(key: string): string {
    return `${qiniuConfig.domain}/${key}`;
  }

  /**
   * 移动/重命名文件
   * @param srcKey 源文件key
   * @param destKey 目标文件key
   * @param force 是否强制覆盖
   * @returns Promise
   */
  async moveFile(
    srcKey: string,
    destKey: string,
    force: boolean = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.move(
        qiniuConfig.bucket,
        srcKey,
        qiniuConfig.bucket,
        destKey,
        { force },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, respBody: any, respInfo: any) => {
          if (err) {
            this.logger.error(`移动文件失败: ${err.message}`);
            reject(err);
            return;
          }

          if (respInfo.statusCode === 200) {
            this.logger.log(`移动文件成功: ${srcKey} -> ${destKey}`);
            resolve();
          } else {
            this.logger.error(`移动文件失败: ${respInfo.statusCode}`);

            reject(new Error(`移动文件失败: ${respInfo.statusCode}`));
          }
        },
      );
    });
  }

  /**
   * 复制文件
   * @param srcKey 源文件key
   * @param destKey 目标文件key
   * @param force 是否强制覆盖
   * @returns Promise
   */
  async copyFile(
    srcKey: string,
    destKey: string,
    force: boolean = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void this.bucketManager.copy(
        qiniuConfig.bucket,
        srcKey,
        qiniuConfig.bucket,
        destKey,
        { force },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: Error | undefined, respBody: any, respInfo: any) => {
          if (err) {
            this.logger.error(`复制文件失败: ${err.message}`);
            reject(err);
            return;
          }

          if (respInfo.statusCode === 200) {
            this.logger.log(`复制文件成功: ${srcKey} -> ${destKey}`);
            resolve();
          } else {
            this.logger.error(`复制文件失败: ${respInfo.statusCode}`);

            reject(new Error(`复制文件失败: ${respInfo.statusCode}`));
          }
        },
      );
    });
  }
}
