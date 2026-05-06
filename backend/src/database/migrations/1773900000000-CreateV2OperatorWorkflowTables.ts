import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateV2OperatorWorkflowTables1773900000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // complaint_user_note — operator notes attached to a complaint (PIPE-02)
    await queryRunner.query(`
      CREATE TABLE "complaint_user_note" (
        "id"          UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "complaintId" UUID      NOT NULL,
        "userId"      UUID      NOT NULL,
        "content"     TEXT      NOT NULL,
        "parameters"  JSONB,
        "version"     INT       NOT NULL DEFAULT 1,
        "isActive"    BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_user_note" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_user_note_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_complaint_user_note_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_user_note_complaintId"
        ON "complaint_user_note" ("complaintId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_complaint_user_note_active"
        ON "complaint_user_note" ("complaintId")
        WHERE "isActive" = true
    `);

    // access_token — short-lived API tokens for operator authentication (Phase 9)
    await queryRunner.query(`
      CREATE TABLE "access_token" (
        "id"          UUID             NOT NULL DEFAULT uuid_generate_v4(),
        "userId"      UUID             NOT NULL,
        "token"       VARCHAR(64)      NOT NULL,
        "expiresAt"   TIMESTAMPTZ      NOT NULL,
        "lastUsedAt"  TIMESTAMPTZ,
        "isActive"    BOOLEAN          NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMPTZ      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_token" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_token_token" UNIQUE ("token"),
        CONSTRAINT "FK_access_token_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_access_token_userId" ON "access_token" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_access_token_active"
        ON "access_token" ("userId")
        WHERE "isActive" = true
    `);

    // ticket_lock — optimistic lock per complaint (one operator at a time, Phase 9)
    await queryRunner.query(`
      CREATE TABLE "ticket_lock" (
        "id"          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "complaintId" UUID        NOT NULL,
        "userId"      UUID        NOT NULL,
        "lockedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expiresAt"   TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_ticket_lock" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ticket_lock_complaintId" UNIQUE ("complaintId"),
        CONSTRAINT "FK_ticket_lock_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ticket_lock_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_lock_userId" ON "ticket_lock" ("userId")
    `);

    // ticket_timing_event — immutable audit trail of milestones (AUDIT-TIMING)
    // No updatedAt column — append-only, mirrors audit_log pattern from 01-02.
    await queryRunner.query(`
      CREATE TABLE "ticket_timing_event" (
        "id"          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "complaintId" UUID        NOT NULL,
        "executionId" UUID,
        "milestone"   VARCHAR(50) NOT NULL,
        "occurredAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userId"      UUID,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_timing_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticket_timing_event_complaint" FOREIGN KEY ("complaintId")
          REFERENCES "complaint" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ticket_timing_event_execution" FOREIGN KEY ("executionId")
          REFERENCES "ticket_execution" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ticket_timing_event_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_timing_event_complaintId"
        ON "ticket_timing_event" ("complaintId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_timing_event_milestone"
        ON "ticket_timing_event" ("milestone")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_timing_event_executionId"
        ON "ticket_timing_event" ("executionId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_timing_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_lock"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_user_note"`);
  }
}
