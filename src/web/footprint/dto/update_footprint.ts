import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

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
    description: '封面图片URL',
    example: 'https://cdn.example.com/cover.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({
    description: '关联相册ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  album_id?: number;
}
