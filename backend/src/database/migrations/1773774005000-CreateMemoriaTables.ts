import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMemoriaTables1773774005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // kb_document
    await queryRunner.query(`
      CREATE TABLE "kb_document" (
        "id"         UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "title"      VARCHAR   NOT NULL,
        "sourceType" VARCHAR   NOT NULL,
        "filePath"   VARCHAR,
        "mimeType"   VARCHAR,
        "isActive"   BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kb_document" PRIMARY KEY ("id")
      )
    `);

    // kb_document_version
    await queryRunner.query(`
      CREATE TABLE "kb_document_version" (
        "id"                UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "version"           INT       NOT NULL,
        "changeDescription" TEXT,
        "processedAt"       TIMESTAMP,
        "chunkCount"        INT       NOT NULL DEFAULT 0,
        "isActive"          BOOLEAN   NOT NULL DEFAULT true,
        "documentId"        UUID      NOT NULL,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kb_document_version" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kb_document_version_document" FOREIGN KEY ("documentId")
          REFERENCES "kb_document" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_kb_document_version_documentId" ON "kb_document_version" ("documentId")
    `);

    // kb_chunk — vector(1536) for pgvector embeddings
    await queryRunner.query(`
      CREATE TABLE "kb_chunk" (
        "id"                UUID           NOT NULL DEFAULT uuid_generate_v4(),
        "content"           TEXT           NOT NULL,
        "chunkIndex"        INT            NOT NULL,
        "sectionTitle"      VARCHAR,
        "metadata"          JSONB,
        "embedding"         vector(1536)   NOT NULL,
        "documentVersionId" UUID           NOT NULL,
        "createdAt"         TIMESTAMP      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kb_chunk" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kb_chunk_documentVersion" FOREIGN KEY ("documentVersionId")
          REFERENCES "kb_document_version" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_kb_chunk_documentVersionId" ON "kb_chunk" ("documentVersionId")
    `);

    // case_memory — vector(1536) for similarity search
    await queryRunner.query(`
      CREATE TABLE "case_memory" (
        "id"              UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "summary"         TEXT         NOT NULL,
        "decision"        TEXT,
        "outcome"         VARCHAR,
        "responseSnippet" TEXT,
        "embedding"       vector(1536) NOT NULL,
        "isActive"        BOOLEAN      NOT NULL DEFAULT true,
        "complaintId"     UUID         NOT NULL,
        "tipologyId"      UUID,
        "createdAt"       TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_case_memory" PRIMARY KEY ("id"),
        CONSTRAINT "FK_case_memory_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_case_memory_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_case_memory_complaintId" ON "case_memory" ("complaintId")
    `);

    // human_feedback_memory — vector(1536) for correction pattern similarity
    await queryRunner.query(`
      CREATE TABLE "human_feedback_memory" (
        "id"                 UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aiText"             TEXT         NOT NULL,
        "humanText"          TEXT         NOT NULL,
        "diffDescription"    TEXT,
        "correctionCategory" VARCHAR,
        "correctionWeight"   FLOAT        NOT NULL DEFAULT 1.0,
        "embedding"          vector(1536) NOT NULL,
        "complaintId"        UUID,
        "tipologyId"         UUID,
        "createdAt"          TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_human_feedback_memory" PRIMARY KEY ("id"),
        CONSTRAINT "FK_human_feedback_memory_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_human_feedback_memory_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL
      )
    `);

    // style_memory
    await queryRunner.query(`
      CREATE TABLE "style_memory" (
        "id"             UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "expressionText" TEXT      NOT NULL,
        "expressionType" VARCHAR   NOT NULL,
        "context"        TEXT,
        "source"         VARCHAR,
        "isActive"       BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"     UUID,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_style_memory" PRIMARY KEY ("id"),
        CONSTRAINT "FK_style_memory_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "style_memory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "human_feedback_memory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case_memory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kb_chunk"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kb_document_version"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kb_document"`);
  }
}
