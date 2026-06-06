import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisService } from './service';
import { StatisController } from './controller';
import { Album } from '@/entity/album';
import { Photo } from '@/entity/photo';
import { EnvConfigModule } from '@/web/env_config/module';

@Module({
  imports: [TypeOrmModule.forFeature([Album, Photo]), EnvConfigModule],
  controllers: [StatisController],
  providers: [StatisService],
  exports: [StatisService],
})
export class StatisModule {}
