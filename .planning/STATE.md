# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Cada reclamacao tratada com conformidade regulatoria, artefatos rastreaveis, HITL obrigatorio, sem perder prazo
**Current focus:** MILESTONE COMPLETE — all 7 phases done

## Current Position

Phase: 7 of 7 (Polish & Compliance) — COMPLETE
Plan: 4 of 4 in phase 07 — 07-04 DONE (SensitiveDataInterceptor + CPF/phone masking + frontend mask.ts)
Status: ALL PHASES COMPLETE — 23/23 plans done
Last activity: 2026-03-18 — Completed 07-04-PLAN.md (NestJS interceptor SEC-01..SEC-05, controller-scoped CPF/phone redaction, frontend maskSensitive in ticket page)

Progress: [██████████] 100% (23/23 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: ~8 min
- Total execution time: ~2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 DONE | 29 min | 9.7 min |
| 02-access-layer | 4/4 DONE | ~61 min | ~15 min |
| 03-orchestration-engine | 3/3 DONE | ~18 min | ~6 min |
| 04-intelligence-layer | 4/4 DONE | ~32 min | ~8 min |
| 05-skills-pipeline | 3/3 DONE | ~7 min | ~2 min |
| 06-human-review-pipeline | 4/4 DONE | ~65 min | ~16 min |

**Recent Trend:**
- Last 5 plans: 2 min, 4 min, 18 min, 2 min, 4 min
- Trend: Skill implementation plans are fast (~2-4 min) — single file edits, no npm installs needed.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Arquitetura completa (nao MVP) — provar viabilidade da plataforma inteira na PoC
- Init: NestJS + Next.js + PostgreSQL + pgvector — stack conforme documento de arquitetura
- Init: LLM provider-agnostic com pagina de cadastro por funcionalidade
- 01-01: TypeORM synchronize:false from day one — auto-sync drops vector columns
- 01-01: Docker postgres on port 5433 (local postgres conflict on 5432)
- 01-01: pgvector type registration via PgvectorBootstrapService pool hook (pgvector 0.2.x API)
- 01-01: Migration class names must include JS timestamp suffix (TypeORM 0.3.x requirement)
- 01-01: Extensions enabled in both init.sql (first container) and migration (all DBs)
- 01-02: FK constraints complaint->regulatorio added via ALTER TABLE in migration 002 (dependency order)
- 01-02: Status columns as VARCHAR in SQL, TypeScript enums at app layer (avoids ALTER TYPE migrations)
- 01-02: audit_log has no updatedAt — append-only immutability enforced at schema level
- 01-02: token_usage as separate OneToOne entity with DECIMAL(10,6) for precision cost tracking
- 01-02: pgvector(1536) on exactly 3 entities: kb_chunk, case_memory, human_feedback_memory
- 01-03: data-source.ts seeds glob must point to main.seeder.js specifically — *.js causes run.js to be treated as seeder class
- 01-03: TypeORM 0.3.x rejects repo.delete({}) with empty criteria — use dataSource.query('DELETE FROM table') for full truncation
- 01-03: typeorm-extension Seeder.run() requires (dataSource, factoryManager) signature even if factoryManager unused
- 01-03: Complaint mock seeder uses count-based idempotency (skip if >= 20) since protocol numbers are runtime-generated
- 02-01: APP_GUARD pattern for global guards — all endpoints auto-protected, @Public() to opt out
- 02-01: JwtStrategy fetches full User from DB on each request — ensures live isActive check (not stale from token)
- 02-01: UserSeeder runs first in MainSeeder sequence for FK readiness in future plans
- 02-02: Global ValidationPipe with transform:true in main.ts — enables @Type(() => Number) coercion on query params
- 02-02: isOverdue query param accepted as string 'true'/'false', parsed to boolean in service (HTTP query params are always strings)
- 02-02: sortBy guarded with allowedSortFields whitelist before interpolation into QueryBuilder.orderBy() — SQL injection prevention
- 02-02: Artifact.complaintId direct FK — artifact queries by complaint don't need join chain through stepExecution
- 02-03: jose used for session encryption (HS256) — works on both Edge (middleware) and Node.js (server components)
- 02-03: Session cookie stores encrypted backend JWT — browser never sees raw access_token
- 02-03: cookies() is async in Next.js 15+ — all session/DAL code must use await cookies()
- 02-03: redirect() throws NEXT_REDIRECT internally — must be called outside try/catch in server actions
- 02-03: useActionState from 'react' (React 19), not from 'react-dom' — useFormState is deprecated
- 02-03: Filter state in URL searchParams, not useState — server-rendered, shareable, no hydration mismatches
- 02-04: Next.js 16.x flipped middleware/proxy convention — middleware.ts emits deprecation warning but IS registered in middleware-manifest.json
- 02-04: Edge middleware must use request.cookies.get() not next/headers cookies() — cookies() is Node.js only
- 02-04: TipologyController auto-protected by global JwtAuthGuard (APP_GUARD) — no @Public() needed
- 03-01: One-way dependency chain enforced: ExecucaoModule -> OrquestracaoModule -> RegulatorioModule (no circular imports)
- 03-01: computeSla is synchronous — pure computation on already-loaded entities, no DB calls needed
- 03-01: validatePolicyRules uses conservative strategy — unknown BLOCKING rule types add violations (fail-safe not fail-open)
- 03-01: Phase 3 stub for requires_complete_checklist — always passes, deferred to Phase 4
- 03-02: ExecutionContext interface requires [key: string]: unknown index signature for TypeORM DeepPartial<Record<string,unknown>> assignment
- 03-02: advanceStep locates next step by array index not stepOrder arithmetic — robust to non-sequential stepOrder values
- 03-02: retryStep updates existing StepExecution row (increment retryCount), does NOT create new row
- 03-02: executeSkillStub is synchronous — all stubs are pure computation, no async needed
- 03-03: TicketExecutionController uses @Controller() (empty) not @Controller('api') — global setGlobalPrefix('api') already prefixes all routes
- 03-03: scripts/ excluded from tsconfig — verify-e2e.ts references future-phase entities not yet created
- 04-01: pdf-parse must be dynamically imported (import()) — CJS module in NestJS ESM context
- 04-01: pgvector insert via raw DataSource.query() with pgvector.toSql() + $N::vector cast — TypeORM QueryBuilder cannot handle vector columns
- 04-01: VectorSearchService filters by active document version IDs before cosine query — avoids stale chunk matches
- 04-01: cosine distance ORDER BY ASC (lower = more similar); similarity output = 1 - distance
- 04-01: OPENAI_API_KEY added as Joi.string().optional() in AppModule validation schema
- 04-01: Seeders live in seeds/ not seeders/ — established in phase 01-03
- 04-02: callWithFallback generic pattern: single method wraps primary+fallback, callFn receives ModelWithConfig
- 04-02: classify()/generate() shaped as Record<string,unknown> for TicketExecutionService skill dispatch interface
- 04-02: IaModule not added to AppModule directly — transitively loaded via ExecucaoModule in 04-03
- 04-02: PromptBuilderService has 3 builders: classification (generateObject/Zod), draft (generateText), compliance (generateObject in 04-04)
- 04-03: stepExec saved before skill dispatch — llm_call.stepExecutionId FK is non-nullable; must exist before tokenUsageTracker.track() is called
- 04-03: IaModule imports TypeOrmModule.forFeature([LlmCall, TokenUsage]) directly — avoids circular dep with ExecucaoModule
- 04-03: FinalResponseComposerAgent returns model:'none' when no violations — token tracker skips on sentinel
- 04-03: No @Roles on KbManagerController — global JwtAuthGuard protects; role enforcement deferred to Phase 7
- 04-03: executeSkill try/catch returns error-as-data — pipeline records failure without crashing
- 05-01: SkillRegistryService is single owner of all skill logic — TicketExecutionService delegates entirely, no skill implementations remain in ticket-execution.service.ts
- 05-01: complaintId passed as explicit 4th parameter to SkillRegistryService.execute() — never derived from input metadata to avoid stale-data artifact FKs
- 05-01: MemoriaModule imported into ExecucaoModule to enable CaseMemory + HumanFeedbackMemory repos in SkillRegistryService constructor (Wave 3 readiness)
- 05-01: DetermineRegulatoryAction uses 'classificacao' functionalityType (light model) + generateObject with Zod schema for cost-efficient structured regulatory action classification
- 05-02: applyPersonaTone is rule-based (no LLM) — forbiddenExpressions stripped via regex, requiredExpressions conditionally appended; graceful no-op returns personaApplied:false when no tipologyId or no active persona found
- 05-03: HumanDiffCapture is Phase 5 scaffold — stores aiDraft from input, humanFinal:null; real diff computed in Phase 6 HITL when operator approves
- 05-03: PersistMemory uses raw INSERT with pgvector.toSql() — caseMemoryRepo.create() used only to build object fields, actual insert bypasses TypeORM ORM layer for vector column
- 05-03: TrackTokenUsage aggregates via JOIN step_execution ON ticketExecutionId — does NOT call tokenUsageTracker.track() since per-call tracking already happened in each AI skill
- 05-03: embed() from 'ai' SDK chosen for PersistMemory — consistent with VectorSearchService pattern, uses ModelSelectorService.getEmbeddingModel() for centralized model config
- 06-01: HitlPolicyService in same file as HumanReviewService — avoids circular dep; both exported from human-review.service.ts
- 06-01: skillKey/llmModel NOT added to StepDefinition entity (no migration) — handled via StepSkillBinding upsert in updateSteps() transaction
- 06-01: TransitionRuleDto uses actual entity fields (conditionType/conditionExpression/targetStepKey) not plan-spec fields (condition/targetStepOrder)
- 06-01: pdf-parse pinned to 1.1.1 — v2.4.5 has incompatible class-based API; document-ingestion.service uses pdfMod.default ?? pdfMod fallback
- 06-01: tsconfig.build.json must exclude scripts/ — NestJS nest build uses tsconfig.build.json, not tsconfig.json
- 06-01: AI SDK v6 renamed maxTokens to maxOutputTokens in generateObject/generateText (affects 5 service files)
- 06-01: EmbeddingModel<string> in ai SDK v6 is non-generic — use EmbeddingModel without type parameter
- 06-02: ActionState = { error?: string; success?: boolean } — React 19 useActionState requires state generic S to match _prev parameter and be assignable from {} initial state; discriminated unions break with .bind() pattern
- 06-02: Server action type exported from actions.ts and imported by client component — single source of truth for useActionState generic parameter
- 06-02: currentArtifact filters artifacts by currentStepExec.id first, falls back to artifacts.at(-1) — STEP-02 compliant artifact display
- 06-03: useActionState inline wrapper (_prev, formData) => serverAction(bound, args, _prev, formData) — avoids TypeScript .bind() overload errors in React 19
- 06-03: getTransitions server action for client lazy-load — BACKEND_URL is server-only; client components cannot fetch backend directly without proxy
- 06-03: react-diff-viewer-continued dynamic import with { ssr: false } — CJS module causes SSR build error if statically imported

### Pending Todos

None.

### Blockers/Concerns

- **pgvector 0.2.x API change:** The `pgvector/typeorm` subpath no longer exists. Use `pgvector/pg` with pool hook. Pattern established in `PgvectorBootstrapService`.
- **Local postgres on 5432:** Docker postgres mapped to 5433. `.env.example` documents this. All future plans should use port 5433 for local dev.
- **Phase 1 complete:** All 3 foundation plans done. Database has 32 tables, seed data, 20 mock complaints. Ready for Phase 2 backend API work.
- **Auth operational (02-01 done):** JWT guard global, RBAC via @Roles, 3 test users seeded (operator/supervisor/admin). All subsequent endpoints auto-protected.
- **Complaint API operational (02-02 done):** GET /api/complaints (paginated, 7 filters), GET /api/complaints/:id (full relations), /executions, /artifacts, /logs sub-resources all live. Frontend can integrate immediately.
- **Phase 2 complete (02-03 done):** Next.js frontend with login, session management (jose HS256 cookie), complaint queue with URL-driven filters, ticket detail with all sections. AUTH-01..03 and TICK-01,02,04,05,06 satisfied. Ready for Phase 3 processing pipeline.
- **Phase 2 gap closure complete (02-04 done):** Edge middleware registered, GET /api/tipologies endpoint live, tipologia filter end-to-end in /tickets. All 3 verified gaps closed.
- **Phase 3 COMPLETE (verified 5/5):** RegulatoryOrchestrationService + TicketExecutionService (step engine, 19 skill stubs) + TicketExecutionController (4 BFF endpoints). Module chain ExecucaoModule->OrquestracaoModule->RegulatorioModule fully wired. Ready for Phase 4 Intelligence Layer.
- **04-01 done:** BaseDeConhecimentoModule live with DocumentIngestionService (PDF RAG ingestion), VectorSearchService (pgvector cosine), TemplateResolverService (3-tier IQI), MandatoryInfoResolverService (dedup). LlmModelConfig entity + migration + 4 model configs seeded. Ready for 04-02 AI classification.
- **04-02 done:** IaModule live with ModelSelectorService (DB-driven multi-model routing + callWithFallback), PromptBuilderService (3 context-rich prompt builders), ComplaintParsingAgent (generateObject + Zod), DraftGeneratorAgent (generateText). Ready for 04-03 real skill dispatch.
- **04-03 done:** ComplianceEvaluatorAgent + FinalResponseComposerAgent + TokenUsageTrackerService live. KbManagerController (POST /api/kb/upload, GET /api/kb/documents). TicketExecutionService.executeSkillStub replaced by async executeSkill routing 6 skills to real AI agents + token tracking. ExecucaoModule->IaModule wired, no circular deps. Ready for 04-04 (phase completion).
- **Phase 4 COMPLETE (04-04 done):** All intelligence layer services verified. 6 real AI skills dispatched from TicketExecutionService. Full complaint AI processing pipeline operational.
- **Phase 5 COMPLETE:** All 3 plans done. All 19 skills (SKLL-01..SKLL-19) have real implementations — zero stubs remain. Full pipeline from LoadComplaint through AuditTrail is operational. Complaint processed end-to-end: 11 artifact types (ART-01..ART-11) produced, CaseMemory with pgvector embeddings persisted, token usage aggregated, append-only audit log created.
- **SKLL-20 (execution record):** Satisfied by StepExecution row persistence in TicketExecutionService.advanceStep() — no separate skill needed.
- **HumanDiffCapture scaffold ready for Phase 6:** human_diff artifact created with `humanFinal: null`; Phase 6 HITL will populate humanFinal when operator approves/edits the AI draft.
- **06-01 COMPLETE:** HumanReviewController (POST/GET /api/executions/:execId/steps/:stepExecId/review), HitlPolicyService (risk-aware HITL gate), StepsDesignerController (5 admin endpoints). VPS build passes clean. Plans 06-02 and 06-03 can be built against this stable backend API.
- **06-02 COMPLETE:** StepProcessor 4-column page at /tickets/[id]/execution/[execId]. advanceStep/retryStep/startExecution server actions with typed ActionState. HITL editor link appears when paused_human. VPS build clean with zero TS errors. Pre-placed 06-03 files (hitl-editor, steps-designer) also build clean after installing react-diff-viewer-continued and shadcn tabs/textarea/checkbox.
- **PHASE 6 COMPLETE (06-03 done):** HITL editor at /tickets/:id/execution/:execId/review/:stepExecId with 4-tab layout (AI text/Edit/Diff/Checklist). submitHumanReview POSTs review + advances with operatorInput. Admin steps designer at /admin/steps and /admin/steps/:capabilityId with skillKey/llmModel inputs, isHumanRequired toggle, step reorder, per-step TransitionsEditor (lazy-loaded via server action). VPS build passes clean. Ready for Phase 7 (Reporting Dashboard).
- **06-04 gap closure done:** Frontend TransitionsEditor now correctly maps backend conditionType/conditionExpression/targetStepKey ↔ UI model. getTransitions reads backend fields; saveTransitions serializes to backend DTO shape. TransitionsEditor uses step-key dropdown instead of order number input. VPS tsc and npm run build clean.
- **07-01:** StyleMemory.expressionText (text column) not style.expression (jsonb) — entity schema uses expressionText; plan spec assumed jsonb
- **07-01:** forwardRef(() => IaModule) in MemoriaModule breaks circular: MemoriaModule -> IaModule -> BaseDeConhecimentoModule -> MemoriaModule
- **07-01:** Memory context injected into DraftGeneratorAgent input map before generate() call — agent reads from input, adds to PromptContext
- **07-01 DONE:** MemoryRetrievalService (findSimilarCases, findSimilarCorrections, findStylePatterns) + MemoryFeedbackService (persistFeedback with pgvector.toSql) wired. PromptContext extended with memory fields. DraftFinalResponse skill retrieves memory context before generating draft. HumanReviewService persists feedback after review save. VPS build clean. Note: StyleMemory uses expressionText (text) not style.expression (jsonb) — adapted.
- **07-02 COMPLETE:** AdminConfigController (12 endpoints @Roles(ADMIN)), AdminConfigService (CRUD + StyleMemory sync), 5 admin page groups (/admin/personas, /admin/templates, /admin/skills, /admin/capabilities, /admin/models). forwardRef fix: IaModule uses forwardRef(() => BaseDeConhecimentoModule) to break IaModule->BDCM->MemoriaModule->forwardRef(IaModule) circle. 4 seeded personas confirmed. Frontend builds clean. 403 on non-admin confirmed.
- **07-02 key decisions:** GET /api/admin/capability-versions (not capabilities) to avoid StepsDesignerController conflict; PORT env var in main.ts; StyleMemory sync is non-fatal try/catch.
- **07-04:** SensitiveDataInterceptor at controller class level (not global) — avoids deep recursion on large artifact blobs in non-complaint endpoints
- **07-04:** ObservabilityController excluded from SensitiveDataInterceptor — SEC-02 structurally safe (LlmCall has no promptText/completionText columns)
- **07-04:** Frontend maskSensitive applied in page.tsx before spreading to child components — all children receive pre-masked data
- **07-03:** step_execution column is stepKey not skillKey — plan SQL had wrong column name
- **07-03:** token_usage has no estimatedCostUsd or stepExecutionId — cost aggregation uses llm_call.costUsd
- **07-03:** audit_log has no ticketExecutionId FK — getTicketLogs uses UNION entityType pattern
- **07-03:** recharts --legacy-peer-deps + react-is override for React 19.2.3 compat
- **07-03 DONE:** ObservabilityService (8 raw-SQL methods) + ObservabilityController (8 routes @Roles(ADMIN)) + recharts + shadcn chart + /admin/observability dashboard (6 panels) + trace explorer + ticket logs. VPS build clean. SEC-02 confirmed: ObservabilityController does NOT need SensitiveDataInterceptor.
- **07-04 DONE (PHASE 7 COMPLETE):** SensitiveDataInterceptor (backend/src/interceptors/) with recursive CPF/phone redaction applied to ExecutionController, HumanReviewController, ComplaintController. frontend/src/lib/mask.ts (maskCpf, maskPhone, maskSensitive). Ticket detail page applies maskSensitive to rawText + normalizedText. Both backend and frontend build clean on VPS. SEC-01..SEC-05 all satisfied. Project COMPLETE — 23/23 plans done.

## Session Continuity

Last session: 2026-03-18
Stopped at: Completed 07-04-PLAN.md — SensitiveDataInterceptor + frontend mask.ts — PROJECT COMPLETE (23/23 plans)
Resume file: None
