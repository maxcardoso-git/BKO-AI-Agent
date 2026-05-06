# Architecture

**Analysis Date:** 2026-05-06

## Pattern Overview

**Overall:** Monorepo with two deployable apps — a NestJS backend (`backend/`) and a Next.js 16 App-Router frontend (`frontend/`) — sharing a single PostgreSQL database (with `pgvector` extension) for relational state, vector memory, and KB chunks. Architecture is **modular monolith on the backend** (8 domain modules) and **server-component-first** on the frontend (Server Actions for mutations, Server Components for reads).

**Key Characteristics:**
- 16-step regulatory pipeline orchestrated by `TicketExecutionService` (`backend/src/modules/execucao/services/ticket-execution.service.ts:65`)
- Skill-based dispatch via a single `SkillRegistryService.execute(skillKey, ...)` switch (`backend/src/modules/execucao/services/skill-registry.service.ts:112`)
- Auto-advance loop with HITL pause gated by `HitlPolicyService` (`backend/src/modules/execucao/services/human-review.service.ts:19`)
- Versioned `Capability` graph: each tipology binds to a `Capability` whose current `CapabilityVersion` defines ordered `StepDefinition`s; each step binds to a `SkillDefinition` via `StepSkillBinding`
- Append-only audit (`AuditLog`) and per-step `Artifact` rows for full traceability
- pgvector-backed similarity search for KB chunks, case memory, and human feedback memory

## Layers

**Frontend (Next.js App Router)** — `frontend/src/app/`
- Purpose: Operator console for tickets, executions, HITL review, and admin configuration
- Auth: cookie-based sessions decrypted in `frontend/src/middleware.ts:1` and `frontend/src/lib/session.ts`
- All backend calls go through `fetchAuthAPI` in `frontend/src/lib/api.ts:17`, attaching the JWT from session
- Mutations use Next.js Server Actions (`actions.ts` files alongside pages)

**API Layer (NestJS Controllers)** — `backend/src/modules/*/controllers/`
- Global prefix `/api` set in `backend/src/main.ts:11`
- Global JWT + Roles guards registered in `backend/src/modules/auth/auth.module.ts:38`
- Sensitive data masking via `SensitiveDataInterceptor` (`backend/src/interceptors/sensitive-data.interceptor.ts`) applied per-controller
- Validation: global `ValidationPipe` with `transform: true, whitelist: true` (`backend/src/main.ts:12`)

**Service Layer** — `backend/src/modules/*/services/`
- Pure business logic, TypeORM repositories injected via `@InjectRepository`
- Cross-module access by importing the foreign `*.module.ts` and re-using its exported repositories (e.g. `ExecucaoModule` imports `OperacaoModule` to read `Complaint` rows)

**Persistence Layer** — TypeORM entities in `backend/src/modules/*/entities/`
- `synchronize: false` — schema managed by migrations in `backend/src/database/migrations/` (14 migrations as of 2026-05)
- `pgvector` types registered at boot by `PgvectorBootstrapService` (`backend/src/database/pgvector-bootstrap.service.ts`)
- Vector inserts use raw `dataSource.query` with `pgvector.toSql()` because TypeORM cannot type-cast `vector` columns (see `skill-registry.service.ts:1009`)

**Realtime Layer** — `backend/src/events.gateway.ts:21`
- Single Socket.IO gateway exposing `execution:update` and `ticket:update` events
- CORS allow-list hard-coded for dev hosts and `72.61.52.70:3205/3210`

## Backend Modules

Loaded by `backend/src/app.module.ts:50-56` in this order. Dependencies use `forwardRef` only where circular (IaModule ↔ MemoriaModule).

