import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PhotoService } from './service';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { DeletePhotoDto } from './dto/delete_photo';
import { SlimPhotoDto, SlimPhotoQueryDto } from './dto/slim_photo';
import { UnboundPhotoQueryDto } from './dto/unbound_photo_query';
import { Result } from '@/utils/response';
import { Public } from '@/decorator/public';
import { Paging } from '@/utils/paging';
import { applyImageProcessingToPhotos, resolveImageOptions } from '@/utils/image';

@ApiTags('照片管理')
@ApiBearerAuth('JWT-auth')
@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post()
  @ApiOperation({ summary: '创建照片', description: '添加新的照片记录' })
  async createPhoto(@Body() data: CreatePhotoDto) {
    const photo = await this.photoService.createPhoto(data);
    return Result.success('照片创建成功', photo);
  }

  @Get('/detail/:id')
  @Public()
  @ApiOperation({
    summary: '获取照片详情',
    description: '根据照片ID查询详细信息',
  })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async getPhotoDetail(@Param('id', ParseIntPipe) id: number) {
    const photo = await this.photoService.getPhotoDetail(id);
    return Result.success('获取照片详情成功', photo);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新照片', description: '更新照片信息（如名称）' })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async updatePhoto(@Param('id', ParseIntPipe) id: number, @Body() data: UpdatePhotoDto) {
    await this.photoService.updatePhoto(id, data);
    return Result.success('照片更新成功');
  }

  @Delete()
  @ApiOperation({
    summary: '批量删除照片',
    description: '根据ID列表删除照片记录，同时会删除七牛云上对应的文件',
  })
  async delPhoto(@Body() data: DeletePhotoDto) {
    await this.photoService.delPhotos(data.ids);
    return Result.success('照片删除成功');
  }

  @Get('unbound')
  @ApiOperation({
    summary: '查询未绑定照片',
    description: '分页查询未绑定任何相册的照片',
  })
  async getUnboundPhotos(@Query() query: UnboundPhotoQueryDto) {
    const result = await this.photoService.getUnboundPhotos(query.page, query.limit, query.keyword);
    const imageOptions = resolveImageOptions(query);
    const items = applyImageProcessingToPhotos(result.items, imageOptions);

    const pagingData = Paging.filter({
      items,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('查询未绑定照片成功', pagingData);
  }

  @Get('slim/preview')
  @ApiOperation({
    summary: '预览待瘦身照片',
    description: '统计指定相册或照片列表中符合瘦身条件的图片数量与体积',
  })
  async previewSlimPhotos(@Query() query: SlimPhotoQueryDto) {
    const preview = await this.photoService.previewSlimPhotos(query);
    return Result.success('获取瘦身预览成功', preview);
  }

  @Post('slim')
  @ApiOperation({
    summary: '批量瘦身照片',
    description: '通过七牛 pfop 持久化处理压缩已上传原图，并更新数据库中的体积与尺寸',
  })
  async slimPhotos(@Body() data: SlimPhotoDto) {
    const summary = await this.photoService.slimPhotos(data);
    return Result.success('照片瘦身完成', summary);
  }
}
