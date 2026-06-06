import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: '登录账号',
    example: 'admin',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  username?: string;

  @ApiProperty({
    description: '显示名称',
    example: '神秘人',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  name?: string;

  @ApiProperty({
    description: '当前密码（修改密码时必填）',
    example: '123456',
    required: false,
  })
  @ValidateIf((o: UpdateProfileDto) => !!o.new_password)
  @IsString()
  @IsNotEmpty({ message: '请输入当前密码' })
  old_password?: string;

  @ApiProperty({
    description: '新密码',
    example: '654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  new_password?: string;
}
