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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QiniuService } from './service';
import { FileListDto } from './dto/upload_file';
import { Result } from '../../utils/response';
import { Paging } from '../../utils/paging';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('七牛云文件管理')
@ApiBearerAuth('JWT-auth')
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

      return Result.success(`成功上传 ${urls.length} 个文件`, urls);
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
      return Result.success('文件删除成功', { key });
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

      return Result.success('获取文件信息成功', {
        key: key,
        url: url,
        hash: info.hash,
        size: info.fsize,
        mimeType: info.mimeType,
        putTime: new Date(info.putTime / 10000), // 七牛返回的时间是100纳秒为单位
        type: info.type,
      });
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

      // 使用 Paging 工具格式化分页数据
      // 注意：七牛云不提供总数，这里使用当前页的数据量作为参考
      const pagingData = Paging.filter({
        items: items,
        total: items.length, // 当前页数据量
        page: page,
        size: limit,
      });

      // 添加七牛云特有的 marker 信息
      return Result.success('获取文件列表成功', pagingData);
    } catch (error) {
      this.logger.error(`获取文件列表失败: ${error.message}`);
      throw new BadRequestException(`获取文件列表失败: ${error.message}`);
    }
  }
}
