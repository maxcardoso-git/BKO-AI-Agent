import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendHumanReviewForV21773900001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // SCHEMA-02: Add enrichedText column to complaint (operator note enrichment)
    await queryRunner.query(
      `ALTER TABLE "complaint" ADD COLUMN IF NOT EXISTS "enrichedText" TEXT`,
    );

    // SCHEMA-03 + status column safety:
    // Inspected migration 1773774004000-CreateExecucaoTables.ts: human_review.status was created as
    // VARCHAR (see: `"status" VARCHAR NOT NULL DEFAULT 'pending'`).
    // Case A: No ALTER TYPE needed — column already accepts arbitrary strings.
    // Entity decorator switches from `enum` to `varchar` (TypeScript-only change per decision 01-02).
    // HumanReviewStatus.CORRECTED added at TypeScript layer only — no PG enum to alter.

    // SCHEMA-04: Add rejectionReason column to human_review (operator rejection note)
    await queryRunner.query(
      `ALTER TABLE "human_review" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "complaint" DROP COLUMN IF EXISTS "enrichedText"`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_review" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    // NOTE: We do NOT recreate any enum type in down() — irreversible by design.
    // Rows with status='corrected' would violate a recreated enum constraint.
  }
}
