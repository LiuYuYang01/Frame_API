import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UserService } from './service';
import { LoginDto } from './dto/login';
import { LoginResponse } from './dto/login_response';
import { Public } from './public.decorator';

@ApiTags('用户管理')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 用户登录 - 公开接口，不需要 JWT 认证
  @Public()
  @Post('login')
  @ApiOperation({
    summary: '管理员登录',
  })
  @ApiBody({ type: LoginDto, description: '登录信息' })
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