| Module | Path | Owns | Depends On |
|---|---|---|---|
| `AuthModule` | `backend/src/modules/auth/` | JWT login, Passport strategies, global guards, `User` access | `OperacaoModule` (User entity via `TypeOrmModule.forFeature`) |
| `OperacaoModule` | `backend/src/modules/operacao/` | `Complaint`, `ComplaintDetail/History/Attachment`, `User`, `Discount`, `Invoice` | none |
| `RegulatorioModule` | `backend/src/modules/regulatorio/` | `Tipology`, `Subtipology`, `Situation`, `RegulatoryRule/Action`, `Persona`, `ResponseTemplate`, `MandatoryInfoRule`, `ServiceType` | none |
| `OrquestracaoModule` | `backend/src/modules/orquestracao/` | `Capability`, `CapabilityVersion`, `StepDefinition`, `StepTransitionRule`, `SkillDefinition`, `StepSkillBinding`, `Resource`; `RegulatoryOrchestrationService`, `StepsDesignerService`, `ResourceService` | `RegulatorioModule` |
| `IaModule` | `backend/src/modules/ia/` | `ModelSelectorService`, `PromptBuilderService`, 4 LLM agents, `TokenUsageTrackerService` | `BaseDeConhecimentoModule` (forwardRef), `RegulatorioModule` |
| `MemoriaModule` | `backend/src/modules/memoria/` | `KbDocument/Version/Chunk`, `CaseMemory`, `HumanFeedbackMemory`, `StyleMemory`; `MemoryRetrievalService`, `MemoryFeedbackService` | `IaModule` (forwardRef) |
| `BaseDeConhecimentoModule` | `backend/src/modules/base-de-conhecimento/` | `LlmModelConfig`; `DocumentIngestionService`, `VectorSearchService`, `TemplateResolverService`, `MandatoryInfoResolverService` | `MemoriaModule`, `RegulatorioModule` |
| `ExecucaoModule` | `backend/src/modules/execucao/` | `TicketExecution`, `StepExecution`, `Artifact`, `LlmCall`, `TokenUsage`, `HumanReview`, `AuditLog`; `TicketExecutionService`, `SkillRegistryService`, `HumanReviewService`, `HitlPolicyService`, `ObservabilityService` | `OrquestracaoModule`, `OperacaoModule`, `IaModule`, `MemoriaModule`, `BaseDeConhecimentoModule`, `RegulatorioModule` |

`ExecucaoModule` is the integration hub — see `backend/src/modules/execucao/execucao.module.ts:27-43`.

## Domain Model

**Operational core**
```
Complaint (1) ── (N) TicketExecution (1) ── (N) StepExecution (1) ── (N) Artifact
                                                              └── (N) LlmCall ── (1) TokenUsage
                                                              └── (N) HumanReview
```
- `Complaint` (`backend/src/modules/operacao/entities/complaint.entity.ts:35`) — protocol, raw/normalized text, `status` (PENDING/IN_PROGRESS/WAITING_HUMAN/COMPLETED/CANCELLED), `riskLevel`, SLA fields, FK to `Tipology`/`Situation`/`Subtipology`
- `TicketExecution` (`backend/src/modules/execucao/entities/ticket-execution.entity.ts:24`) — `status` enum (PENDING/RUNNING/PAUSED_HUMAN/COMPLETED/FAILED/CANCELLED), `currentStepKey`, `metadata` jsonb (carries `stepOutputs`, `selectedActionKey`, SLA snapshot)
- `StepExecution` (`backend/src/modules/execucao/entities/step-execution.entity.ts:25`) — `stepKey`, `status` (incl. WAITING_HUMAN), `input`/`output` jsonb, `durationMs`, FK to `StepDefinition`
- `Artifact` (`backend/src/modules/execucao/entities/artifact.entity.ts:13`) — typed payload (`artifactType` string like `parsed_complaint`, `final_response`, `compliance_evaluation`), `content` jsonb, FK to both `StepExecution` and `Complaint`
- `HumanReview` (`backend/src/modules/execucao/entities/human-review.entity.ts:21`) — `aiGeneratedText`, `humanFinalText`, `diffSummary`, `correctionReason`, `checklistItems`, status enum

