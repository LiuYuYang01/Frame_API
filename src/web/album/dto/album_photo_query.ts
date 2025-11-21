import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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
}
