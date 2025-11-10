import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@/entity/user';
import { LoginDto } from './dto/login';
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
      throw new CustomException(401, '账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomException(401, '密码错误');
    }

    // 生成 JWT token，有效期 3 天
    const payload = { userId: user.id, username };
    const token = this.jwtService.sign(payload, {
      expiresIn: '3d', // 3 天有效期
    });

    // 返回用户信息（不包含密码）
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        create_time: user.create_time,
      },
    };
  }
}
