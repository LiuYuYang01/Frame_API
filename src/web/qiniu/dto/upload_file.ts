import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
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

  @ApiProperty({
    description: '相册ID（必填，上传的图片将关联到该相册）',
    example: 1,
    type: Number,
    required: true,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: '相册ID不能为空' })
  albumId: number;

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
