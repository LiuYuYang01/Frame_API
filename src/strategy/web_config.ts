import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/entity/user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'liuyuyang1024', // 在生产环境中应该使用环境变量
    });
  }

  async validate(payload: { userId: number }) {
    const { userId } = payload;
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new UnauthorizedException('用户不存在');

    return user;
  }
}
