# Phase 10: Validation UI, Training Memory & Audit Reports — Research

**Researched:** 2026-05-26
**Domain:** NestJS backend (HITL review flow, memory feedback, timing audit) + Next.js frontend (new validation page, admin pages)
**Confidence:** HIGH — all findings from direct source file inspection

---

## Summary

Phase 10 extends an existing HITL pipeline that already has most backend infrastructure wired. The `HumanReviewService` (`human-review.service.ts`) handles approve logic but not reject/correct status transitions — it only sets `APPROVED` or `PENDING`. The `HumanFeedbackMemory` entity exists but lacks a `feedbackType` column (VARCHAR); `MemoryFeedbackService` and `MemoryRetrievalService` source files are **missing** (deleted or never committed) but their compiled `.d.ts` and `.js` exist in `dist/` — they must be recreated from the compiled output. The frontend review page at `/tickets/[id]/execution/[execId]/review/[stepExecId]/page.tsx` is a full-featured HITL UI that must be repurposed/extended to `/processar/:protocolo/validar`.

The current `/processar` page shows a "Revisar Texto →" link to the legacy review URL when `paused_human`. Phase 10 replaces this link flow with an in-flow redirect to `/processar/:protocolo/validar`. The `decision_made` timing milestone exists in `TimingMilestone` but is NOT currently emitted on reject/correct — only `approved` is emitted. Admin feedback and audit timing pages do not exist yet.

**Primary recommendation:** Recreate missing service source files from `dist/`, add `feedbackType` + `rejectionReason` to `human_feedback_memory` via migration, extend `HumanReviewService.createReview()` to handle `corrected`/`rejected` status, build `/processar/[protocolo]/validar` as a new route that reuses components from the existing review page.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/typeorm` | existing | ORM + migrations | project standard |
| `pgvector/pg` | existing | vector similarity search | used in MemoryRetrievalService |
| `ai` SDK (`embed`) | existing | embedding generation | used in DraftFinalResponse skill |
| `diff` (diffWords) | existing | text diff computation | used in HumanReviewService |
| `@tanstack/react-query` | existing | data fetching/caching | project standard |
| `react-hook-form` | existing | form state | used in existing review page |
| `RichTextArea` | existing component | editable textarea | at `@/components/ui/rich-text-area` |
| `MarkdownPreview` | existing component | markdown display | at `@/components/ui/markdown-preview` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useRequireAuth` | existing hook | RBAC gate | admin pages |
| `useAuthStore` | existing hook | token/user | all pages needing auth |

**Installation:** No new packages needed — all dependencies already present.

---

## Architecture Patterns

### Backend: Existing Service Call Signatures

**HumanReviewService** — `backend/src/modules/execucao/services/human-review.service.ts`

```typescript
// Current signature (lines 85-92):
async createReview(
  stepExecutionId: string,
  complaintId: string,
  reviewerUserId: string,
  dto: SubmitReviewDto,
): Promise<HumanReview>

// Current status logic (lines 128-132):
status: dto.approved
  ? HumanReviewStatus.APPROVED
  : HumanReviewStatus.PENDING
// PROBLEM: No CORRECTED or REJECTED branch — must add dto.rejected + dto.corrected booleans
```

**SubmitReviewDto** — `backend/src/modules/execucao/dto/submit-review.dto.ts` (must be verified/extended)
- Currently has: `approved`, `humanFinal`/`humanFinalText`, `correctionReason`, `checklist`/`checklistItems`, `observations`
- Need to add: `rejected?: boolean`, `rejectionReason?: string`

**HumanReview entity** — `backend/src/modules/execucao/entities/human-review.entity.ts`
- Has `HumanReviewStatus` enum: `PENDING | APPROVED | REJECTED | REVISION_REQUESTED | CORRECTED`
- Has `rejectionReason: string | null` column (line 46) — already exists
- Missing from current `createReview()`: branches for `REJECTED` and `CORRECTED`

