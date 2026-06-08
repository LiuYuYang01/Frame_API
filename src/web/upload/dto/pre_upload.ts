import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class PreUploadDto {
  @ApiProperty({ description: '文件 MD5 哈希', example: 'd41d8cd98f00b204e9800998ecf8427e' })
  @IsString()
  hash: string;

  @ApiProperty({ description: '原始文件名', example: 'sunset.jpg' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: '文件大小（字节）', example: 2048576 })
  @IsNumber()
  @Min(1)
  size: number;

  @ApiProperty({ description: 'MIME 类型', example: 'image/jpeg' })
  @IsString()
  type: string;

  @ApiProperty({ description: '相册 ID', example: 1 })
  @IsNumber()
  albumId: number;

  @ApiProperty({ description: '图片宽度（像素）', required: false, example: 1920 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiProperty({ description: '图片高度（像素）', required: false, example: 1080 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;
}
