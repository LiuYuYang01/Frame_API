import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AlbumService } from './service';
import { CreateAlbumDto } from './dto/create_album';
import { UpdateAlbumDto } from './dto/update_album';
import { QueryAlbumDto } from './dto/query_album';
import { ManagePhotosDto } from './dto/manage_photos';
import { Result } from '@/utils/response';
import { Paging } from '@/utils/paging';
import { PageQueryBaseDto } from '@/dto/page_query_base';

@ApiTags('相册管理')
@ApiBearerAuth('JWT-auth')
@Controller('album')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Post()
  @ApiOperation({
    summary: '创建相册',
    description: '创建一个新的相册',
  })
  async createAlbum(@Body() data: CreateAlbumDto) {
    const album = await this.albumService.createAlbum(data);
    return Result.success('相册创建成功', album);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新相册',
    description: '更新相册信息（名称、描述、封面）',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async updateAlbum(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateAlbumDto) {
    await this.albumService.updateAlbum(id, data);
    return Result.success('相册更新成功');
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除相册',
    description: '删除相册并不会删除照片本身',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async delAlbum(@Param('id', ParseIntPipe) id: number) {
    await this.albumService.delAlbum(id);
    return Result.success('相册删除成功');
  }

  @Post(':id/photos')
  @ApiOperation({
    summary: '添加照片到相册',
    description: '将指定的照片添加到相册中',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async addPhotos(@Param('id', ParseIntPipe) id: number, @Body() data: ManagePhotosDto) {
    await this.albumService.addPhotos(id, data.photo_ids);
    return Result.success('添加照片到相册成功');
  }

  @Delete(':id/photos')
  @ApiOperation({
    summary: '从相册移除照片',
    description: '从相册中移除指定的照片，不会删除照片本身',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async delPhotos(@Param('id', ParseIntPipe) id: number, @Body() data: ManagePhotosDto) {
    await this.albumService.delPhotos(id, data.photo_ids);
    return Result.success('从相册移除照片成功');
  }

  @Get('/detail/:id')
  @ApiOperation({
    summary: '获取相册详情',
    description: '根据相册ID获取详细信息',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async detail(@Param('id', ParseIntPipe) id: number) {
    const album = await this.albumService.findOneWithCount(id);
    return Result.success('获取相册详情成功', album);
  }

  @Get('/list')
  @ApiOperation({
    summary: '获取相册列表',
    description: '分页获取相册列表，支持按名称搜索',
  })
  async list(@Query() query: QueryAlbumDto) {
    console.log(query, 333);

    const result = await this.albumService.getAlbumList(query);

    const pagingData = Paging.filter({
      items: result.items,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('获取相册列表成功', pagingData);
  }

  @Get(':id/photos')
  @ApiOperation({
    summary: '分页查询相册中的照片',
    description: '分页查询指定相册中的所有照片',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async getPhotos(@Param('id', ParseIntPipe) id: number, @Query() query: PageQueryBaseDto) {
    const result = await this.albumService.getPhotosPaginated(id, query.page, query.limit);

    const pagingData = Paging.filter({
      items: result.items,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('查询相册照片成功', pagingData);
  }
}
