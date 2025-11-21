import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const toNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

export class PhotoThumbnailQueryDto {
  @ApiPropertyOptional({
    description: '缩略图宽度，传递后返回缩放后的图片URL',
    example: 1000,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({}, { message: 'width 必须是数字' })
  @Min(1, { message: 'width 必须大于等于 1' })
  width?: number;

  @ApiPropertyOptional({
    description: '缩略图高度，传递后返回缩放后的图片URL',
    example: 1000,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({}, { message: 'height 必须是数字' })
  @Min(1, { message: 'height 必须大于等于 1' })
  height?: number;
}
