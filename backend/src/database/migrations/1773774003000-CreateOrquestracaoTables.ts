import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrquestracaoTables1773774003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // capability
    await queryRunner.query(`
      CREATE TABLE "capability" (
        "id"          UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"         VARCHAR   NOT NULL,
        "name"        VARCHAR   NOT NULL,
        "description" TEXT,
        "isActive"    BOOLEAN   NOT NULL DEFAULT true,
        "tipologyId"  UUID,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_capability" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_capability_key" UNIQUE ("key"),
        CONSTRAINT "FK_capability_tipology" FOREIGN KEY ("tipologyId")
          REFERENCES "tipology" ("id") ON DELETE SET NULL
      )
    `);

    // capability_version
    await queryRunner.query(`
      CREATE TABLE "capability_version" (
        "id"           UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "version"      INT       NOT NULL,
        "description"  TEXT,
        "isActive"     BOOLEAN   NOT NULL DEFAULT true,
        "isCurrent"    BOOLEAN   NOT NULL DEFAULT false,
        "capabilityId" UUID      NOT NULL,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_capability_version" PRIMARY KEY ("id"),
        CONSTRAINT "FK_capability_version_capability" FOREIGN KEY ("capabilityId")
          REFERENCES "capability" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_capability_version_capabilityId" ON "capability_version" ("capabilityId")
    `);

    // step_definition
    await queryRunner.query(`
      CREATE TABLE "step_definition" (
        "id"                  UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"                 VARCHAR   NOT NULL,
        "name"                VARCHAR   NOT NULL,
        "description"         TEXT,
        "stepOrder"           INT       NOT NULL,
        "isHumanRequired"     BOOLEAN   NOT NULL DEFAULT false,
        "timeoutSeconds"      INT,
        "isActive"            BOOLEAN   NOT NULL DEFAULT true,
        "capabilityVersionId" UUID      NOT NULL,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_step_definition" PRIMARY KEY ("id"),
        CONSTRAINT "FK_step_definition_capabilityVersion" FOREIGN KEY ("capabilityVersionId")
          REFERENCES "capability_version" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_step_definition_capabilityVersionId" ON "step_definition" ("capabilityVersionId")
    `);

    // step_transition_rule
    await queryRunner.query(`
      CREATE TABLE "step_transition_rule" (
        "id"                  UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "conditionType"       VARCHAR   NOT NULL,
        "conditionExpression" JSONB     NOT NULL,
        "targetStepKey"       VARCHAR   NOT NULL,
        "priority"            INT       NOT NULL DEFAULT 0,
        "description"         TEXT,
        "isActive"            BOOLEAN   NOT NULL DEFAULT true,
        "stepDefinitionId"    UUID      NOT NULL,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_step_transition_rule" PRIMARY KEY ("id"),
        CONSTRAINT "FK_step_transition_rule_stepDefinition" FOREIGN KEY ("stepDefinitionId")
          REFERENCES "step_definition" ("id") ON DELETE CASCADE
      )
    `);

    // skill_definition
    await queryRunner.query(`
      CREATE TABLE "skill_definition" (
        "id"           UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "key"          VARCHAR   NOT NULL,
        "name"         VARCHAR   NOT NULL,
        "description"  TEXT,
        "inputSchema"  JSONB,
        "outputSchema" JSONB,
        "version"      VARCHAR   NOT NULL DEFAULT '1.0.0',
        "isActive"     BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skill_definition" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_skill_definition_key" UNIQUE ("key")
      )
    `);

    // step_skill_binding
    await queryRunner.query(`
      CREATE TABLE "step_skill_binding" (
        "id"               UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "configuration"    JSONB,
        "llmModel"         VARCHAR,
        "promptVersion"    VARCHAR,
        "sortOrder"        INT       NOT NULL DEFAULT 0,
        "isActive"         BOOLEAN   NOT NULL DEFAULT true,
        "stepDefinitionId" UUID      NOT NULL,
        "skillDefinitionId" UUID     NOT NULL,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_step_skill_binding" PRIMARY KEY ("id"),
        CONSTRAINT "FK_step_skill_binding_stepDefinition" FOREIGN KEY ("stepDefinitionId")
          REFERENCES "step_definition" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_step_skill_binding_skillDefinition" FOREIGN KEY ("skillDefinitionId")
          REFERENCES "skill_definition" ("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "step_skill_binding"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skill_definition"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "step_transition_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "step_definition"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "capability_version"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "capability"`);
  }
}
