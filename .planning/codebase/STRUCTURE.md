# Codebase Structure

**Analysis Date:** 2026-05-06

## Directory Layout

```
BKOAgent/
├── docker-compose.yml             # Postgres + pgvector + backend + frontend wiring
├── backend/                        # NestJS 11 API (TypeScript)
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── Dockerfile
│   ├── scripts/                   # ad-hoc DB / seed helpers
│   └── src/
│       ├── main.ts                 # bootstrap, global pipes, /api prefix
│       ├── app.module.ts           # root NestJS module
│       ├── app.controller.ts
│       ├── app.service.ts
│       ├── events.gateway.ts       # Socket.IO realtime gateway
│       ├── database/
│       │   ├── data-source.ts
│       │   ├── pgvector-bootstrap.service.ts
│       │   ├── migrations/         # 14 versioned migration files
│       │   ├── seeds/              # seed runners
│       │   └── factories/          # test data factories
│       ├── interceptors/
│       │   └── sensitive-data.interceptor.ts
│       └── modules/                # 8 domain modules
│           ├── auth/
│           ├── operacao/
│           ├── regulatorio/
│           ├── orquestracao/
│           ├── ia/
│           ├── memoria/
│           ├── base-de-conhecimento/
│           └── execucao/
├── frontend/                       # Next.js 16 App Router (React 19)
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── components.json             # shadcn config
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── Dockerfile
│   ├── public/
│   └── src/
│       ├── middleware.ts           # session-cookie auth gate
│       ├── app/                    # App Router routes
│       ├── components/             # shared components
│       │   ├── nav-bar.tsx
│       │   └── ui/                 # shadcn primitives
│       └── lib/                    # api/session/dal/types/utils helpers
└── .planning/                      # GSD planning + codebase docs (this file)
    ├── PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json
    ├── phases/                     # phase plans, research, summaries
    └── codebase/                   # ARCHITECTURE.md, STRUCTURE.md, ...
```

## Backend Module Anatomy

Every module follows this convention:

```
modules/<domain>/
├── <domain>.module.ts             # @Module() declaration
├── controllers/                   # *.controller.ts — REST endpoints
├── services/                      # *.service.ts — business logic
├── entities/                      # *.entity.ts — TypeORM entities
├── dto/                           # *.dto.ts — class-validator DTOs
└── (optional)
    ├── decorators/                # custom param decorators
    ├── guards/                    # Nest guards
    └── strategies/                # Passport strategies (auth only)
```

### `auth/` — `backend/src/modules/auth/`
- `auth.module.ts:19` — registers `JwtModule.registerAsync`, `PassportModule`, global `APP_GUARD`s
- `auth.controller.ts`, `auth.service.ts`
- `dto/login.dto.ts`
- `decorators/public.decorator.ts`, `decorators/roles.decorator.ts`
- `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts`
- `strategies/jwt.strategy.ts`, `strategies/local.strategy.ts`

### `operacao/` — `backend/src/modules/operacao/`
- Entities: `complaint.entity.ts`, `complaint-detail.entity.ts`, `complaint-history.entity.ts`, `complaint-attachment.entity.ts`, `user.entity.ts`, `discount.entity.ts`, `invoice.entity.ts`
- Services: `complaint.service.ts`, `discount.service.ts`, `invoice.service.ts`
- Controllers: `complaint.controller.ts`, `discount.controller.ts`, `invoice.controller.ts`, `admin-users.controller.ts`
- DTOs: `complaint-filter.dto.ts`, `complaint-list-response.dto.ts`

### `regulatorio/` — `backend/src/modules/regulatorio/`
- Entities: `tipology.entity.ts`, `subtipology.entity.ts`, `situation.entity.ts`, `regulatory-rule.entity.ts`, `regulatory-action.entity.ts`, `persona.entity.ts`, `response-template.entity.ts`, `mandatory-info-rule.entity.ts`, `service-type.entity.ts`
- Services: `admin-config.service.ts`
- Controllers: `tipology.controller.ts`, `admin-config.controller.ts`

### `orquestracao/` — `backend/src/modules/orquestracao/`
- Entities: `capability.entity.ts`, `capability-version.entity.ts`, `step-definition.entity.ts`, `step-transition-rule.entity.ts`, `skill-definition.entity.ts`, `step-skill-binding.entity.ts`, `resource.entity.ts`
- Services: `regulatory-orchestration.service.ts` (SLA calc, capability selection, policy validation), `steps-designer.service.ts`, `resource.service.ts`
- Controllers: `steps-designer.controller.ts`, `resource.controller.ts`
- DTOs: `update-steps.dto.ts`

### `ia/` — `backend/src/modules/ia/`
- No entities (consumes `LlmCall`/`TokenUsage` from `ExecucaoModule` via direct `TypeOrmModule.forFeature` import to avoid circular dep — `ia.module.ts:17`)
- Services: `model-selector.service.ts`, `prompt-builder.service.ts`, `complaint-parsing.agent.ts`, `draft-generator.agent.ts`, `compliance-evaluator.agent.ts`, `final-response-composer.agent.ts`, `token-usage-tracker.service.ts`
- Note: Agents named `*.agent.ts` (not `.service.ts`) by convention to denote LLM-callers

