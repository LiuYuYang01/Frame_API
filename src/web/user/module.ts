import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './controller';
import { UserService } from './service';
import { User } from '@/entity/user';
import { JwtStrategy } from '@/strategy/jwt_config';
import { JWT_SECRET, JWT_EXPIRES_IN } from '@/strategy/jwt.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: JWT_SECRET, // 使用统一的 JWT 密钥配置（与 JwtStrategy 中的 secretOrKey 必须一致）
      signOptions: {
        expiresIn: JWT_EXPIRES_IN, // 使用统一的过期时间配置
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService, JwtStrategy],
  exports: [UserService, JwtStrategy, PassportModule, JwtModule],
})
export class UserModule {}
