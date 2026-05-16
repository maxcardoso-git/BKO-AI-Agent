// pgvector type registration is handled by PgvectorBootstrapService (OnModuleInit)
// which hooks into the pg pool after the TypeORM DataSource is initialized.
// See: src/database/pgvector-bootstrap.service.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser:false disables the Nest-default body-parser so our custom
  // limit-aware express middlewares below are the only ones registered.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Raise body size limit to support bulk imports (Turbina CSV batches).
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
