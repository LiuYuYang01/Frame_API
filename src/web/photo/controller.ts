import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PhotoService } from './service';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { QueryPhotoDto } from './dto/query_photo';
import { Result } from '../../utils/response';
import { Paging } from '../../utils/paging';
import { formatObjectDates } from '../../utils/date';

@ApiTags('照片管理')
@ApiBearerAuth('JWT-auth')
@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post()
  @ApiOperation({ summary: '创建照片', description: '添加新的照片记录' })
  async create(@Body() createPhotoDto: CreatePhotoDto) {
    const photo = await this.photoService.create(createPhotoDto);
    const formattedPhoto = formatObjectDates(photo, ['create_time']);
    return Result.success('照片创建成功', formattedPhoto);
  }

  @Get()
  @ApiOperation({
    summary: '查询照片列表',
    description: '分页查询照片列表，支持按名称搜索',
  })
  async findAll(@Query() query: QueryPhotoDto) {
    const result = await this.photoService.findAll(query);

    // 格式化时间
    const formattedItems = result.items.map((photo) =>
      formatObjectDates(photo, ['create_time']),
    );

    const pagingData = Paging.filter({
      items: formattedItems,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('查询照片列表成功', pagingData);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询照片详情',
    description: '根据照片ID查询详细信息',
  })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const photo = await this.photoService.findOne(id);
    const formattedPhoto = formatObjectDates(photo, ['create_time']);
    return Result.success('查询照片详情成功', formattedPhoto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新照片', description: '更新照片信息（如名称）' })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePhotoDto: UpdatePhotoDto,
  ) {
    const photo = await this.photoService.update(id, updatePhotoDto);
    const formattedPhoto = formatObjectDates(photo, ['create_time']);
    return Result.success('照片更新成功', formattedPhoto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除照片',
    description: '删除照片记录（不会删除七牛云上的文件）',
  })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.photoService.remove(id);
    return Result.success('照片删除成功', null);
  }
}
