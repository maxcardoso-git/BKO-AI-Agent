# Phase 6: Human Review Pipeline - Research

**Researched:** 2026-03-17
**Domain:** HITL review UI (Next.js 16 + React 19), BFF human-review endpoints (NestJS), diff computation, step flow designer (admin CRUD)
**Confidence:** HIGH — all findings from direct codebase inspection + verified library sources

---

## Summary

Phase 6 builds three things: (1) a 4-column step processor UI where operators drive execution step-by-step, (2) a HITL editor where operators review/edit AI-generated text with diff capture, checklist, and approval, and (3) an admin steps designer for visual flow management. The backend has all the necessary entities and tables already in the database (`human_review`, `step_execution`, `ticket_execution`, `step_definition`, `step_skill_binding`, `step_transition_rule`). No schema migrations are needed for Phase 6.

The `HumanReview` entity is fully defined and the `human_review` table is live. The `TicketExecutionController` already handles `POST /api/executions/:id/advance` with optional `operatorInput` body — this is the hook for human review submission. What's missing is: (a) a dedicated BFF endpoint to persist a human review (`POST /api/executions/:stepId/human-review`), (b) frontend pages for the step processor UI (`/tickets/[id]/execution/[execId]`) and HITL editor (`/tickets/[id]/execution/[execId]/review/[stepId]`), and (c) admin CRUD pages for step/capability flow management.

