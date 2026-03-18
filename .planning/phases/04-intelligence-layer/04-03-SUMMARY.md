---
phase: 04-intelligence-layer
plan: 03
subsystem: ai-skill-dispatch
tags: [nestjs, ai-sdk, compliance, token-tracking, kb-manager, skill-routing]

dependency-graph:
  requires:
    - 04-02  # IaModule, ModelSelectorService, PromptBuilderService, ComplaintParsingAgent, DraftGeneratorAgent
    - 04-01  # BaseDeConhecimentoModule, VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
    - 03-02  # TicketExecutionService, StepExecution, executeSkillStub (now replaced)
  provides:
    - ComplianceEvaluatorAgent (AI-07)
    - FinalResponseComposerAgent (AI-08)
    - TokenUsageTrackerService (AI-09)
    - KbManagerController (KB-08)
    - Real async skill dispatch in TicketExecutionService
  affects:
    - 04-04  # compliance prompt builder already wired; ComplianceEvaluatorAgent ready
    - 05-xx  # Phase 5 will replace remaining stubs (LoadComplaint, NormalizeComplaintText, etc.)

tech-stack:
  added: []
  patterns:
    - "TokenUsage-first FK pattern: create TokenUsage before LlmCall to satisfy llm_call.tokenUsageId FK"
    - "stepExec-before-skill pattern: save StepExecution before skill dispatch so stepExec.id is available for LlmCall FK"
    - "error-as-data pattern: executeSkill try/catch returns error payload instead of throwing (pipeline continues)"
    - "model:none sentinel: FinalResponseComposerAgent skips LLM and returns model:'none' when no violations — tracker skips tracking"

key-files:
  created:
    - backend/src/modules/ia/services/compliance-evaluator.agent.ts
    - backend/src/modules/ia/services/final-response-composer.agent.ts
    - backend/src/modules/ia/services/token-usage-tracker.service.ts
    - backend/src/modules/base-de-conhecimento/controllers/kb-manager.controller.ts
  modified:
    - backend/src/modules/ia/ia.module.ts
    - backend/src/modules/base-de-conhecimento/base-de-conhecimento.module.ts
    - backend/src/modules/execucao/services/ticket-execution.service.ts
    - backend/src/modules/execucao/execucao.module.ts

decisions:
  - "04-03: stepExec saved before skill dispatch — ensures stepExec.id exists for llm_call.stepExecutionId FK (non-nullable)"
  - "04-03: executeSkill try/catch returns error-as-data — pipeline records failure without crashing"
  - "04-03: IaModule imports TypeOrmModule.forFeature([LlmCall, TokenUsage]) directly — avoids circular dep with ExecucaoModule"
  - "04-03: FinalResponseComposerAgent returns model:'none' when no violations — token tracker skips on model==='none' sentinel"
  - "04-03: No @Roles on KbManagerController — global JwtAuthGuard protects; role enforcement deferred to Phase 7"
  - "04-03: KbManagerController uses Multer memoryStorage (no disk writes), 50MB limit, PDF/TXT only"

metrics:
  duration: "4 min"
  completed: "2026-03-18"
---

# Phase 4 Plan 03: AI Skill Dispatch Integration Summary

**One-liner:** Replaced synchronous skill stubs with real async AI dispatch routing 6 skills to 4 specialized agents with per-call token cost tracking via LlmCall+TokenUsage FK chain.

## What Was Built

### ComplianceEvaluatorAgent (AI-07)

`backend/src/modules/ia/services/compliance-evaluator.agent.ts`

Uses `generateObject` with `ComplianceEvaluationSchema` (Zod) against the `avaliacao` model config. Returns structured evaluation:

- `isCompliant` (boolean), `complianceScore` (0–1)
- `violations[]` — each with rule, severity (info/warning/error/critical), description, suggestion
- `mandatoryFieldsStatus[]` — per-field presence check with excerpt
- `recommendations[]`, `languageQuality` (isAppropriate + issues[])

Retrieves regulatory context via VectorSearch (`manual_anatel`) and resolves mandatory fields from DB before building the compliance prompt.

### FinalResponseComposerAgent (AI-08)

`backend/src/modules/ia/services/final-response-composer.agent.ts`

Uses `generateText` against the `composicao` model config. Short-circuits when there are no violations and no recommendations — returns the draft as-is with `model: 'none'` sentinel. When there are violations, builds a structured revision prompt applying all corrections.

### TokenUsageTrackerService (AI-09)

`backend/src/modules/ia/services/token-usage-tracker.service.ts`

