import { Module, forwardRef } from '@nestjs/common';
import { QiniuController } from './controller';
import { QiniuService } from './service';
import { PhotoModule } from '../photo/module';
import { AlbumModule } from '../album/module';

@Module({
  imports: [forwardRef(() => PhotoModule), AlbumModule],
  controllers: [QiniuController],
  providers: [QiniuService],
  exports: [QiniuService],
})
export class QiniuModule {}
