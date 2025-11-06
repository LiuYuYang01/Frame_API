import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { QiniuService } from './service';
import { FileListDto, MoveFileDto, CopyFileDto } from './dto/upload_file';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('七牛云文件管理')
@Controller('qiniu')
export class QiniuController {
  private readonly logger = new Logger(QiniuController.name);

  constructor(private readonly qiniuService: QiniuService) {}

  /**
   * 上传文件（支持单个或多个）
   */
  @Post('upload')
  @ApiOperation({
    summary: '文件上传',
    description: '支持批量上传，最终以数组形式返回每个文件的地址',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '上传的文件（支持多选）',
    required: true,
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          description: '要上传的文件列表（可选择多个文件）',
          items: {
            type: 'string',
            format: 'binary',
          },
          minItems: 1,
          maxItems: 10,
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFile(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少上传一个文件');
    }

    try {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const urls: string[] = [];

      for (const file of files) {
        const tempFilePath = path.join(tempDir, file.originalname);
        fs.writeFileSync(tempFilePath, file.buffer);

        // 生成文件key - 格式: YYYY_MM_DD_唯一值
        const ext = path.extname(file.originalname);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const uniqueId = `${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 11)}`;
        const key = `${year}_${month}_${day}_${uniqueId}${ext}`;

        const result = await this.qiniuService.uploadFile(tempFilePath, key);
        fs.unlinkSync(tempFilePath);

        const url = this.qiniuService.getPublicDownloadUrl(result.key);
        urls.push(url);
      }

      return {
        success: true,
        message: `成功上传 ${urls.length} 个文件`,
        data: urls,
      };
    } catch (error) {
      this.logger.error(`文件上传失败: ${error.message}`);
      throw new BadRequestException(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 删除文件
   */
  @Delete('delete/:key')
  @ApiOperation({
    summary: '删除文件',
    description:
      '根据文件 key 从七牛云存储中删除指定文件。此操作不可恢复，请谨慎使用。',
  })
  @ApiParam({
    name: 'key',
    description: '文件在七牛云的唯一标识（key）',
    example: '1699123456789-abc123def.jpg',
    required: true,
  })
  async deleteFile(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('文件key不能为空');
    }

    try {
      await this.qiniuService.deleteFile(key);
      return {
        success: true,
        message: '文件删除成功',
        data: { key },
      };
    } catch (error) {
      this.logger.error(`文件删除失败: ${error.message}`);
      throw new BadRequestException(`文件删除失败: ${error.message}`);
    }
  }

  /**
   * 获取文件详情
   */
  @Get('info/:key')
  @ApiOperation({
    summary: '获取文件详情',
    description:
      '根据文件 key 获取文件的详细信息，包括文件大小、哈希值、MIME 类型、上传时间等。',
  })
  @ApiParam({
    name: 'key',
    description: '文件在七牛云的唯一标识（key）',
    example: '1699123456789-abc123def.jpg',
    required: true,
  })
  async getFileInfo(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('文件key不能为空');
    }

    try {
      const info = await this.qiniuService.getFileInfo(key);
      const url = this.qiniuService.getPublicDownloadUrl(key);

      return {
        success: true,
        message: '获取文件信息成功',
        data: {
          key: key,
          url: url,
          hash: info.hash,
          size: info.fsize,
          mimeType: info.mimeType,
          putTime: new Date(info.putTime / 10000), // 七牛返回的时间是100纳秒为单位
          type: info.type,
        },
      };
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${error.message}`);
      throw new BadRequestException(`获取文件信息失败: ${error.message}`);
    }
  }

  /**
   * 列举文件（分页）
   */
  @Get('list')
  @ApiOperation({
    summary: '列举文件（分页）',
    description:
      '获取七牛云存储空间中的文件列表，支持分页查询和前缀过滤。可用于文件浏览和管理。',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '页码',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '每页数量',
    example: 10,
  })
  @ApiQuery({
    name: 'prefix',
    required: false,
    type: String,
    description: '文件前缀过滤（例如：images/ 可以只列出 images 目录下的文件）',
    example: 'images/',
  })
  async listFiles(@Query() query: FileListDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const prefix = query.prefix || '';

      // 七牛云使用marker来实现分页，这里简化处理
      const result = await this.qiniuService.listFiles(prefix, '', limit);

      const items = result.items.map((item) => ({
        key: item.key,
        hash: item.hash,
        size: item.fsize,
        mimeType: item.mimeType,
        putTime: new Date(item.putTime / 10000),
        url: this.qiniuService.getPublicDownloadUrl(item.key),
      }));

      return {
        success: true,
        message: '获取文件列表成功',
        data: {
          items: items,
          total: items.length,
          page: page,
          limit: limit,
          hasMore: !!result.marker,
          marker: result.marker,
        },
      };
    } catch (error) {
      this.logger.error(`获取文件列表失败: ${error.message}`);
      throw new BadRequestException(`获取文件列表失败: ${error.message}`);
    }
  }

  /**
   * 移动/重命名文件
   */
  @Post('move')
  @ApiOperation({
    summary: '移动/重命名文件',
    description:
      '在七牛云存储中移动或重命名文件。可用于文件整理和重命名操作。如果目标文件已存在，可通过 force 参数强制覆盖。',
  })
  async moveFile(@Body() moveFileDto: MoveFileDto) {
    const { srcKey, destKey, force = false } = moveFileDto;

    if (!srcKey || !destKey) {
      throw new BadRequestException('源文件key和目标文件key不能为空');
    }

    try {
      await this.qiniuService.moveFile(srcKey, destKey, force);
      return {
        success: true,
        message: '文件移动成功',
        data: {
          srcKey,
          destKey,
          url: this.qiniuService.getPublicDownloadUrl(destKey),
        },
      };
    } catch (error) {
      this.logger.error(`文件移动失败: ${error.message}`);
      throw new BadRequestException(`文件移动失败: ${error.message}`);
    }
  }

  /**
   * 复制文件
   */
  @Post('copy')
  @ApiOperation({
    summary: '复制文件',
    description:
      '在七牛云存储中复制文件。源文件保持不变，创建一个新的副本。可用于文件备份和多版本管理。',
  })
  async copyFile(@Body() copyFileDto: CopyFileDto) {
    const { srcKey, destKey, force = false } = copyFileDto;

    if (!srcKey || !destKey) {
      throw new BadRequestException('源文件key和目标文件key不能为空');
    }

    try {
      await this.qiniuService.copyFile(srcKey, destKey, force);
      return {
        success: true,
        message: '文件复制成功',
        data: {
          srcKey,
          destKey,
          url: this.qiniuService.getPublicDownloadUrl(destKey),
        },
      };
    } catch (error) {
      this.logger.error(`文件复制失败: ${error.message}`);
      throw new BadRequestException(`文件复制失败: ${error.message}`);
    }
  }

  /**
   * 获取上传凭证
   */
  @Get('token')
  @ApiOperation({
    summary: '获取上传凭证',
    description:
      '获取七牛云上传凭证（Upload Token），用于前端直传功能。前端可以使用此凭证直接上传文件到七牛云，无需经过后端服务器中转，提升上传速度和降低服务器压力。',
  })
  @ApiQuery({
    name: 'key',
    required: false,
    type: String,
    description:
      '指定上传后的文件 key（可选）。如果不指定，前端上传时需要自行指定文件名。',
    example: 'my-custom-file.jpg',
  })
  getUploadToken(@Query('key') key?: string) {
    try {
      const token = this.qiniuService.getUploadToken(key);
      return {
        success: true,
        message: '获取上传凭证成功',
        data: {
          token,
          key: key || null,
          expires: 3600,
        },
      };
    } catch (error) {
      this.logger.error(`获取上传凭证失败: ${error.message}`);
      throw new BadRequestException(`获取上传凭证失败: ${error.message}`);
    }
  }
}
