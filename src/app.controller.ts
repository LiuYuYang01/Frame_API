import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Hello World' })
  getHello(): string {
    return '<h1>Hello World!</h1>';
  }
}
