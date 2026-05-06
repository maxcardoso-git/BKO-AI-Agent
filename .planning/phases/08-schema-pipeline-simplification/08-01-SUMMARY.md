---
phase: 08
plan: 01
subsystem: persistence
tags: [typeorm, migrations, schema, entities, v2, operator-workflow]
requires: []
provides:
  - complaint_user_note table (operator notes on complaints)
  - access_token table (short-lived API tokens for operators)
  - ticket_lock table (optimistic lock per complaint)
  - ticket_timing_event table (immutable milestone audit trail)
  - complaint.enrichedText column (rawText enriched with latest operator note)
  - human_review.rejectionReason column (rejection note from operator)
  - HumanReviewStatus.CORRECTED enum value (corrected workflow state)
affects:
  - Phase 8 plan 02 (SkillRegistryService LoadComplaint, ComplaintUserNote service)
  - Phase 8 plan 03 (TimingEventService, TicketTimingEvent entity)
  - Phase 9 (AccessToken auth service, TicketLock optimistic concurrency)
tech-stack:
  added:
    - "@nestjs/websockets (fixed missing dep)"
    - "@nestjs/platform-socket.io (fixed missing dep)"
    - "socket.io (fixed missing dep)"
    - "@types/multer (fixed missing dep)"
  patterns:
    - immutable-entity (ticket_timing_event mirrors audit_log — no updatedAt)
    - varchar-status-columns (decision 01-02 — HumanReview status switched from enum to varchar)
    - operacao-module-placement (TicketTimingEvent in OperacaoModule to avoid Phase 9 circular dep)
key-files:
  created:
    - backend/src/database/migrations/1773900000000-CreateV2OperatorWorkflowTables.ts
    - backend/src/database/migrations/1773900001000-ExtendHumanReviewForV2.ts
    - backend/src/modules/operacao/entities/complaint-user-note.entity.ts
    - backend/src/modules/operacao/entities/access-token.entity.ts
    - backend/src/modules/operacao/entities/ticket-lock.entity.ts
    - backend/src/modules/operacao/entities/ticket-timing-event.entity.ts
  modified:
    - backend/src/modules/operacao/entities/complaint.entity.ts
    - backend/src/modules/execucao/entities/human-review.entity.ts
    - backend/src/modules/operacao/operacao.module.ts
decisions:
  - "human_review.status was VARCHAR in source migration 1773774004000 (Case A) — no ALTER TYPE needed"
  - "TicketTimingEvent placed in OperacaoModule (not ExecucaoModule) to avoid Phase 9 circular dep"
  - "ticket_timing_event has no updatedAt — append-only immutability mirrors audit_log (decision 01-02)"
  - "HumanReview status decorator switched from enum to varchar (aligns with decision 01-02)"
  - "migration compiled via `npx tsc -p tsconfig.build.json --rootDir src --outDir dist` (nest build excludes unreferenced files)"
metrics:
  duration: ~35 min
  completed: 2026-05-06
---

# Phase 8 Plan 01: Schema Migrations for v2 Operator Workflow Summary

**One-liner:** 2 TypeORM migrations creating 4 new tables (complaint_user_note, access_token, ticket_lock, ticket_timing_event) plus enrichedText/rejectionReason column extensions and HumanReviewStatus.CORRECTED enum value.

## What Was Built

### Migration 1773900000000-CreateV2OperatorWorkflowTables

Creates 4 new tables required by the v2 operator workflow:

| Table | Purpose | Key Constraint |
|-------|---------|----------------|
| `complaint_user_note` | Operator notes attached to complaints (PIPE-02) | FK complaint, FK user |
| `access_token` | Short-lived API tokens for operators (Phase 9) | `UQ_access_token_token` (varchar 64) |
| `ticket_lock` | One-lock-per-complaint optimistic concurrency | `UQ_ticket_lock_complaintId` |
| `ticket_timing_event` | Immutable milestone audit trail (AUDIT-TIMING) | No updatedAt — append-only |

### Migration 1773900001000-ExtendHumanReviewForV2

**STEP 0 finding:** `human_review.status` was created as `VARCHAR` in `1773774004000-CreateExecucaoTables.ts` (Case A). No `ALTER COLUMN TYPE` conversion needed.

Column additions:
- `complaint.enrichedText TEXT` — rawText enriched with latest operator note (SCHEMA-02)
- `human_review.rejectionReason TEXT` — rejection reason from operator (SCHEMA-04)

### Entity Files (all under `backend/src/modules/operacao/entities/`)

