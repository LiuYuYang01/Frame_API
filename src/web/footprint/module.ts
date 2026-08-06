import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FootprintService } from './service';
import { FootprintController } from './controller';
import { Footprint } from '@/entity/footprint';
import { Album } from '@/entity/album';

@Module({
  imports: [TypeOrmModule.forFeature([Footprint, Album])],
  controllers: [FootprintController],
  providers: [FootprintService],
  exports: [FootprintService],
})
export class FootprintModule {}
