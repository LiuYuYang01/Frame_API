import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryBaseDto } from '@/dto/page_query_base';

export class QueryPhotoDto extends PageQueryBaseDto {
  @ApiProperty({
    description: '搜索关键词（按照片名称搜索）',
    example: 'sunset',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
