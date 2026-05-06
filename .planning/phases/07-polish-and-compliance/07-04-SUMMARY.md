---
phase: 07-polish-and-compliance
plan: 04
subsystem: security
tags: [lgpd, interceptor, masking, nestjs, nextjs, cpf, phone, sec-01, sec-02]

requires:
  - phase: 07-02
    provides: AdminConfigController + @Roles(ADMIN) guards on all admin endpoints
  - phase: 07-03
    provides: ObservabilityController (confirmed no raw prompt/completion columns in LlmCall)

provides:
  - SensitiveDataInterceptor (backend) recursively redacting CPF and phone patterns from response payloads
  - @UseInterceptors applied to ExecutionController, HumanReviewController, ComplaintController
  - frontend/src/lib/mask.ts with maskCpf, maskPhone, maskSensitive utilities
  - Ticket detail page applying maskSensitive to rawText and normalizedText before render

affects:
  - All future phases that add complaint-serving endpoints (must apply SensitiveDataInterceptor)

tech-stack:
  added: []
  patterns:
    - "Controller-scoped interceptor pattern: @UseInterceptors at class level, not global (avoids deep recursion on artifact blobs)"
    - "Defence-in-depth masking: backend interceptor is primary, frontend maskSensitive is secondary"
    - "CPF regex: /\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g → '***.***.***-**'"
    - "Phone regex: /\\(\\d{2}\\)\\s?\\d{4,5}-\\d{4}/g → '(**) *****-****'"

key-files:
  created:
    - backend/src/interceptors/sensitive-data.interceptor.ts
    - frontend/src/lib/mask.ts
  modified:
    - backend/src/modules/execucao/controllers/execution.controller.ts
    - backend/src/modules/execucao/controllers/human-review.controller.ts
    - backend/src/modules/operacao/controllers/complaint.controller.ts
    - frontend/src/app/tickets/[id]/page.tsx

key-decisions:
  - "SensitiveDataInterceptor applied at controller class level NOT globally — avoids deep recursion on large artifact content blobs"
  - "ObservabilityController excluded from interceptor — SEC-02 satisfied structurally (LlmCall has no promptText/completionText columns)"
  - "Frontend masking applied to rawText and normalizedText in page.tsx before passing to child components — pure function works in server context"
  - "interceptors/ directory created at backend/src/interceptors/ (not common/) to keep NestJS interceptor convention"

patterns-established:
  - "Controller-scoped @UseInterceptors: decorate class not method for full controller coverage"
  - "maskSensitive wraps maskCpf + maskPhone in frontend — single call for composed masking"

duration: 8min
completed: 2026-03-18
---

# Phase 7 Plan 04: LGPD Sensitive Data Masking Summary

**NestJS SensitiveDataInterceptor (CPF + phone redaction) applied to 3 complaint controllers, plus frontend maskCpf/maskPhone/maskSensitive utilities in ticket detail page — SEC-01 through SEC-05 compliance**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T14:41:55Z
- **Completed:** 2026-03-18T14:49:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `SensitiveDataInterceptor` at `backend/src/interceptors/sensitive-data.interceptor.ts` — recursive `redactSensitive()` function walks any JSON payload shape, replacing CPF patterns with `***.***.***-**` and phone patterns with `(**) *****-****`
- Applied `@UseInterceptors(SensitiveDataInterceptor)` at class level on `ExecutionController`, `HumanReviewController`, and `ComplaintController` — all complaint/execution API responses are now redacted before reaching the browser
- Created `frontend/src/lib/mask.ts` with `maskCpf`, `maskPhone`, and `maskSensitive` exports — defence-in-depth layer in ticket detail page applying `maskSensitive` to `rawText` and `normalizedText` before render
- `ObservabilityController` correctly excluded from interceptor — SEC-02 confirmed structurally safe (LlmCall entity has no `promptText`/`completionText` columns, trace SELECT only reads aggregate metadata)
- Both backend (`nest build`) and frontend (`next build`) pass clean on VPS with exit 0

## Task Commits

1. **Task 1: SensitiveDataInterceptor + apply to complaint and execution controllers** - `69b0e44` (feat)
2. **Task 2: Frontend masking utilities + apply to ticket detail page** - `8ce0a7b` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `backend/src/interceptors/sensitive-data.interceptor.ts` - NestJS interceptor with recursive CPF/phone redaction over any JSON payload
- `backend/src/modules/execucao/controllers/execution.controller.ts` - Added `@UseInterceptors(SensitiveDataInterceptor)` at class level
- `backend/src/modules/execucao/controllers/human-review.controller.ts` - Added `@UseInterceptors(SensitiveDataInterceptor)` at class level
- `backend/src/modules/operacao/controllers/complaint.controller.ts` - Added `@UseInterceptors(SensitiveDataInterceptor)` at class level
- `frontend/src/lib/mask.ts` - `maskCpf`, `maskPhone`, `maskSensitive` pure string utilities
- `frontend/src/app/tickets/[id]/page.tsx` - Applies `maskSensitive` to `rawComplaint.rawText` and `rawComplaint.normalizedText` before passing masked complaint to child components

## Decisions Made

- **Controller-scoped interceptor vs global:** Applied at controller class level with `@UseInterceptors`, NOT in `main.ts` as global interceptor. Avoids deep recursive walk of large artifact binary/JSON blobs that go through other endpoints (e.g., KB document uploads, admin config payloads). Scoped to exactly the 3 controllers that serve complaint text and execution artifacts.
- **ObservabilityController exclusion:** SEC-02 structurally satisfied — LlmCall entity has no raw prompt/completion text columns. The trace SELECT in ObservabilityService only reads `id`, `model`, `provider`, `latencyMs`, `responseStatus`. No interceptor needed; adding it would be defensive noise.
- **Frontend masking placement:** Applied in `page.tsx` server component before spreading into child components, rather than in `TicketDetails` component. This ensures ALL child components (TicketHeader, TicketDetails, TicketHistory) receive pre-masked data with no need to modify child components.
- **interceptors/ location:** Created `backend/src/interceptors/` (not `backend/src/common/interceptors/`) — keeps flat structure consistent with NestJS convention; `common/` subdirectory did not exist in this codebase.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `nest` binary not on PATH on VPS (npm scripts use local `./node_modules/.bin/nest`). Required `npm install --legacy-peer-deps` before `npm run build` on fresh deploy. Standard VPS pattern; no structural issue.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 7 plan 04 is the final plan in the project (4/4 in phase 07, 23/23 total plans). The full 7-phase BKO Agent platform is now complete.
- All SEC-01..SEC-05 controls satisfied: CPF/phone masking (SEC-01), prompt log redaction (SEC-02 structural), RBAC 403 enforcement (SEC-03, from 07-02), audit trail queryable per ticket (SEC-04, from 07-03), role segregation verified (SEC-05)
- Platform is ready for production validation on VPS with real Anatel complaint data

---
*Phase: 07-polish-and-compliance*
*Completed: 2026-03-18*
