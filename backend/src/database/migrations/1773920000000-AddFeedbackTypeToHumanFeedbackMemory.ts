import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackTypeToHumanFeedbackMemory1773920000000 implements MigrationInterface {
  name = 'AddFeedbackTypeToHumanFeedbackMemory1773920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "feedbackType" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "rejectionReason" text NULL`,
    );
    // Backfill: any existing row is a 'correction' (legacy behavior persisted only corrections)
    await queryRunner.query(
      `UPDATE "human_feedback_memory" SET "feedbackType" = 'correction' WHERE "feedbackType" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hfm_feedback_type" ON "human_feedback_memory" ("feedbackType")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hfm_tipology_feedback" ON "human_feedback_memory" ("tipologyId","feedbackType")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hfm_tipology_feedback"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hfm_feedback_type"`);
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "feedbackType"`,
    );
  }
}
