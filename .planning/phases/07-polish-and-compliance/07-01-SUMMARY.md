---
phase: 07-polish-and-compliance
plan: 01
subsystem: api
tags: [nestjs, pgvector, memory, rag, human-feedback, style-memory, embeddings, ai-sdk]

# Dependency graph
requires:
  - phase: 05-skills-pipeline
    provides: PersistMemory skill inserts CaseMemory rows with pgvector embeddings; SkillRegistryService DraftFinalResponse dispatches DraftGeneratorAgent
  - phase: 06-human-review-pipeline
    provides: HumanReviewService.createReview() saves HumanReview rows after operator approval/editing
  - phase: 04-intelligence-layer
    provides: ModelSelectorService.getEmbeddingModel() for centralized embedding model access; PromptBuilderService.buildDraftResponsePrompt() for draft system prompt construction
provides:
  - MemoryRetrievalService.findSimilarCases(embedding, tipologyId, limit) — pgvector cosine similarity on case_memory
  - MemoryRetrievalService.findSimilarCorrections(embedding, tipologyId, limit) — pgvector cosine similarity on human_feedback_memory
  - MemoryRetrievalService.findStylePatterns(tipologyId, limit) — SELECT from style_memory by tipologyId and isActive
  - MemoryFeedbackService.persistFeedback() — raw INSERT into human_feedback_memory with pgvector.toSql(embedding)
  - PromptContext extended with similarCases, humanCorrections, stylePatterns optional fields
  - buildDraftResponsePrompt appends similar cases, human corrections, and approved/forbidden style pattern sections when non-empty
  - DraftFinalResponse skill: embeds complaint text, retrieves all three memory contexts, passes them into DraftGeneratorAgent input
  - HumanReviewService.createReview(): fire-and-forget MemoryFeedbackService.persistFeedback after review save
