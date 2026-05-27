import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiResponseRatingToHumanReview1773930000000 implements MigrationInterface {
  name = 'AddAiResponseRatingToHumanReview1773930000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Operator rating (1-3 stars) of the AI-generated draft. Required for new submissions;
    // nullable so historical rows that pre-date the rating UI remain valid.
    await queryRunner.query(
      `ALTER TABLE "human_review" ADD COLUMN IF NOT EXISTS "aiResponseRating" smallint NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_review" ADD CONSTRAINT "chk_human_review_rating_range"
         CHECK ("aiResponseRating" IS NULL OR ("aiResponseRating" BETWEEN 1 AND 3))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "human_review" DROP CONSTRAINT IF EXISTS "chk_human_review_rating_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "human_review" DROP COLUMN IF EXISTS "aiResponseRating"`,
    );
  }
}