**TimingEventService** — `backend/src/modules/operacao/services/timing-event.service.ts`
```typescript
async emit(
  milestone: TimingMilestone,    // 'paused_human' | 'decision_made' | 'approved' | etc.
  complaintId: string,
  executionId: string | null,
  userId: string | null,
  occurredAt: Date,
): Promise<TicketTimingEvent>
```
- `decision_made` is a valid milestone (line 11) but currently NOT emitted on reject/correct
- `approved` is emitted on approve (line 166 in human-review.service.ts)
- Phase 10 must emit `decision_made` on ALL three actions (approve/correct/reject)

**TicketLockService** — `backend/src/modules/operacao/services/ticket-lock.service.ts`
```typescript
async acquire(complaintId: string, userId: string): Promise<TicketLock>
// DELETE + INSERT pattern in a transaction (lines 29-55)
// Returns ConflictException (409) if active lock exists for another user
```
- `release(complaintId: string)` method likely exists — verify at lines 58+
- Lock release should happen in HumanReviewService after approve/correct/reject

**HumanReviewController** — `backend/src/modules/execucao/controllers/human-review.controller.ts`
- `POST /api/executions/:execId/steps/:stepExecId/review` — existing submit endpoint
- `GET /api/executions/:execId/steps/:stepExecId/review` — existing get endpoint
- New endpoint needed: `POST /api/complaints/:complaintId/validate` or similar for the new `/validar` flow

### Backend: Missing Source Files (Recreate from Dist)

**MemoryRetrievalService** — source MISSING, must create at:
`backend/src/modules/memoria/services/memory-retrieval.service.ts`

From `dist/modules/memoria/services/memory-retrieval.service.js`:
```typescript
@Injectable()
export class MemoryRetrievalService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findSimilarCases(embedding: number[], tipologyId: string, limit = 3): Promise<SimilarCaseResult[]>
  async findSimilarCorrections(embedding: number[], tipologyId: string, limit = 3): Promise<SimilarCorrectionResult[]>
  async findStylePatterns(tipologyId: string, limit = 5): Promise<StylePatternResult[]>
}
// Uses pgvector.toSql(embedding) for the vector param
// SQL: SELECT ... FROM "human_feedback_memory" WHERE "tipologyId" = $2 ORDER BY embedding <=> $1::vector ASC LIMIT $3
```

**MemoryFeedbackService** — source MISSING, must create at:
`backend/src/modules/memoria/services/memory-feedback.service.ts`

From `dist/modules/memoria/services/memory-feedback.service.d.ts`:
```typescript
@Injectable()
export class MemoryFeedbackService {
  constructor(dataSource: DataSource, modelSelector: ModelSelectorService) {}

  async persistFeedback(
    aiText: string,
    humanText: string,
    diffDescription: string,
    complaintId: string,
    tipologyId: string | null,
  ): Promise<void>
}
```
- Called in HumanReviewService line 233 (fire-and-forget)
- Must embed `aiText` using `ModelSelectorService.getEmbeddingModel()` + `embed()` from `ai` SDK
- Inserts into `human_feedback_memory` table

### Backend: Schema Changes Required

**human_feedback_memory table** — `HumanFeedbackMemory` entity:
- Currently has: `aiText`, `humanText`, `diffDescription`, `correctionCategory`, `correctionWeight`, `embedding`, `complaintId`, `tipologyId`
- MISSING `feedbackType` (requirement TRAIN-01/TRAIN-02: `'correction'` vs `'rejection'`)
- MISSING `rejectionReason` text column (for TRAIN-02 persistence)
- Migration needed: `ALTER TABLE human_feedback_memory ADD COLUMN IF NOT EXISTS "feedbackType" varchar NULL`
- `feedbackType` is VARCHAR (not enum) — matches existing `correctionCategory: varchar` pattern

