import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoService } from './service';
import { PhotoController } from './controller';
import { Photo } from '../../entity/photo';
import { FileModule } from '../upload/module';

@Module({
  imports: [TypeOrmModule.forFeature([Photo]), forwardRef(() => FileModule)],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService], // 导出服务供其他模块使用
})
export class PhotoModule {}
