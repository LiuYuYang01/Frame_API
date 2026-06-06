import { Module, forwardRef } from '@nestjs/common';
import { FileController } from './controller';
import { QiniuService } from './service';
import { PhotoModule } from '@/web/photo/module';
import { AlbumModule } from '@/web/album/module';
import { EnvConfigModule } from '@/web/env_config/module';

@Module({
  imports: [forwardRef(() => PhotoModule), AlbumModule, EnvConfigModule],
  controllers: [FileController],
  providers: [QiniuService],
  exports: [QiniuService],
})
export class FileModule {}