### `memoria/` — `backend/src/modules/memoria/`
- Entities: `kb-document.entity.ts`, `kb-document-version.entity.ts`, `kb-chunk.entity.ts`, `case-memory.entity.ts`, `human-feedback-memory.entity.ts`, `style-memory.entity.ts`
- Services: `memory-retrieval.service.ts`, `memory-feedback.service.ts`
- Controllers: `memory.controller.ts`

### `base-de-conhecimento/` — `backend/src/modules/base-de-conhecimento/`
- Entities: `llm-model-config.entity.ts` (only)
- Services: `document-ingestion.service.ts`, `vector-search.service.ts`, `template-resolver.service.ts`, `mandatory-info-resolver.service.ts`
- Controllers: `kb-manager.controller.ts`

### `execucao/` — `backend/src/modules/execucao/`
- Entities: `ticket-execution.entity.ts`, `step-execution.entity.ts`, `artifact.entity.ts`, `llm-call.entity.ts`, `token-usage.entity.ts`, `human-review.entity.ts`, `audit-log.entity.ts`
- Services: `ticket-execution.service.ts` (607 lines — pipeline driver), `skill-registry.service.ts` (1236 lines — 16-skill switch), `human-review.service.ts` (245 lines — `HumanReviewService` + `HitlPolicyService`), `observability.service.ts`, `execution.service.ts`
- Controllers: `ticket-execution.controller.ts`, `execution.controller.ts`, `human-review.controller.ts`, `observability.controller.ts`
- DTOs: `submit-review.dto.ts`

## Frontend Structure

`frontend/src/app/` (App Router — folder = route segment):

```
app/
├── layout.tsx                          # root layout
├── page.tsx                            # → redirect('/tickets')
├── actions.ts                          # global server actions
├── login/
│   ├── page.tsx
│   └── actions.ts                      # signin server action
├── tickets/
│   ├── page.tsx                        # list (server component, fetchAuthAPI)
│   ├── components/
│   │   ├── ticket-filters.tsx
│   │   └── ticket-table.tsx
│   └── [id]/                           # /tickets/:id
│       ├── page.tsx                    # detail with tabs
│       ├── components/
│       │   ├── ticket-header.tsx
│       │   ├── ticket-details.tsx
│       │   ├── ticket-history.tsx
│       │   ├── ticket-executions.tsx
│       │   └── ticket-artifacts.tsx
│       ├── logs/page.tsx
│       └── execution/[execId]/         # /tickets/:id/execution/:execId
│           ├── page.tsx
│           ├── actions.ts              # advance/finalize server actions
│           ├── components/step-processor.tsx
│           └── review/[stepExecId]/    # HITL editor
│               ├── page.tsx
│               ├── actions.ts          # submit-review server action
│               └── components/hitl-editor.tsx
└── admin/
    ├── layout.tsx
    ├── capabilities/                   # toggle-capability-button + actions
    ├── models/                         # LLM model config CRUD
    ├── observability/                  # cost/conformance/latency charts + trace/[execId]
    ├── personas/                       # persona CRUD
    ├── skills/                         # skill prompt management
    ├── steps/                          # capability step designer; nested [capabilityId]
    └── templates/                      # response template CRUD
```

`frontend/src/components/`
- `nav-bar.tsx` — global navigation
- `ui/` — shadcn primitives: `button.tsx`, `card.tsx`, `chart.tsx`, `checkbox.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `select.tsx`, `separator.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `badge.tsx`

`frontend/src/lib/`
- `api.ts:5` — `fetchAPI` (no auth) and `fetchAuthAPI` (attaches Bearer JWT from session)
- `session.ts` — `jose`-based JWE encrypt/decrypt for cookie session
- `dal.ts` — `verifySession()` server-only data access layer
- `types.ts` — shared TS types (`Complaint`, `Execution`, `Artifact`, etc.)
- `mask.ts` — `maskSensitive()` for defence-in-depth PII redaction
- `utils.ts` — `cn()` tailwind helper

## Naming Conventions

**Files:** `kebab-case.ts` everywhere (backend and frontend). Suffixes encode role:
- `*.module.ts` — NestJS module declaration
- `*.controller.ts` — REST controller
- `*.service.ts` — DI-injectable service
- `*.agent.ts` — LLM-calling service in `ia/services/`
- `*.entity.ts` — TypeORM entity
- `*.dto.ts` — request/response DTO
- `*.guard.ts`, `*.strategy.ts`, `*.decorator.ts` — auth artefacts
- `*.gateway.ts` — Socket.IO gateway
- `*.interceptor.ts` — Nest interceptor
- Frontend: `page.tsx` (route page), `layout.tsx` (route layout), `actions.ts` (server actions), `*.tsx` (React component)

**Classes:** `PascalCase` — `TicketExecutionService`, `Complaint`, `HitlPolicyService`, `JwtAuthGuard`. Entities use the singular noun (`Complaint`, not `Complaints`).

