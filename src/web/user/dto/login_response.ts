import { ApiProperty } from '@nestjs/swagger';

export class LoginResponse {
  @ApiProperty({
    description: 'JWT 访问令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: '用户信息',
    example: {
      id: 1,
      name: '张三',
      username: 'zhangsan',
      create_time: '2025-11-07T08:00:00.000Z',
    },
  })
  user: {
    id: number;
    name: string;
    username: string;
    create_time: Date;
  };
}
