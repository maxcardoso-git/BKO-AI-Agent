---
phase: 07-polish-and-compliance
plan: 02
subsystem: admin-ui
tags: [nestjs, nextjs, typeorm, personas, react19, useActionState, admin-crud, role-guard]

# Dependency graph
requires:
  - phase: 05-skills-pipeline
    provides: 4 seeded personas (cobranca, cancelamento, portabilidade, qualidade) via persona.seeder.ts
  - phase: 06-human-review-pipeline
    provides: /admin/steps pages pattern to follow, StepsDesignerController (GET /api/admin/capabilities)
  - phase: 04-intelligence-layer
    provides: LlmModelConfig entity and seed data (4 model configs)
  - phase: 03-orchestration-engine
    provides: SkillDefinition, CapabilityVersion entities

provides:
  - AdminConfigController: 12 REST endpoints (GET/POST/PATCH/DELETE) for personas, templates, skills, capability-versions, LLM models — all @Roles(UserRole.ADMIN)
  - AdminConfigService: service with full CRUD methods + StyleMemory sync on persona create/update
  - /admin/personas: server page + client form with create + delete per row
  - /admin/templates: server page + inline edit per template row
  - /admin/skills: server page + toggle active/inactive per skill
  - /admin/capabilities: server page + toggle per capability version
  - /admin/models: server page + inline edit (modelId, temperature, isActive) per LLM config
  - /admin/layout.tsx: shared header nav linking all 6 admin sections
  - GET /api/admin/capability-versions: new endpoint returning CapabilityVersion[] (avoids conflict with StepsDesignerController GET /api/admin/capabilities which returns Capability[])

affects:
  - 07-03-PLAN and beyond: all admin catalog management now available via UI
  - Backend runtime: forwardRef fix enables MemoriaModule -> IaModule -> BaseDeConhecimentoModule circular dep to resolve correctly

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin page pattern: async Server Component fetches list, renders table + imported Client Component for forms
    - useActionState with .bind() for action binding: boundAction.bind(null, id) then wrapping in (_prev, formData) => boundAction(_prev, formData)
    - Non-breaking PATCH endpoints via AdminConfigController with @Roles(UserRole.ADMIN) gate

key-files:
  created:
    - backend/src/modules/regulatorio/controllers/admin-config.controller.ts
    - backend/src/modules/regulatorio/services/admin-config.service.ts
    - frontend/src/app/admin/layout.tsx
    - frontend/src/app/admin/personas/page.tsx
    - frontend/src/app/admin/personas/actions.ts
    - frontend/src/app/admin/personas/create-persona-form.tsx
    - frontend/src/app/admin/personas/delete-persona-button.tsx
    - frontend/src/app/admin/templates/page.tsx
    - frontend/src/app/admin/templates/actions.ts
    - frontend/src/app/admin/templates/edit-template-form.tsx
    - frontend/src/app/admin/skills/page.tsx
    - frontend/src/app/admin/skills/actions.ts
    - frontend/src/app/admin/skills/toggle-skill-button.tsx
    - frontend/src/app/admin/capabilities/page.tsx
    - frontend/src/app/admin/capabilities/actions.ts
    - frontend/src/app/admin/capabilities/toggle-capability-button.tsx
    - frontend/src/app/admin/models/page.tsx
    - frontend/src/app/admin/models/actions.ts
    - frontend/src/app/admin/models/edit-model-form.tsx
    - backend/src/modules/memoria/services/memory-retrieval.service.ts
    - backend/src/modules/memoria/services/memory-feedback.service.ts
  modified:
    - backend/src/modules/regulatorio/regulatorio.module.ts
    - backend/src/modules/ia/ia.module.ts
    - backend/src/modules/memoria/memoria.module.ts
    - backend/src/main.ts

key-decisions:
  - "GET /api/admin/capabilities collision resolved: AdminConfigController uses /api/admin/capability-versions for CapabilityVersion[] list; StepsDesignerController keeps /api/admin/capabilities returning Capability[] for steps designer"
  - "forwardRef on BOTH sides of circular dep: IaModule uses forwardRef(() => BaseDeConhecimentoModule) since MemoriaModule already uses forwardRef(() => IaModule)"
  - "StyleMemory sync in AdminConfigService is supplementary (try/catch non-fatal) — persona create/update succeeds even if style_memory table write fails"
  - "PORT env var support added to main.ts: process.env.PORT ?? 3001 — allows backend to run on non-default port in shared server environments"
  - "Admin capabilities page uses /api/admin/capability-versions (returns CapabilityVersion[]) not /api/admin/capabilities (returns Capability[] with nested versions)"

patterns-established:
  - "Toggle pattern: useTransition + server action for instant toggle (skills, capabilities) without full form"
  - "Bound action pattern: updateX.bind(null, id) then (_prev, formData) => boundAction(_prev, formData) in useActionState wrapper"

# Metrics
duration: 22min
completed: 2026-03-18
---

