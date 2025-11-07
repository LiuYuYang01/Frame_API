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
}

