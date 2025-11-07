import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from './web/user/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Hello World' })
  getHello(): string {
    return '<h1>Hello World!</h1>';
  }
}
