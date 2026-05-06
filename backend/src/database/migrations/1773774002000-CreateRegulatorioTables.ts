import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegulatorioTables1773774002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // tipology
    await queryRunner.query(`
      CREATE TABLE "tipology" (
        "id"              UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"             VARCHAR   NOT NULL,
        "label"           VARCHAR   NOT NULL,
        "description"     TEXT,
        "slaBusinessDays" INT       NOT NULL,
        "isActive"        BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tipology" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tipology_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tipology_key" ON "tipology" ("key")
    `);

    // subtipology
    await queryRunner.query(`
      CREATE TABLE "subtipology" (
        "id"          UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"         VARCHAR   NOT NULL,
        "label"       VARCHAR   NOT NULL,
        "description" TEXT,
        "isActive"    BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"  UUID      NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subtipology" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subtipology_key" UNIQUE ("key"),
        CONSTRAINT "FK_subtipology_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subtipology_tipologyId" ON "subtipology" ("tipologyId")
    `);

    // situation
    await queryRunner.query(`
      CREATE TABLE "situation" (
        "id"               UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"              VARCHAR   NOT NULL,
        "label"            VARCHAR   NOT NULL,
        "slaOverrideDays"  INT,
        "description"      TEXT,
        "isActive"         BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_situation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_situation_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_situation_key" ON "situation" ("key")
    `);

    // regulatory_rule
    await queryRunner.query(`
      CREATE TABLE "regulatory_rule" (
        "id"             UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "code"           VARCHAR   NOT NULL,
        "title"          VARCHAR   NOT NULL,
        "description"    TEXT      NOT NULL,
        "sourceDocument" VARCHAR   NOT NULL,
        "sourceSection"  VARCHAR,
        "ruleType"       VARCHAR   NOT NULL,
        "isActive"       BOOLEAN   NOT NULL DEFAULT true,
        "metadata"       JSONB,
        "tipologyId"     UUID,
        "situationId"    UUID,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_rule" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_rule_code" UNIQUE ("code"),
        CONSTRAINT "FK_regulatory_rule_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_regulatory_rule_situation" FOREIGN KEY ("situationId")
          REFERENCES "situation" ("id") ON DELETE SET NULL
      )
    `);

    // regulatory_action
    await queryRunner.query(`
      CREATE TABLE "regulatory_action" (
        "id"                   UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"                  VARCHAR   NOT NULL,
        "label"                VARCHAR   NOT NULL,
        "description"          TEXT,
        "requiresJustification" BOOLEAN  NOT NULL DEFAULT false,
        "isActive"             BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_action" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_action_key" UNIQUE ("key")
      )
    `);

    // persona
    await queryRunner.query(`
      CREATE TABLE "persona" (
        "id"                   UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "name"                 VARCHAR   NOT NULL,
        "description"          TEXT,
        "formalityLevel"       INT       NOT NULL,
        "empathyLevel"         INT       NOT NULL,
        "assertivenessLevel"   INT       NOT NULL,
        "requiredExpressions"  TEXT[],
        "forbiddenExpressions" TEXT[],
        "isActive"             BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"           UUID,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_persona" PRIMARY KEY ("id"),
        CONSTRAINT "FK_persona_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL
      )
    `);

    // response_template
    await queryRunner.query(`
      CREATE TABLE "response_template" (
        "id"              UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "name"            VARCHAR   NOT NULL,
        "templateContent" TEXT      NOT NULL,
        "version"         INT       NOT NULL DEFAULT 1,
        "sourceDocument"  VARCHAR,
        "isActive"        BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"      UUID,
        "situationId"     UUID,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_response_template" PRIMARY KEY ("id"),
        CONSTRAINT "FK_response_template_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_response_template_situation" FOREIGN KEY ("situationId")
          REFERENCES "situation" ("id") ON DELETE SET NULL
      )
    `);

    // mandatory_info_rule
    await queryRunner.query(`
      CREATE TABLE "mandatory_info_rule" (
        "id"             UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "fieldName"      VARCHAR   NOT NULL,
        "fieldLabel"     VARCHAR   NOT NULL,
        "description"    TEXT,
        "validationRule" VARCHAR,
        "isRequired"     BOOLEAN   NOT NULL DEFAULT true,
        "sortOrder"      INT       NOT NULL DEFAULT 0,
        "isActive"       BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"     UUID,
        "situationId"    UUID,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mandatory_info_rule" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mandatory_info_rule_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_mandatory_info_rule_situation" FOREIGN KEY ("situationId")
          REFERENCES "situation" ("id") ON DELETE SET NULL
      )
    `);

    // Now add FK constraints on complaint that reference regulatorio tables
    await queryRunner.query(`
      ALTER TABLE "complaint"
        ADD CONSTRAINT "FK_complaint_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_complaint_subtipology" FOREIGN KEY ("subtipologyId")
          REFERENCES "subtipology" ("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_complaint_situation" FOREIGN KEY ("situationId")
          REFERENCES "situation" ("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_complaint_regulatoryAction" FOREIGN KEY ("regulatoryActionId")
          REFERENCES "regulatory_action" ("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Remove cross-table FKs first
    await queryRunner.query(`
      ALTER TABLE "complaint"
        DROP CONSTRAINT IF EXISTS "FK_complaint_tipology",
        DROP CONSTRAINT IF EXISTS "FK_complaint_subtipology",
        DROP CONSTRAINT IF EXISTS "FK_complaint_situation",
        DROP CONSTRAINT IF EXISTS "FK_complaint_regulatoryAction"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "mandatory_info_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "response_template"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "persona"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "regulatory_action"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "regulatory_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "situation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subtipology"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tipology"`);
  }
}
