import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstructionsToPersona1780000000000 implements MigrationInterface {
  name = 'AddInstructionsToPersona1780000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Free-text generation brief injected into the LLM system prompt by the
    // draft generator and smart-note. Lets admins steer the IA per tipology
    // (e.g. character cap, where to insert the answer in the IQI template,
    // tone hints beyond the numeric levels). Optional — null means no extra
    // steering beyond formality/empathy/assertiveness + required/forbidden.
    await queryRunner.query(
      `ALTER TABLE "persona" ADD COLUMN IF NOT EXISTS "instructions" text NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "persona" DROP COLUMN IF EXISTS "instructions"`,
    );
  }
}
