import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { assertShopTimezone } from './common/shop-timezone';

async function bootstrap(): Promise<void> {
  // Check shop timezone before anything can record a transaction.
  assertShopTimezone();

  const app = await NestFactory.create(AppModule);

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS - Allow ALL origins
  app.enableCors({
    origin: '*',

    methods: [
      'GET',
      'HEAD',
      'PUT',
      'PATCH',
      'POST',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],

    exposedHeaders: [
      'Content-Length',
      'Content-Range',
    ],

    optionsSuccessStatus: 204,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  setupSwagger(app);

  // Start API
  const port = process.env.API_PORT || 4000;

  await app.listen(port, '0.0.0.0');

  Logger.log(`API running on port ${port}`);
}

bootstrap();
