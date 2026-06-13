import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import helmet from 'helmet';

// Задаём UTC до создания pg-соединений. Драйвер pg читает timezone
// при установке соединения — поэтому ОБЯЗАТЕЛЬНО до NestFactory.create().
process.env.TZ = 'UTC';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Защитные HTTP-заголовки: X-Frame-Options, X-Content-Type-Options,
  // Strict-Transport-Security, Content-Security-Policy и др.
  app.use(helmet());

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new MulterExceptionFilter());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api`);
}

bootstrap();