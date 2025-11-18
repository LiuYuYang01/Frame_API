import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

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
}
