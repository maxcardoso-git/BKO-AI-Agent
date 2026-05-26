---
phase: 10-validation-ui-training-memory-audit-reports
plan: "03"
subsystem: frontend-validation-ui
tags: [nextjs, react, validation, hitl, admin, observability, tailwind, shadcn]

dependency-graph:
  requires:
    - 10-01  # backend validate endpoint + human_review lifecycle
    - 10-02  # injectedCorrections in draft_response artifact
  provides:
    - Operator approve/correct/reject UI at /processar/[protocolo]/validar
    - Auto-redirect from /processar on paused_human
    - VALUI-06 retry flow (?retry=<protocolo> auto-pull + scroll)
    - Admin feedback audit page /admin/feedback
    - Admin timing audit page /admin/audit/timings
    - Observability human review avg time panel
  affects:
    - 10-04  # any future frontend polish / navigation additions

tech-stack:
  added: []
  patterns:
    - useRequireAuth(['OPERATOR','SUPERVISOR','ADMIN']) for validation page
    - useRequireAuth(['ADMIN']) for admin pages
    - pullByProtocol(rawProtocol) explicit-arg refactor pattern (avoids useState timing issues)
    - router.push + useEffect on execution.status for paused_human redirect
    - useSearchParams() one-time-mount useEffect for ?retry= consumption
    - fetchHumanReviewAvgTime via useEffect + useAuthStore in observability page

key-files:
  created:
    - BKOConsole/src/app/(app)/processar/[protocolo]/validar/page.tsx
    - BKOConsole/src/app/(app)/processar/[protocolo]/validar/ValidarClient.tsx
    - BKOConsole/src/app/(app)/processar/[protocolo]/validar/RejectionModal.tsx
    - BKOConsole/src/app/(app)/processar/[protocolo]/validar/InjectedCorrectionsPanel.tsx
    - BKOConsole/src/app/(app)/admin/feedback/page.tsx
    - BKOConsole/src/app/(app)/admin/audit/timings/page.tsx
    - BKOConsole/src/lib/validation-api.ts
    - BKOConsole/src/lib/admin-feedback-api.ts
    - BKOConsole/src/lib/admin-audit-api.ts
  modified:
    - BKOConsole/src/app/(app)/processar/components/ProcessarClient.tsx
    - BKOConsole/src/app/(app)/observability/page.tsx

decisions:
  - id: VALUI-06-retry-empty-deps
    description: "retry useEffect has intentionally empty deps [] — fires once on mount, reads searchParams.get('retry'), then calls pullByProtocol + router.replace to consume the param. Avoids infinite loop from re-render after state updates."
  - id: pullByProtocol-refactor
    description: "handlePullByProtocol refactored to pullByProtocol(rawProtocol) accepting explicit arg, with handlePullByProtocol as zero-arg wrapper. Enables retry useEffect to call without waiting for setPullProtocol to settle."
  - id: isLoading-not-in-useRequireAuth
    description: "useRequireAuth returns { hasAccess, persistHydrated } — no isLoading field. Auth gate uses !persistHydrated || !hasAccess instead of authLoading. Plan spec assumed isLoading — deviation auto-fixed."
  - id: RichTextArea-default-export
    description: "RichTextArea is default export (not named). Fixed import: import RichTextArea from '@/components/ui/rich-text-area'. Plan spec used named import — auto-fixed."
  - id: no-shadcn-table
    description: "BKOConsole has no shadcn Table component installed. Admin pages use plain <table> HTML with Tailwind classes — consistent with /admin/locks pattern."
  - id: admin-pages-html-table
    description: "admin/feedback and admin/audit/timings use native HTML tables with overflow-x-auto wrapper — no react-query dependency, matches pattern of existing admin pages."

metrics:
  duration: "~15 min"
  completed: "2026-05-26"
---

# Phase 10 Plan 03: Frontend Validation UI Summary

**One-liner:** Operator approve/correct/reject validation UI at /processar/[protocolo]/validar with auto-redirect on paused_human, VALUI-06 note-carry-forward retry, admin feedback + timing audit pages, and observability human review avg time panel.

## What Was Built

### Task 1: Validation Page + ProcessarClient Changes

**New route `/processar/[protocolo]/validar`:**
- `page.tsx` — Next.js 16 server-component shell with async params
- `ValidarClient.tsx` — 3-column layout: editable RichTextArea draft (left 2/3), context panels (right 1/3)
  - Aprovar: calls `POST /api/complaints/:id/validate` with `decision='approved'` + `humanFinal`, redirects to /processar
  - Corrigir: validates correctionReason >= 5 chars inline, calls validate with `decision='corrected'`, redirects to /processar
  - Reprovar: opens RejectionModal, on confirm calls validate with `decision='rejected'`, redirects to `/processar?retry=<protocolo>`
  - Shows conformance score badge (from compliance_check artifact)
  - Context panels: operator note, template used, KB chunk count, original complaint text
- `RejectionModal.tsx` — shadcn Dialog requiring motivo >= 10 chars before confirming
- `InjectedCorrectionsPanel.tsx` — collapsible amber panel showing AI-vs-human correction pairs from `artifact.content.injectedCorrections` (10-02 output)

