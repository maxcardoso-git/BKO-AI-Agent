import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExecucaoTables1773774004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ticket_execution
    await queryRunner.query(`
      CREATE TABLE "ticket_execution" (
        "id"                  UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "status"              VARCHAR   NOT NULL DEFAULT 'pending',
        "startedAt"           TIMESTAMP,
        "completedAt"         TIMESTAMP,
        "currentStepKey"      VARCHAR,
        "totalDurationMs"     INT,
        "errorMessage"        TEXT,
        "metadata"            JSONB,
        "complaintId"         UUID      NOT NULL,
        "capabilityVersionId" UUID      NOT NULL,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_execution" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticket_execution_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ticket_execution_capabilityVersion" FOREIGN KEY ("capabilityVersionId")
          REFERENCES "capability_version" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_execution_complaintId" ON "ticket_execution" ("complaintId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_execution_status" ON "ticket_execution" ("status")
    `);

    // step_execution
    await queryRunner.query(`
      CREATE TABLE "step_execution" (
        "id"                UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "stepKey"           VARCHAR   NOT NULL,
        "status"            VARCHAR   NOT NULL DEFAULT 'pending',
        "startedAt"         TIMESTAMP,
        "completedAt"       TIMESTAMP,
        "durationMs"        INT,
        "input"             JSONB,
        "output"            JSONB,
        "errorMessage"      TEXT,
        "retryCount"        INT       NOT NULL DEFAULT 0,
        "ticketExecutionId" UUID      NOT NULL,
        "stepDefinitionId"  UUID,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_step_execution" PRIMARY KEY ("id"),
        CONSTRAINT "FK_step_execution_ticketExecution" FOREIGN KEY ("ticketExecutionId")
          REFERENCES "ticket_execution" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_step_execution_stepDefinition" FOREIGN KEY ("stepDefinitionId")
          REFERENCES "step_definition" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_step_execution_ticketExecutionId" ON "step_execution" ("ticketExecutionId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_step_execution_status" ON "step_execution" ("status")
    `);

    // artifact
    await queryRunner.query(`
      CREATE TABLE "artifact" (
        "id"               UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "artifactType"     VARCHAR   NOT NULL,
        "content"          JSONB     NOT NULL,
        "version"          INT       NOT NULL DEFAULT 1,
        "stepExecutionId"  UUID      NOT NULL,
        "complaintId"      UUID      NOT NULL,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_artifact" PRIMARY KEY ("id"),
        CONSTRAINT "FK_artifact_stepExecution" FOREIGN KEY ("stepExecutionId")
          REFERENCES "step_execution" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_artifact_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_artifact_stepExecutionId" ON "artifact" ("stepExecutionId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_artifact_complaintId" ON "artifact" ("complaintId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_artifact_artifactType" ON "artifact" ("artifactType")
    `);

    // token_usage
    await queryRunner.query(`
      CREATE TABLE "token_usage" (
        "id"                UUID           NOT NULL DEFAULT uuid_generate_v4(),
        "promptTokens"      INT            NOT NULL,
        "completionTokens"  INT            NOT NULL,
        "totalTokens"       INT            NOT NULL,
        "costUsd"           DECIMAL(10,6)  NOT NULL,
        "model"             VARCHAR        NOT NULL,
        "createdAt"         TIMESTAMP      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_usage" PRIMARY KEY ("id")
      )
    `);

    // llm_call
    await queryRunner.query(`
      CREATE TABLE "llm_call" (
        "id"               UUID           NOT NULL DEFAULT uuid_generate_v4(),
        "model"            VARCHAR        NOT NULL,
        "provider"         VARCHAR        NOT NULL,
        "promptTokens"     INT            NOT NULL,
        "completionTokens" INT            NOT NULL,
        "totalTokens"      INT            NOT NULL,
        "costUsd"          DECIMAL(10,6),
        "latencyMs"        INT,
        "promptHash"       VARCHAR,
        "responseStatus"   VARCHAR        NOT NULL,
        "errorMessage"     TEXT,
        "stepExecutionId"  UUID           NOT NULL,
        "tokenUsageId"     UUID,
        "createdAt"        TIMESTAMP      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_llm_call" PRIMARY KEY ("id"),
        CONSTRAINT "FK_llm_call_stepExecution" FOREIGN KEY ("stepExecutionId")
          REFERENCES "step_execution" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_llm_call_tokenUsage" FOREIGN KEY ("tokenUsageId")
          REFERENCES "token_usage" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_llm_call_stepExecutionId" ON "llm_call" ("stepExecutionId")
    `);

    // human_review
    await queryRunner.query(`
      CREATE TABLE "human_review" (
        "id"               UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "reviewerUserId"   VARCHAR   NOT NULL,
        "status"           VARCHAR   NOT NULL DEFAULT 'pending',
        "aiGeneratedText"  TEXT      NOT NULL,
        "humanFinalText"   TEXT,
        "diffSummary"      TEXT,
        "correctionReason" TEXT,
        "checklistCompleted" BOOLEAN NOT NULL DEFAULT false,
        "checklistItems"   JSONB,
        "observations"     TEXT,
        "reviewedAt"       TIMESTAMP,
        "stepExecutionId"  UUID      NOT NULL,
        "complaintId"      UUID      NOT NULL,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_human_review" PRIMARY KEY ("id"),
        CONSTRAINT "FK_human_review_stepExecution" FOREIGN KEY ("stepExecutionId")
          REFERENCES "step_execution" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_human_review_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_human_review_complaintId" ON "human_review" ("complaintId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_human_review_status" ON "human_review" ("status")
    `);

    // audit_log — append-only, no updatedAt
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id"         UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "action"     VARCHAR   NOT NULL,
        "entityType" VARCHAR   NOT NULL,
        "entityId"   VARCHAR   NOT NULL,
        "userId"     VARCHAR,
        "details"    JSONB,
        "ipAddress"  VARCHAR,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_log_entityType_entityId" ON "audit_log" ("entityType", "entityId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_log_action" ON "audit_log" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_log_createdAt" ON "audit_log" ("createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "human_review"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "llm_call"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_usage"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "artifact"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "step_execution"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_execution"`);
  }
}
