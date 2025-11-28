import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePhotoDto {
  @ApiProperty({ description: '图片名称', example: 'sunset.jpg' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '图片URL地址',
    example: 'https://cdn.example.com/2024_01_15_123456_abc123.jpg',
  })
  @IsString()
  url: string;

  @ApiProperty({ description: '文件大小（字节）', example: 2048576 })
  @IsNumber()
  @Min(0)
  size: number;

  @ApiProperty({
    description: '图片宽度（像素）',
    example: 1920,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiProperty({
    description: '图片高度（像素）',
    example: 1080,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiProperty({
    description: '图片格式/MIME类型',
    example: 'image/jpeg',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: '文件哈希值（用于秒传）',
    example: 'Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1',
    required: false,
  })
  @IsOptional()
  @IsString()
  hash?: string;
}
