import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperacaoTables1773774001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // complaint
    await queryRunner.query(`
      CREATE TABLE "complaint" (
        "id"                  UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "protocolNumber"      VARCHAR      NOT NULL,
        "rawText"             TEXT         NOT NULL,
        "normalizedText"      TEXT,
        "status"              VARCHAR      NOT NULL DEFAULT 'pending',
        "riskLevel"           VARCHAR      NOT NULL DEFAULT 'low',
        "slaDeadline"         TIMESTAMP,
        "slaBusinessDays"     INT,
        "isOverdue"           BOOLEAN      NOT NULL DEFAULT false,
        "source"              VARCHAR      NOT NULL,
        "externalId"          VARCHAR,
        "procedente"          BOOLEAN,
        "tipologyId"          UUID,
        "subtipologyId"       UUID,
        "situationId"         UUID,
        "regulatoryActionId"  UUID,
        "createdAt"           TIMESTAMP    NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_complaint_protocolNumber" UNIQUE ("protocolNumber")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_status" ON "complaint" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_protocolNumber" ON "complaint" ("protocolNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_tipologyId" ON "complaint" ("tipologyId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_situationId" ON "complaint" ("situationId")
    `);

    // complaint_detail
    await queryRunner.query(`
      CREATE TABLE "complaint_detail" (
        "id"          UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "fieldName"   VARCHAR   NOT NULL,
        "fieldValue"  TEXT      NOT NULL,
        "fieldType"   VARCHAR   NOT NULL,
        "confidence"  FLOAT,
        "source"      VARCHAR   NOT NULL,
        "complaintId" UUID      NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_detail" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_detail_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_detail_complaintId" ON "complaint_detail" ("complaintId")
    `);

    // complaint_history
    await queryRunner.query(`
      CREATE TABLE "complaint_history" (
        "id"             UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "action"         VARCHAR   NOT NULL,
        "description"    TEXT,
        "previousStatus" VARCHAR,
        "newStatus"      VARCHAR,
        "performedBy"    VARCHAR,
        "metadata"       JSONB,
        "complaintId"    UUID      NOT NULL,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_history_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_history_complaintId" ON "complaint_history" ("complaintId")
    `);

    // complaint_attachment
    await queryRunner.query(`
      CREATE TABLE "complaint_attachment" (
        "id"          UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "fileName"    VARCHAR   NOT NULL,
        "fileType"    VARCHAR   NOT NULL,
        "fileSize"    INT       NOT NULL,
        "storagePath" VARCHAR   NOT NULL,
        "uploadedBy"  VARCHAR,
        "complaintId" UUID      NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_attachment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_attachment_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_attachment_complaintId" ON "complaint_attachment" ("complaintId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_attachment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_detail"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint"`);
  }
}
