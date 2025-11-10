import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Result } from '@/utils/response';

// 自定义异常类
export class CustomException extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'CustomException';
  }
}

@Catch() // 捕获所有异常
export class GlobalExceptionHandler implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 打印异常信息到控制台
    console.error(exception);

    let result: Result<null>;

    // 处理自定义异常
    if (exception instanceof CustomException) {
      result = Result.error(exception.code, exception.message);
      response.status(HttpStatus.OK).json(result);
      return;
    }

    // 处理 NestJS 内置的 HTTP 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as { message?: string }).message || exception.message;

      result = Result.error(status, message);
      response.status(HttpStatus.OK).json(result);
      return;
    }

    // 处理所有其他异常
    if (exception instanceof Error) {
      result = Result.error(exception.message);
      response.status(HttpStatus.OK).json(result);
      return;
    }

    // 处理未知类型的异常
    result = Result.error('未知错误');
    response.status(HttpStatus.OK).json(result);
  }
}
