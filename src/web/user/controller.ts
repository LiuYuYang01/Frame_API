import { Controller, Post, Patch, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './service';
import { LoginDto } from './dto/login';
import { LoginResponse } from './dto/login_response';
import { UpdateProfileDto } from './dto/update_profile';
import { Public } from '@/decorator/public';
import { Result } from '@/utils/response';
import { User } from '@/entity/user';

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
  async login(@Body() loginDto: LoginDto): Promise<Result<LoginResponse>> {
    const result = await this.userService.login(loginDto);
    return Result.success('登录成功', result);
  }

  @Patch('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '更新个人资料',
    description: '修改账号、名称或密码',
  })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(@Req() req: { user: User }, @Body() dto: UpdateProfileDto) {
    const user = await this.userService.updateProfile(req.user.id, dto);
    return Result.success('更新成功', user);
  }
}
