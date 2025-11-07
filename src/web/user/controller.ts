import { Controller, Post, Body } from '@nestjs/common';
import { UserService } from './service';
import { LoginDto } from './dto/login';
import { LoginResponse } from './dto/login_response';
import { Public } from './public.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 用户登录 - 公开接口，不需要 JWT 认证
  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<{ code: number; message: string; data: LoginResponse }> {
    const result = await this.userService.login(loginDto);
    return {
      code: 200,
      message: '登录成功',
      data: result,
    };
  }
}
