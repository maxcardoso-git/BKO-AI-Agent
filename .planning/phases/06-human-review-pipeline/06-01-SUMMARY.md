---
phase: 06-human-review-pipeline
plan: 01
subsystem: api
tags: [nestjs, typeorm, hitl, diff, human-review, steps-designer, postgresql]

# Dependency graph
requires:
  - phase: 05-skills-pipeline
    provides: ART-09 final_response and ART-11 human_diff artifacts produced by SkillRegistryService; WAITING_HUMAN StepExecution rows created by TicketExecutionService.advanceStep()
  - phase: 03-orchestration-engine
    provides: TicketExecutionService, StepDefinition, StepSkillBinding, CapabilityVersion entities and advanceStep() pause mechanism
provides:
  - POST/GET /api/executions/:execId/steps/:stepExecId/review — human review submission with diff computation and ART-11 update
  - HitlPolicyService.shouldRequireHumanReview() — risk-aware HITL gate (isHumanRequired OR riskLevel in high/critical)
  - GET /api/admin/capabilities — list all capabilities with versions and step definitions
  - PUT /api/admin/capabilities/:capId/versions/:verId/steps — atomic step reorder with StepSkillBinding upsert
  - GET/PUT /api/admin/steps/:stepId/transitions — StepTransitionRule CRUD
affects: [06-02, 06-03, 07-compliance-reporting]

# Tech tracking
tech-stack:
  added:
    - "diff@^8.0.0 — word-level diff computation (diffWords) for HumanReview.diffSummary"
    - "@types/multer@^1.4.12 — Express.Multer.File type for KB upload controller"
  patterns:
    - "HitlPolicyService pattern: pure injectable service, no repos, single boolean method"
    - "Two classes in same service file: HitlPolicyService + HumanReviewService in human-review.service.ts"
    - "StepsDesigner updateSteps() with transaction: upsert StepDefinition rows sequentially then upsert StepSkillBinding by skillKey lookup"
    - "TransitionRule DTO maps actual entity fields: conditionType/conditionExpression/targetStepKey (not condition/targetStepOrder)"

key-files:
  created:
    - backend/src/modules/execucao/dto/submit-review.dto.ts
    - backend/src/modules/execucao/services/human-review.service.ts
    - backend/src/modules/execucao/controllers/human-review.controller.ts
    - backend/src/modules/orquestracao/dto/update-steps.dto.ts
    - backend/src/modules/orquestracao/services/steps-designer.service.ts
    - backend/src/modules/orquestracao/controllers/steps-designer.controller.ts
  modified:
    - backend/src/modules/execucao/execucao.module.ts
    - backend/src/modules/execucao/services/ticket-execution.service.ts
    - backend/src/modules/orquestracao/orquestracao.module.ts
    - backend/package.json
    - backend/tsconfig.build.json

key-decisions:
  - "HitlPolicyService in same file as HumanReviewService — avoids circular dep; both exported from human-review.service.ts"
  - "skillKey/llmModel NOT added to StepDefinition entity (no migration) — handled via StepSkillBinding upsert in updateSteps() transaction"
  - "TransitionRuleDto uses conditionType/conditionExpression/targetStepKey matching actual StepTransitionRule entity (plan DTO was wrong)"
  - "StepsDesignerService.listCapabilities() uses QueryBuilder not .find() — ensures stepOrder ordering across relation levels"
  - "pdf-parse pinned to 1.1.1 (v2 has incompatible class-based API); document-ingestion.service uses dynamic default fallback"
  - "tsconfig.build.json now excludes scripts/ — was missing causing verify-e2e.ts compile errors in nest build"

patterns-established:
  - "HITL gate via HitlPolicyService.shouldRequireHumanReview(isHumanRequired, riskLevel) — all future step pause logic should go through this service"
  - "Admin CRUD controllers use @Controller() with empty string — global setGlobalPrefix('api') handles prefix"

# Metrics
duration: 13min
completed: 2026-03-18
---

