import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  DEFAULT_SLIM_MAX_LONG_EDGE,
  DEFAULT_SLIM_MIN_SIZE_BYTES,
  DEFAULT_SLIM_QUALITY,
} from '@/constants/image_slim';

const transformQueryNumberArray = (value: unknown): number[] | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => Number(item)).filter((item) => !Number.isNaN(item));
};

export class SlimPhotoQueryDto {
  @ApiPropertyOptional({ description: '相册 ID，与 ids 二选一或同时提供', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  albumId?: number;

  @ApiPropertyOptional({
    description: '指定照片 ID 列表',
    type: [Number],
    example: [1, 2, 3],
  })
  @ValidateIf((dto: SlimPhotoQueryDto) => !dto.albumId)
  @IsOptional()
  @Transform(({ value }) => transformQueryNumberArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids?: number[];

  @ApiPropertyOptional({
    description: '仅处理大于该体积的照片（字节）',
    example: DEFAULT_SLIM_MIN_SIZE_BYTES,
    default: DEFAULT_SLIM_MIN_SIZE_BYTES,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSizeBytes?: number;

  @ApiPropertyOptional({
    description: '输出长边上限（像素）',
    example: DEFAULT_SLIM_MAX_LONG_EDGE,
    default: DEFAULT_SLIM_MAX_LONG_EDGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(320)
  maxLongEdge?: number;

  @ApiPropertyOptional({
    description: '输出 JPEG 质量（1-100）',
    example: DEFAULT_SLIM_QUALITY,
    default: DEFAULT_SLIM_QUALITY,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number;
}

export class SlimPhotoDto extends SlimPhotoQueryDto {}
