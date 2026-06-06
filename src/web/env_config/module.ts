import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvConfig } from '@/entity/env_config';
import { EnvConfigService } from './service';
import { EnvConfigController } from './controller';

@Module({
  imports: [TypeOrmModule.forFeature([EnvConfig])],
  controllers: [EnvConfigController],
  providers: [EnvConfigService],
  exports: [EnvConfigService],
})
export class EnvConfigModule {}
