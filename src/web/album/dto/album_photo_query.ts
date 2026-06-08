import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PageQueryBaseDto } from '@/dto/page_query_base';
import { PhotoThumbnailQueryDto } from '@/web/photo/dto/photo_thumb_query';

export class AlbumPhotoQueryDto extends IntersectionType(PageQueryBaseDto, PhotoThumbnailQueryDto) {
  @ApiPropertyOptional({
    description: '搜索关键词（照片名称）',
    example: 'sunset',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: '仅查询未绑定任何相册的照片',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unbound_only?: boolean;
}
