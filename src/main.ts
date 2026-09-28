import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const docsPath = setupSwagger(app);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);

  const log = new Logger('Bootstrap');
  log.log(`KPV API listening on http://localhost:${port}/api`);
  if (docsPath) log.log(`Swagger UI      http://localhost:${port}${docsPath}`);
}

void bootstrap();
