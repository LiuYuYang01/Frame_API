import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryBaseDto } from '@/dto/page_query_base';

export class QueryFootprintDto extends PageQueryBaseDto {
  @ApiProperty({
    description: '搜索关键词（按标题或地址搜索）',
    example: '西湖',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
