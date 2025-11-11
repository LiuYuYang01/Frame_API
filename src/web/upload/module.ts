import { Module, forwardRef } from '@nestjs/common';
import { FileController } from './controller';
import { QiniuService } from './service';
import { PhotoModule } from '@/web/photo/module';
import { AlbumModule } from '@/web/album/module';

@Module({
  imports: [forwardRef(() => PhotoModule), AlbumModule],
  controllers: [FileController],
  providers: [QiniuService],
  exports: [QiniuService],
})
export class FileModule {}
