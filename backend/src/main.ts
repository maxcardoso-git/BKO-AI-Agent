// pgvector type registration is handled by PgvectorBootstrapService (OnModuleInit)
// which hooks into the pg pool after the TypeORM DataSource is initialized.
// See: src/database/pgvector-bootstrap.service.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3001);
}
bootstrap();