# Phase 7 Plan 02: Admin Catalog Management UI Summary

**AdminConfigController (12 REST endpoints) + 5 admin page groups (personas/templates/skills/capabilities/models) providing full no-recompile catalog management with role-gated CRUD operations**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-18T03:50:51Z
- **Completed:** 2026-03-18T04:13:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Backend: 12 admin endpoints registered under @Roles(UserRole.ADMIN), operators/supervisors get 403
- Frontend: 5 admin page groups at /admin/personas, /admin/templates, /admin/skills, /admin/capabilities, /admin/models — all build clean
- Runtime verified: 4 Phase-5-seeded personas returned from GET /api/admin/personas; operator token returns 403

## Task Commits

Each task was committed atomically:

1. **Task 1: AdminConfigController + AdminConfigService (backend)** - `0bdb2c8` (feat)
2. **Task 2: Admin UI pages for personas, templates, skills, capabilities, and models** - `6483268` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/src/modules/regulatorio/controllers/admin-config.controller.ts` - 12 REST endpoints @Roles(ADMIN)
- `backend/src/modules/regulatorio/services/admin-config.service.ts` - CRUD + StyleMemory sync
- `backend/src/modules/regulatorio/regulatorio.module.ts` - Added SkillDefinition, CapabilityVersion, LlmModelConfig forFeature + AdminConfig controller/service
- `frontend/src/app/admin/layout.tsx` - Shared header nav for all admin sections
- `frontend/src/app/admin/personas/` - page.tsx + actions.ts + create-persona-form.tsx + delete-persona-button.tsx
- `frontend/src/app/admin/templates/` - page.tsx + actions.ts + edit-template-form.tsx
- `frontend/src/app/admin/skills/` - page.tsx + actions.ts + toggle-skill-button.tsx
- `frontend/src/app/admin/capabilities/` - page.tsx + actions.ts + toggle-capability-button.tsx
- `frontend/src/app/admin/models/` - page.tsx + actions.ts + edit-model-form.tsx
- `backend/src/modules/ia/ia.module.ts` - forwardRef(BaseDeConhecimentoModule) to break circular dep
- `backend/src/main.ts` - PORT env var support

## Decisions Made
- GET /api/admin/capabilities collision: used /api/admin/capability-versions for the new endpoint (CapabilityVersion[]) to avoid conflict with StepsDesignerController (Capability[])
- forwardRef on both sides: added `forwardRef(() => BaseDeConhecimentoModule)` in IaModule to complement MemoriaModule's existing `forwardRef(() => IaModule)`
- StyleMemory sync wrapped in try/catch — supplementary data, persona save must not fail if style_memory write fails

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular dependency: IaModule → BaseDeConhecimentoModule → MemoriaModule → forwardRef(IaModule)**
- **Found during:** Task 1 (backend deploy and startup)
- **Issue:** MemoriaModule was updated in a prior wave to import IaModule (via forwardRef) for MemoryFeedbackService (uses ModelSelectorService). IaModule imported BaseDeConhecimentoModule directly (no forwardRef), causing Nest to report "module at index [1] of IaModule imports is undefined" at runtime.
- **Fix:** Added `forwardRef(() => BaseDeConhecimentoModule)` in IaModule.imports[1] — both sides of the circular dep now use forwardRef.
- **Files modified:** `backend/src/modules/ia/ia.module.ts`
- **Verification:** Backend starts cleanly, all modules initialize without error
- **Committed in:** 6483268 (Task 2 commit)

**2. [Rule 3 - Blocking] Port 3001 occupied by Docker on VPS; main.ts hardcoded**
- **Found during:** Task 2 (runtime verification)
- **Issue:** Port 3001 mapped to rag-layer-frontend Docker container on the VPS. BKO backend `main.ts` hardcoded `await app.listen(3001)` — could not be overridden via PORT env var.
- **Fix:** Changed to `process.env.PORT ? Number(process.env.PORT) : 3001` in main.ts; ran backend on 3111 for verification.
- **Files modified:** `backend/src/main.ts`
- **Verification:** Backend started on PORT=3111, login + personas endpoint confirmed working
- **Committed in:** 6483268 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking)
**Impact on plan:** Both fixes required for correct runtime behavior. No scope creep.

## Issues Encountered
- BKO docker-compose.yml was not on VPS — synced it to start the postgres container and run migrations/seeds before runtime verification
- DB had no data until migrations + seeds ran: `npm run migration:run` and `npm run seed` executed on VPS

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin UI fully operational for all catalog sections (PERS-01..03, CONF-01..07 except CONF-03 which was Phase 6)
- Backend starts cleanly with forwardRef circular dep fix — MemoriaModule Wave 3 services (MemoryRetrievalService, MemoryFeedbackService) are ready for use
- Ready for 07-03 (reporting dashboard or gap closure plan)

---
*Phase: 07-polish-and-compliance*
*Completed: 2026-03-18*
