import { Module } from '@nestjs/common';
import { QiniuController } from './controller';
import { QiniuService } from '../service';

@Module({
  controllers: [QiniuController],
  providers: [QiniuService],
  exports: [QiniuService],
})
export class QiniuModule {}
