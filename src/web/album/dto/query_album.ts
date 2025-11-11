import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryBaseDto } from '@/dto/page_query_base';

export class QueryAlbumDto extends PageQueryBaseDto {
  @ApiProperty({
    description: '搜索关键词（按相册名称搜索）',
    example: '旅行',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
