import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IntersectionType } from '@nestjs/swagger';
import { PageQueryBaseDto } from '@/dto/page_query_base';
import { PhotoThumbnailQueryDto } from '@/web/photo/dto/photo_thumb_query';

export class QueryAlbumDto extends IntersectionType(PageQueryBaseDto, PhotoThumbnailQueryDto) {
  @ApiProperty({
    description: '搜索关键词（按相册名称搜索）',
    example: '旅行',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