The diff computation between AI draft and human final text should use the `diff` npm package (58M weekly downloads, version 8.x, ships with TypeScript types as of v8, no `@types/diff` needed). For the diff display component, `react-diff-viewer-continued` v4.x now supports React 19 (confirmed from GitHub issue #63 resolved February 2026). The base UI components (Button, Card, Input, Badge, Select) are already installed via `@base-ui/react` + shadcn. A `Textarea` component is not yet in `/frontend/src/components/ui/` — it must be added.

**Primary recommendation:** Add one `HumanReviewController` in `ExecucaoModule` with endpoints for submitting/fetching reviews; add `diff` package for diff computation; add `react-diff-viewer-continued` for display; build three new frontend route sections (`/tickets/[id]/execution/[execId]`, `/tickets/[id]/execution/[execId]/review/[stepId]`, `/admin/steps`). No DB migrations needed.

---

## Standard Stack

### Core (already in use — HIGH confidence from direct codebase inspection)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS + TypeORM | as wired | HumanReview CRUD, endpoint creation | Already used throughout |
| Next.js 16 App Router | 16.1.7 | Step processor UI + HITL editor pages | Locked decision |
| React 19 + useActionState | 19.2.3 | Form submission for review/approval | Already used in login page |
| Tailwind CSS v4 | as wired | Layout for 4-column step processor | Already used |
| `@base-ui/react` + shadcn | as wired | Button, Card, Input, Badge, Select components | Already installed |
| `jose` | ^6.2.1 | Session auth for BFF calls | Already installed |

### New Dependencies Required

| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `diff` | ^8.0.0 | Compute word/line diffs between AI draft and human final | 58M weekly downloads, v8 ships TypeScript types, no @types/diff needed; used by most diff viewers internally |
| `react-diff-viewer-continued` | ^4.x | Display diff side-by-side or inline in the HITL editor | Only actively maintained React diff viewer with confirmed React 19 support (v4.1.0+, issue #63 closed Feb 2026) |

### UI Components Missing from Current Install

| Component | Action | Where Used |
|-----------|--------|------------|
| `Textarea` | Add via `npx shadcn@latest add textarea` | HITL editor — human text editing area |
| `Checkbox` | Add via `npx shadcn@latest add checkbox` | Regulatory checklist items |
| `Tabs` | Add via `npx shadcn@latest add tabs` | HITL editor tabs (AI view / Diff / Checklist) |
| `Separator` | Add via `npx shadcn@latest add separator` | Column dividers in 4-column layout |
| `Progress` | Add via `npx shadcn@latest add progress` | Step progress bar |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-diff-viewer-continued` | Custom word-by-word highlights | diff-viewer handles line/word level, dark mode, split/unified toggle; custom = reimplementation |
| `diff` npm | `fast-diff` | fast-diff is a subset of diff-match-patch; `diff` has more comprehensive API (diffWords, diffLines, structuredPatch) — better match for text review use case |
| Server Action for review submit | REST API route + fetch | Project already uses Server Actions for mutations (login), consistent pattern |

**Installation:**
```bash
cd /path/to/frontend
npm install diff react-diff-viewer-continued
npx shadcn@latest add textarea checkbox tabs separator progress

cd /path/to/backend
# No new backend packages needed
```

---

## Architecture Patterns

### Recommended File Structure

```
backend/src/modules/execucao/
├── controllers/
│   ├── execution.controller.ts            # existing — GET by complaintId
│   ├── ticket-execution.controller.ts     # existing — advance/finalize/retry
│   └── human-review.controller.ts         # NEW — POST/GET human review
├── services/
│   ├── execution.service.ts               # existing
│   ├── ticket-execution.service.ts        # existing
│   ├── skill-registry.service.ts          # existing
│   └── human-review.service.ts            # NEW — review persistence logic

backend/src/modules/orquestracao/
├── controllers/
│   └── steps-designer.controller.ts       # NEW — CRUD for step/skill/binding admin
├── services/
│   ├── regulatory-orchestration.service.ts # existing
│   └── steps-designer.service.ts           # NEW — step CRUD, binding, rules

frontend/src/app/tickets/[id]/
├── page.tsx                               # existing — ticket detail
├── execution/
│   └── [execId]/
│       ├── page.tsx                        # NEW — step processor 4-column UI
│       ├── actions.ts                      # NEW — advanceStep, finalizeExecution server actions
│       └── review/
│           └── [stepId]/
│               ├── page.tsx               # NEW — HITL editor UI
│               └── actions.ts             # NEW — submitHumanReview server action

frontend/src/app/admin/
└── steps/
    ├── page.tsx                           # NEW — list capabilities/versions/steps
    └── [capabilityId]/
        └── page.tsx                       # NEW — visual step flow editor
```

### Pattern 1: HumanReviewController Endpoint Design

**What:** BFF endpoint that accepts operator review data (humanFinalText, correctionReason, checklistItems, observations, approved) and persists a `HumanReview` row, then resumes the execution.
**When to use:** Called from the HITL editor approve action.

```typescript
// Source: codebase — human-review.entity.ts, ticket-execution.controller.ts advance pattern
@Controller()
export class HumanReviewController {
  // POST /api/executions/:execId/steps/:stepId/review
  // Body: { humanFinalText, correctionReason, checklistItems, observations, approved }
  // Returns: HumanReview + updated StepExecution
  @Post('executions/:execId/steps/:stepId/review')
  async submitReview(
    @Param('execId') execId: string,
    @Param('stepId') stepId: string,
    @Body() body: SubmitReviewDto,
  ): Promise<{ review: HumanReview; stepExecution: StepExecution }> { ... }

  // GET /api/executions/:execId/steps/:stepId/review
  // Returns: existing HumanReview or null
  @Get('executions/:execId/steps/:stepId/review')
  async getReview(
    @Param('execId') execId: string,
    @Param('stepId') stepId: string,
  ): Promise<HumanReview | null> { ... }
}
```

### Pattern 2: Diff Computation — Backend (in HumanReviewService)

**What:** Compute a structured diff between `aiGeneratedText` and `humanFinalText` before persisting the `HumanReview`. Store the diff summary in `human_review.diffSummary`.
**When to use:** Every time a human review is submitted with a non-empty `humanFinalText`.

```typescript
// Source: npm package 'diff' v8 — ships TS types natively
import { diffWords } from 'diff';

function computeDiffSummary(aiText: string, humanText: string): string {
  const changes = diffWords(aiText, humanText);
  const additions = changes.filter(c => c.added).map(c => c.value).join(' ');
  const removals = changes.filter(c => c.removed).map(c => c.value).join(' ');
  const changesCount = changes.filter(c => c.added || c.removed).length;
  return JSON.stringify({ changesCount, additions: additions.slice(0, 500), removals: removals.slice(0, 500) });
}
```

Note: `diffSummary` column in `human_review` is `TEXT` — store as JSON string (not JSONB). The full diff can be recomputed on the frontend from aiDraft + humanFinal; diffSummary is for backend ML learning queries only.

### Pattern 3: Diff Display — Frontend (in HITL Editor)

**What:** Show side-by-side diff between AI text (left) and human-edited text (right).
**When to use:** After operator edits the textarea; show live diff preview in diff panel tab.

```typescript
// Source: react-diff-viewer-continued v4.x (React 19 confirmed)
import ReactDiffViewer from 'react-diff-viewer-continued';

// In HITL editor client component:
<ReactDiffViewer
  oldValue={aiDraft}         // left — AI generated text
  newValue={humanDraft}      // right — operator's edited version (local state)
  splitView={true}
  useDarkTheme={false}
  showDiffOnly={false}
/>
```

The component is client-only (`'use client'` required). The local `humanDraft` state must be `useState` in the client component — it's not persisted until approval.

### Pattern 4: 4-Column Step Processor Layout

**What:** Responsive Tailwind grid: col-1 = ticket data, col-2 = current step info, col-3 = generated artifact viewer, col-4 = human review action.
**When to use:** The main execution page `/tickets/[id]/execution/[execId]`.

```tsx
// Source: codebase patterns — tailwind grid-cols-4
<div className="grid grid-cols-4 gap-4 h-full min-h-screen">
  <section className="col-span-1 rounded-lg border bg-card p-4">
    {/* Ticket data — complaint details, SLA, metadata */}
  </section>
  <section className="col-span-1 rounded-lg border bg-card p-4">
    {/* Current step — stepKey, status badge, skill name, timing */}
  </section>
  <section className="col-span-1 rounded-lg border bg-card p-4">
    {/* Generated artifact — artifact type, content viewer (JSON or text) */}
  </section>
  <section className="col-span-1 rounded-lg border bg-card p-4">
    {/* Human review — shows "Avancar" button or HITL editor link */}
    {/* Blocked if status === 'waiting_human' until review submitted */}
  </section>
</div>
```

STEP-04 requires this exact 4-column layout. On mobile, collapse to single column. Use `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`.

### Pattern 5: Server Action for Review Submission

**What:** A `'use server'` action that calls the backend `POST /api/executions/:execId/steps/:stepId/review` then calls `POST /api/executions/:execId/advance` with the operatorInput.
**When to use:** The approve button in the HITL editor.

```typescript
// Source: codebase — app/login/actions.ts pattern, fetchAuthAPI lib
'use server'
import { fetchAuthAPI } from '@/lib/api'

export async function submitHumanReview(
  execId: string,
  stepId: string,
  _prevState: unknown,
  formData: FormData
) {
  const humanFinalText = formData.get('humanFinalText') as string
  const correctionReason = formData.get('correctionReason') as string
  const observations = formData.get('observations') as string

  const reviewRes = await fetchAuthAPI(
    `/api/executions/${execId}/steps/${stepId}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ humanFinalText, correctionReason, observations, approved: true }),
    }
  )

  if (!reviewRes.ok) {
    return { error: 'Falha ao salvar revisão' }
  }

  // Advance execution after review — passes humanFinalText as operatorInput
  await fetchAuthAPI(`/api/executions/${execId}/advance`, {
    method: 'POST',
    body: JSON.stringify({ operatorInput: { humanFinalText, correctionReason } }),
  })

  // revalidatePath and/or redirect
  return { success: true }
}
```

**IMPORTANT:** `redirect()` must be called OUTSIDE the try/catch block (prior decision — redirect() throws NEXT_REDIRECT).

### Pattern 6: Steps Designer — Admin CRUD

**What:** Admin pages to create/edit Capability → CapabilityVersion → StepDefinition → StepSkillBinding graph.
**When to use:** The `/admin/steps` routes (DSGN-01 through DSGN-09).

DSGN requirements need:
- List capabilities and their versions
- Create new step definitions within a capability version
- Bind a SkillDefinition to a StepDefinition (StepSkillBinding)
- Set `isHumanRequired`, `llmModel`, `conditionType`, `conditionExpression` on bindings and transitions
- Visual flow = ordered list of steps with drag-and-drop reordering (stepOrder field)

The "visual flow builder" (DSGN-01) in a resource-constrained roadmap = an ordered step list with add/edit/delete/reorder, not a graphical canvas. The `StepTransitionRule` entity stores condition rules. The `StepSkillBinding.llmModel` stores per-step LLM override.

### Anti-Patterns to Avoid

- **Using StepExecution.id as the "stepId" for human review submission:** The step execution row is created when `advanceStep()` is called. The human review must reference a `stepExecutionId` — which means the `WAITING_HUMAN` step execution must be created first (it already is: `advanceStep()` creates a `WAITING_HUMAN` StepExecution when `isHumanRequired && !operatorInput`). The frontend must load the current step execution ID from the execution's stepExecutions list.

- **Computing diff on frontend only without persisting:** HITL-06 requires `diff` and `correctionReason` to be persisted for ML learning. The backend endpoint must compute and store the diff, not just the frontend display.

- **Embedding the diff viewer in a Server Component:** `react-diff-viewer-continued` renders client-side. The HITL editor page must use `'use client'` or extract the diff panel into a client component.

- **Creating new WAITING_HUMAN StepExecution on every review call:** The `WAITING_HUMAN` StepExecution row is already created by `advanceStep()`. `submitReview` should find it by `(ticketExecutionId, stepKey)` — do NOT create duplicate StepExecution rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diff computation | Myers algorithm from scratch | `diff` npm package v8 | 58M weekly downloads; handles edge cases (empty strings, unicode), pure TypeScript |
| Diff display component | Custom CSS-highlighted spans | `react-diff-viewer-continued` v4 | Split/unified views, word-level highlighting, React 19 confirmed |
| Step flow visualization | D3 or Cytoscape canvas graph | Ordered table with stepOrder reordering | DSGN scope is admin CRUD, not interactive graph canvas |
| Checklist persistence | Separate checklist entity | `human_review.checklistItems JSONB` column (already in schema) | Already modeled in DB |
| Authentication in Server Actions | Custom auth check | `verifySession()` from `@/lib/dal` | Already established pattern, used in all server components |

**Key insight:** The database schema (human_review, step_execution, step_definition tables) is already complete. Phase 6 is plumbing + UI, not new data modeling.

---

## Common Pitfalls

### Pitfall 1: Missing `stepExecutionId` when submitting human review

**What goes wrong:** `POST /api/executions/:execId/steps/:stepId/review` receives a `:stepId` that refers to a `StepDefinition.id` but the code tries to use it as a `StepExecution.id` — FK violation on `human_review.stepExecutionId`.
**Why it happens:** The URL parameter name is ambiguous. The frontend must pass the `StepExecution.id` (the execution row), not the `StepDefinition.id`.
**How to avoid:** The frontend step processor page loads `GET /api/complaints/:id/executions` which includes `stepExecutions` (already joined in `ExecutionService.findByComplaintId()` with `leftJoinAndSelect`). The `stepExecution.id` is available — use it in the review endpoint URL.
**Warning signs:** `23503 foreign key violation on stepExecutionId` in Postgres logs.

### Pitfall 2: Advancing after human review without operatorInput causes WAITING_HUMAN loop

**What goes wrong:** After the human review is persisted, calling `POST /api/executions/:id/advance` WITHOUT `operatorInput` creates another `WAITING_HUMAN` StepExecution for the same step.
**Why it happens:** `advanceStep()` checks `currentStep.isHumanRequired && !operatorInput` — if operatorInput is absent, it pauses again.
**How to avoid:** The `submitReview` server action must pass `operatorInput` in the advance call. Minimum content: `{ humanReviewId: review.id, approved: true }`. The `advanceStep()` code at line 213 will then proceed past the human gate.
**Warning signs:** `execution.status` stays `paused_human` after review submit; execution never moves to next step.

### Pitfall 3: `react-diff-viewer-continued` used in a Server Component

**What goes wrong:** Build error — `react-diff-viewer-continued` uses browser APIs and client-only hooks internally.
**Why it happens:** Next.js App Router defaults to Server Components; importing a client library without `'use client'` directive causes build failure.
**How to avoid:** Create a dedicated `DiffPanel` client component with `'use client'` at the top. The HITL editor page can be a Server Component that fetches data and passes it to the `DiffPanel` client component as props.
**Warning signs:** `Error: You're importing a component that needs X. This React hook only works in a client component.`

### Pitfall 4: `diff` package import — named exports only in v8

**What goes wrong:** `import diff from 'diff'` (default import) fails TypeScript compilation in v8.
**Why it happens:** The `diff` package v8 exports only named exports: `diffWords`, `diffLines`, `diffChars`, `createTwoFilesPatch`, etc.
**How to avoid:** Always use named imports: `import { diffWords } from 'diff'`.
**Warning signs:** TypeScript error `Module 'diff' has no default export`.

### Pitfall 5: HumanReview `aiGeneratedText` not populated from artifact

**What goes wrong:** When creating the `HumanReview` row, `aiGeneratedText` is set to an empty string because the code looks for it in `operatorInput` instead of reading from the existing ART-11 artifact.
**Why it happens:** The `HumanDiffCapture` skill in Phase 5 creates an ART-11 artifact with `{ diffSummary: 'pending_human_review', changesCount: null }` — but the actual AI-generated response text is in the ART-09 artifact (`final_response` type, `content.finalResponse`).
**How to avoid:** `HumanReviewService.createReview()` must load the ART-09 artifact for the execution via `artifactRepo.findOne({ where: { complaintId, artifactType: 'final_response' }, order: { createdAt: 'DESC' } })` and set `aiGeneratedText = artifact.content.finalResponse`.
**Warning signs:** `human_review.aiGeneratedText` is empty string; operator sees blank AI draft in the HITL editor.

### Pitfall 6: Steps designer updates `stepOrder` without atomic reorder

**What goes wrong:** Dragging step B before step A results in both having `stepOrder = 1`, causing undefined sort behavior in `advanceStep()`.
**Why it happens:** Naive "update one row" approach when reordering steps. If step A has order 2 and step B is moved to position 1, B gets order 1 but A still has order 2 — no conflict. But if B was already at 2 and is swapped with A at 2, there's a duplicate.
**How to avoid:** Reordering must be done in a DB transaction using TypeORM `DataSource.transaction()`. Reassign all steps in the version sequentially (1, 2, 3, ...) based on the new order array.
**Warning signs:** Step pipeline runs in wrong order; execution completes in 1 step instead of 19.

### Pitfall 7: HITL editor's checklist items not typed

**What goes wrong:** `human_review.checklistItems` is `JSONB` with no enforced schema — different submissions use different keys, making ML analysis impossible.
**Why it happens:** JSONB is permissive; client can send anything.
**How to avoid:** Define a `ChecklistItemDto` interface and validate with `class-validator` in NestJS. The checklist items correspond to the ART-06 mandatory checklist (`BuildMandatoryChecklist` skill output). The HITL editor should pre-populate checklist from the ART-06 artifact content.
**Warning signs:** `checklistItems` in DB has inconsistent keys across reviews.

---

## Code Examples

### HumanReviewService — Create Review

```typescript
// Source: codebase — human-review.entity.ts, artifact.entity.ts
import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HumanReview, HumanReviewStatus } from '../entities/human-review.entity';
import { StepExecution } from '../entities/step-execution.entity';
import { Artifact } from '../entities/artifact.entity';
import { diffWords } from 'diff';

@Injectable()
export class HumanReviewService {
  constructor(
    @InjectRepository(HumanReview)
    private readonly reviewRepo: Repository<HumanReview>,
    @InjectRepository(StepExecution)
    private readonly stepExecRepo: Repository<StepExecution>,
    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,
  ) {}

  async createReview(
    stepExecutionId: string,
    complaintId: string,
    reviewerUserId: string,
    dto: {
      humanFinalText: string | null;
      correctionReason: string | null;
      checklistItems: Record<string, boolean> | null;
      observations: string | null;
      approved: boolean;
    },
  ): Promise<HumanReview> {
    // Load AI draft from ART-09 artifact (final_response)
    const artifact = await this.artifactRepo.findOne({
      where: { complaintId, artifactType: 'final_response' },
      order: { createdAt: 'DESC' },
    });
    const aiGeneratedText = (artifact?.content?.['finalResponse'] as string) ?? '';

    // Compute diff if human edited
    let diffSummary: string | null = null;
    if (dto.humanFinalText && dto.humanFinalText !== aiGeneratedText) {
      const changes = diffWords(aiGeneratedText, dto.humanFinalText);
      const changesCount = changes.filter(c => c.added || c.removed).length;
      diffSummary = JSON.stringify({ changesCount });
    }

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        stepExecutionId,
        complaintId,
        reviewerUserId,
        status: dto.approved ? HumanReviewStatus.APPROVED : HumanReviewStatus.PENDING,
        aiGeneratedText,
        humanFinalText: dto.humanFinalText,
        diffSummary,
        correctionReason: dto.correctionReason,
        checklistItems: dto.checklistItems,
        observations: dto.observations,
        checklistCompleted: dto.checklistItems != null,
        reviewedAt: dto.approved ? new Date() : null,
      }),
    );

    return review;
  }
}
```

### HumanReview BFF Endpoint Registration

```typescript
// Source: codebase — execucao.module.ts, ticket-execution.controller.ts pattern
// In execucao.module.ts — add HumanReviewController + HumanReviewService
@Module({
  ...
  controllers: [ExecutionController, TicketExecutionController, HumanReviewController],
  providers: [ExecutionService, TicketExecutionService, SkillRegistryService, HumanReviewService],
  ...
})
export class ExecucaoModule {}
```

### HITL Editor Client Component — Diff Panel

```typescript
// Source: react-diff-viewer-continued v4, codebase useActionState pattern
'use client'

import { useState } from 'react'
import { useActionState } from 'react'  // React 19 — from 'react', NOT 'react-dom'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { submitHumanReview } from './actions'

interface HitlEditorProps {
  execId: string
  stepExecutionId: string
  aiDraft: string
  checklistTemplate: Array<{ fieldName: string; fieldLabel: string; isRequired: boolean }>
}

export function HitlEditor({ execId, stepExecutionId, aiDraft, checklistTemplate }: HitlEditorProps) {
  const [humanDraft, setHumanDraft] = useState(aiDraft)
  const [activeTab, setActiveTab] = useState<'ai' | 'diff' | 'checklist'>('ai')

  const submitAction = submitHumanReview.bind(null, execId, stepExecutionId)
  const [state, formAction, isPending] = useActionState(submitAction, {})

  return (
    <form action={formAction} className="space-y-4">
      {/* Tab selector */}
      {/* AI view tab — read-only display of aiDraft */}
      {/* Diff tab — ReactDiffViewer with oldValue=aiDraft newValue=humanDraft */}
      {/* Checklist tab — checkbox list */}

      {/* Hidden fields */}
      <input type="hidden" name="humanFinalText" value={humanDraft} />

      {/* Textarea for editing */}
      <textarea
        value={humanDraft}
        onChange={e => setHumanDraft(e.target.value)}
        name="_humanDraftDisplay"  // NOT submitted — hidden field above is used
        rows={10}
        className="w-full rounded-md border p-3 font-mono text-sm"
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Aprovando...' : 'Aprovar Resposta'}
      </Button>
    </form>
  )
}
```

### advanceStep Server Action (Step Processor Page)

```typescript
// Source: codebase — fetchAuthAPI lib/api.ts, prior decision: redirect() outside try/catch
'use server'
import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export async function advanceStep(execId: string, _prev: unknown, _formData: FormData) {
  const res = await fetchAuthAPI(`/api/executions/${execId}/advance`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body?.message ?? 'Falha ao avançar etapa' }
  }

  revalidatePath(`/tickets`)
  return { success: true }
}
```

### Steps Designer — List Capabilities (Backend)

```typescript
// Source: codebase — capability-version.entity.ts, step-definition.entity.ts
// GET /api/admin/capabilities
@Get('admin/capabilities')
async listCapabilities(): Promise<Capability[]> {
  return this.stepsDesignerService.listCapabilities();
}

// PUT /api/admin/capabilities/:capId/versions/:verId/steps
// Body: { steps: Array<{ key, name, stepOrder, isHumanRequired, skillKey, llmModel }> }
@Put('admin/capabilities/:capId/versions/:verId/steps')
async updateSteps(
  @Param('capId') capId: string,
  @Param('verId') verId: string,
  @Body() body: UpdateStepsDto,
): Promise<StepDefinition[]> {
  return this.stepsDesignerService.updateSteps(verId, body.steps);
}
```

---

## What Already Exists (Do Not Rebuild)

| Already Built | Location | How Phase 6 Uses It |
|---------------|----------|---------------------|
| `HumanReview` entity + DB table | `execucao/entities/human-review.entity.ts` | Use as-is, no migration needed |
| `StepExecution` with `WAITING_HUMAN` status | `execucao/entities/step-execution.entity.ts` | Human-blocked steps already pause in this state |
| `advanceStep()` with `operatorInput` | `ticket-execution.service.ts` | Pass `{ humanReviewId, approved: true }` to resume |
| `POST /api/executions/:id/advance` | `ticket-execution.controller.ts` | HITL editor calls this after review submit |
| `GET /api/complaints/:id/executions` | `execution.controller.ts` | Already joins stepExecutions — use to render step list |
| ART-09 `final_response` artifact | `skill-registry.service.ts` phase 5 | Source for `aiGeneratedText` in HumanReview |
| ART-06 `mandatory_checklist` artifact | `skill-registry.service.ts` phase 5 | Source for checklist template in HITL editor |
| `ExecucaoModule` with all imports | `execucao.module.ts` | `HumanReviewService` + `HumanReviewController` added here only |
| `@base-ui/react` Button, Card, Input, Badge, Select | `/frontend/src/components/ui/` | Used in step processor and HITL editor without reinstall |
| `fetchAuthAPI` + `verifySession` | `/frontend/src/lib/api.ts`, `dal.ts` | BFF calls from server actions and server components |

---

## Entity Field Mapping Reference

### HumanReview entity (existing, no changes)

| Field | Type | Phase 6 Usage |
|-------|------|---------------|
| `reviewerUserId` | varchar | From session (verifySession().userId) |
| `status` | enum (pending/approved/rejected/revision_requested) | Set to `approved` on submit |
| `aiGeneratedText` | text NOT NULL | Load from ART-09 artifact |
| `humanFinalText` | text nullable | Operator's edited version |
| `diffSummary` | text nullable | JSON string from `diffWords()` computation |
| `correctionReason` | text nullable | Operator explains why they changed |
| `checklistCompleted` | boolean | True when checklistItems provided |
| `checklistItems` | jsonb nullable | `{ fieldName: boolean }` map from ART-06 checklist |
| `observations` | text nullable | Free-text operator notes |
| `reviewedAt` | timestamp | Set to `new Date()` when approved |
| `stepExecutionId` | uuid FK | The `WAITING_HUMAN` StepExecution id |
| `complaintId` | uuid FK | From execution.complaintId |

### StepDefinition fields for designer (existing, no changes)

| Field | Used In Designer |
|-------|----------------|
| `key` | Step identifier — must be unique per capability version |
| `name` | Display label in flow builder |
| `stepOrder` | Sort order — used by advanceStep() to find next step |
| `isHumanRequired` | Toggle in designer — pauses execution at this step |
| `timeoutSeconds` | Optional per-step timeout |
| `isActive` | Soft-delete toggle |

### StepSkillBinding fields for designer (existing, no changes)

| Field | Used In Designer |
|-------|----------------|
| `skillDefinitionId` | Dropdown of all SkillDefinition.key values |
| `llmModel` | Per-step LLM override (DSGN-05 requirement) |
| `configuration` | JSONB config passed to skill |
| `promptVersion` | Version tag for prompt tracking |

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| HumanDiffCapture returns placeholder artifact | Phase 6 populates `humanFinalText` in `HumanReview` and updates ART-11 | Phase 6 change | ART-11 content gets filled with real diff data |
| Execution stays `paused_human` forever | Phase 6 advance call with `operatorInput` after review | Phase 6 change | Execution resumes past human gate |
| No admin UI for step flows | Phase 6 adds `/admin/steps` CRUD | Phase 6 addition | Admins can configure step/skill bindings without DB migrations |

**Not changing in Phase 6:**
- `StepExecution.WAITING_HUMAN` pause mechanism (already works in Phase 5)
- The ART-01 through ART-09 artifact pipeline (Phase 5 complete)
- The 4-step entity chain: Capability → CapabilityVersion → StepDefinition → StepSkillBinding (all seeded)

---

## Open Questions

1. **Should the review submission also update the ART-11 artifact content?**
   - What we know: ART-11 (`human_diff` artifact) was created as a placeholder in Phase 5 with `{ diffSummary: 'pending_human_review', changesCount: null }`
   - What's unclear: Requirements say `HITL-06: sistema persiste diff e motivo para aprendizado` — this is satisfied by `human_review` row; whether to also update ART-11 is unspecified
   - Recommendation: Update ART-11 `content` with real diff data when review is submitted. The `HumanReviewService.createReview()` should also find the ART-11 artifact and update its content. This keeps both `human_review.diffSummary` (for queries) and ART-11 (for execution artifacts consistency) in sync.

2. **HITL-07: Risk-based HITL policy — where is this enforced?**
   - What we know: `StepDefinition.isHumanRequired` is the flag; `complaint.riskLevel` is seeded on complaints
   - What's unclear: Whether `isHumanRequired` is set statically in step definitions or dynamically based on `complaint.riskLevel` at runtime
   - Recommendation: Phase 6 should implement a `HitlPolicyService.shouldRequireHumanReview(stepKey, complaint)` method that returns `true` if `isHumanRequired` OR `riskLevel IN ('high', 'critical')`. This is called in `advanceStep()` instead of the raw `currentStep.isHumanRequired` check. This is a small extension to the existing check.

3. **Steps designer — should it allow creating new CapabilityVersions or only editing existing ones?**
   - What we know: `CapabilityVersion.isCurrent` is what `selectCapabilityVersion()` uses; creating a new version without setting `isCurrent = false` on the old one would break execution routing
   - What's unclear: DSGN requirements don't specify version management workflow
   - Recommendation: Designer scope = edit active/current version steps only. Creating new versions is an advanced admin operation beyond Phase 6 scope. Set DSGN new-version creation as out-of-scope.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `/backend/src/modules/execucao/entities/human-review.entity.ts` — all fields, relations, enums
- `/backend/src/modules/execucao/entities/step-execution.entity.ts` — WAITING_HUMAN status
- `/backend/src/modules/execucao/entities/ticket-execution.entity.ts` — PAUSED_HUMAN status, operatorInput flow
- `/backend/src/modules/execucao/services/ticket-execution.service.ts` — advanceStep() human gate logic (lines 213-231)
- `/backend/src/modules/execucao/controllers/ticket-execution.controller.ts` — existing advance/finalize endpoints
- `/backend/src/modules/execucao/controllers/execution.controller.ts` — GET executions with stepExecutions join
- `/backend/src/database/migrations/1773774004000-CreateExecucaoTables.ts` — human_review DDL confirmed
- `/backend/src/modules/orquestracao/entities/step-definition.entity.ts` — isHumanRequired, stepOrder fields
- `/backend/src/modules/orquestracao/entities/step-skill-binding.entity.ts` — llmModel, configuration fields
- `/backend/src/modules/orquestracao/entities/step-transition-rule.entity.ts` — conditionType, conditionExpression
- `/backend/src/modules/orquestracao/entities/capability-version.entity.ts` — isCurrent flag
- `/backend/src/modules/execucao/execucao.module.ts` — current module imports (all already wired)
- `/frontend/src/app/login/page.tsx` — useActionState from 'react' pattern confirmed
- `/frontend/src/app/tickets/[id]/page.tsx` — verifySession + fetchAuthAPI server component pattern
- `/frontend/src/lib/api.ts` — fetchAuthAPI helper
- `/frontend/src/components/ui/` — installed: button, card, input, badge, select, label, table
- `/frontend/package.json` — confirmed next 16.1.7, react 19.2.3, no diff libraries installed
- `/backend/package.json` — no diff libraries installed

### Secondary (MEDIUM confidence — WebFetch confirmed)

- GitHub issue #63 on `react-diff-viewer-continued` — React 19 support confirmed resolved in v4.1.0 (February 2026)
- `react-diff-viewer-continued` README — `oldValue/newValue/splitView` props API confirmed

### Tertiary (LOW confidence — WebSearch only)

- `diff` npm package v8 — named exports, TypeScript types bundled, 58M weekly downloads (could not WebFetch npm page; based on WebSearch result summary)

---

## Metadata

**Confidence breakdown:**
- Backend entities and DB schema: HIGH — direct inspection, no schema changes needed
- advanceStep() human gate mechanism: HIGH — code read line-by-line
- react-diff-viewer-continued React 19 support: HIGH — GitHub issue confirmed resolved
- `diff` package API (named exports, v8): MEDIUM — WebSearch result, could not WebFetch npm
- Steps designer scope recommendation: MEDIUM — inferred from entity structure + DSGN requirements
- HITL-07 risk policy placement: MEDIUM — architectural recommendation based on existing code

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain — react-diff-viewer-continued v4.x is recent stable)
