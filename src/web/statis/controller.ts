import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
    description: '获取相册数量、照片数量、七牛云存储和流量等统计信息',
  })
  async getStatistics() {
    const statistics = await this.statisService.getStatistics();
    return Result.success('获取统计信息成功', statistics);
  }
}
