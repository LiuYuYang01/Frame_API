import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 上传文件 DTO
 */
export class UploadFileDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '要上传的文件',
    example: 'file.jpg',
  })
  file: Express.Multer.File;

  @ApiPropertyOptional({
    description: '自定义文件名（可选，不包含扩展名）',
    example: 'my-custom-image',
    type: String,
  })
  @IsOptional()
  @IsString()
  customName?: string;
}

/**
 * 批量上传文件 DTO
 */
export class BatchUploadDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '批量上传的文件列表（最多10个）',
    maxItems: 10,
  })
  files: Express.Multer.File[];
}

/**
 * 删除文件 DTO
 */
export class DeleteFileDto {
  @ApiProperty({
    description: '要删除的文件key（文件在七牛云的唯一标识）',
    example: '1699123456789-abc123def.jpg',
    type: String,
  })
  @IsString()
  key: string;
}

/**
 * 文件列表查询 DTO
 */
export class FileListDto {
  @ApiPropertyOptional({
    description: '页码',
    default: 1,
    minimum: 1,
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: '每页数量',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: '文件前缀过滤（例如：images/ 可以只列出 images 目录下的文件）',
    example: 'images/',
    type: String,
  })
  @IsOptional()
  @IsString()
  prefix?: string;
}

/**
 * 移动文件 DTO
 */
export class MoveFileDto {
  @ApiProperty({
    description: '源文件 key',
    example: 'old-file-name.jpg',
    type: String,
  })
  @IsString()
  srcKey: string;

  @ApiProperty({
    description: '目标文件 key',
    example: 'new-file-name.jpg',
    type: String,
  })
  @IsString()
  destKey: string;

  @ApiPropertyOptional({
    description: '是否强制覆盖目标文件（如果已存在）',
    default: false,
    example: false,
    type: Boolean,
  })
  @IsOptional()
  force?: boolean;
}

/**
 * 复制文件 DTO
 */
export class CopyFileDto {
  @ApiProperty({
    description: '源文件 key',
    example: 'source-file.jpg',
    type: String,
  })
  @IsString()
  srcKey: string;

  @ApiProperty({
    description: '目标文件 key（副本的文件名）',
    example: 'copied-file.jpg',
    type: String,
  })
  @IsString()
  destKey: string;

  @ApiPropertyOptional({
    description: '是否强制覆盖目标文件（如果已存在）',
    default: false,
    example: false,
    type: Boolean,
  })
  @IsOptional()
  force?: boolean;
}
