import { SetMetadata } from '@nestjs/common';

/**
 * Public 装饰器 - 用于标记不需要 JWT 认证的接口
 * 使用方式: @Public()
 */
export const Public = () => SetMetadata('isPublic', true);
