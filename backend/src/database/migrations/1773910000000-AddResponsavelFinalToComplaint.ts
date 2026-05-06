import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResponsavelFinalToComplaint1773910000000 implements MigrationInterface {
  name = 'AddResponsavelFinalToComplaint1773910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "complaint" ADD COLUMN IF NOT EXISTS "responsavelFinal" uuid NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "complaint" DROP COLUMN IF EXISTS "responsavelFinal"`);
  }
}