Persists `TokenUsage` record first (FK target), then `LlmCall` with `tokenUsageId` set. Applies static per-1M-token cost table for 5 models (gpt-4o, gpt-4o-mini, text-embedding-3-small, claude-sonnet-4-6, claude-haiku-4-5). Returns 0 for unknown models (with warning log).

### KbManagerController (KB-08)

`backend/src/modules/base-de-conhecimento/controllers/kb-manager.controller.ts`

4 endpoints under `@Controller('kb')` (global prefix makes them `/api/kb/*`):

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/kb/upload | Upload PDF/TXT, trigger ingestion pipeline |
| GET | /api/kb/documents | List all documents with versions |
| GET | /api/kb/documents/:id | Get single document |
| PATCH | /api/kb/documents/:docId/versions/:versionId/activate | Activate specific version |

No `@Roles` decorator — global `JwtAuthGuard` protects all endpoints. Role enforcement deferred to Phase 7.

### TicketExecutionService — Async Skill Dispatch

`backend/src/modules/execucao/services/ticket-execution.service.ts`

`executeSkillStub` replaced by `private async executeSkill(skillKey, input, stepExecutionId)`:

**AI-powered skills (real dispatch):**

| Skill | Delegates To | Token Tracked |
|-------|-------------|---------------|
| ClassifyTypology | complaintParser.classify() | Yes |
| RetrieveManualContext | vectorSearch.search() | No (DB query) |
| RetrieveIQITemplate | templateResolver.resolve() | No (DB query) |
| BuildMandatoryChecklist | mandatoryInfoResolver.resolve() | No (DB query) |
| DraftFinalResponse | draftGenerator.generate() | Yes |
| ComplianceCheck | complianceEvaluator.evaluate() | Yes |
| GenerateArtifact | finalResponseComposer.compose() | Yes (skipped when model=none) |

**Non-AI stubs preserved** (LoadComplaint, NormalizeComplaintText, ComputeSla, DetermineRegulatoryAction, ApplyPersonaTone, HumanDiffCapture, PersistMemory, TrackTokenUsage, AuditTrail, ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento) — Phase 5 concern.

Critical ordering fix in `advanceStep`: StepExecution is saved *before* skill dispatch so `stepExec.id` is available as non-nullable FK for `LlmCall.stepExecutionId`.

## Module Wiring

```
ExecucaoModule
  -> IaModule (NEW)
       -> TypeOrmModule.forFeature([LlmCall, TokenUsage])  ← direct, no circular dep
       -> BaseDeConhecimentoModule
            -> MemoriaModule (KbDocument, KbDocumentVersion repos)
            -> RegulatorioModule
  -> OrquestracaoModule
  -> OperacaoModule
```

No circular dependencies. IaModule does NOT import ExecucaoModule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] stepExec.id availability for LlmCall FK**

- **Found during:** Task 3 implementation
- **Issue:** Original plan showed creating `stepExec` after skill dispatch, but `LlmCall.stepExecutionId` is non-nullable — if created during skill dispatch, `stepExec.id` would be unavailable at token tracking time.
- **Fix:** Save StepExecution before skill dispatch, then update with output/timing after. This ensures `stepExec.id` exists when `tokenUsageTracker.track()` is called inside `executeSkill`.
- **Files modified:** `ticket-execution.service.ts`
- **Commit:** c2ee950

None of the plan's core requirements were changed. The deviation was an ordering fix to satisfy DB FK constraints.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| stepExec saved before skill dispatch | llm_call.stepExecutionId FK is non-nullable; must exist before track() is called |
| error-as-data in executeSkill try/catch | Pipeline records skill failures without throwing; step execution records failure gracefully |
| IaModule imports TypeOrmModule.forFeature([LlmCall, TokenUsage]) directly | Avoids circular dep: ExecucaoModule->IaModule; IaModule cannot import ExecucaoModule back |
| model:'none' sentinel in FinalResponseComposer | Short-circuit when no violations avoids unnecessary LLM call; tracker skips on sentinel |
| No @Roles on KbManagerController | RolesGuard not globally registered until Phase 7; global JwtAuthGuard is sufficient |

## Next Phase Readiness

Phase 4 Plan 04 (04-04) can proceed immediately:

- `ComplianceEvaluatorAgent.evaluate()` is live and tested via `executeSkill('ComplianceCheck', ...)`
- `PromptBuilderService.buildCompliancePrompt()` was already wired in 04-02
- Token tracking for all 4 AI calls is live
- KB upload pipeline is accessible via `/api/kb/upload`

Phase 5 will replace the remaining non-AI stubs (LoadComplaint, NormalizeComplaintText, ComputeSla, etc.) with full service integrations.
