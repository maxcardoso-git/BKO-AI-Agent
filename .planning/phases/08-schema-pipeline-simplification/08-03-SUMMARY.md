---
plan: 08-03
phase: 08-schema-pipeline-simplification
status: complete
requires: ["08-01", "08-02"]
affects: ["09", "10"]
tech_stack_added: []
commits:
  - 7cd9086
  - a4adf0d
  - f292135
---

# 08-03 Summary: TimingEventService + Timing Endpoint + Prompt Enhancement

## What Was Built

### TimingEventService (operacao/services/)

Located at `backend/src/modules/operacao/services/timing-event.service.ts`.

**API:**
- `emit(milestone, complaintId, executionId?, userId?, occurredAt?)` — inserts a `ticket_timing_event` row
- `emitOnce(milestone, complaintId, executionId?, userId?, occurredAt?)` — idempotent; skips if same `(complaintId, milestone)` already exists (used for `ticket_created`)

**Module wiring decision:** Service lives in `OperacaoModule` (NOT `ExecucaoModule`). This preserves the `Execucao → Operacao` dependency direction and prevents a circular dep in Phase 9, when `ComplaintUserNoteService` (operacao domain) also needs to emit `note_saved` events.

### Instrumentation Points in TicketExecutionService

Two lifecycle events added (surgical inserts, no other behaviour changed):

1. **`execution_started`** — emitted right after `ticketExecutionRepo.save()` in `startExecution()`. `userId=null` (automatic event).
2. **`paused_human`** — emitted inside the `PAUSED_HUMAN` branch of `advanceStep()`, after saving execution status. `userId=null` (automatic event).

Deferred (with doc comments in service):
- `decision_made` / `approved` / `completed` → Phase 10 HumanReviewService
- `note_saved` → Phase 9 ComplaintUserNoteService

### GET /api/complaints/:id/timing Endpoint

Added to `ComplaintController`. Route: `GET /api/complaints/:id/timing`.

Returns `TimingMetricsDto` with 5 fields:
| Metric | Formula | Phase 8 state |
|--------|---------|---------------|
| `tempo_total` | first event → last event (ms) | non-null when any events exist |
| `tempo_sla` | `ticket_created` → `completed` | null until ticket completed |
| `tempo_revisao_humana` | sum of `paused_human→decision_made` pairs | null until Phase 10 |
| `tempo_nota_a_processamento` | `note_saved` → `execution_started` | **always null in Phase 8** (Phase 9 closes) |
| `tempo_aprovacao_a_conclusao` | `approved` → `completed` | null until Phase 10 |

Plus `events` array (milestone, occurredAt, userId) for audit/debug.

**tempo_nota_a_processamento is intentionally null after Phase 8** — `note_saved` events are emitted by Phase 9's `ComplaintUserNoteService.create()`. Smoke tests assert `null`; Phase 9 verification asserts non-null.

### DraftFinalResponse Prompt Enhancement (PIPE-03)

`PromptBuilderService.buildDraftResponsePrompt()` now injects a `## NOTA DO OPERADOR (contexto prioritario)` section into the system prompt **before** KB chunks when `ctx.operatorNote` is non-empty. Structured parameters (`operatorNoteParameters`) are listed as bullet points below the note text.

`DraftGeneratorAgent` forwards `operatorNote` and `operatorNoteParameters` from the skill input map into `PromptContext` before calling the prompt builder.

## Verification

All must-haves confirmed:
- `timing-event.service.ts` exists in `operacao/services/` (not `execucao/services/`)
- `OperacaoModule` has 3 references to `TimingEventService` (import + provider + export)
- `TicketExecutionService` has 2 `timingEventService.emit()` calls
- `GET :id/timing` route present in `ComplaintController`
- `TimingMetricsDto` defined with all 5 fields
- `NOTA DO OPERADOR` section in `PromptBuilderService`
- `operatorNote` forwarded in `DraftGeneratorAgent`
- TypeScript `--noEmit` passes clean
- `timing-event.service.ts` does NOT exist in `execucao/services/`

## Phase 8 Requirements Coverage

All 14 Phase 8 requirements addressed across plans 08-01..08-03:
- **SCHEMA-01..04**: 4 new tables, enrichedText, rejectionReason, CORRECTED enum, VARCHAR status ✓
- **PIPE-01..05**: 14 active steps, operator note in pipeline, NOTA DO OPERADOR in prompt, legacy skills kept ✓
- **AUTH-TOKEN-01**: access_token table schema ✓
- **AUDIT-TIMING-01/02/05**: ticket_timing_event table, 5-metric endpoint, execution lifecycle events ✓
- **LOCK-01**: ticket_lock table with UNIQUE on complaintId ✓
