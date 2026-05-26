---
phase: 10
plan: "01"
subsystem: backend-foundation
tags: [human-review, memory, admin, audit, timings, observability, hitl]
one-liner: "3-branch HITL review (approve/correct/reject) with decision_made event, lock release, feedback memory, and admin audit endpoints"

dependency-graph:
  requires: ["09-01 (TicketLock entity)", "08-01 (TimingEventService + ticket_timing_event)", "06-01 (HumanReviewService + MemoryFeedbackService)", "05-03 (HumanFeedbackMemory pgvector insert)"]
  provides: ["POST /api/complaints/:id/validate", "GET /api/admin/feedback", "GET /api/admin/audit/timings", "GET /api/admin/observability/human-review-avg-time", "feedbackType + rejectionReason on human_feedback_memory", "decision_made timing event"]
  affects: ["10-02 (training memory loop — uses findSimilarFeedback filter)", "10-03 (validation UI — calls /complaints/:id/validate)"]

tech-stack:
  added: []
  patterns: ["switch-on-decision over if-approved boolean", "object-params persistFeedback signature", "parameterized LIMIT/OFFSET with positional $N"]

key-files:
  created:
    - backend/src/database/migrations/1773920000000-AddFeedbackTypeToHumanFeedbackMemory.ts
    - backend/src/modules/execucao/dto/admin-feedback.dto.ts
    - backend/src/modules/execucao/dto/audit-timings.dto.ts
    - backend/src/modules/execucao/services/admin-feedback.service.ts
    - backend/src/modules/execucao/services/admin-audit.service.ts
    - backend/src/modules/execucao/controllers/admin-feedback.controller.ts
    - backend/src/modules/execucao/controllers/admin-audit.controller.ts
  modified:
    - backend/src/modules/memoria/entities/human-feedback-memory.entity.ts
    - backend/src/modules/memoria/services/memory-feedback.service.ts
    - backend/src/modules/memoria/services/memory-retrieval.service.ts
    - backend/src/modules/execucao/dto/submit-review.dto.ts
    - backend/src/modules/execucao/services/human-review.service.ts
    - backend/src/modules/execucao/controllers/human-review.controller.ts
    - backend/src/modules/execucao/services/observability.service.ts
    - backend/src/modules/execucao/controllers/observability.controller.ts
    - backend/src/modules/execucao/execucao.module.ts

decisions:
  - id: 10-01-a
    description: "Embed aiText (not humanText) in MemoryFeedbackService — retrieval is 'find corrections of drafts similar to this new AI draft', so search vector must represent the AI output"
    impact: "Breaking change from Phase 5 (which embedded humanText). Existing rows in human_feedback_memory were embedded against humanText — backfill migration sets feedbackType='correction' but does not re-embed. Re-embedding is a future concern if retrieval quality degrades."
  - id: 10-01-b
    description: "Rejection weight=0.5 — rejection is a weaker training signal than correction (no replacement text), so down-weight for future retrieval ranking"
    impact: "findSimilarFeedback callers receive correctionWeight=0.5 for rejection rows; prompt builders can use this for weighted ranking"
  - id: 10-01-c
    description: "lockRepo.delete direct (not TicketLockService.release) — avoids cross-module role check; operator who just decided is implicitly authorized"
    impact: "Clean coupling — HumanReviewService does not import TicketLockService. Consistent with plan wiring_facts."
  - id: 10-01-d
    description: "Corrected branch resumes auto-advance loop — correction means 'go ahead with human version', same as approval"
    impact: "Ticket execution continues after correction, not just after approval. This is the expected UX for Phase 10."
  - id: 10-01-e
    description: "Approved path does NOT persist memory feedback — only corrections/rejections train the model"
    impact: "Behavior change from Phase 5 which persisted on every approval. Memory rows are now training signals only, not audit logs."

metrics:
  duration: "~25 min"
  completed: "2026-05-26"
  tasks-completed: 3
  commits: 3
---

# Phase 10 Plan 01: Backend Foundation Summary

## Objective

Backend prerequisite gate for Phase 10 validation flow: extend HumanReviewService to handle approve/correct/reject (all 3 emit `decision_made` timing event, release ticket lock, set `responsavelFinal`); extend MemoryFeedbackService/MemoryRetrievalService; add admin audit endpoints.

## What Was Built

### Migration (Task 1)

**Timestamp:** `1773920000000-AddFeedbackTypeToHumanFeedbackMemory`

- Adds `feedbackType varchar NULL` and `rejectionReason text NULL` to `human_feedback_memory` using `ADD COLUMN IF NOT EXISTS` (idempotent — safe for prod DB at 72.61.52.70:5433)
- Backfills existing rows to `feedbackType='correction'` (all legacy rows were corrections semantically)
- Creates composite index `idx_hfm_tipology_feedback` and standalone `idx_hfm_feedback_type`

### MemoryFeedbackService Changes (Task 1)

**Signature changed from positional args to object params:**

```typescript
// Before (Phase 5):
persistFeedback(aiText, humanText, diffDescription, complaintId, tipologyId)

// After (Phase 10):
persistFeedback({ aiText, humanText, diffDescription, complaintId, tipologyId, feedbackType, rejectionReason? })
```

