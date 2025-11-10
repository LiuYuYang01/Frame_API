import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAlbumDto {
  @ApiProperty({
    description: '相册名称',
    example: '旅行相册',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: '相册描述',
    example: '2024年春节旅行照片',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: '封面图片URL',
    example: 'https://cdn.example.com/cover.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  cover?: string;
}
