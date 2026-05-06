---
phase: 06-human-review-pipeline
plan: 03
subsystem: ui
tags: [nextjs, react19, hitl, steps-designer, react-diff-viewer-continued, server-actions, useActionState, tailwind]

# Dependency graph
requires:
  - phase: 06-01
    provides: HumanReviewController (POST/GET review), StepsDesignerController (capabilities, versions, steps, transitions endpoints)
  - phase: 06-02
    provides: step-processor.tsx, UI components (tabs, textarea, checkbox), actions.ts review scaffolding pre-placed

provides:
  - HITL editor page at /tickets/:id/execution/:execId/review/:stepExecId with 4 tabs (AI text, Edit, Diff, Checklist)
  - submitHumanReview server action: POST review + POST advance with operatorInput, redirect on success
  - Approval gate: approve button disabled until all required checklist items checked (HITL-05)
  - /admin/steps: capabilities list with current version name and step count
  - /admin/steps/:capabilityId: StepsDesigner with skillKey/llmModel inputs, isHumanRequired toggle, step reorder, transitions editor
  - getTransitions server action for auth-aware lazy-load of transition conditions
  - saveTransitions server action: PUT /api/admin/steps/:stepId/transitions

affects: [07-reporting-dashboard, future-phases using HITL flow]

# Tech tracking
tech-stack:
  added: [react-diff-viewer-continued@4.2.0]
  patterns:
    - "useActionState inline wrapper (not .bind()) avoids TypeScript overload errors with server actions that have extra bound parameters"
    - "getTransitions server action for client component lazy-load — avoids direct client-side fetch to BACKEND_URL (server-only env var)"
    - "dynamic(() => import('react-diff-viewer-continued'), { ssr: false }) — SSR-safe lazy load for CJS diff viewer"

key-files:
  created:
    - frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/page.tsx
    - frontend/src/app/admin/steps/page.tsx
    - frontend/src/app/admin/steps/[capabilityId]/page.tsx
    - frontend/src/app/admin/steps/[capabilityId]/actions.ts
    - frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx
  modified:
    - frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/components/hitl-editor.tsx
    - frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/actions.ts

key-decisions:
  - "useActionState inline wrapper: (_prev, formData) => serverAction(bound, args, _prev, formData) avoids TypeScript .bind() overload errors in React 19"
  - "getTransitions server action instead of client-side fetch('/api/...') — BACKEND_URL is server-only and not accessible from client components without a proxy"
  - "react-diff-viewer-continued dynamically imported with { ssr: false } — CJS module causes SSR build error if imported statically"

patterns-established:
  - "Server action pattern for client lazy-load: export async function getX() { return fetchAuthAPI(...).json() } — called from useTransition() handler in client component"
  - "useActionState with inline wrapper: useActionState<S,P>((prev, payload) => serverAction(...extraArgs, prev, payload), initialState)"

# Metrics
duration: 22min
completed: 2026-03-18
---

# Phase 6 Plan 3: HITL Frontend Editor and Steps Designer Summary

**HITL review editor (4 tabs: AI text/Edit/Diff/Checklist) + steps designer admin pages with skillKey/llmModel inputs, isHumanRequired toggle, step reordering, and per-step transition condition CRUD — completing the full Phase 6 frontend**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-18T03:02:26Z
- **Completed:** 2026-03-18T03:24:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- HITL editor at `/tickets/:id/execution/:execId/review/:stepExecId` with 4-tab layout (AI text read-only, Edit textarea, react-diff-viewer-continued side-by-side diff, regulatory checklist from ART-06)
- Approval flow: `submitHumanReview` POSTs review then advances execution with `operatorInput: { humanReviewId, approved: true }` then redirects to execution page
- Approve button gated on all `isRequired` checklist items checked (HITL-05 requirement enforced client-side)
- Steps designer at `/admin/steps` and `/admin/steps/:capabilityId` with full flow management (skill binding, LLM override, step reorder, transition conditions)
- Build passes clean on VPS with zero TypeScript errors

## Task Commits

1. **Task 1: HITL editor — server page and client component** - `efec803` (feat)
2. **Task 2: Steps designer admin pages with transitions editor** - `2700c55` (feat)

**Plan metadata:** (docs commit created next)

## Files Created/Modified
- `frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/page.tsx` - Server component: loads complaint, ART-09/ART-06 artifacts, existing review; renders HitlEditor
- `frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/components/hitl-editor.tsx` - Client component: 4-tab form, approval gate, inline useActionState wrapper
- `frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/actions.ts` - submitHumanReview server action with ReviewActionState type
- `frontend/src/app/admin/steps/page.tsx` - Capabilities list with version name and step count
- `frontend/src/app/admin/steps/[capabilityId]/page.tsx` - Loads capability + active version, renders StepsDesigner
- `frontend/src/app/admin/steps/[capabilityId]/actions.ts` - saveSteps, saveTransitions, getTransitions server actions
- `frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx` - StepsDesigner + TransitionsEditor client components

## Decisions Made
- **useActionState inline wrapper**: Using `(_prev, formData) => serverAction(execId, stepExecId, complaintId, _prev, formData)` instead of `.bind()` — TypeScript's `.bind()` type inference doesn't narrow the extra pre-bound args correctly for `useActionState` overloads, causing compile errors
- **getTransitions server action for lazy-load**: Client component's `TransitionsEditor` needs to fetch from backend but `BACKEND_URL` is a server-only env var not accessible client-side. Server action pattern gives clean auth-aware data fetching from a client handler
- **react-diff-viewer-continued with `{ ssr: false }`**: CJS module causes SSR compile error when imported statically; dynamic import defers to client

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Replaced client-side fetch with server action for transitions lazy-load**
- **Found during:** Task 2 (steps-designer.tsx)
- **Issue:** Plan specified `fetch('/api/admin/steps/:stepId/transitions', { credentials: 'include' })` from client component. This would fail because (a) there's no `/api` proxy route in Next.js config, (b) `BACKEND_URL` is a server-only env var inaccessible to client components, (c) no cookie forwarding to backend
- **Fix:** Added `getTransitions(stepId: string)` server action in `actions.ts` that calls `fetchAuthAPI()`. `TransitionsEditor` calls this via `useTransition()` handler instead of raw fetch
- **Files modified:** `frontend/src/app/admin/steps/[capabilityId]/actions.ts`, `frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx`
- **Verification:** Build passes; pattern consistent with all other backend calls in this project
- **Committed in:** 2700c55 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — auth/proxy pattern)
**Impact on plan:** Fix was essential for correct operation. No functional scope change — transitions still load lazily on expand, still save via PUT endpoint.

## Issues Encountered
- TypeScript build error on `useActionState<ReviewActionState, FormData>(boundAction, {})`: React 19's `useActionState` overloads don't infer `.bind()` return types correctly for pre-bound server actions. Fixed with inline wrapper function (no `bind`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Human Review Pipeline) is now COMPLETE: backend (06-01) + step processor (06-02) + HITL editor + steps designer (06-03) all done
- VPS build passes clean — all routes registered and TypeScript-verified
- Phase 7 (Reporting Dashboard) can begin: full pipeline with HITL is operational end-to-end
- Admin can configure step flows via `/admin/steps`; operators can review and approve AI drafts via `/tickets/:id/execution/:execId/review/:stepExecId`

---
*Phase: 06-human-review-pipeline*
*Completed: 2026-03-18*
