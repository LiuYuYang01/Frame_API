import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateFootprintDto {
  @ApiProperty({
    description: '标题',
    example: '美丽的西湖',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: '内容描述',
    example: '今天去了西湖，风景非常美丽',
    required: false,
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: '地址',
    example: '浙江省杭州市西湖区',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: '位置坐标（经纬度，格式：lng,lat）',
    example: '120.135,30.259',
    required: false,
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({
    description: '照片列表',
    example: ['https://cdn.example.com/photo1.jpg', 'https://cdn.example.com/photo2.jpg'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
