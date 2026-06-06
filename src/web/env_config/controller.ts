import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { EnvConfigService } from './service';
import { Result } from '@/utils/response';

@ApiTags('环境配置管理')
@ApiBearerAuth('JWT-auth')
@Controller('env_config')
export class EnvConfigController {
  constructor(private readonly envConfigService: EnvConfigService) {}

  @Get('list')
  @ApiOperation({ summary: '获取环境配置列表' })
  async list() {
    const data = await this.envConfigService.list();
    return Result.success('获取成功', data);
  }

  @Get('name/:name')
  @ApiOperation({ summary: '根据名称获取环境配置' })
  @ApiParam({ name: 'name', example: 'baidu_statis' })
  async getByName(@Param('name') name: string) {
    const config = await this.envConfigService.getByName(name);
    if (!config) {
      return Result.error('配置不存在');
    }
    return Result.success('获取成功', config);
  }

  @Patch('json/:id')
  @ApiOperation({ summary: '更新 JSON 配置' })
  @ApiParam({ name: 'id', example: 1 })
  async updateJsonValue(@Param('id') id: string, @Body() value: Record<string, unknown>) {
    await this.envConfigService.updateJsonValue(Number(id), value);
    return Result.success('JSON配置更新成功');
  }
}
