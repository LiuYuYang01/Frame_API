import { Controller, Post, Body, UseInterceptors, UploadedFiles, Logger } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { QiniuService } from './service';
import { PhotoService } from '@/web/photo/service';
import { AlbumService } from '@/web/album/service';
import { Result } from '@/utils/response';
import { Photo } from '@/entity/photo';
import { CustomException } from '@/execption/global_exception_handler';
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
  @UseInterceptors(FilesInterceptor('files', 20))
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

    try {
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });

      const photos = await Promise.all(files.map((file) => this.processFile(file, tempDir)));

      // 将所有照片添加到指定相册
      const photoIds = photos.map((photo) => photo.id);
      await this.albumService.addPhotos(albumIdNum, photoIds);

      return Result.success('上传成功', photos);
    } catch (error) {
      this.logger.error(`文件上传失败: ${error.message}`);
      throw new CustomException(500, `文件上传失败: ${error.message}`);
    }
  }

  private async processFile(file: Express.Multer.File, tempDir: string): Promise<Photo> {
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
      return existingPhoto;
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
    return this.photoService.createPhoto({
      name: fileHash,
      url: url,
      size: fileInfo.fsize,
      width: imageInfo?.width || 0,
      height: imageInfo?.height || 0,
      type: fileInfo.mimeType,
    });
  }
}
