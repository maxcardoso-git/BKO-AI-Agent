import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as pgvector from 'pgvector/pg';

/**
 * Registers pgvector types on each new pg client connection.
 * Must run after the TypeORM DataSource is initialized so vector columns
 * can be parsed correctly by the pg driver.
 */
@Injectable()
export class PgvectorBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PgvectorBootstrapService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Access the underlying pg Pool from TypeORM's postgres driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (this.dataSource.driver as any).master;
    if (pool) {
      pool.on('connect', async (client: any) => {
        try {
          await (pgvector as any).registerTypes(client);
        } catch {
          // vector extension may not exist yet (before migration runs)
        }
      });
      this.logger.log('pgvector type registration hook installed on pg pool');
    }
  }
}
