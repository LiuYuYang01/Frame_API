/**
 * JWT 配置常量
 * 统一管理 JWT 相关配置，避免在多个地方重复定义
 */
export const JWT_SECRET = 'liuyuyang1024'; // 生产环境应该使用环境变量 process.env.JWT_SECRET
export const JWT_EXPIRES_IN = '3d'; // Token 过期时间
