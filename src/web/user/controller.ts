import { Controller, Post, Patch, Body, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './service';
import { LoginDto } from './dto/login';
import { LoginResponse } from './dto/login_response';
import { UpdateProfileDto } from './dto/update_profile';
import { Public } from '@/decorator/public';
import { Result } from '@/utils/response';
import { User } from '@/entity/user';
import { CustomException } from '@/execption/global_exception_handler';

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

  @Post('avatar')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '上传头像',
    description: '上传图片并更新当前用户头像',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Req() req: { user: User }, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new CustomException(400, '请选择头像图片');
    }

    const user = await this.userService.uploadAvatar(req.user.id, file);
    return Result.success('头像更新成功', user);
  }
}
