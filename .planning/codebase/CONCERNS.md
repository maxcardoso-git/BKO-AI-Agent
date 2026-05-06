# Codebase Concerns

**Analysis Date:** 2026-05-06

## Tech Debt

**Schema Migration System Disabled (CRITICAL):**
- Issue: TypeORM `synchronize: false` in `backend/src/database/data-source.ts:17` but no migration runner is invoked at deploy time. Recent deploys required manual `CREATE TABLE` statements on the server for `discount` and `invoice` tables.
- Files: `backend/src/database/data-source.ts`, `backend/src/database/migrations/` (14 migration files exist but are not auto-applied)
- Impact: Schema drift between environments; production schema is hand-edited; rollback is impossible; new entity fields silently fail at runtime when columns are missing.
- Fix approach: Wire `npm run migration:run` into deployment pipeline; add a startup health check that fails fast if pending migrations exist; document the workflow for adding new entity fields (entity → generate migration → run on deploy).

**Dual Frontend Codebases:**
- Issue: Two frontends coexist with different API contracts. `/opt/bko-agent/frontend` (basic, in this repo at `frontend/`) and `/root/EngDB/BKOConsole` (full UI, used in production) — only the second is actually used, but both are maintained.
- Files: `frontend/` (this repo), `BKOConsole` (separate repo on server)
- Impact: API contract drift; backend endpoints need to satisfy both consumers; recent deploy required emergency endpoint additions (`/api/admin/resources`, `/api/admin/users`, `/api/admin/webhooks`, `/api/memory/cases|feedback|style`, `/api/admin/capability-versions/:id`, `/api/executions/:id/steps`, `/api/complaints/:id/executions/start` alias) because they were missing on backend but expected by bko-console.
- Fix approach: Decide canonical frontend; archive or delete the other; consolidate into a monorepo or document the split clearly with API contract tests.

**Missing Test Coverage:**
- Issue: Only one test file exists in the backend source tree (`backend/src/app.controller.spec.ts`) — no unit, integration, or end-to-end coverage for orchestration, skills, HITL, interceptors, or controllers.
- Files: `backend/src/app.controller.spec.ts` (only test); rest of `backend/src/` untested
- Impact: Regressions like the `SensitiveDataInterceptor` Date-serialization bug and the `HitlPolicyService` over-triggering bug shipped to production undetected.
- Fix approach: Prioritize tests around `SkillRegistryService.execute()`, `TicketExecutionService.advanceStep()` / `autoAdvanceLoop()`, `HitlPolicyService.shouldRequireHumanReview()`, and serialization interceptors before any further skill additions.

## Risks

**OpenAI API Key Drift (DB vs Env):**
- Risk: `OPENAI_API_KEY` is stored in the `resource` table AND read by backend from `process.env.OPENAI_API_KEY`. During the recent deploy the DB had the key but the backend read from env, requiring a manual copy into `.env`.
- Files: `backend/src/modules/admin-config/` resource service, `backend/src/database/migrations/1773880000000-AddResourcesTable.ts`
- Current mitigation: Manual sync.
- Recommendations: Pick one source of truth. If DB-driven, remove env fallback and load lazily through a `ResourceConfigService`. If env-driven, drop the DB column. Add a startup assertion that fails with a clear message if the key is missing.

