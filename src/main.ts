import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { assertShopTimezone } from './common/shop-timezone';

async function bootstrap(): Promise<void> {
  // Before anything can record a transaction,
  // make sure the host can date it.
  assertShopTimezone();

  const app = await NestFactory.create(AppModule);

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS
  const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string, callback: (arg0: Error | null, arg1: boolean) => any) => {
      // Allow requests without Origin header
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`), false);
    },

    credentials: true,

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

  // Listen on all network interfaces
  const port = process.env.API_PORT || 4000;

  await app.listen(port, '0.0.0.0');

  Logger.log(`API running on http://0.0.0.0:${port}`);
  Logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();