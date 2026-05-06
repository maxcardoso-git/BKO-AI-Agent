import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntelligenceLayer1773774007000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // llm_model_config table
    await queryRunner.query(`
      CREATE TABLE "llm_model_config" (
        "id"                UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "functionalityType" VARCHAR   NOT NULL,
        "provider"          VARCHAR   NOT NULL,
        "modelId"           VARCHAR   NOT NULL,
        "apiKeyEnvVar"      VARCHAR,
        "temperature"       FLOAT     NOT NULL DEFAULT 0.3,
        "maxTokens"         INT,
        "isActive"          BOOLEAN   NOT NULL DEFAULT true,
        "fallbackConfigId"  UUID,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_llm_model_config" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_llm_model_config_functionalityType" UNIQUE ("functionalityType"),
        CONSTRAINT "FK_llm_model_config_fallback" FOREIGN KEY ("fallbackConfigId")
          REFERENCES "llm_model_config" ("id") ON DELETE SET NULL
      )
    `);

    // IVFFlat cosine index on kb_chunk.embedding for vector similarity search
    // lists=100 is appropriate for < 1M vectors (research recommendation)
    await queryRunner.query(`
      CREATE INDEX "IDX_kb_chunk_embedding_cosine"
      ON "kb_chunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_kb_chunk_embedding_cosine"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "llm_model_config"`);
  }
}