affects: [07-02, 07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MemoryRetrievalService pattern: pure DataSource injection with raw pgvector queries, no TypeORM repo needed for vector similarity searches"
    - "MemoryFeedbackService pattern: non-critical persistence — errors logged but not re-thrown so review flow continues uninterrupted"
    - "forwardRef() on IaModule import in MemoriaModule — breaks circular: MemoriaModule -> IaModule -> BaseDeConhecimentoModule -> MemoriaModule"
    - "Memory augmentation via input injection: SkillRegistryService adds memory arrays to input map before calling DraftGeneratorAgent.generate()"
    - "DraftGeneratorAgent reads memory context from input: similarCases/humanCorrections/stylePatterns passed via execute() input, added to PromptContext"

key-files:
  created:
    - backend/src/modules/memoria/services/memory-retrieval.service.ts
    - backend/src/modules/memoria/services/memory-feedback.service.ts
  modified:
    - backend/src/modules/memoria/memoria.module.ts
    - backend/src/modules/ia/services/prompt-builder.service.ts
    - backend/src/modules/ia/services/draft-generator.agent.ts
    - backend/src/modules/execucao/services/skill-registry.service.ts
    - backend/src/modules/execucao/services/human-review.service.ts

key-decisions:
  - "StyleMemory.expressionText (text column) not style.expression (jsonb) — entity schema uses expressionText; plan spec assumed jsonb, adapted to match actual schema"
  - "forwardRef(() => IaModule) in MemoriaModule breaks circular dep chain without touching BaseDeConhecimentoModule or IaModule"
  - "Memory augmented via input injection pattern — SkillRegistryService adds memory arrays to input before calling draftGenerator.generate() so DraftGeneratorAgent reads them from its existing input parameter"
  - "getStepExecution loads ticketExecution.complaint relation to access tipologyId for MemoryFeedbackService.persistFeedback() call"
  - "Task 1 was already committed (0bdb2c8) from a prior session that did partial 07 work — verified services match plan spec and proceeded to Task 2"

patterns-established:
  - "Non-critical async persistence: void service.method().catch(err => console.error(msg, err)) — preserves main flow on failure"
  - "Memory retrieval try/catch with empty array fallback — memory context enhances quality but is never blocking"

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 7 Plan 01: Memory-Driven AI Improvement Summary

**MemoryRetrievalService + MemoryFeedbackService wired into DraftFinalResponse skill and HumanReviewService — AI draft generation now retrieves similar past cases, human corrections, and approved/forbidden style patterns via pgvector cosine similarity**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T03:50:07Z
- **Completed:** 2026-03-18T03:58:54Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- MemoryRetrievalService provides three vector/SQL queries: `findSimilarCases`, `findSimilarCorrections`, `findStylePatterns` — all backed by raw DataSource queries for pgvector compatibility
- MemoryFeedbackService persists human corrections to `human_feedback_memory` with pgvector embeddings after each review submission, enabling future retrieval
- PromptBuilderService.buildDraftResponsePrompt() now appends three memory sections (similar cases, human corrections, approved/forbidden expressions) when those arrays are populated
- SkillRegistryService.DraftFinalResponse handler embeds complaint text, retrieves all three memory contexts in parallel via Promise.all, and injects them into the draft generation input
- HumanReviewService.createReview() fires MemoryFeedbackService.persistFeedback() as a non-blocking background call after saving the review

## Task Commits

Each task was committed atomically:

1. **Task 1: MemoryRetrievalService + MemoryFeedbackService + MemoriaModule update** - `0bdb2c8` (feat) — committed in prior session, verified identical to plan spec
2. **Task 2: Extend PromptContext + wire memory into SkillRegistryService and HumanReviewService** - `9bca32a` (feat)

## Files Created/Modified
- `backend/src/modules/memoria/services/memory-retrieval.service.ts` — findSimilarCases/findSimilarCorrections via pgvector cosine; findStylePatterns via isActive SQL filter on style_memory
- `backend/src/modules/memoria/services/memory-feedback.service.ts` — persistFeedback with embed() + raw INSERT with pgvector.toSql()
- `backend/src/modules/memoria/memoria.module.ts` — adds IaModule (forwardRef), MemoryRetrievalService, MemoryFeedbackService providers/exports
- `backend/src/modules/ia/services/prompt-builder.service.ts` — PromptContext extended with similarCases/humanCorrections/stylePatterns; buildDraftResponsePrompt adds three memory sections
- `backend/src/modules/ia/services/draft-generator.agent.ts` — reads similarCases/humanCorrections/stylePatterns from input and adds to PromptContext
- `backend/src/modules/execucao/services/skill-registry.service.ts` — injects MemoryRetrievalService; DraftFinalResponse case embeds text + retrieves memory context in try/catch + injects into agent input
- `backend/src/modules/execucao/services/human-review.service.ts` — injects MemoryFeedbackService; fire-and-forget persistFeedback after review save; loads ticketExecution.complaint relation for tipologyId

## Decisions Made
- **StyleMemory schema adaptation:** The plan spec described `style_memory` as having a `style` JSONB column with `style.expression`. The actual entity uses `expressionText` (plain text column). Adapted `findStylePatterns()` and the `stylePatterns` mapping in SkillRegistryService to use `expressionText` directly.
- **forwardRef() for circular dependency:** `MemoriaModule -> IaModule -> BaseDeConhecimentoModule -> MemoriaModule` chain required `forwardRef(() => IaModule)` in MemoriaModule. This is the minimal change — no modification to IaModule or BaseDeConhecimentoModule needed.
- **Input injection pattern for memory augmentation:** Rather than adding a new method to DraftGeneratorAgent, memory context arrays are injected into the `input` map before calling `generate()`. DraftGeneratorAgent reads them from input and adds to its PromptContext. Clean separation of concerns.
- **Task 1 was pre-committed:** The `0bdb2c8` commit from an earlier session had already created the two services and updated MemoriaModule. Local files written matched git state exactly (zero diff). Proceeded directly to Task 2 verification and Task 2 implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StyleMemory.expressionText vs style.expressionType mismatch**
- **Found during:** Task 1 (reading StyleMemory entity before implementing)
- **Issue:** Plan spec described `style_memory` as having a `style` JSONB column and instructed callers to use `row.style.expression as string`. Actual entity has `expressionText: string` (text column) and `expressionType: StyleExpressionType` (enum column).
- **Fix:** `findStylePatterns()` selects `"expressionText"` and `"expressionType"` directly. SkillRegistryService maps `p.expressionText` (not `p.style.expression`) and `p.expressionType` to PromptContext stylePatterns shape.
- **Files modified:** memory-retrieval.service.ts, skill-registry.service.ts
- **Committed in:** 9bca32a

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: schema mismatch between plan spec and actual entity)
**Impact on plan:** Essential correction. Using plan's spec verbatim would have caused runtime query errors. No scope creep.

## Issues Encountered
- Task 1 was already committed as part of `0bdb2c8` (07-02 commit) from a prior session. The local files I wrote were byte-for-byte identical to what was committed. Git status showed no diff, confirming the prior commit was correct. Proceeded to verify build, then implemented Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MEM-01..MEM-06 requirements satisfied: similarity retrieval, feedback persistence, and style pattern surfacing in AI draft prompts all wired
- 07-02 (AdminConfigController + persona/template CRUD) was already committed in prior session — STATE.md needs review to ensure it reflects this
- Ready to continue with 07-03 (observability/reporting) and 07-04 (security/compliance) plans

---
*Phase: 07-polish-and-compliance*
*Completed: 2026-03-18*
