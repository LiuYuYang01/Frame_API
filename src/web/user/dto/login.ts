import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: '用户账号',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  username: string;

  @ApiProperty({
    description: '用户密码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
