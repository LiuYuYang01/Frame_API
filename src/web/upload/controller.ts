import { Controller, Post, Body, UseInterceptors, UploadedFiles, Logger, Get, Delete, Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { QiniuService } from './service';
import { PhotoService } from '@/web/photo/service';
import { AlbumService } from '@/web/album/service';
import { Result } from '@/utils/response';
import { Photo } from '@/entity/photo';
import { CustomException } from '@/execption/global_exception_handler';
import { CheckInstantUploadDto } from './dto/chunk_upload.dto';
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
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

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
    // 计算文件哈希值（使用 MD5）
    const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex');

    // 使用哈希值作为文件名
    const ext = path.extname(file.originalname);
    const key = `${fileHash}${ext}`;
    const url = this.qiniuService.getPublicDownloadUrl(key);

    // 如果数据库已存在相同 URL，则直接复用
    const existingPhoto = await this.photoService.findByUrl(url);
    if (existingPhoto) {
      this.logger.log(`文件已存在，跳过上传：${existingPhoto.id} - ${existingPhoto.url}`);
      return { photo: existingPhoto, isNew: false };
    }

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
    const photo = await this.photoService.createPhoto({
      name: fileHash,
      url: url,
      size: fileInfo.fsize,
      width: imageInfo?.width || 0,
      height: imageInfo?.height || 0,
      type: fileInfo.mimeType,
      hash: uploadResult.hash,
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
   * 秒传检查：通过文件hash检查是否已存在
   */
  @Post('check_instant_upload')
  @ApiOperation({
    summary: '秒传检查',
    description: '通过文件hash检查文件是否已存在，如果存在则直接返回照片信息，无需上传',
  })
  async checkInstantUpload(@Body() dto: CheckInstantUploadDto) {
    const existingPhoto = await this.photoService.findByHash(dto.hash);
    if (existingPhoto) {
      this.logger.log(`文件已存在（秒传）：${existingPhoto.id} - ${existingPhoto.url}`);
      return Result.success('文件已存在，可直接使用', existingPhoto);
    }
    return Result.success('文件不存在，需要上传', null);
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
    const result = await this.qiniuService.uploadChunk(chunkBuffer, uploadIdValue, chunkIndexValue, totalChunksValue, key || '', fileSizeValue);

    // 如果上传完成，创建照片记录
    if (result.completed && result.key && result.hash) {
      const ext = path.extname(fileName);
      const finalKey = key || result.key;
      const url = this.qiniuService.getPublicDownloadUrl(finalKey);

      // 检查是否已存在（通过hash）
      let photo: Photo;
      const existingPhoto = await this.photoService.findByHash(result.hash);
      if (existingPhoto) {
        this.logger.log(`文件已存在（秒传）：${existingPhoto.id} - ${existingPhoto.url}`);
        photo = existingPhoto;
      } else {
        // 获取文件信息
        const fileInfo = await this.qiniuService.getFileInfo(finalKey);
        const imageInfo = await this.qiniuService.getImageInfo(url);

        // 创建照片记录
        photo = await this.photoService.createPhoto({
          name: fileName.replace(ext, ''),
          url: url,
          size: fileInfo.fsize,
          width: imageInfo?.width || 0,
          height: imageInfo?.height || 0,
          type: fileInfo.mimeType,
          hash: result.hash,
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
