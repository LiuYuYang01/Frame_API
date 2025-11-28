import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionHandler } from './execption/global_exception_handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionHandler());

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动过滤掉 DTO 中未定义的属性
      forbidNonWhitelisted: true, // 如果有未定义的属性，抛出错误
      transform: true, // 自动转换类型
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
    }),
  );

  // 启用 CORS（如果需要前端跨域访问）
  app.enableCors({
    origin: true, // 允许所有来源（生产环境应该设置具体的域名）
    credentials: true,
  });

  // 设置全局请求前缀（排除 api-docs 路径）
  app.setGlobalPrefix('api', {
    exclude: ['docs'],
  });

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('NestJS API 文档')
    .setDescription('NestJS 应用程序接口文档，包含用户管理、文件管理、相册管理、照片管理等模块')
    .setVersion('1.0.0')
    .addTag('用户管理', '用户相关接口')
    .addTag('文件管理', '文件上传、下载、删除等操作')
    .addTag('照片管理', '照片的增删改查操作')
    .addTag('相册管理', '相册的增删改查、添加/移除照片等操作')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: '输入 JWT 令牌',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:6666', '开发环境')
    .addServer('https://api.example.com', '生产环境')
    .setContact('技术支持', 'https://github.com/your-repo', 'support@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true, // 持久化授权
      docExpansion: 'none', // 默认折叠所有接口
      filter: true, // 启用搜索过滤
      showRequestDuration: true, // 显示请求时长
    },
    customSiteTitle: 'NestJS API 文档',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }', // 隐藏顶部栏
  });

  await app.listen(process.env.PORT ?? 6666);
  console.log(`🚀 应用程序正在运行: http://localhost:${process.env.PORT ?? 6666}`);
  console.log(`📚 API 文档地址: http://localhost:${process.env.PORT ?? 6666}/docs`);
}

bootstrap().catch((err) => {
  console.error('应用启动失败:', err);
  process.exit(1);
});
