import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './controller';
import { UserService } from './service';
import { User } from '../../entity/user';
import { JwtStrategy } from '../../strategy/jwt_config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'your-secret-key-change-in-production', // 在生产环境中应该使用环境变量
      signOptions: {
        expiresIn: '3d', // 默认 3 天有效期
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService, JwtStrategy],
  exports: [UserService, JwtStrategy, PassportModule, JwtModule],
})
export class UserModule {}