**Migration pattern** — see `backend/src/database/migrations/1773910000000-AddResponsavelFinalToComplaint.ts`:
```typescript
export class AddFeedbackTypeToHumanFeedbackMemory17739XXXXXXXX implements MigrationInterface {
  name = 'AddFeedbackTypeToHumanFeedbackMemory17739XXXXXXXX';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "feedbackType" varchar NULL`);
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" ADD COLUMN IF NOT EXISTS "rejectionReason" text NULL`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "feedbackType"`);
    await queryRunner.query(`ALTER TABLE "human_feedback_memory" DROP COLUMN IF EXISTS "rejectionReason"`);
  }
}
```

### Backend: Embedding Generation Pattern

From `skill-registry.service.ts` lines 258-259 (DraftFinalResponse skill):
```typescript
const embeddingModel = await this.modelSelector.getEmbeddingModel();
const { embedding: memEmbedding } = await embed({ model: embeddingModel, value: complaintText });
```
- Reuse this exact pattern in `MemoryFeedbackService.persistFeedback()`
- Store as `pgvector.toSql(embedding)` (see MemoryRetrievalService dist)

### Backend: DraftFinalResponse Prompt Injection

`skill-registry.service.ts` lines 252-306 — `DraftFinalResponse` case:
- Already calls `memoryRetrieval.findSimilarCorrections(embedding, tipologyId, 3)` (line 262)
- Puts result in `memoryAugmentedInput.humanCorrections` (line 271)
- Passes to `draftGenerator.generate({ ...memoryAugmentedInput, ... })`
- Artifact `draft_response` content: `{ draftResponse, templateUsed, mandatoryFieldsCount, kbChunksUsed }`
- To show injected corrections in UI: add `humanCorrections` to artifact content (currently NOT persisted)
- The `findSimilarCorrections` query only returns rows without `feedbackType` filter — after adding feedbackType, it should filter on `feedbackType = 'correction'`

### Frontend: Existing Review Page (Reuse/Extend)

`/Users/maxcardoso/Documents/EngDB/BKOConsole/src/app/(app)/tickets/[id]/execution/[execId]/review/[stepExecId]/page.tsx`
- Full HITL review UI: tabbed layout, RichTextArea editor, compliance score, checklist, sentiment, KB context
- Uses hooks: `useHumanReview`, `useSubmitReview`, `useStepExecutions`, `useComplaint`
- Submit calls `submitReview.mutateAsync({ humanFinal, correctionReason, checklist, approved: true })`
- After submit: `router.push('/processar')`
- **Current limitation**: Only "Aprovar Resposta" button — no "Corrigir" or "Reprovar" actions
- **No rejection modal** exists in this page

### Frontend: Current paused_human → review Link (ProcessarClient)

`ProcessarClient.tsx` lines 542-556:
```tsx
{execution.status === 'paused_human' && (
  <a href={`/tickets/${complaint.id}/execution/${execution.id}/review/${pausedStepExecId}`}>
    Revisar Texto →
  </a>
)}
```
- `pausedStepExecId` is set via `onUpdate` callback from `ProgressBar` component (line 523)
- The link goes to the LEGACY review URL — Phase 10 replaces this with `/processar/${protocolo}/validar`
- For the new flow: `router.push(`/processar/${complaint.protocolNumber}/validar`)` after `paused_human`

### Frontend: Admin Page Pattern

`/admin/locks/page.tsx` pattern:
```tsx
'use client'
const { hasAccess } = useRequireAuth(['SUPERVISOR', 'ADMIN'])
const { token } = useAuthStore()
// fetch with authHeader, useState for data
// simple table layout with filter controls
```
- No react-query in admin pages — plain `fetch` + `useState` + `useCallback`
- `useRequireAuth(['ADMIN'])` for feedback and timings pages (ADMIN only)

### Frontend: New Route Structure

Phase 10 creates:
1. `/processar/[protocolo]/validar` — operator validation page
   - Path: `BKOConsole/src/app/(app)/processar/[protocolo]/validar/page.tsx`
   - Needs: look up complaint by protocolNumber, load execution, load AI draft, show 3-action UI
2. `/admin/feedback` — list HumanFeedbackMemory entries
   - Path: `BKOConsole/src/app/(app)/admin/feedback/page.tsx`
3. `/admin/audit/timings` — timing metrics per ticket
   - Path: `BKOConsole/src/app/(app)/admin/audit/timings/page.tsx`

### Observability: human_review_avg_time

`ObservabilityService` — `backend/src/modules/execucao/services/observability.service.ts`
- Methods follow pattern: raw SQL against `ticket_timing_event` table
- Add `getHumanReviewAvgTime()`:
  ```sql
  SELECT AVG(
    EXTRACT(EPOCH FROM (dm.occurred_at - ph.occurred_at)) / 60
  ) AS avg_minutes
  FROM ticket_timing_event ph
  JOIN ticket_timing_event dm ON dm."executionId" = ph."executionId"
    AND dm.milestone = 'decision_made'
  WHERE ph.milestone = 'paused_human'
  ```
- Expose as `GET /admin/observability/human-review-avg-time` in `ObservabilityController`

### Timing: complaint-level metrics (TimingMetricsDto)

`complaint.service.ts` line 176: already computes `tempo_revisao_humana` as sum of `paused_human → decision_made` pairs per complaint. This is the per-ticket metric for `/admin/audit/timings`. The new observability metric is the global average.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| pgvector similarity search | raw SQL everywhere | `MemoryRetrievalService.findSimilarCorrections()` | already compiled, just needs source recreated |
| Embedding generation | custom model call | `ModelSelectorService.getEmbeddingModel()` + `embed()` from `ai` SDK | exact pattern used in DraftFinalResponse |
| Text diff | custom diff | `diffWords` from `diff` package | already imported in HumanReviewService |
| Lock acquire/release | direct DB delete | `TicketLockService.acquire()` | transaction safety, handles conflict 409 |
| Rich text editing | custom textarea | `RichTextArea` component | already in project |
| Timing event emission | direct DB insert | `TimingEventService.emit()` | idempotency, userId tracking |

---

## Common Pitfalls

### Pitfall 1: Missing MemoryRetrievalService / MemoryFeedbackService Source Files
**What goes wrong:** NestJS cannot compile — `memoria.module.ts` references `./services/memory-retrieval.service` which does not exist as `.ts`.
**Why it happens:** Source files were removed but compiled dist remains. The app currently runs from dist.
**How to avoid:** Recreate source files FIRST, matching the compiled `.d.ts` signatures exactly.
**Warning signs:** `Cannot find module '../../memoria/services/memory-retrieval.service'` compilation error.

### Pitfall 2: HumanFeedbackMemory Missing feedbackType — Query Returns Wrong Records
**What goes wrong:** `findSimilarCorrections` returns ALL feedback including rejections; LLM gets rejection examples injected.
**Why it happens:** The query has no `feedbackType` filter currently.
**How to avoid:** After adding `feedbackType` column: update `findSimilarCorrections` SQL to add `AND "feedbackType" = 'correction'`.

### Pitfall 3: decision_made Event Not Emitted on Reject/Correct
**What goes wrong:** `tempo_revisao_humana` in TimingMetricsDto is always null — no `decision_made` event exists.
**Why it happens:** `HumanReviewService.createReview()` only emits `approved` event on approval path (line 165).
**How to avoid:** Emit `decision_made` milestone on ALL three branches (approve, correct, reject).

### Pitfall 4: Lock Not Released After Rejection
**What goes wrong:** After rejection, complaint stays locked and operator cannot re-acquire for new execution.
**Why it happens:** `HumanReviewService` does not call `TicketLockService.release()` — currently the approval flow doesn't release either, relying on lock expiry.
**How to avoid:** Call `ticketLockService.release(complaintId)` after persisting the decision, then re-acquire if operator starts new execution.

### Pitfall 5: protocolNumber-based Routing Without Lookup
**What goes wrong:** `/processar/:protocolo/validar` receives protocolNumber but needs complaintId + executionId.
**Why it happens:** The URL only has protocolNumber (human-readable), not UUIDs.
**How to avoid:** Backend endpoint `GET /api/complaints/by-protocol?q=:protocolo` already exists (used in ProcessarClient line 158). Page server-side or client-side calls this to get `complaintId`, then loads latest execution with `paused_human` status.

### Pitfall 6: TypeORM synchronize:false — Schema Drift
**What goes wrong:** Adding `feedbackType` to entity without migration — column missing in DB, inserts fail silently (NULL constraint) or crash.
**Why it happens:** `synchronize: false` is set in TypeORM config.
**How to avoid:** Always create migration file. Use `ADD COLUMN IF NOT EXISTS` for safety. Run migration on prod (72.61.52.70, port 5433).

### Pitfall 7: Rejection Flow Must Cancel Execution, Not Complete
**What goes wrong:** Rejection leaves `TicketExecution` in `paused_human` status — operator sees stale state.
**Why it happens:** Approve path transitions execution to `RUNNING`/`COMPLETED`. Reject has no transition.
**How to avoid:** On reject: set `TicketExecution.status = CANCELLED` (or new status if needed) and `StepExecution.status = FAILED` with error context. Verify what status values exist.

---

## Code Examples

### Emit decision_made timing event (Pattern)
```typescript
// Source: backend/src/modules/operacao/services/timing-event.service.ts
await this.timingEvents.emit(
  'decision_made',
  complaintId,
  stepExec?.ticketExecutionId ?? null,
  reviewerUserId,
  new Date(),
);
```

### Generate embedding for feedback (Pattern from DraftFinalResponse)
```typescript
// Source: backend/src/modules/execucao/services/skill-registry.service.ts lines 258-259
const embeddingModel = await this.modelSelector.getEmbeddingModel();
const { embedding } = await embed({ model: embeddingModel, value: aiText });
// Then: pgvector.toSql(embedding) for DB storage
```

### MemoryRetrievalService.findSimilarCorrections SQL (from dist)
```sql
SELECT id, "aiText", "humanText", "diffDescription", "correctionCategory",
       1 - (embedding <=> $1::vector) AS similarity
