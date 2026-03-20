import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateLlmModelConfig1773850000000 implements MigrationInterface {
  name = 'UpdateLlmModelConfig1773850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename maxTokens → maxOutputTokens
    await queryRunner.query(`
      ALTER TABLE llm_model_config
      RENAME COLUMN "maxTokens" TO "maxOutputTokens"
    `);

    // Add cost columns
    await queryRunner.query(`
      ALTER TABLE llm_model_config
      ADD COLUMN IF NOT EXISTS "costPerInputToken" float NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "costPerOutputToken" float NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE llm_model_config DROP COLUMN IF EXISTS "costPerOutputToken"`);
    await queryRunner.query(`ALTER TABLE llm_model_config DROP COLUMN IF EXISTS "costPerInputToken"`);
    await queryRunner.query(`ALTER TABLE llm_model_config RENAME COLUMN "maxOutputTokens" TO "maxTokens"`);
  }
}
