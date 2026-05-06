import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourcesTable1773880000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "resource" (
        "id"                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"              VARCHAR NOT NULL,
        "type"              VARCHAR NOT NULL DEFAULT 'API_HTTP',
        "subtype"           VARCHAR NOT NULL DEFAULT 'NONE',
        "llmProvider"       VARCHAR,
        "llmModel"          VARCHAR,
        "endpoint"          VARCHAR,
        "httpMethod"        VARCHAR NOT NULL DEFAULT 'POST',
        "authMode"          VARCHAR NOT NULL DEFAULT 'NONE',
        "bearerToken"       TEXT,
        "apiKeyHeader"      VARCHAR,
        "apiKeyValue"       TEXT,
        "basicUser"         VARCHAR,
        "basicPassword"     TEXT,
        "connectionJson"    JSONB,
        "configurationJson" JSONB,
        "metadataJson"      JSONB,
        "tags"              TEXT,
        "environment"       VARCHAR NOT NULL DEFAULT 'PROD',
        "isActive"          BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Add resourceId FK to llm_model_config
    await qr.query(`
      ALTER TABLE "llm_model_config"
        ADD COLUMN IF NOT EXISTS "resourceId" UUID REFERENCES "resource"("id") ON DELETE SET NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "llm_model_config" DROP COLUMN IF EXISTS "resourceId"`);
    await qr.query(`DROP TABLE IF EXISTS "resource"`);
  }
}
