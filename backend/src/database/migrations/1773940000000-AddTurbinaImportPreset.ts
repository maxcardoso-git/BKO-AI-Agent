import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTurbinaImportPreset1773940000000 implements MigrationInterface {
  name = 'AddTurbinaImportPreset1773940000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "turbina_import_preset" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "filters" jsonb NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_turbina_import_preset_user" ON "turbina_import_preset" ("userId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_turbina_import_preset_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "turbina_import_preset"`);
  }
}
