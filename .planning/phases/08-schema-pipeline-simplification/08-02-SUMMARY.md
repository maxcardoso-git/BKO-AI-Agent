---
phase: 08
plan: 02
subsystem: pipeline-simplification
tags: [migration, skill-registry, enrichedText, timing-events, typeorm, pipeline]
one-liner: "Pipeline reduced 16→14 steps via migration; loadComplaint now emits enrichedText + ticket_created timing event"

dependency-graph:
  requires: ["08-01 — created complaint_user_note, ticket_timing_event, enrichedText column"]
  provides:
    - "Migration 1773900002000 — deactivates retrieve_discount* / retrieve_invoice* steps"
    - "loadComplaint skill returns enrichedText with [NOTA OPERADOR] delimiter"
    - "ticket_created TicketTimingEvent emitted idempotently from loadComplaint"
    - "complaint.enrichedText column persisted on first LoadComplaint run"
  affects: ["08-03 — DraftFinalResponse can read enrichedText from skill input"]

tech-stack:
  added: []
  patterns:
    - "Idempotent SQL UPDATE via LIKE patterns (4 variants) for key case insensitivity"
    - "Repository.findOne with ORDER BY + isActive filter for latest-version-note lookup"
    - "Idempotent event emission via findOne + conditional save"

key-files:
  created:
    - backend/src/database/migrations/1773900002000-DeactivateRetrieveDiscountAndInvoiceSteps.ts
  modified:
    - backend/src/modules/execucao/services/skill-registry.service.ts

decisions:
  - "Migration uses 4 LIKE patterns (retrieve_discount%, retrieve_invoice%, retrievediscount%, retrieveinvoice%) to cover CamelCase and snake_case variants — LOWER() cast makes it case-insensitive"
  - "RetrieveDiscounts/RetrieveInvoices skill code kept in skill-registry.service.ts (PIPE-04 — historical capability; manual re-activation still works)"
  - "TicketTimingEvent and ComplaintUserNote repos injected via @InjectRepository — resolved transitively because ExecucaoModule imports OperacaoModule (which exports TypeOrmModule with both entities)"
  - "enrichedText persisted to complaint.enrichedText only when value changes (equality guard prevents unnecessary DB writes)"
  - "ticket_created event uses complaint.createdAt as occurredAt (backfills correct timestamp even for existing complaints)"
  - "Smoke test ran against remote DB (72.61.52.70:5433) via local backend on port 3001 — .env points to remote DB by design"

metrics:
  duration: "~40 minutes"
  completed: "2026-05-06"
---

# Phase 8 Plan 02: Pipeline Simplification — Step Deactivation + enrichedText Summary

Pipeline reduced from 16 to 14 active steps via migration, LoadComplaint skill enriched with operator note composition and first-run timing event.

## What Was Built

### Task 1: Migration 1773900002000 — Deactivate retrieve_discount* / retrieve_invoice* Steps

**File:** `backend/src/database/migrations/1773900002000-DeactivateRetrieveDiscountAndInvoiceSteps.ts`

**Class:** `DeactivateRetrieveDiscountAndInvoiceSteps1773900002000`

**up():** Single idempotent UPDATE using 4 LIKE patterns:
```sql
UPDATE "step_definition"
   SET "isActive" = false, "updatedAt" = now()
 WHERE LOWER("key") LIKE '%retrieve_discount%'
    OR LOWER("key") LIKE '%retrieve_invoice%'
    OR LOWER("key") LIKE '%retrievediscount%'
    OR LOWER("key") LIKE '%retrieveinvoice%'
```

**down():** Inverse UPDATE with `isActive = true` on the same patterns.

Active step counts before/after: **16 → 14** (all 6 capability versions confirmed).

### Task 2: LoadComplaint Skill Enrichment

**File:** `backend/src/modules/execucao/services/skill-registry.service.ts`

Changes:
1. Added imports for `ComplaintUserNote` and `TicketTimingEvent` from `operacao/entities/`
2. Injected `complaintUserNoteRepo` and `ticketTimingEventRepo` in constructor
3. **loadComplaint()** updated with:
   - `complaintUserNoteRepo.findOne({ where: { complaintId, isActive: true }, order: { version: 'DESC' } })` — latest active note
   - `enrichedText` composed: `rawText + '\n\n[NOTA OPERADOR]:\n' + note.content` when note exists, `rawText` alone otherwise
   - `complaint.enrichedText` persisted (equality-guarded save)
   - Idempotent `ticket_created` TicketTimingEvent emission (skips if already exists)
   - Return object and artifact content both include `enrichedText`, `operatorNote`, `operatorNoteParameters`, `operatorNoteVersion`
4. `buildMandatoryChecklist()` has PIPE-05 tolerance JSDoc comment

### Task 3: Smoke Test Results

All 6 verification queries returned expected results:

| Check | Query | Expected | Result |
|-------|-------|----------|--------|
| 6 | Active steps for execution's capability version | 14 | **14** ✓ |
| 7 | parsed_complaint artifact enrichedText | Contains `[NOTA OPERADOR]:` | **Present** ✓ |
| 8 | complaint.enrichedText column | Populated | **Populated** ✓ |
| 9 | ticket_created timing event | 1 row, userId NULL | **1 row, userId null** ✓ |
| 10 | retrieve_discount/invoice step_executions | 0 rows | **0 rows** ✓ |
| 11 | Idempotency: second LoadComplaint run | COUNT still 1 | **1** ✓ |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Runtime Notes

- Remote DB at 72.61.52.70:5433 is used (per .env) — local Docker postgres exists but .env points to remote
- Seeder fails against remote DB due to `tipology.slaAberta` NOT NULL constraint (different schema on remote) — pre-existing condition unrelated to this plan; step_definition data already seeded
- Local backend (port 3001) connected to remote DB for smoke test — this is expected behavior

## Next Phase Readiness

Phase 08-03 (DraftFinalResponse updates) can proceed:
- `enrichedText` is available in skill output from loadComplaint
- `operatorNote`, `operatorNoteParameters`, `operatorNoteVersion` also available
- All 6 smoke test checks pass
- Pipeline is confirmed at 14 steps end-to-end