**Skills with Silent Soft-Fail:**
- Risk: Multiple skills swallow errors and return placeholder data, masking failures from operators and downstream steps.
- Files:
  - `backend/src/modules/execucao/services/skill-registry.service.ts:271-273` — `DraftFinalResponse` memory retrieval failure logged as `warn`, continues with no memory context.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:899-903` — `ApplyPersonaTone` LLM failure silently falls back to rule-based on the original draft.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:992-996` — `PersistMemory` embedding failure stores a 1536-dim zero vector, polluting future similarity searches.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:384-392` — top-level catch returns `{ error, skillKey, failedAt }` instead of throwing; downstream steps see "success" with poisoned input.
- Current mitigation: Warning logs only.
- Recommendations: Distinguish between recoverable degradation and skill failure. Surface errors on the StepExecution row; show degraded-mode badges on the UI; never silently insert zero vectors into pgvector tables.

**bko-console Depends on Endpoints That May Not All Exist:**
- Risk: The frontend assumes endpoints whose backend implementations are stubs or partial.
- Files: `backend/src/modules/operacao/controllers/admin-users.controller.ts:71-79` — `/api/admin/webhooks` and `/api/admin/webhooks/:id/logs` return hardcoded `[]`.
- Impact: Webhook UI panels appear functional but show empty data forever; misleading to operators.
- Recommendations: Either implement webhook persistence or hide the UI panels until backed.

## Code Smells

**SkillRegistryService Giant Switch (~24 cases):**
- File: `backend/src/modules/execucao/services/skill-registry.service.ts:112-393` — single `execute()` method with a switch over skill keys.
- Why it smells: 1236-line service; ~24 inline cases; new skills require editing the switch and adding inline implementations (recently happened for `ExtractComplaintEntities` and `RetrieveKnowledgeBase`); makes testing each skill in isolation hard; violates open/closed principle.
- Refactor path: Move each skill into its own class implementing a `Skill` interface (`execute(input, ctx) → output`); register them in a `Map<string, Skill>` keyed by `SkillDefinition.key`; auto-discover via NestJS `DiscoveryService`. Allows per-skill tests, retries, timeouts, telemetry decorators.

**Entities With Many Nullable Fields:**
- Smell: Operacao entities (Complaint, TicketExecution, StepExecution) carry many `?: string | null` fields driven by partial population across the pipeline, leading to defensive `?? null` and `?? ''` everywhere in skills (e.g. `skill-registry.service.ts:419-440` LoadComplaint output coalescing).
- Impact: Type system gives weak guarantees; makes it hard to know which fields are populated at which stage; encourages "just default it" code.
- Refactor path: Introduce stage-specific DTOs (`ParsedComplaint`, `EnrichedComplaint`, `ResolvedComplaint`) so each consumer's required fields are non-nullable.

**Inconsistent Skill Input Passing (flatOutputs flattening):**
- Smell: `TicketExecutionService.advanceStep` lines 261-268 and 336-344 manually flatten `metadata.stepOutputs.<stepKey>.<field>` to top-level so skills can read `rawText`, `tipologyId`, `normalizedText` directly. The flattening is duplicated in two places (HITL pause path and normal path).
- Impact: Skills depend on this flattening implicitly; if a future caller passes the un-flattened metadata, skills receive `undefined` for fields they expect at the top level. Order of key collisions is undefined when two prior steps write the same key.
- Refactor path: Make a single `buildSkillInput(execution, operatorInput?)` helper; document the precedence rule (later step wins? operator override?) explicitly; consider passing typed `stepOutputs` to skills instead of flattening.

## Operational Concerns

**PM2 Process Manager (No systemd):**
- Concern: Production runs under PM2 rather than systemd; no managed restarts on host reboot unless `pm2 startup` was run; PM2 logs not integrated with journalctl.
- Recommendation: Either commit `pm2 startup` config and ecosystem file to repo, or migrate to systemd unit files for predictable boot/restart behavior.

**Local Docker Postgres on Non-Standard Port 5433:**
- Files: `docker-compose.yml`
- Concern: Local DB runs on `5433` (to avoid conflict with system 5432) but defaults in `data-source.ts:9` and `.env` examples assume `5432`. New developers hit connection failures until they read the README.
- Recommendation: Standardize on a single port; document the override clearly; or detect via env var without a 5432 default.

**Manual SQL for Schema Changes:**
- Concern: The deployment workflow includes hand-editing schema (e.g. `CREATE TABLE discount`, `CREATE TABLE invoice`); SQL backfill needed when capabilities cloned to new tipologies because step skill bindings weren't cloned by the cloning logic.
- Files: cloning logic in capability/orchestracao service (search for `cloneCapability` in `backend/src/modules/orquestracao/`)
- Recommendation: Add deep-clone for `step_skill_binding` rows when cloning capabilities; treat hand-SQL as a release blocker, not a workaround.

**No Migration System Active:**
- Concern: 14 migration files in `backend/src/database/migrations/` exist but no deploy step runs them; `npm run migration:run` is never invoked in the deploy pipeline.
- Recommendation: Add a `predeploy` migration step; reject deploys when `migration:show` reports pending migrations on the server.

## Schema-Code Drift

**Entity Fields vs DB Columns:**
- Issue: Confirmed drift incidents during recent deploy:
  - Tipology entity uses `label` field but a query referenced `t.name` — caused runtime SQL error.
  - `LlmModelConfig` entity inconsistency: local uses `maxTokens` while server schema/code uses `maxOutputTokens`.
  - `PromptContext` entity diverged between local and server.
- Files: `backend/src/modules/regulatorio/entities/tipology.entity.ts`, `backend/src/modules/ia/entities/llm-model-config.entity.ts`, `PromptContext` entity (search `backend/src/modules/ia/entities/`)
- Impact: Queries fail at runtime with cryptic Postgres errors; bugs only surface when the matching code path is exercised.
- Fix approach: Add a CI check that runs `typeorm schema:log` against a fresh DB seeded from migrations and fails if it reports ANY diff. Forces every entity change to ship with a migration.

## Missing Implementations

**Skills Referencing Unimplemented Templates/Embeddings:**
- Files & symptoms:
  - `backend/src/modules/execucao/services/skill-registry.service.ts:707-709` — `RetrieveIQITemplate` returns `{ templateContent: null, error: 'No tipologyId provided' }` and the pipeline silently continues with no template.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:746-748` — `BuildMandatoryChecklist` returns empty checklist if no tipologyId.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:992-996` — `PersistMemory` falls back to a zero embedding vector.
  - `backend/src/modules/execucao/services/skill-registry.service.ts:939-963` — `HumanDiffCapture` is a Phase-5 scaffold returning `pending_human_review`; only populated by `HumanReviewService.createReview` afterward.
- Impact: Pipeline reports success for steps that did nothing useful; downstream skills generate output from missing context.
- Recommendation: Each skill should declare prerequisite fields and fail loudly when missing rather than degrade silently.

**Webhook Endpoints Are Hardcoded Stubs:**
- File: `backend/src/modules/operacao/controllers/admin-users.controller.ts:71-79`
- Issue: `GET /api/admin/webhooks` and `GET /api/admin/webhooks/:id/logs` both `return []` with no underlying table.
- Recommendation: Either ship the webhook subsystem or remove the routes (and the matching UI in bko-console) until ready.

## Validation Gaps

**Hardcoded Auto-Advance Step Limit:**
- File: `backend/src/modules/execucao/services/ticket-execution.service.ts:163` — `let maxIterations = 30;`
- Issue: Magic number caps every workflow at 30 auto-advance iterations. A capability with more than ~30 non-HITL steps would silently stall mid-pipeline; no warning, no metric.
- Recommendation: Compute the cap from `steps.length * 2` or make it configurable per capability; emit a metric/log when the cap is hit.

**No Rate Limiting:**
- Issue: No `@nestjs/throttler` or equivalent guard on any controller; LLM-backed endpoints (`/advance`, `/start`) can be triggered repeatedly with no per-IP or per-user limit.
- Impact: A single client can burn through OpenAI quota; deliberate or accidental retries can multiply LLM cost.
- Recommendation: Add `ThrottlerModule` globally with stricter per-route overrides on AI-invoking endpoints.

**No Idempotency Keys on State-Changing Endpoints:**
- Issue: `POST /api/complaints/:id/executions/start`, `/advance`, `/retry` have no `Idempotency-Key` header support. The `startExecution` 409 guard prevents duplicate executions only when a prior one is RUNNING/PAUSED_HUMAN — does not prevent double-start after completion.
- Files: `backend/src/modules/execucao/services/ticket-execution.service.ts:81-90`
- Recommendation: Add an `Idempotency-Key` header pattern persisted in a small table with a uniqueness constraint; return the same response for the same key within a TTL window.

**HitlPolicyService Behavior (Recently Fixed, Watch For Regression):**
- File: `backend/src/modules/execucao/services/human-review.service.ts:24-31`
- Note: Previously was forcing human review on EVERY step when `riskLevel ∈ {'high','critical'}`. Now respects only `isHumanRequired || riskLevel ∈ {'high','critical'}` at policy evaluation time, but caller in `autoAdvanceLoop` (`ticket-execution.service.ts:177-180`) passes `null` for riskLevel — meaning auto-advance ignores risk entirely while `advanceStep` (`ticket-execution.service.ts:254-257`) passes the real `complaint.riskLevel`. Behavioral asymmetry between the two paths; document or unify.
- Recommendation: Add a regression test pinning the policy matrix; unify the auto-advance and explicit-advance code paths so risk is evaluated identically.

**SensitiveDataInterceptor Date Handling (Recently Fixed):**
- File: `backend/src/interceptors/sensitive-data.interceptor.ts:14`
- Note: The line `if (data instanceof Date) return data.toISOString();` is now present. Prior to the fix, Dates serialized as `{}` and broke the frontend with React error #31. Document this with a comment and add a test covering Date, nested Dates, Date inside arrays, Date inside objects.
- Recommendation: Add explicit unit tests for the redactor matrix (string, number, null, Date, Array, plain object, nested combinations) before the next change to this file.

---

*Concerns audit: 2026-05-06*
