import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { ImageFormat, ImageScene } from '@/utils/image';

const toNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

export class PhotoThumbnailQueryDto {
  @ApiPropertyOptional({
    description: '图片处理场景：thumb(管理端网格) | grid(展示端瀑布流) | preview(预览大图) | cover(相册封面) | placeholder(模糊占位)',
    example: 'grid',
    enum: ['thumb', 'grid', 'preview', 'cover', 'placeholder'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['thumb', 'grid', 'preview', 'cover', 'placeholder'])
  scene?: ImageScene;

  @ApiPropertyOptional({
    description: '缩略图宽度，传递后返回缩放后的图片URL',
    example: 540,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({}, { message: 'width 必须是数字' })
  @Min(1, { message: 'width 必须大于等于 1' })
  width?: number;

  @ApiPropertyOptional({
    description: '缩略图高度，传递后返回缩放后的图片URL',
    example: 540,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({}, { message: 'height 必须是数字' })
  @Min(1, { message: 'height 必须大于等于 1' })
  height?: number;

  @ApiPropertyOptional({
    description: '图片质量 1-100，默认按场景预设',
    example: 80,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({}, { message: 'quality 必须是数字' })
  @Min(1, { message: 'quality 必须大于等于 1' })
  quality?: number;

  @ApiPropertyOptional({
    description: '输出格式，默认 webp',
    example: 'webp',
    enum: ['webp', 'jpg', 'png', 'avif'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['webp', 'jpg', 'png', 'avif'])
  format?: ImageFormat;
}