**Methods / functions:** `camelCase` — `startExecution`, `advanceStep`, `shouldRequireHumanReview`, `findSimilarCases`. Async functions return `Promise<T>` with explicit return types.

**Enums:** `PascalCase` type, `SCREAMING_SNAKE_CASE` members with string values matching DB columns — `TicketExecutionStatus.PAUSED_HUMAN = 'paused_human'` (`ticket-execution.entity.ts:15-22`).

**DB tables:** `snake_case` singular — `ticket_execution`, `step_execution`, `human_review`, `case_memory`. JSON column keys remain `camelCase` (matching the entity field).

**Skill keys:** `PascalCase` strings (e.g. `LoadComplaint`, `DraftFinalResponse`) — must match a `case` in `SkillRegistryService.execute()` switch (`skill-registry.service.ts:119`).

**Step keys / artifact types / capability keys:** lower `snake_case` (`final_response`, `compliance_evaluation`, `parsed_complaint`).

## Where to Find Things

| You need… | Look in… |
|---|---|
| A REST route | `backend/src/modules/<domain>/controllers/*.controller.ts` (global prefix `/api`) |
| Business logic | `backend/src/modules/<domain>/services/*.service.ts` |
| A DB model | `backend/src/modules/<domain>/entities/*.entity.ts` |
| A request shape | `backend/src/modules/<domain>/dto/*.dto.ts` |
| A DB schema change | new file under `backend/src/database/migrations/` (timestamp-prefixed) |
| Pipeline orchestration | `backend/src/modules/execucao/services/ticket-execution.service.ts` |
| Skill implementation | switch case in `backend/src/modules/execucao/services/skill-registry.service.ts:119` |
| HITL gating | `backend/src/modules/execucao/services/human-review.service.ts:19` (`HitlPolicyService`) |
| LLM agent | `backend/src/modules/ia/services/*.agent.ts` |
| Vector search / KB | `backend/src/modules/base-de-conhecimento/services/vector-search.service.ts` |
| Memory retrieval | `backend/src/modules/memoria/services/memory-retrieval.service.ts` |
| A frontend page | `frontend/src/app/<route>/page.tsx` |
| A frontend mutation | `frontend/src/app/<route>/actions.ts` (Server Action) |
| A backend HTTP call from FE | use `fetchAuthAPI` from `frontend/src/lib/api.ts:17` |
| Auth gate | `frontend/src/middleware.ts` + `frontend/src/lib/dal.ts` `verifySession()` |
| Shared TS types | `frontend/src/lib/types.ts` |
| Shadcn primitive | `frontend/src/components/ui/` |

## Where to Add New Code

**New backend domain feature**
- Pick the right module under `backend/src/modules/`; if it crosses 2+ domains, prefer extending `ExecucaoModule` since it already imports the others
- New entity → `<module>/entities/<name>.entity.ts` AND register in the module's `TypeOrmModule.forFeature([...])` array AND add to a new migration in `backend/src/database/migrations/`
- New service → `<module>/services/<name>.service.ts`, add to `providers` (and `exports` if used by other modules)
- New endpoint → `<module>/controllers/<name>.controller.ts`, add to `controllers`
- New DTO → `<module>/dto/<name>.dto.ts` with `class-validator` decorators

**New pipeline skill**
- Add `SkillDefinition` row (DB seed or admin UI)
- Add a `case '<SkillKey>':` branch in `SkillRegistryService.execute()` (`skill-registry.service.ts:119`); persist any artifact via `this.artifactRepo.save(...)` with a new `artifactType`
- Bind to a step via `StepSkillBinding`

**New frontend page**
- Create `frontend/src/app/<segment>/page.tsx` (server component by default)
- Mutations → co-located `actions.ts` with `'use server'` directive
- Reusable bits → `<segment>/components/<name>.tsx`
- If global, place under `frontend/src/components/` or `frontend/src/components/ui/`

**New shared type**
- Add to `frontend/src/lib/types.ts`; backend types stay in their entities/DTOs (no shared package — duplication is intentional)

## Special Directories

**`backend/src/database/migrations/`** — Timestamp-prefixed `.ts` files (e.g. `1773774004000-CreateExecucaoTables.ts`). Schema is `synchronize: false` — never edit entities without a corresponding migration. Migrations run on boot via `migrationsRun: true` (`app.module.ts:44`).

**`backend/src/database/seeds/`** and **`factories/`** — Data seeders run via `npm run seed`.

**`backend/scripts/`** — One-off operational scripts (not committed to runtime image).

**`.planning/`** — GSD project planning. `phases/NN-name/` holds per-phase `*-PLAN.md`, `*-RESEARCH.md`, `*-SUMMARY.md`, `*-VERIFICATION.md`, `*-UAT.md`. `codebase/` holds these analysis docs.

**`frontend/public/`** — Static assets served at root.

**`node_modules/`** — Generated, not committed.

---

*Structure analysis: 2026-05-06*
