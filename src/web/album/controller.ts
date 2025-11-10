import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AlbumService } from './service';
import { UpdateAlbumDto } from './dto/update_album';
import { QueryAlbumDto } from './dto/query_album';
import { QueryAlbumPhotosDto } from './dto/query_album_photos';
import { ManagePhotosDto } from './dto/manage_photos';
import { Result } from '../../utils/response';
import { Paging } from '../../utils/paging';

@ApiTags('相册管理')
@ApiBearerAuth('JWT-auth')
@Controller('album')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Get()
  @ApiOperation({
    summary: '查询相册列表',
    description: '分页查询相册列表，支持按名称搜索，包含照片数量',
  })
  async findAll(@Query() query: QueryAlbumDto) {
    const result = await this.albumService.findAll(query);

    const pagingData = Paging.filter({
      items: result.items,
      total: result.total,
      page: result.page,
      size: result.limit,
    });

    return Result.success('查询相册列表成功', pagingData);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询相册详情',
    description: '根据相册ID查询详细信息，包含照片数量（不包含照片列表）',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const album = await this.albumService.findOneWithCount(id);
    return Result.success('查询相册详情成功', album);
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
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateAlbumDto: UpdateAlbumDto) {
    const album = await this.albumService.update(id, updateAlbumDto);
    return Result.success('相册更新成功', album);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除相册',
    description: '删除相册（不会删除照片本身）',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.albumService.remove(id);
    return Result.success('相册删除成功', null);
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
  async addPhotos(@Param('id', ParseIntPipe) id: number, @Body() managePhotosDto: ManagePhotosDto) {
    await this.albumService.addPhotos(id, managePhotosDto.photo_ids);
    return Result.success('添加照片到相册成功', null);
  }

  @Delete(':id/photos')
  @ApiOperation({
    summary: '从相册移除照片',
    description: '从相册中移除指定的照片（不删除照片本身）',
  })
  @ApiParam({
    name: 'id',
    description: '相册ID',
    example: 1,
    type: Number,
  })
  async removePhotos(@Param('id', ParseIntPipe) id: number, @Body() managePhotosDto: ManagePhotosDto) {
    await this.albumService.removePhotos(id, managePhotosDto.photo_ids);
    return Result.success('从相册移除照片成功', null);
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
  async getPhotos(@Param('id', ParseIntPipe) id: number, @Query() query: QueryAlbumPhotosDto) {
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