**Orchestration plan**
```
Capability ── (N) CapabilityVersion ── (N) StepDefinition ── (1) StepSkillBinding ── (1) SkillDefinition
                                                          └── (N) StepTransitionRule
```
- `Capability` is keyed by `tipologyId` (nullable for generic fallback)
- `CapabilityVersion` (`backend/src/modules/orquestracao/entities/capability-version.entity.ts:14`) — `version` int, `isActive`, `isCurrent` (only one current per capability)
- `StepDefinition` (`backend/src/modules/orquestracao/entities/step-definition.entity.ts:13`) — `key`, `stepOrder`, `isHumanRequired`, `timeoutSeconds`
- `SkillDefinition` — `key` matches a case in `SkillRegistryService.execute()` switch (`skill-registry.service.ts:119`); has optional `systemPrompt` for runtime override

**Memory tier** (vector-backed, all embed via `ModelSelectorService.getEmbeddingModel()`)
- `CaseMemory` (`backend/src/modules/memoria/entities/case-memory.entity.ts`) — past resolved cases, queried for similarity by `MemoryRetrievalService.findSimilarCases()`
- `HumanFeedbackMemory` — diffs between AI draft and human final, queried by `findSimilarCorrections()`
- `StyleMemory` — approved/forbidden expressions per tipology, queried by `findStylePatterns()`
- `KbChunk` (`backend/src/modules/memoria/entities/kb-chunk.entity.ts`) — Anatel manual chunks, queried by `VectorSearchService.search()`

## Pipeline Orchestration

The 16 step skills are resolved at runtime via `SkillRegistryService.execute()` switch starting at `backend/src/modules/execucao/services/skill-registry.service.ts:119`:

| Wave | Skill keys |
|---|---|
| Wave 1 — Data & Regulatory | `LoadComplaint`, `NormalizeComplaintText`, `ComputeSla`, `DetermineRegulatoryAction`, `ValidateReclassification`, `ValidateReencaminhamento`, `ValidateCancelamento`, `AnalyzeCustomerSentiment`, `RetrieveDiscounts`, `RetrieveInvoices` |
| Wave 2 — KB & Generation | `ClassifyTypology`, `RetrieveManualContext`, `RetrieveIQITemplate`, `BuildMandatoryChecklist`, `DraftFinalResponse`, `ComplianceCheck`, `GenerateArtifact`, `ApplyPersonaTone` |
| Wave 3 — Quality & Memory | `HumanDiffCapture`, `PersistMemory`, `TrackTokenUsage`, `AuditTrail` |

**Start flow** (`TicketExecutionService.startExecution`, `ticket-execution.service.ts:65`):
1. Load complaint with `tipology`/`situation` relations
2. Concurrent-execution guard (409 if active execution exists)
3. `RegulatoryOrchestrationService.selectCapabilityVersion(tipologyId)` — falls back to generic capability (`tipologyId IS NULL`) if no tipology-specific one
4. Load `StepDefinition[]` for that version, sorted by `stepOrder ASC`
5. Compute SLA (`computeSla`, `regulatory-orchestration.service.ts:39`) — uses `situation.slaOverrideDays ?? tipology.slaBusinessDays`, business days only
6. Persist execution with `currentStepKey = steps[0].key`, then fire-and-forget `autoAdvanceLoop` via `setImmediate` (`ticket-execution.service.ts:153`)

**Advance flow** (`advanceStep`, `ticket-execution.service.ts:197`):
1. Load execution + complaint + steps
2. `validatePolicyRules(complaint, 'advance')` — throws 422 with violations on failure
3. **HITL gate** — `HitlPolicyService.shouldRequireHumanReview(currentStep.isHumanRequired, complaint.riskLevel)` returns true if step explicitly requires human OR riskLevel is `high`/`critical` (`human-review.service.ts:24`). If true and no `operatorInput`: run skill (to produce AI draft), persist `final_response` artifact, set status = `PAUSED_HUMAN`, return early
4. Resolve `StepSkillBinding` for the step → call `executeSkill(skillKey, ...)` → wrap in `StepExecution` row with input/output/duration
5. Accumulate output into `execution.metadata.stepOutputs[stepKey]`; capture `selectedActionKey` if skill is `DetermineRegulatoryAction`
6. Find next step by index in sorted array → set `currentStepKey` or mark COMPLETED if last
7. Write append-only `AuditLog` row

