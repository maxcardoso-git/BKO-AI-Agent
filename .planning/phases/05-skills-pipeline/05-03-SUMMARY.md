---
phase: 05-skills-pipeline
plan: 03
subsystem: execucao
tags: [nestjs, typeorm, pgvector, embeddings, audit-log, case-memory, skill-registry, ai-sdk]

# Dependency graph
requires:
  - phase: 05-01
    provides: SkillRegistryService with Wave 1 skills, CaseMemory + HumanFeedbackMemory repos injected, DataSource injected, MemoriaModule wired
  - phase: 05-02
    provides: ApplyPersonaTone (SKLL-13) real implementation; all waves 1+2 skills operational
  - phase: 04-02
    provides: ModelSelectorService.getEmbeddingModel() for embedding model resolution
  - phase: 01-02
    provides: AuditLog entity (append-only, no updatedAt), CaseMemory entity with pgvector(1536) column
provides:
  - HumanDiffCapture (SKLL-16): ART-11 human_diff artifact with pending_human_review placeholder
  - PersistMemory (SKLL-17): CaseMemory row with pgvector embedding via embed() + zero-vector fallback
  - TrackTokenUsage (SKLL-18): aggregated llm_call token stats via raw DataSource query
  - AuditTrail (SKLL-19): append-only AuditLog entry + ART-10 audit_trail artifact
  - All 19 skills (SKLL-01 through SKLL-19) fully operational — zero stubs remain
affects:
  - 06-HITL-PLAN (HumanDiffCapture placeholder content populated here; Phase 6 fills humanFinal)
  - Any future plan querying case_memory for similarity search (embeddings now persisted)
  - Compliance reporting (AuditLog entries queryable for audit trail)

# Tech tracking
tech-stack:
  added:
    - embed from 'ai' SDK (Vercel AI SDK embedding function)
    - pgvector/pg (already installed, now imported in skill-registry.service.ts)
  patterns:
    - Zero-vector fallback: try embed() -> catch -> new Array(1536).fill(0) ensures row is always saved
    - Raw SQL for pgvector insert: TypeORM cannot handle vector columns; use dataSource.query() + pgvector.toSql() + $N::vector cast
    - Aggregation-only skill: TrackTokenUsage queries existing rows (no side effects), returns computed totals
    - Append-only audit: AuditLog has no updatedAt — save() creates new row, never updates

key-files:
  created: []
  modified:
    - backend/src/modules/execucao/services/skill-registry.service.ts

key-decisions:
  - "05-03: HumanDiffCapture is scaffold placeholder — stores aiDraft from input, humanFinal:null; real diff computed in Phase 6 HITL when operator approves"
  - "05-03: PersistMemory uses raw INSERT with pgvector.toSql() — caseMemoryRepo.create() used only to build object fields, actual insert bypasses TypeORM ORM layer for vector column"
  - "05-03: TrackTokenUsage aggregates via JOIN step_execution ON ticketExecutionId — does NOT call tokenUsageTracker.track() since per-call tracking already happened in each AI skill"
  - "05-03: embed() imported from 'ai' SDK (Vercel AI SDK) — consistent with how VectorSearchService generates query embeddings"

patterns-established:
  - "Embedding persistence pattern: getEmbeddingModel() -> embed() -> pgvector.toSql() -> raw INSERT with $N::vector cast"
  - "Zero-vector fallback: catch embedding errors, fill 1536 zeros, log warn, continue — pipeline never fails due to embedding API unavailability"
  - "Aggregation skill pattern: read-only query against existing rows, return computed metrics without side effects"

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 5 Plan 03: Wave 3 Skills Summary

**All 19 skills fully operational: HumanDiffCapture (ART-11 placeholder), PersistMemory (pgvector embedding + zero-vector fallback via Vercel AI SDK), TrackTokenUsage (raw SQL aggregation of existing llm_call rows), AuditTrail (append-only AuditLog + ART-10 artifact)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-18T02:04:22Z
- **Completed:** 2026-03-18T02:08:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- Replaced all 4 Wave 3 stubs with real implementations — zero `stub-pending-wave` strings remain in codebase
- HumanDiffCapture: persists ART-11 `human_diff` artifact with `diffSummary: 'pending_human_review'`, `changesCount: null`, and `aiDraft` captured from input; `humanFinal` left null for Phase 6 HITL
- PersistMemory: generates embedding via `embed({ model: embeddingModel, value: summaryText })` using `ModelSelectorService.getEmbeddingModel()`, inserts CaseMemory row via raw SQL with `pgvector.toSql()` + `::vector` cast; graceful zero-vector (1536 dims) fallback on API failure
- TrackTokenUsage: aggregates `SUM(totalTokens)`, `SUM(costUsd)`, `COUNT(id)` from `llm_call` rows joined to `step_execution` by `ticketExecutionId` — never calls `tokenUsageTracker.track()` (per-call tracking already happened)
- AuditTrail: creates append-only `AuditLog` row (`skill_audit_trail`) with full execution snapshot (stepOutputs, tipologyKey, selectedActionKey, slaDeadline, situationKey), then persists ART-10 `audit_trail` artifact referencing the log entry
- Added `embed` import from `'ai'` SDK and `pgvector/pg` import to service

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement HumanDiffCapture, PersistMemory, TrackTokenUsage, and AuditTrail skills** - `2883469` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `backend/src/modules/execucao/services/skill-registry.service.ts` — Replaced 4 Wave 3 stubs with method dispatch calls; added 4 private methods (~188 lines added, 6 removed); added `embed` + `pgvector/pg` imports

## Decisions Made

- **HumanDiffCapture is Phase 5 scaffold only:** The `aiDraft` is captured from input now, but `humanFinal` is intentionally null. Phase 6 HITL will populate this when an operator reviews and submits the final approved text.
- **PersistMemory bypasses TypeORM ORM for vector insert:** `caseMemoryRepo.create()` is used only to build and validate field values; the actual INSERT uses `dataSource.query()` with raw SQL and `pgvector.toSql()` because TypeORM's ORM layer cannot serialize vector columns. Consistent with `DocumentIngestionService` and `VectorSearchService` patterns.
- **TrackTokenUsage is a read-only aggregation skill:** It does NOT call `tokenUsageTracker.track()`. Individual LLM calls are tracked in-situ by their respective skill cases (ClassifyTypology, DraftFinalResponse, etc.). TrackTokenUsage only rolls up existing rows for reporting.
- **embed() from 'ai' SDK chosen over createOpenAI directly:** Consistent with how `VectorSearchService` generates embeddings, using `ModelSelectorService.getEmbeddingModel()` for centralized model config.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 19 skills (SKLL-01 through SKLL-19) are now real implementations — the full pipeline from LoadComplaint through AuditTrail is operational
- A complaint can be processed end-to-end: 11 artifact types produced (ART-01 through ART-11), memory persisted with embeddings, token usage tracked, audit log created
- SKLL-20 (execution record) is satisfied by `StepExecution` row persistence in `TicketExecutionService.advanceStep()` — no separate skill needed
- Phase 5 is COMPLETE — all 3 plans (05-01, 05-02, 05-03) done
- Ready for Phase 6: HITL (Human-in-the-Loop) — will populate `humanFinal` in the `human_diff` artifact created by HumanDiffCapture

---
*Phase: 05-skills-pipeline*
*Completed: 2026-03-18*
