import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class UpdatePhotoDto {
  @ApiProperty({
    description: '图片名称',
    example: 'sunset.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: '图片描述',
    example: '美丽的日落',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: '是否收藏（同步到收藏相册）',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiProperty({
    description: '标签数组',
    example: ['日本', '东京'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
