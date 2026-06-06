import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatisService } from './service';
import { Result } from '@/utils/response';
import { Public } from '@/decorator/public';

@ApiTags('统计管理')
@ApiBearerAuth('JWT-auth')
@Controller('statis')
export class StatisController {
  constructor(private readonly statisService: StatisService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: '获取统计信息',
    description: '获取相册数量、照片数量、照片总大小等统计信息',
  })
  async getStatistics() {
    const statistics = await this.statisService.getStatistics();
    return Result.success('获取统计信息成功', statistics);
  }

  @Get('baidu')
  @ApiOperation({
    summary: '获取百度统计数据',
    description: '支持 basic、overview、new-visitor、basic-overview 四种类型',
  })
  @ApiQuery({ name: 'type', required: true, example: 'overview' })
  @ApiQuery({ name: 'startDate', required: false, example: '20240101' })
  @ApiQuery({ name: 'endDate', required: false, example: '20240131' })
  async getBaiduStatistics(
    @Query('type') type: 'basic' | 'overview' | 'new-visitor' | 'basic-overview',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.statisService.getBaiduStatistics(type, startDate, endDate);
    return Result.success(`获取${type}类型统计数据成功`, data);
  }
}
