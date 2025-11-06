import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('用户管理')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: '获取用户列表',
    description: '获取系统中所有用户的列表信息',
  })
  @ApiResponse({
    status: 200,
    description: '成功获取用户列表',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: '张三' },
          email: { type: 'string', example: 'zhangsan@example.com' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '服务器内部错误',
  })
  getHello() {
    return this.usersService.list();
  }
}
