import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoService } from './service';
import { PhotoController } from './controller';
import { Photo } from '@/entity/photo';
import { FileModule } from '@/web/upload/module';
import { AlbumModule } from '@/web/album/module';

@Module({
  imports: [TypeOrmModule.forFeature([Photo]), forwardRef(() => FileModule), AlbumModule],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService], // 导出服务供其他模块使用
})
export class PhotoModule {}
