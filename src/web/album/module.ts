import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumService } from './service';
import { AlbumController } from './controller';
import { Album } from '../../entity/album';
import { Photo } from '../../entity/photo';

@Module({
  imports: [TypeOrmModule.forFeature([Album, Photo])],
  controllers: [AlbumController],
  providers: [AlbumService],
  exports: [AlbumService], // 导出服务供其他模块使用
})
export class AlbumModule {}
