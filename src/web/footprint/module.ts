import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FootprintService } from './service';
import { FootprintController } from './controller';
import { Footprint } from '@/entity/footprint';

@Module({
  imports: [TypeOrmModule.forFeature([Footprint])],
  controllers: [FootprintController],
  providers: [FootprintService],
  exports: [FootprintService],
})
export class FootprintModule {}
