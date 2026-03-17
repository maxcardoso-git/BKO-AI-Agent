import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PgvectorBootstrapService } from './database/pgvector-bootstrap.service';
import { OperacaoModule } from './modules/operacao/operacao.module';
import { RegulatorioModule } from './modules/regulatorio/regulatorio.module';
import { OrquestracaoModule } from './modules/orquestracao/orquestracao.module';
import { ExecucaoModule } from './modules/execucao/execucao.module';
import { MemoriaModule } from './modules/memoria/memoria.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        EMBEDDING_DIMENSIONS: Joi.number().default(1536),
        NODE_ENV: Joi.string().default('development'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/database/migrations/*.js'],
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    OperacaoModule,
    RegulatorioModule,
    OrquestracaoModule,
    ExecucaoModule,
    MemoriaModule,
  ],
  controllers: [AppController],
  providers: [AppService, PgvectorBootstrapService],
})
export class AppModule {}