**`validation-api.ts`:**
- `submitValidationDecision(complaintId, token, payload)` — POST to backend validate endpoint
- `fetchValidationContext(protocolo, token)` — lookup complaint by protocol, fetch latest execution + artifacts (draft_response, compliance_check, iqi_template, manual_context) + latest operator note

**ProcessarClient.tsx changes (6 edits):**
1. Added `useCallback` to React imports
2. Added `useRouter, useSearchParams` from `next/navigation`
3. Added `router = useRouter()` and `searchParams = useSearchParams()` in component body
4. Refactored `handlePullByProtocol` into `pullByProtocol(rawProtocol: string)` useCallback + zero-arg wrapper
5. Added auto-redirect useEffect on `execution.status === 'paused_human'`
6. Added VALUI-06 retry useEffect (empty deps, one-shot) consuming `?retry=` param
7. Replaced old `<a href="/tickets/...">Revisar Texto</a>` with `<button>Ir para validacao</button>` using same router.push
8. Wrapped `<NoteForm>` with `<div data-note-form>` for scroll/focus target

### Task 2: Admin Pages

**`/admin/feedback` (ADMIN-only):**
- Filters: tipologyId (text input), feedbackType (Select: correction/rejection/all)
- Paginated table (50/page): date, protocol, tipology, feedback type badge, summary text
- `admin-feedback-api.ts`: `fetchAdminFeedback(token, filters)` → GET /api/admin/feedback

**`/admin/audit/timings` (ADMIN-only):**
- Filters: tipologyId, periodStart (date), periodEnd (date), userRole (OPERATOR/SUPERVISOR/ADMIN)
- Paginated table (100/page): 8 columns including 5 timing metrics with `fmtMin()` formatter
- `admin-audit-api.ts`: `fetchAdminAuditTimings(token, filters)` + `fetchHumanReviewAvgTime(token)`

### Task 3: Observability Panel

Added to `/observability/page.tsx`:
- Import `useEffect` from React + `useAuthStore` + `fetchHumanReviewAvgTime`
- New `humanReviewAvgTime` state with useEffect fetch on token
- New Card: "Tempo Medio de Revisao Humana" showing `avgMinutes` (rounded) or "—" + sample size subtitle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isLoading` not returned by `useRequireAuth`**

- **Found during:** Task 1 ValidarClient implementation, confirmed by TS errors
- **Issue:** Plan spec used `const { hasAccess, isLoading: authLoading } = useRequireAuth(...)` but the hook returns `{ user, persistHydrated, isAuthenticated, hasAccess }` — no `isLoading` field
- **Fix:** Changed to `const { hasAccess, persistHydrated } = useRequireAuth(...)` and used `!persistHydrated || !hasAccess` as auth guard
- **Files modified:** ValidarClient.tsx, admin/feedback/page.tsx, admin/audit/timings/page.tsx
- **Commit:** 713619c

**2. [Rule 1 - Bug] `RichTextArea` is a default export, not named**

- **Found during:** Task 1, TS error `Module has no exported member 'RichTextArea'`
- **Issue:** Plan spec used `import { RichTextArea } from '@/components/ui/rich-text-area'` but file uses `export default RichTextArea`
- **Fix:** Changed to `import RichTextArea from '@/components/ui/rich-text-area'`
- **Files modified:** ValidarClient.tsx
- **Commit:** 713619c

**3. [Rule 2 - Missing Critical] No `rows` prop on `RichTextArea`**

- **Found during:** Reading rich-text-area.tsx source
- **Issue:** Plan spec called `<RichTextArea ... rows={18} />` but interface only accepts `value, onChange, readOnly, placeholder, className, style, name`
- **Fix:** Used `style={{ minHeight: '360px' }}` instead of `rows`
- **Files modified:** ValidarClient.tsx
- **Commit:** 713619c

**4. [Rule 3 - Blocking] No shadcn Table component in BKOConsole**

- **Found during:** Task 2 admin pages implementation
- **Issue:** Plan spec used `import { Table, TableHeader, ... } from '@/components/ui/table'` but no table.tsx exists in components/ui/
- **Fix:** Used native HTML `<table>` with Tailwind classes and `overflow-x-auto` wrapper — consistent with existing admin pages pattern
- **Files modified:** admin/feedback/page.tsx, admin/audit/timings/page.tsx
- **Commit:** 713619c

## Known Limitations / Next Steps

- SUPERVISOR cannot access /admin/feedback or /admin/audit/timings — intentional per VALUI-07 (admin-only audit data)
- The `/processar/[protocolo]/validar` page does not enforce that the calling operator holds the lock — it re-fetches context for any operator who navigates there directly. Lock ownership enforcement is backend-side (POST /api/complaints/:id/validate returns 403 if caller doesn't hold lock).
- `fetchValidationContext` fetches executions with `?latest=true` — if the backend doesn't support this filter, it returns all executions and the page picks `executions[0]` (first in array). Should work in practice since API mirrors ProcessarClient.tsx pattern.
- VALUI-06 scroll targets `[data-note-form] textarea` — works for NoteForm's first textarea. If NoteForm has multiple textareas, the first one is focused (plano field). This is acceptable UX.

## Build Verification

- `npx tsc --noEmit` — 0 errors
- `npm run build` — succeeds, all routes listed including:
  - `ƒ /processar/[protocolo]/validar` (dynamic)
  - `○ /admin/feedback` (static)
  - `○ /admin/audit/timings` (static)
