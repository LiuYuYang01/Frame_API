import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisService } from './service';
import { StatisController } from './controller';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';

@Module({
  imports: [TypeOrmModule.forFeature([Album, Photo])],
  controllers: [StatisController],
  providers: [StatisService],
  exports: [StatisService],
})
export class StatisModule {}
