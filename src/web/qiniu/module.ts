import { Module } from '@nestjs/common';
import { QiniuController } from './controller';
import { QiniuService } from './service';
import { PhotoModule } from '../photo/module';

@Module({
  imports: [PhotoModule],
  controllers: [QiniuController],
  providers: [QiniuService],
  exports: [QiniuService],
})
export class QiniuModule {}
