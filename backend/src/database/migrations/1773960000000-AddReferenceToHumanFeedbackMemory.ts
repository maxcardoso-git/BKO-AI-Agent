import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceToHumanFeedbackMemory1773960000000 implements MigrationInterface {
  name = 'AddReferenceToHumanFeedbackMemory1773960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Generic reference for typed corrections that point to a specific entity.
    // For feedbackType='iqi_substitution': referenceId = chosen response_template.id,
    // referenceType = 'response_template'. Lets the learning loop look up
    // "what did the operator switch TO" without parsing text.
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "referenceId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "referenceType" varchar NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hfm_reference"
         ON "human_feedback_memory" ("feedbackType","referenceType","tipologyId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hfm_reference"`);
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "referenceType"`);
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "referenceId"`);
  }
}
