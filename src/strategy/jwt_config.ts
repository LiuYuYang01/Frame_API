import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/entity/user';
import { JWT_SECRET } from './jwt.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      // jwtFromRequest: 指定从哪里解析 JWT，这里使用 Authorization Bearer Token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: 是否忽略 JWT 的过期时间，false 代表不过期自动失效
      ignoreExpiration: false,
      // secretOrKey: 用于验证 JWT 签名的密钥（与生成 token 时使用的 secret 必须一致）
      secretOrKey: JWT_SECRET,
    });
  }

  // JWT 验证，如果验证失败就会触发这个方法
  async validate(payload: { user_id: number }) {
    const { user_id } = payload;
    const user = await this.userRepository.findOne({ where: { id: user_id } });

    if (!user) throw new UnauthorizedException('用户不存在');

    return user;
  }
}
