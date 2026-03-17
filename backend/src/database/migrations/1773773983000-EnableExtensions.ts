import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableExtensions1773773983000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Extensions are kept on rollback to prevent data loss
  }
}
