import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoService } from './service';
import { PhotoController } from './controller';
import { Photo } from '../../entity/photo';

@Module({
  imports: [TypeOrmModule.forFeature([Photo])],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService], // 导出服务供其他模块使用
})
export class PhotoModule {}
