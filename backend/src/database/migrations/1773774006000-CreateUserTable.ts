import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1773774006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id"           UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "email"        VARCHAR   NOT NULL,
        "passwordHash" VARCHAR   NOT NULL,
        "name"         VARCHAR   NOT NULL,
        "role"         VARCHAR   NOT NULL DEFAULT 'operator',
        "isActive"     BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_user_email" ON "user" ("email")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
