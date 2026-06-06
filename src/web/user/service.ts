import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@/entity/user';
import { LoginDto } from './dto/login';
import { UpdateProfileDto } from './dto/update_profile';
import { CustomException } from '@/execption/global_exception_handler';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // 查找用户（使用 email 字段）
    const user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      throw new CustomException(400, '账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomException(400, '密码错误');
    }

    // 生成 JWT token 并设置有效期 3 天
    const token = this.jwtService.sign(
      { user_id: user.id },
      {
        expiresIn: '3d',
      },
    );

    // 返回用户信息（不包含密码）
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        create_time: user.create_time,
      },
    };
  }

  /**
   * 更新当前用户资料
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new CustomException(400, '用户不存在');
    }

    const { username, name, old_password, new_password } = dto;

    if (username && username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username } });
      if (existing) {
        throw new CustomException(400, '账号已被占用');
      }
      user.username = username;
    }

    if (name) {
      user.name = name;
    }

    if (new_password) {
      const isPasswordValid = await bcrypt.compare(old_password || '', user.password);
      if (!isPasswordValid) {
        throw new CustomException(400, '当前密码错误');
      }
      user.password = await bcrypt.hash(new_password, 10);
    }

    await this.userRepository.save(user);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      create_time: user.create_time,
    };
  }
}
