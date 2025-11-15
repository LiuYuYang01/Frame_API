import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PhotoService } from './service';
import { CreatePhotoDto } from './dto/create_photo';
import { UpdatePhotoDto } from './dto/update_photo';
import { Result } from '@/utils/response';

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

  @Delete(':id')
  @ApiOperation({
    summary: '删除照片',
    description: '删除照片记录，同时会删除七牛云上对应的文件',
  })
  @ApiParam({
    name: 'id',
    description: '照片ID',
    example: 1,
    type: Number,
  })
  async delPhoto(@Param('id', ParseIntPipe) id: number) {
    await this.photoService.delPhoto(id);
    return Result.success('照片删除成功');
  }
}
