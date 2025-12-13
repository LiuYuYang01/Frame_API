import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { UserModule } from '@/web/user/module';
import { FileModule } from '@/web/upload/module';
import { PhotoModule } from '@/web/photo/module';
import { AlbumModule } from '@/web/album/module';
import { StatisModule } from '@/web/statis/module';
import { FootprintModule } from '@/web/footprint/module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/entity/user';
import { Photo } from '@/entity/photo';
import { Album } from '@/entity/album';
import { Footprint } from '@/entity/footprint';
import { JwtAuthGuard } from '@/guard/jwt_auth';

@Module({
  imports: [
    // 配置 ConfigModule 以加载环境变量文件
    ConfigModule.forRoot({
      // 根据 NODE_ENV 加载对应的 .env 文件
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      isGlobal: true, // 全局可用，其他模块无需再次导入
    }),
    // 使用 forRootAsync 以便注入 ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'ThriveX_Phone'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'ThriveX_Phone'),
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // 生产环境关闭
        logging: configService.get<string>('NODE_ENV') === 'development', // 仅开发环境显示SQL日志
        entities: [User, Photo, Album, Footprint],
      }),
      inject: [ConfigService],
    }),
    UserModule,
    FileModule,
    PhotoModule,
    AlbumModule,
    StatisModule,
    FootprintModule,
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