FROM "human_feedback_memory"
WHERE "tipologyId" = $2
ORDER BY embedding <=> $1::vector ASC
LIMIT $3
```
After Phase 10: add `AND "feedbackType" = 'correction'`

### Frontend: Detect paused_human and redirect to /validar
```tsx
// In ProcessarClient, replace the "Revisar Texto →" href:
if (execution.status === 'paused_human' && complaint) {
  router.push(`/processar/${complaint.protocolNumber}/validar`)
}
// OR keep as link: href={`/processar/${complaint.protocolNumber}/validar`}
```

### Admin page fetch pattern (from /admin/locks/page.tsx)
```tsx
'use client'
const { hasAccess } = useRequireAuth(['ADMIN'])
const { token } = useAuthStore()
const [data, setData] = useState([])
const fetchData = useCallback(async () => {
  const res = await fetch(`${BACKEND}/api/admin/feedback`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) setData(await res.json())
}, [token])
useEffect(() => { fetchData() }, [fetchData])
```

---

## State of the Art

| Old Approach | Current Approach | Phase 10 Change |
|---|---|---|
| Reject = PENDING status | HumanReviewStatus.REJECTED exists in enum | Wire REJECTED branch in createReview() |
| No feedbackType distinction | All entries in human_feedback_memory | Add feedbackType: 'correction'|'rejection' |
| Manual redirect to /tickets/[id]/execution/[execId]/review/[stepExecId] | Link shown when paused_human | Auto/programmatic redirect to /processar/:protocolo/validar |
| decision_made never emitted | approved emitted only on approval | Emit decision_made on all 3 decisions |

---

## Open Questions

1. **TicketLockService.release() signature**
   - What we know: `acquire()` is at lines 28-56, `getLock()` at line 58
   - What's unclear: Is there a `release(complaintId)` method or only `DELETE /lock/force` via controller?
   - Recommendation: Read `ticket-lock.service.ts` lines 58+ before planning the lock release call

2. **TicketExecution status on rejection**
   - What we know: `CANCELLED` and `FAILED` enum values may exist
   - What's unclear: Which status to use when operator rejects — is there a `REJECTED` execution status?
   - Recommendation: Read `TicketExecutionStatus` enum in `ticket-execution.entity.ts` before implementing

3. **complaint.responsavelFinal update**
   - What we know: Column exists (migration 1773910000000), Complaint entity has it at line 379
   - What's unclear: Success criterion says "set responsavelFinal to current user" — which service updates it?
   - Recommendation: Check if ComplaintService has a method or if direct repo.save is used in HumanReviewService

4. **ProgressBar onUpdate callback shape**
   - What we know: `ProcessarClient.tsx` line 523: `onUpdate={(completed, total, status, stepExecId) => { ... }}`
   - What's unclear: ProgressBar polls the execution status — does it expose `paused_human` step exec ID reliably?
   - Recommendation: Read `ProgressBar.tsx` to confirm it emits `stepExecId` on `paused_human`

5. **KB chunks / injected corrections in validar UI**
   - What we know: DraftFinalResponse puts `humanCorrections` in `memoryAugmentedInput` but NOT in artifact
   - What's unclear: How to show injected past corrections in the validation screen (VALUI-02 + success criterion 5)
   - Recommendation: Add `humanCorrections` to the `draft_response` artifact content in DraftFinalResponse skill so the frontend can read it

---

## Sources

### Primary (HIGH confidence — direct source inspection)
- `backend/src/modules/execucao/services/human-review.service.ts` — full file read
- `backend/src/modules/execucao/entities/human-review.entity.ts` — full file read
- `backend/src/modules/execucao/controllers/human-review.controller.ts` — full file read
- `backend/src/modules/memoria/entities/human-feedback-memory.entity.ts` — full file read
- `backend/src/modules/operacao/services/timing-event.service.ts` — full file read
- `backend/src/modules/execucao/services/observability.service.ts` — full file read
- `backend/src/modules/execucao/controllers/observability.controller.ts` — partial read
- `backend/src/modules/execucao/services/skill-registry.service.ts` lines 252-370 — DraftFinalResponse skill
- `backend/src/database/migrations/1773910000000-AddResponsavelFinalToComplaint.ts` — migration pattern
- `backend/src/modules/operacao/dto/timing-metrics.dto.ts` — full file read
- `backend/src/modules/operacao/services/ticket-lock.service.ts` lines 1-56 — acquire pattern
- `BKOConsole/src/app/(app)/tickets/[id]/execution/[execId]/review/[stepExecId]/page.tsx` — full file read
- `BKOConsole/src/app/(app)/processar/components/ProcessarClient.tsx` — full file read
- `BKOConsole/src/app/(app)/admin/locks/page.tsx` — partial read (admin pattern)
- `BKOConsole/src/app/(app)/admin/tokens/page.tsx` — partial read (admin pattern)
- `backend/dist/modules/memoria/services/memory-retrieval.service.d.ts` — type signatures
- `backend/dist/modules/memoria/services/memory-retrieval.service.js` — SQL implementation
- `backend/dist/modules/memoria/services/memory-feedback.service.d.ts` — type signatures

---

## Metadata

**Confidence breakdown:**
- HumanReviewService current behavior: HIGH — full source read
- Missing source files (MemoryRetrievalService, MemoryFeedbackService): HIGH — confirmed missing, dist available
- HumanFeedbackMemory schema gaps (feedbackType): HIGH — entity read, column absent
- DraftFinalResponse injection flow: HIGH — source read
- Timing events: HIGH — service source read
- Frontend new route structure: HIGH — existing page and ProcessarClient inspected
- TicketLockService release method: MEDIUM — only saw acquire(), lines 58+ not read
- TicketExecution rejection status: MEDIUM — enum not fully read

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (stable codebase, low churn expected)