**Auto-advance loop** (`autoAdvanceLoop`, `ticket-execution.service.ts:162`) iterates up to 30 times, calling `advanceStep` until a step requires human review or the execution leaves RUNNING.

**HITL resume** — frontend posts to `POST /api/executions/:execId/steps/:stepExecId/review` (`human-review.controller.ts:34`). `HumanReviewService.createReview` computes the word-level diff with the `diff` package, persists `HumanReview`, updates ART-11 (`human_diff`), and triggers `MemoryFeedbackService` to learn from the correction. The execution then resumes via a follow-up advance call.

## Frontend Routing

Next.js 16 App Router (`frontend/src/app/`):
- `/` → redirects to `/tickets` (`frontend/src/app/page.tsx:4`)
- `/login` — public, server action in `frontend/src/app/login/actions.ts`
- `/tickets` — list view, server-component fetches `/api/complaints` + `/api/tipologies` (`frontend/src/app/tickets/page.tsx:19`)
- `/tickets/[id]` — ticket detail with tabs: details, history, executions, artifacts (`frontend/src/app/tickets/[id]/page.tsx:16`)
- `/tickets/[id]/execution/[execId]` — live execution view, renders `<StepProcessor>` (`frontend/src/app/tickets/[id]/execution/[execId]/page.tsx:11`)
- `/tickets/[id]/execution/[execId]/review/[stepExecId]` — HITL editor (`frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/components/hitl-editor.tsx`)
- `/tickets/[id]/logs` — full audit/step log
- `/admin/*` — capabilities, models, observability, personas, steps, templates, skills (each with its own `actions.ts` for mutations)
- `middleware.ts` enforces auth on `/tickets/:path*`; unauthenticated requests redirect to `/login` (`frontend/src/middleware.ts:14`)

## Cross-Cutting Concerns

**Authentication** — JWT in cookie; backend validates with Passport `JwtStrategy` (`backend/src/modules/auth/strategies/jwt.strategy.ts`); guards registered globally via `APP_GUARD` (`auth.module.ts:38-46`). `@Public()` decorator opts routes out.

**Authorization** — Role-based via `RolesGuard` + `@Roles()` decorator (`backend/src/modules/auth/guards/roles.guard.ts`).

**Validation** — `class-validator` DTOs in `dto/` folders. Global `ValidationPipe` with `transform`/`whitelist`.

**Sensitive-data redaction** — `SensitiveDataInterceptor` applied at controller level (e.g. `complaint.controller.ts:17`); frontend applies `maskSensitive` defence-in-depth (`frontend/src/lib/mask.ts`, used in `tickets/[id]/page.tsx:38`).

**Error handling** — Services throw `HttpException` with explicit status (404/409/422). Auto-advance loop swallows errors silently to avoid wedging executions (`ticket-execution.service.ts:185`).

**Logging** — `@nestjs/common` `Logger` in services (e.g. `skill-registry.service.ts:49`). No external aggregator configured.

**Token & cost tracking** — Every LLM call routed through `ModelSelectorService.callWithFallback`; usage persisted via `TokenUsageTrackerService.track()` (writes `LlmCall` and aggregates into `TokenUsage`).

**Configuration** — `ConfigModule` with Joi schema (`backend/src/app.module.ts:21-32`) requires `DB_*`, `JWT_SECRET`; optional `OPENAI_API_KEY`, `EMBEDDING_DIMENSIONS` (default 1536).

---

*Architecture analysis: 2026-05-06*
