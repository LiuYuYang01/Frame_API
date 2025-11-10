export class Result<T> {
  code: number; // 响应码，200 代表成功; 400 代表失败
  message: string; // 响应码 描述字符串
  data: T; // 返回的数据

  constructor(code: number, message: string, data: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  static status(flag: boolean): Result<null> {
    return flag ? Result.success('操作成功') : Result.error('操作失败');
  }

  // 成功响应
  static success(): Result<null>;
  static success<T>(message: string): Result<T>;
  static success<T>(data: T): Result<T>;
  static success<T>(message: string, data: T): Result<T>;
  static success<T>(messageOrData?: string | T, data?: T): Result<T | null> {
    if (arguments.length === 0) {
      return new Result<null>(200, 'ok', null);
    }

    if (arguments.length === 1) {
      if (typeof messageOrData === 'string') {
        return new Result<T>(200, messageOrData, null as T);
      } else {
        return new Result<T>(200, 'ok', messageOrData as T);
      }
    }
    return new Result<T>(200, messageOrData as string, data as T);
  }

  static ok<T extends Record<string, unknown>>(data: T): Result<T> {
    return new Result<T>(200, 'ok', data);
  }

  // 失败响应
  static error(): Result<null>;
  static error<T>(message: string): Result<T>;
  static error<T>(code: number, message: string): Result<T>;
  static error<T>(codeOrMessage?: number | string, message?: string): Result<T | null> {
    if (arguments.length === 0) {
      return new Result<null>(400, 'no', null);
    }

    if (arguments.length === 1) {
      return new Result<T>(400, codeOrMessage as string, null as T);
    }
    return new Result<T>(codeOrMessage as number, message as string, null as T);
  }
}
