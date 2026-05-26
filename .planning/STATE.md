# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Cada reclamacao tratada com conformidade regulatoria, artefatos rastreaveis, HITL obrigatorio, sem perder prazo
**Current focus:** Milestone v2 - Operator Workflow — Phase 10: Validation UI, Training Memory & Audit Reports

## Current Position

Phase: 10 — Validation UI, Training Memory & Audit Reports
Plan: 01 of ~4 in phase
Status: In progress — 10-01 complete
Last activity: 2026-05-26 — Completed 10-01-PLAN.md (backend foundation: 3-branch HITL, admin endpoints, migration)

Progress: v1 [██████████] 100% (23/23 plans) | v2 [█████████░] ~93% (13/14 plans est.)

Post-09 work shipped (not tracked as plans):
- d3b8256 feat: pipeline enhancements, invoice/turbina import, smart-note, compliance prompt fixes
- 0b90c90 wip: 09 hotfixes (route-roles, middleware, app-layout) deployed at 72.61.52.70

## Performance Metrics

**Velocity:**
- Total plans completed: 23
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
| 07-polish-compliance | 4/4 DONE | ~30 min | ~7 min |

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
- 07-01: StyleMemory.expressionText (text column) not style.expression (jsonb) — entity schema uses expressionText; plan spec assumed jsonb
- 07-01: forwardRef(() => IaModule) in MemoriaModule breaks circular: MemoriaModule -> IaModule -> BaseDeConhecimentoModule -> MemoriaModule
- 07-01: Memory context injected into DraftGeneratorAgent input map before generate() call — agent reads from input, adds to PromptContext
- 07-02: GET /api/admin/capability-versions (not capabilities) to avoid StepsDesignerController conflict
- 07-02: PORT env var in main.ts; StyleMemory sync is non-fatal try/catch
- 07-03: step_execution column is stepKey not skillKey — plan SQL had wrong column name
- 07-03: token_usage has no estimatedCostUsd or stepExecutionId — cost aggregation uses llm_call.costUsd
- 07-03: audit_log has no ticketExecutionId FK — getTicketLogs uses UNION entityType pattern
- 07-03: recharts --legacy-peer-deps + react-is override for React 19.2.3 compat
- 07-04: SensitiveDataInterceptor at controller class level (not global) — avoids deep recursion on large artifact blobs in non-complaint endpoints
- 07-04: ObservabilityController excluded from SensitiveDataInterceptor — SEC-02 structurally safe (LlmCall has no promptText/completionText columns)
- 08-01: TicketTimingEvent in OperacaoModule (not ExecucaoModule) — avoids Phase 9 circular dep
- 08-01: ticket_timing_event has no updatedAt — append-only immutability mirrors audit_log (decision 01-02)
- 08-01: human_review.status source DDL was VARCHAR (Case A) — no ALTER TYPE needed; entity decorator switched from enum to varchar
- 08-01: migration compilation requires `npx tsc -p tsconfig.build.json --rootDir src --outDir dist` (nest build excludes unreferenced migration files)
- 08-02: Migration uses 4 LIKE patterns with LOWER() cast for case-insensitive step key matching (covers CamelCase + snake_case variants)
- 08-02: RetrieveDiscounts/RetrieveInvoices skill code KEPT in skill-registry.service.ts — PIPE-04 historical audit preservation
- 08-02: ticket_created event uses complaint.createdAt as occurredAt — backfills correct timestamp for existing complaints
- 08-02: Remote DB at 72.61.52.70:5433 used via .env; local Docker postgres exists but is secondary
- 09-01: AccessTokenService registered in both AuthModule and OperacaoModule — each module has its own TypeOrmModule.forFeature([AccessToken])
- 09-01: TicketLockService uses DataSource.transaction() with DELETE+INSERT — never plain save() on unique complaintId
- 09-01: ComplaintUserNoteService emits note_saved outside transaction with try/catch — timing event failure is non-fatal
- 09-01: GET /api/executions/:execId/steps restricted to SUPERVISOR/ADMIN via @Roles — OPERATOR gets 403 from global RolesGuard
- 10-01: MemoryFeedbackService embeds aiText (not humanText) — retrieval is "find corrections of drafts similar to this new AI draft"
- 10-01: Rejection memory weight=0.5 — weaker signal than correction (no replacement text); down-weight for retrieval ranking
- 10-01: Corrected branch resumes auto-advance (same as approved) — "correct and go ahead" semantics
- 10-01: Approved path does NOT persist memory feedback — only corrections/rejections are training signals
- 10-01: Complaint + TicketLock added to ExecucaoModule TypeOrmModule.forFeature for HumanReviewService lock release + responsavelFinal update

### v2 Context

- TypeORM synchronize:false — every schema change needs a migration file (established in 01-01)
- HumanFeedbackMemory entity already exists in MemoriaModule — Phase 10 adds new feedbackType values, does NOT rewrite the entity
- LoadComplaint and DraftFinalResponse skills exist in skill-registry.service.ts — Phase 8 updates them in-place, no rewrites
- complaint_user_note is a new entity — decide module placement in 08-01 (OperacaoModule recommended, FK to Complaint)
- The technical pipeline view at /tickets/[id]/execution/[execId] must NOT be removed — restricted to ADMIN/SUPERVISOR via 403 guard added in Phase 9
- New frontend pages go under /root/EngDB/BKOConsole/src/app/(app)/processar/
- human_review status is VARCHAR at DB layer (TypeScript enum at app layer) — extending enum values is a backend-only change, no ALTER TYPE needed

### Pending Todos

None.

### Blockers/Concerns

None at v2 start.

## Session Continuity

Last session: 2026-05-26
Stopped at: Completed 10-01-PLAN.md (backend foundation)
Resume file: None
