import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsInt, Min, IsOptional } from 'class-validator';

export class ChunkUploadDto {
  @ApiProperty({ description: '上传ID（用于标识同一个文件的上传会话）', example: 'upload_1234567890' })
  @IsString()
  uploadId: string;

  @ApiProperty({ description: '分片索引（从0开始）', example: 0 })
  @IsInt()
  @Min(0)
  chunkIndex: number;

  @ApiProperty({ description: '总分片数', example: 10 })
  @IsInt()
  @Min(1)
  totalChunks: number;

  @ApiProperty({ description: '文件key（可选，不传则自动生成）', required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ description: '文件总大小（字节）', example: 10485760 })
  @IsNumber()
  @Min(1)
  fileSize: number;

  @ApiProperty({ description: '文件哈希值（用于秒传）', required: false })
  @IsOptional()
  @IsString()
  hash?: string;

  @ApiProperty({ description: '原始文件名', example: 'photo.jpg' })
  @IsString()
  fileName: string;
}

export class CheckInstantUploadDto {
  @ApiProperty({ description: '文件哈希值（MD5或etag）', example: 'Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1' })
  @IsString()
  hash: string;

  @ApiProperty({ description: '文件大小（字节）', example: 10485760 })
  @IsNumber()
  @Min(1)
  fileSize: number;
}

export class GetUploadProgressDto {
  @ApiProperty({ description: '上传ID', example: 'upload_1234567890' })
  @IsString()
  uploadId: string;
}

export class CancelUploadDto {
  @ApiProperty({ description: '上传ID', example: 'upload_1234567890' })
  @IsString()
  uploadId: string;
}
