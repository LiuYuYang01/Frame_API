import { ApiProperty } from '@nestjs/swagger';

/**
 * 通用响应格式
 */
export class ResponseDto<T> {
  @ApiProperty({ description: '请求是否成功', example: true })
  success: boolean;

  @ApiProperty({ description: '响应消息', example: '操作成功' })
  message: string;

  @ApiProperty({ description: '响应数据' })
  data: T;
}

/**
 * 文件上传响应数据
 */
export class FileUploadData {
  @ApiProperty({
    description: '文件在七牛云的唯一标识',
    example: '1699123456789-abc123def.jpg',
  })
  key: string;

  @ApiProperty({
    description: '文件哈希值',
    example: 'FhGxwQ7RoE...',
  })
  hash: string;

  @ApiProperty({
    description: '文件访问地址',
    example: 'http://your-domain.com/1699123456789-abc123def.jpg',
  })
  url: string;

  @ApiProperty({
    description: '文件大小（字节）',
    example: 102400,
  })
  size: number;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'image/jpeg',
  })
  mimeType: string;
}

/**
 * 批量上传响应数据项
 */
export class BatchUploadDataItem extends FileUploadData {
  @ApiProperty({
    description: '原始文件名',
    example: 'photo.jpg',
  })
  originalName: string;
}

/**
 * 文件信息响应数据
 */
export class FileInfoData {
  @ApiProperty({
    description: '文件 key',
    example: '1699123456789-abc123def.jpg',
  })
  key: string;

  @ApiProperty({
    description: '文件访问地址',
    example: 'http://your-domain.com/1699123456789-abc123def.jpg',
  })
  url: string;

  @ApiProperty({
    description: '文件哈希值',
    example: 'FhGxwQ7RoE...',
  })
  hash: string;

  @ApiProperty({
    description: '文件大小（字节）',
    example: 102400,
  })
  size: number;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: '上传时间',
    example: '2024-11-04T10:30:00.000Z',
  })
  putTime: Date;

  @ApiProperty({
    description: '存储类型',
    example: 0,
  })
  type: number;
}

/**
 * 文件列表项
 */
export class FileListItem {
  @ApiProperty({
    description: '文件 key',
    example: '1699123456789-abc123def.jpg',
  })
  key: string;

  @ApiProperty({
    description: '文件哈希值',
    example: 'FhGxwQ7RoE...',
  })
  hash: string;

  @ApiProperty({
    description: '文件大小（字节）',
    example: 102400,
  })
  size: number;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: '上传时间',
    example: '2024-11-04T10:30:00.000Z',
  })
  putTime: Date;

  @ApiProperty({
    description: '文件访问地址',
    example: 'http://your-domain.com/1699123456789-abc123def.jpg',
  })
  url: string;
}

/**
 * 文件列表响应数据
 */
export class FileListData {
  @ApiProperty({
    description: '文件列表',
    type: [FileListItem],
  })
  items: FileListItem[];

  @ApiProperty({
    description: '当前页文件数量',
    example: 10,
  })
  total: number;

  @ApiProperty({
    description: '当前页码',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '每页数量',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: '是否还有更多数据',
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: '下一页标记',
    example: 'next_page_marker',
  })
  marker: string;
}

/**
 * 文件操作响应数据（移动、复制）
 */
export class FileOperationData {
  @ApiProperty({
    description: '源文件 key',
    example: 'old-file-name.jpg',
  })
  srcKey: string;

  @ApiProperty({
    description: '目标文件 key',
    example: 'new-file-name.jpg',
  })
  destKey: string;

  @ApiProperty({
    description: '文件访问地址',
    example: 'http://your-domain.com/new-file-name.jpg',
  })
  url: string;
}

/**
 * 上传凭证响应数据
 */
export class UploadTokenData {
  @ApiProperty({
    description: '上传凭证，有效期1小时',
    example: 'your_upload_token_string...',
  })
  token: string;

  @ApiProperty({
    description: '指定的文件 key（如果有）',
    example: 'my-custom-file.jpg',
    nullable: true,
  })
  key: string | null;

  @ApiProperty({
    description: '凭证过期时间（秒）',
    example: 3600,
  })
  expires: number;
}