# Phase 6 Plan 01: Human Review Backend BFF Summary

**HumanReviewController (POST/GET review), HitlPolicyService (risk-aware HITL gate injected into TicketExecutionService), and StepsDesignerController (admin CRUD for capabilities/steps/transitions) — full Phase 6 backend API contract established with diff computation via `diffWords()` and atomic step reordering via DataSource.transaction()**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-18T02:45:05Z
- **Completed:** 2026-03-18T02:58:05Z
- **Tasks:** 2/2
- **Files modified:** 14 (6 new, 8 modified)

## Accomplishments

- HumanReviewService creates HumanReview rows with aiGeneratedText loaded from ART-09 (final_response artifact), computes `diffWords()` diff summary, updates ART-11 (human_diff artifact) with real diff data
- HitlPolicyService injected into TicketExecutionService.advanceStep() — replaces raw `isHumanRequired` check with risk-aware gate that also fires on `riskLevel in ['high','critical']`
- StepsDesignerController + StepsDesignerService: 5 admin endpoints, atomic step reorder via DataSource.transaction() with StepSkillBinding upsert when skillKey provided, StepTransitionRule replace-all strategy

## Task Commits

1. **Task 1: HumanReviewService, HitlPolicyService, HumanReviewController** — `898f9a0` (feat)
2. **Task 2: StepsDesignerService and StepsDesignerController** — `e5bde6a` (feat)

## Files Created/Modified

- `backend/src/modules/execucao/dto/submit-review.dto.ts` — SubmitReviewDto with approved, humanFinalText, correctionReason, checklistItems, observations
- `backend/src/modules/execucao/services/human-review.service.ts` — HitlPolicyService (pure risk gate) + HumanReviewService (ART-09 load, diffWords, ART-11 update)
- `backend/src/modules/execucao/controllers/human-review.controller.ts` — POST/GET /api/executions/:execId/steps/:stepExecId/review
- `backend/src/modules/orquestracao/dto/update-steps.dto.ts` — UpdateStepsDto, TransitionRuleDto (mapped to actual entity fields)
- `backend/src/modules/orquestracao/services/steps-designer.service.ts` — listCapabilities, updateSteps (atomic txn), getTransitions, updateTransitions
- `backend/src/modules/orquestracao/controllers/steps-designer.controller.ts` — 5 admin endpoints
- `backend/src/modules/execucao/execucao.module.ts` — registers HumanReviewController, HumanReviewService, HitlPolicyService
- `backend/src/modules/execucao/services/ticket-execution.service.ts` — injects HitlPolicyService, uses shouldRequireHumanReview()
- `backend/src/modules/orquestracao/orquestracao.module.ts` — registers StepsDesignerController, StepsDesignerService
- `backend/package.json` — adds diff@^8.0.0, @types/multer@^1.4.12, pdf-parse pinned to 1.1.1
- `backend/tsconfig.build.json` — adds scripts/ to exclude list

## Decisions Made

- `HitlPolicyService` lives in same file as `HumanReviewService` to avoid circular dependency; both are exported from the same module path.
- `skillKey` and `llmModel` are NOT added as columns to `StepDefinition` entity (would require migration). Instead, `updateSteps()` looks up `SkillDefinition` by key and upserts the `StepSkillBinding` row within the same transaction.
- `TransitionRuleDto` maps actual `StepTransitionRule` entity fields (`conditionType`, `conditionExpression`, `targetStepKey`) — the plan's DTO spec used different field names.
- `pdf-parse` pinned to v1.1.1 — v2.4.5 has a class-based API (`PDFParse`) that is incompatible with existing `pdfParse(buffer)` call pattern.
- `tsconfig.build.json` was missing `"scripts"` in exclude array — NestJS `nest build` was picking up `verify-e2e.ts` from the scripts/ folder.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tsconfig.build.json missing scripts/ exclusion**
- **Found during:** Task 1 (VPS build verification)
- **Issue:** `scripts/verify-e2e.ts` references future-phase entities not yet created; was being compiled by `nest build` despite `tsconfig.json` excluding scripts/. NestJS CLI uses `tsconfig.build.json`, which was missing the exclusion.
- **Fix:** Added `"scripts"` to the `exclude` array in `tsconfig.build.json`
- **Files modified:** `backend/tsconfig.build.json`
- **Committed in:** 898f9a0