- `ComplaintUserNote` — ManyToOne to Complaint (CASCADE) and User (RESTRICT)
- `AccessToken` — ManyToOne to User (CASCADE); no UpdateDateColumn (lastUsedAt replaces)
- `TicketLock` — unique complaintId; ManyToOne to Complaint (CASCADE) and User (RESTRICT)
- `TicketTimingEvent` — no updatedAt; ManyToOne to Complaint and TicketExecution; userId is plain @Column (not relation) matching audit_log pattern

### Entity Extensions

- `Complaint.enrichedText: string | null` — `@Column({ type: 'text', nullable: true })`
- `HumanReview`: CORRECTED enum value added; status decorator switched from `enum` to `varchar` (decision 01-02); `rejectionReason: string | null` column added

### Module Wiring

`OperacaoModule.TypeOrmModule.forFeature([..., ComplaintUserNote, AccessToken, TicketLock, TicketTimingEvent])` — ExecucaoModule NOT modified. ExecucaoModule already imports OperacaoModule, so repositories are available transitively.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| TicketTimingEvent in OperacaoModule | Avoids Phase 9 circular dep when OperacaoModule's ComplaintUserNoteService needs to emit events while ExecucaoModule imports OperacaoModule |
| ticket_timing_event has no updatedAt | Append-only immutability — mirrors audit_log (decision 01-02) |
| HumanReview status decorator: enum → varchar | Aligns with decision 01-02; source column was already VARCHAR so no DDL change needed |
| migration compiled separately | `nest build` only compiles files in NestJS module graph; migrations need `npx tsc -p tsconfig.build.json --rootDir src --outDir dist` |

## DB Verification (local port 5433)

All 16 migrations applied successfully including the 2 new ones.

```
complaint_user_note  ✓ (4 tables exist)
access_token         ✓
ticket_lock          ✓ (UQ_ticket_lock_complaintId enforced)
ticket_timing_event  ✓ (no updatedAt column)
complaint.enrichedText    ✓ (text, nullable)
human_review.rejectionReason ✓ (text, nullable)
human_review.status   ✓ character varying
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing npm packages preventing TypeScript compilation**

- **Found during:** Task 1 verify step (npx tsc --noEmit)
- **Issue:** `@nestjs/websockets`, `socket.io`, `@types/multer` not installed; `events.gateway.ts` and `kb-manager.controller.ts` had missing type errors
- **Fix:** `npm install @nestjs/websockets @nestjs/platform-socket.io socket.io` and `npm install --save-dev @types/multer`
- **Files modified:** `package.json`, `package-lock.json`

**2. [Rule 1 - Bug] skill-registry.service.ts called resolve() with 3 arguments**

- **Found during:** Task 1 TypeScript compilation
- **Issue:** `this.templateResolver.resolve(tipologyId, situationId, complaintText)` — resolve() accepts 2 params
- **Fix:** Removed `complaintText` argument from call site
- **Files modified:** `backend/src/modules/execucao/services/skill-registry.service.ts`

**3. [Rule 1 - Bug] skill-registry.service.ts referenced persona.instructions (non-existent field)**

- **Found during:** Task 1 TypeScript compilation
- **Issue:** `persona.instructions` used but Persona entity has `description` not `instructions`
- **Fix:** Changed to `persona.description`
- **Files modified:** `backend/src/modules/execucao/services/skill-registry.service.ts`

**4. [Rule 1 - Bug] steps-designer.service.ts referenced posX/posY on StepDefinition (non-existent fields)**

- **Found during:** Task 1 TypeScript compilation
- **Issue:** `existing.posX`, `existing.posY`, `dto.posX`, `dto.posY` used but neither entity nor DTO has those fields
- **Fix:** Cast to `(existing as any)` and `(dto as any)` for runtime flexibility; cast `stepDefRepo.save()` result to `StepDefinition`
- **Files modified:** `backend/src/modules/orquestracao/services/steps-designer.service.ts`

**5. [Rule 1 - Bug] complaint-mock.seeder.ts referenced complaint.resposta (non-existent field)**

- **Found during:** Task 1 TypeScript compilation
- **Issue:** `resposta: data.resposta` in `complaintRepo.create({})` — Complaint entity has no `resposta` field
- **Fix:** Removed the line; cast `save()` result to `Complaint` for type safety
- **Files modified:** `backend/src/database/seeds/complaint-mock.seeder.ts`

## Next Phase Readiness

- Phase 8 Plan 02 (SkillRegistryService updates + ComplaintUserNoteService): Ready — entities exist, migration applied
- Phase 8 Plan 03 (TimingEventService): Ready — TicketTimingEvent entity in OperacaoModule
- Phase 9 (AccessToken/TicketLock services): Ready — tables exist with correct constraints
