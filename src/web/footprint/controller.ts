import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { FootprintService } from './service';
import { CreateFootprintDto } from './dto/create_footprint';
import { UpdateFootprintDto } from './dto/update_footprint';
import { QueryFootprintDto } from './dto/query_footprint';
import { Result } from '@/utils/response';
import { Paging } from '@/utils/paging';
import { Public } from '@/decorator/public';

@ApiTags('足迹管理')
@ApiBearerAuth('JWT-auth')
@Controller('footprint')
export class FootprintController {
  constructor(private readonly footprintService: FootprintService) {}

  @Post()
  @ApiOperation({
    summary: '创建足迹',
    description: '创建一个新的足迹',
  })
  async createFootprint(@Body() data: CreateFootprintDto) {
    const footprint = await this.footprintService.createFootprint(data);
    return Result.success('足迹创建成功', footprint);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: '获取足迹列表',
    description: '分页获取足迹列表，支持按标题或地址搜索',
  })
  async list(@Query() query: QueryFootprintDto) {
    const result = await this.footprintService.getFootprintList(query);

    const pagingData = Paging.filter({
      items: result.items,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('获取足迹列表成功', pagingData);
  }

  @Get(':id')
  @ApiOperation({
    summary: '获取足迹详情',
    description: '根据ID获取足迹的详细信息',
  })
  @ApiParam({
    name: 'id',
    description: '足迹ID',
    example: 1,
    type: Number,
  })
  async getDetail(@Param('id', ParseIntPipe) id: number) {
    const footprint = await this.footprintService.getFootprintDetail(id);
    return Result.success('获取足迹详情成功', footprint);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新足迹',
    description: '更新足迹信息（标题、内容、地址、位置、照片等）',
  })
  @ApiParam({
    name: 'id',
    description: '足迹ID',
    example: 1,
    type: Number,
  })
  async updateFootprint(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateFootprintDto) {
    const footprint = await this.footprintService.updateFootprint(id, data);
    return Result.success('足迹更新成功', footprint);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除足迹',
    description: '删除指定的足迹',
  })
  @ApiParam({
    name: 'id',
    description: '足迹ID',
    example: 1,
    type: Number,
  })
  async deleteFootprint(@Param('id', ParseIntPipe) id: number) {
    await this.footprintService.deleteFootprint(id);
    return Result.success('足迹删除成功');
  }
}