**2. [Rule 1 - Bug] Fixed AI SDK v6 breaking changes: maxTokens → maxOutputTokens (5 files)**
- **Found during:** Task 1 (VPS build verification)
- **Issue:** AI SDK v6 renamed `maxTokens` to `maxOutputTokens` in `generateObject`/`generateText` call options. Build failed with TS2353 errors in 5 service files.
- **Fix:** Replaced `maxTokens:` with `maxOutputTokens:` in skill-registry.service.ts, complaint-parsing.agent.ts, final-response-composer.agent.ts, compliance-evaluator.agent.ts, draft-generator.agent.ts
- **Files modified:** 5 IA/skill service files
- **Committed in:** 898f9a0

**3. [Rule 1 - Bug] Fixed EmbeddingModel<string> → EmbeddingModel (ai SDK v6)**
- **Found during:** Task 1 (VPS build verification)
- **Issue:** `EmbeddingModel` in ai SDK v6 is a plain type alias (not generic). `EmbeddingModel<string>` causes TS2315 "Type is not generic".
- **Fix:** Changed return type to `EmbeddingModel` in model-selector.service.ts
- **Files modified:** `backend/src/modules/ia/services/model-selector.service.ts`
- **Committed in:** 898f9a0

**4. [Rule 1 - Bug] Fixed pdf-parse v2 incompatible API**
- **Found during:** Task 1 (VPS build verification)
- **Issue:** pdf-parse v2.4.5 exports only a `PDFParse` class; the old `pdfParse(buffer)` default-import pattern from v1 no longer works. TS error on `.default` property.
- **Fix:** Pinned pdf-parse to `1.1.1` in package.json; added defensive `pdfMod.default ?? pdfMod` fallback in document-ingestion.service.ts
- **Files modified:** `backend/package.json`, `backend/src/modules/base-de-conhecimento/services/document-ingestion.service.ts`
- **Committed in:** 898f9a0

**5. [Rule 2 - Missing Critical] Added @types/multer for Express.Multer.File type**
- **Found during:** Task 1 (VPS build verification)
- **Issue:** `Express.Multer.File` type used in kb-manager.controller.ts but `@types/multer` was not in devDependencies, causing TS2694.
- **Fix:** Added `"@types/multer": "^1.4.12"` to devDependencies in package.json
- **Files modified:** `backend/package.json`
- **Committed in:** 898f9a0

---

**Total deviations:** 5 auto-fixed (1 blocking, 3 bug, 1 missing critical)
**Impact on plan:** All auto-fixes required for clean build on VPS. No scope creep. The AI SDK v6 breaking changes were pre-existing but only surfaced because this was the first clean VPS build of the project.

## Issues Encountered

- VPS had no BKOAgent project — cloned GitHub repo was empty (GitHub remote exists but no code pushed). Used rsync to sync local project to VPS for build verification. This is not a blocker for development since the project is git-managed locally.
- The plan's `TransitionConditionDto` used `condition` and `targetStepOrder` fields but the actual `StepTransitionRule` entity uses `conditionType`, `conditionExpression`, `targetStepKey`. Adapted the DTO to match the real entity.

## Next Phase Readiness

- All Phase 6 backend API endpoints are live and build-verified
- Plans 06-02 and 06-03 (frontend) can be built in parallel against these stable APIs
- `POST /api/executions/:execId/steps/:stepExecId/review` — ready for HITL editor frontend
- `GET /api/admin/capabilities` — ready for admin steps designer frontend
- HitlPolicyService risk gate is active in `advanceStep()` — high/critical risk complaints now trigger HITL automatically

---
*Phase: 06-human-review-pipeline*
*Completed: 2026-03-18*
