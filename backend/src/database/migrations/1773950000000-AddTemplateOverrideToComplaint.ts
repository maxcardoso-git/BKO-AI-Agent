import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateOverrideToComplaint1773950000000 implements MigrationInterface {
  name = 'AddTemplateOverrideToComplaint1773950000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Operator-forced IQI template. When set, TemplateResolverService.resolve()
    // returns this template regardless of tipologyId/situationId matching.
    // Used when the operator disagrees with the IA's IQI choice on /processar.
    await queryRunner.query(
      `ALTER TABLE "complaint" ADD COLUMN IF NOT EXISTS "templateOverrideId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint"
        ADD CONSTRAINT "FK_complaint_template_override"
        FOREIGN KEY ("templateOverrideId")
        REFERENCES "response_template"("id")
        ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "complaint" DROP CONSTRAINT IF EXISTS "FK_complaint_template_override"`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint" DROP COLUMN IF EXISTS "templateOverrideId"`,
    );
  }
}
