import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { UserModule } from './web/user/module';
import { QiniuModule } from './web/qiniu/module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user';
import { JwtAuthGuard } from './guard/jwt_auth';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'liuyuyang',
      database: 'thrivex_picture',
      entities: [User],
      synchronize: true, // ✅ 开发环境开启
      logging: true, // 显示SQL日志
    }),
    UserModule,
    QiniuModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
