import { Controller, Post, Body, UseInterceptors, UploadedFiles, Logger, Get, Delete, Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { QiniuService } from './service';
import { PhotoService } from '@/web/photo/service';
import { AlbumService } from '@/web/album/service';
import { Result } from '@/utils/response';
import { Photo } from '@/entity/photo';
import { CustomException } from '@/execption/global_exception_handler';
import { PreUploadDto } from './dto/pre_upload';
import { ConfirmUploadDto } from './dto/confirm_upload';
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_MIME_TYPES } from './config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@ApiTags('文件管理')
@ApiBearerAuth('JWT-auth')
@Controller('qiniu')
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly qiniuService: QiniuService,
    private readonly photoService: PhotoService,
    private readonly albumService: AlbumService,
  ) {}

  private async validateAlbumId(albumId: number): Promise<void> {
    try {
      await this.albumService.getAlbumDetail(albumId);
    } catch (error) {
      throw new CustomException(400, `相册不存在：${error.message}`);
    }
  }

  private validateImageFile(fileName: string, mimeType: string): void {
    const ext = path.extname(fileName).toLowerCase();

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType) || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new CustomException(400, '仅支持的图片格式：jpg、jpeg、png、gif、webp、bmp');
    }
  }

  private assertObjectKeyValid(fileName: string, key: string): void {
    if (!this.qiniuService.isValidObjectKey(fileName, key)) {
      throw new CustomException(400, '文件 key 格式无效');
    }
  }

  /**
   * 直传预检：秒传检查或返回七牛上传凭证
   */
  @Post('pre-upload')
  @ApiOperation({
    summary: '直传预检',
    description: '检查文件是否已存在（秒传），否则返回七牛直传凭证',
  })
  async preUpload(@Body() body: PreUploadDto) {
    this.validateImageFile(body.fileName, body.type);
    await this.validateAlbumId(body.albumId);

    const existingPhoto = await this.photoService.findByHash(body.hash);
    if (existingPhoto) {
      await this.albumService.addPhotos(body.albumId, [existingPhoto.id]);
      this.logger.log(`秒传命中：${existingPhoto.id} - ${existingPhoto.url}`);
      return Result.success('秒传成功', {
        instant: true,
        photo: existingPhoto,
      });
    }

    const key = this.qiniuService.buildObjectKey(body.fileName);
    const credentials = await this.qiniuService.getDirectUploadCredentials(key);

    return Result.success('获取上传凭证成功', {
      instant: false,
      ...credentials,
    });
  }

  /**
   * 直传确认：七牛上传完成后写入数据库并关联相册
   */
  @Post('confirm')
  @ApiOperation({
    summary: '直传确认',
    description: '客户端直传七牛成功后，确认并保存图片信息到数据库',
  })
  async confirmUpload(@Body() body: ConfirmUploadDto) {
    this.validateImageFile(body.fileName, body.type);
    await this.validateAlbumId(body.albumId);
    this.assertObjectKeyValid(body.fileName, body.key);

    const existingPhoto = await this.photoService.findByHash(body.hash);
    if (existingPhoto) {
      await this.albumService.addPhotos(body.albumId, [existingPhoto.id]);
      return Result.success('上传成功', existingPhoto);
    }

    const url = await this.qiniuService.getPublicDownloadUrl(body.key);

    try {
      await this.qiniuService.getFileInfo(body.key);
    } catch (error) {
      throw new CustomException(400, `七牛云文件不存在或未上传完成：${error.message}`);
    }

    const photo = await this.photoService.createPhoto({
      name: path.basename(body.key, path.extname(body.key)),
      url,
      size: body.size,
      width: body.width || 0,
      height: body.height || 0,
      type: body.type,
      hash: body.hash,
    });

    await this.albumService.addPhotos(body.albumId, [photo.id]);
    this.logger.log(`直传确认成功：${photo.id} - ${photo.url}`);

    return Result.success('上传成功', photo);
  }

  /**
   * 上传文件（支持单个或多个）
   */
  @Post('upload')
  @ApiOperation({
    summary: '文件上传',
    description: '支持批量上传，必须选择一个相册，上传成功后自动保存图片信息到数据库并关联到指定相册',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '支持多选，仅限图片格式，必须指定相册ID',
    required: true,
    schema: {
      type: 'object',
      required: ['files', 'albumId'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          minItems: 1,
          maxItems: 10,
        },
        albumId: {
          type: 'number',
          description: '相册ID（必填）',
          example: 1,
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFile(@UploadedFiles() files: Express.Multer.File[], @Body('albumId') albumId: string) {
    if (!files || files.length === 0) {
      throw new CustomException(400, '请至少上传一个文件');
    }

    // 验证相册ID
    if (!albumId) {
      throw new CustomException(400, '必须选择一个相册');
    }

    const albumIdNum = parseInt(albumId, 10);
    if (isNaN(albumIdNum)) {
      throw new CustomException(400, '相册ID格式不正确');
    }

    // 验证相册是否存在
    try {
      await this.albumService.getAlbumDetail(albumIdNum);
    } catch (error) {
      throw new CustomException(400, `相册不存在：${error.message}`);
    }

    // 允许的图片格式
    const allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES;
    const allowedExtensions = ALLOWED_IMAGE_EXTENSIONS;

    // 验证所有文件都是图片格式
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(ext)) {
        throw new CustomException(400, '仅支持的图片格式：jpg、jpeg、png、gif、webp、bmp');
      }
    }

    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 记录成功上传的文件信息，用于回滚（只记录新上传的文件）
    const uploadedFiles: Array<{ key: string; photoId: number }> = [];
    const photos: Photo[] = [];

    // 将所有照片添加到指定相册
    try {
      // 逐个处理文件，而不是并发处理
      for (const file of files) {
        const result = await this.processFile(file, tempDir);
        photos.push(result.photo);

        // 只记录新上传的文件（需要回滚的）
        if (result.isNew) {
          // 从 URL 中提取 key
          const url = new URL(result.photo.url);
          const key = url.pathname.substring(1);
          uploadedFiles.push({
            key,
            photoId: result.photo.id,
          });
        }
      }

      // 所有文件上传成功后，将照片添加到相册
      const photoIds = photos.map((photo) => photo.id);
      await this.albumService.addPhotos(albumIdNum, photoIds);

      return Result.success('上传成功', photos);
    } catch (error) {
      this.logger.error(`文件上传失败: ${error.message}`);

      // 回滚：删除所有已上传的文件和数据库记录
      if (uploadedFiles.length > 0) {
        this.logger.warn(`开始回滚，删除 ${uploadedFiles.length} 个已上传的文件`);
        await this.rollbackUploads(uploadedFiles);
      }

      throw new CustomException(500, `文件上传失败: ${error.message}`);
    }
  }

  private async processFile(file: Express.Multer.File, tempDir: string): Promise<{ photo: Photo; isNew: boolean }> {
    // 计算文件哈希值（使用 MD5，用于秒传去重）
    const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex');

    const existingPhoto = await this.photoService.findByHash(fileHash);
    if (existingPhoto) {
      this.logger.log(`文件已存在，跳过上传：${existingPhoto.id} - ${existingPhoto.url}`);
      return { photo: existingPhoto, isNew: false };
    }

    // 使用 10 位随机值作为对象名
    const key = this.qiniuService.buildObjectKey(file.originalname);
    const url = await this.qiniuService.getPublicDownloadUrl(key);

    const tempFilePath = path.join(tempDir, key);
    await fs.promises.writeFile(tempFilePath, file.buffer);

    // 文件上传
    let uploadResult: { hash: string; key: string };
    try {
      uploadResult = await this.qiniuService.uploadFile(tempFilePath, key);
    } finally {
      await fs.promises.unlink(tempFilePath).catch(() => undefined);
    }

    // 获取文件信息
    const fileInfo = await this.qiniuService.getFileInfo(uploadResult.key);

    // 获取图片尺寸信息
    const imageInfo = await this.qiniuService.getImageInfo(url);

    // 创建照片记录
    // hash 仍用 MD5 保证秒传；name 存短对象名（不含扩展名）
    const photo = await this.photoService.createPhoto({
      name: path.basename(key, path.extname(key)),
      url: url,
      size: fileInfo.fsize,
      width: imageInfo?.width || 0,
      height: imageInfo?.height || 0,
      type: fileInfo.mimeType,
      hash: fileHash,
    });

    return { photo, isNew: true };
  }

  /**
   * 回滚上传操作：删除已上传的文件和数据库记录
   */
  private async rollbackUploads(uploadedFiles: Array<{ key: string; photoId: number }>) {
    // 并发执行所有回滚操作（即使部分失败也要继续）
    const rollbackPromises = uploadedFiles.map(async ({ key, photoId }) => {
      try {
        // 删除七牛云文件
        await this.qiniuService.delFile(key);
        this.logger.log(`回滚：七牛云文件删除成功: ${key}`);
      } catch (error) {
        this.logger.error(`回滚：七牛云文件删除失败 ${key}: ${error.message}`);
      }

      try {
        // 删除数据库记录（使用 repository 直接删除，避免再次删除七牛云文件）
        await this.photoService.deletePhotoDirectly(photoId);
        this.logger.log(`回滚：数据库记录删除成功: ${photoId}`);
      } catch (error) {
        this.logger.error(`回滚：数据库记录删除失败 ${photoId}: ${error.message}`);
      }
    });

    await Promise.allSettled(rollbackPromises);
    this.logger.warn(`回滚完成，共处理 ${uploadedFiles.length} 个文件`);
  }

  /**
   * 分片上传
   */
  @Post('chunk_upload')
  @ApiOperation({
    summary: '分片上传',
    description: '上传文件分片，支持断点续传。当所有分片上传完成后自动合并并上传到七牛云',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('chunk', 1))
  async chunkUpload(@UploadedFiles() files: Express.Multer.File[], @Body('uploadId') uploadId: string, @Body('chunkIndex') chunkIndex: string, @Body('totalChunks') totalChunks: string, @Body('fileSize') fileSize: string, @Body('fileName') fileName: string, @Body('key') key?: string, @Body('hash') hash?: string, @Body('albumId') albumId?: string) {
    if (!files || files.length === 0) {
      throw new CustomException(400, '请上传分片文件');
    }

    const chunk = files[0];
    const chunkBuffer = chunk.buffer;

    const uploadIdValue = uploadId;
    const chunkIndexValue = parseInt(chunkIndex, 10);
    const totalChunksValue = parseInt(totalChunks, 10);
    const fileSizeValue = parseInt(fileSize, 10);

    if (isNaN(chunkIndexValue) || isNaN(totalChunksValue) || isNaN(fileSizeValue)) {
      throw new CustomException(400, '参数格式不正确');
    }

    // 上传分片
    const result = await this.qiniuService.uploadChunk(chunkBuffer, uploadIdValue, chunkIndexValue, totalChunksValue, key || '', fileName, fileSizeValue);

    // 如果上传完成，创建照片记录
    if (result.completed && result.key && result.hash) {
      const finalKey = result.key;
      const url = await this.qiniuService.getPublicDownloadUrl(finalKey);

      // 检查是否已存在（使用客户端传入的hash进行秒传检查）
      let photo: Photo | undefined;
      if (hash) {
        const existingPhoto = await this.photoService.findByHash(hash);
        if (existingPhoto) {
          this.logger.log(`文件已存在（秒传）：${existingPhoto.id} - ${existingPhoto.url}`);
          photo = existingPhoto;
        }
      }

      // 如果不存在，创建新记录
      if (!photo) {
        // 获取文件信息
        const fileInfo = await this.qiniuService.getFileInfo(finalKey);
        const imageInfo = await this.qiniuService.getImageInfo(url);

        // 创建照片记录：name 用短对象名，hash 用于秒传
        photo = await this.photoService.createPhoto({
          name: path.basename(finalKey, path.extname(finalKey)),
          url: url,
          size: fileInfo.fsize,
          width: imageInfo?.width || 0,
          height: imageInfo?.height || 0,
          type: fileInfo.mimeType,
          hash,
        });
      }

      // 如果指定了相册，添加到相册
      if (albumId) {
        const albumIdNum = parseInt(albumId, 10);
        if (!isNaN(albumIdNum)) {
          try {
            await this.albumService.addPhotos(albumIdNum, [photo.id]);
          } catch (error) {
            this.logger.warn(`添加到相册失败: ${error.message}`);
          }
        }
      }

      return Result.success('分片上传完成', {
        ...result,
        photo,
      });
    }

    return Result.success('分片上传成功', result);
  }

  /**
   * 获取上传进度
   */
  @Get('upload-progress')
  @ApiOperation({
    summary: '获取上传进度',
    description: '根据上传ID获取已上传的分片索引，用于断点续传',
  })
  async getUploadProgress(@Query('uploadId') uploadId: string) {
    if (!uploadId) {
      throw new CustomException(400, 'uploadId 参数必填');
    }
    const uploadedChunks = await this.qiniuService.getUploadProgress(uploadId);
    return Result.success('获取上传进度成功', {
      uploadId,
      uploadedChunks,
      progress: uploadedChunks.length,
    });
  }

  /**
   * 取消上传
   */
  @Delete('cancel_upload')
  @ApiOperation({
    summary: '取消上传',
    description: '取消上传并清理临时文件',
  })
  async cancelUpload(@Query('uploadId') uploadId: string) {
    if (!uploadId) {
      throw new CustomException(400, 'uploadId 参数必填');
    }
    await this.qiniuService.cancelUpload(uploadId);
    return Result.success('已取消上传');
  }
}
