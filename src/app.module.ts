import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { QiniuModule } from './qiniu/web/module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './model/user';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'liuyuyang',
      database: 'test_app',
      entities: [User],
      synchronize: true, // ✅ 开发环境开启
      logging: true, // 显示SQL日志
    }),
    UsersModule,
    QiniuModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