**Embedding target changed: aiText instead of humanText.**

Rationale: future retrieval is "find past corrections for drafts SIMILAR TO this new AI draft". The embedding must represent the AI-generated text so cosine similarity finds cases where the AI produced similar output and was corrected/rejected. Phase 5 embedded humanText which answers a different question ("find human corrections similar to this new human text").

**Note for downstream consumers:** Any existing `human_feedback_memory` rows are embedded against `humanText`. These will not be re-embedded automatically. If retrieval quality is important for legacy rows, a one-time re-embedding job should be considered in the future.

### MemoryRetrievalService Changes (Task 1)

- `findSimilarCorrections` patched to filter `(feedbackType='correction' OR feedbackType IS NULL)` — prevents rejection rows from leaking into correction-only callers (DraftFinalResponse, ApplyPersonaTone)
- New `findSimilarFeedback(embedding, tipologyId, feedbackType?, limit)` — unified method with optional type filter; returns `feedbackType + rejectionReason` alongside existing SimilarCorrectionResult fields

### HumanReviewService Decision Branches (Task 2)

| Decision | human_review.status | step_execution.status | ticket_execution.status | Memory | timing events |
|----------|--------------------|-----------------------|------------------------|--------|---------------|
| approved | APPROVED | COMPLETED | RUNNING → advances | none | decision_made + approved |
| corrected | CORRECTED | COMPLETED | RUNNING → advances | correction (feedbackType='correction') | decision_made |
| rejected | REJECTED | FAILED | CANCELLED | rejection (feedbackType='rejection') | decision_made |

**Common to ALL 3 branches:**
- Emits `decision_made` timing event with `reviewerUserId` (feeds `human-review-avg-time` metric)
- Sets `complaint.responsavelFinal = reviewerUserId` (audit attribution)
- Releases ticket lock via `lockRepo.delete({ complaintId })`

**Backward compat:** If `dto.decision` is absent, falls back to `dto.approved ? 'approved' : 'corrected'`. Old clients sending `{approved: true}` continue to work exactly as before.

### Rejection Persistence Semantics (Task 2)

For `decision='rejected'` memory rows:
- `humanText = ''` — no human replacement text exists for rejections
- `diffDescription = rejectionReason` — the WHY used by prompt builder similarity search
- `rejectionReason column = same value` — preferred field for `/admin/feedback` display

This dual-write is intentional: `diffDescription` is the generic field for the prompt builder; `rejectionReason` is the explicit typed field for admin UI consumers.

### New Endpoints (Tasks 2 + 3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/complaints/:complaintId/validate` | any authenticated | Convenience wrapper — resolves latest paused HITL step from complaintId |
| GET | `/api/admin/feedback` | ADMIN | Paginated human_feedback_memory with tipologyId + feedbackType filters |
| GET | `/api/admin/audit/timings` | ADMIN | Per-complaint timing breakdown: tempo_total, tempo_sla, tempo_revisao_humana, tempo_nota_a_processamento, tempo_aprovacao_a_conclusao |
| GET | `/api/admin/observability/human-review-avg-time` | ADMIN | Global avg minutes between `paused_human` and `decision_made` events |

### Module Wiring Changes (Task 2)

`ExecucaoModule.TypeOrmModule.forFeature([...])` now includes `Complaint` and `TicketLock` — required for `@InjectRepository(Complaint)` and `@InjectRepository(TicketLock)` in HumanReviewService.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StepExecution field name is `errorMessage` not `error`**

- **Found during:** Task 2 implementation
- **Issue:** Plan pseudocode used `stepExec.error = ...` but entity declares `errorMessage: string | null` (verified in step-execution.entity.ts line 56)
- **Fix:** Changed to `stepExec.errorMessage = ...` in the rejected branch
- **Files modified:** `human-review.service.ts`

**2. [Rule 2 - Missing Critical] Global APP_GUARD pattern — no UseGuards needed on admin controllers**

- **Found during:** Task 3 — inspecting admin-locks.controller.ts reference
- **Issue:** Plan suggested `@UseGuards(JwtAuthGuard, RolesGuard)` but project uses global APP_GUARD pattern where JwtAuthGuard is applied globally; admin controllers only need `@Roles`
- **Fix:** Admin controllers use only `@Roles(UserRole.ADMIN)` — matching existing pattern in admin-locks.controller.ts
- **Files modified:** `admin-feedback.controller.ts`, `admin-audit.controller.ts`

## Next Phase Readiness

- **10-02 (Training Memory):** `findSimilarFeedback` is ready; callers should use `feedbackType='correction'` for correction-only retrieval or `null` for both types
- **10-03 (Validation UI):** `POST /api/complaints/:complaintId/validate` endpoint is ready; UI sends `{ decision: 'approved'|'corrected'|'rejected', humanFinal?, correctionReason?, rejectionReason? }`
- **Migration must run:** Before deploying backend, run `npx typeorm migration:run -d dist/data-source.js` on the production DB to add `feedbackType` and `rejectionReason` columns
