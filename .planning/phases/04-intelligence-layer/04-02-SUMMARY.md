---
phase: 04-intelligence-layer
plan: 02
subsystem: ai-services
tags: [nestjs, openai, anthropic, vercel-ai-sdk, generateObject, generateText, zod, llm-routing, fallback, rag, prompt-builder]

# Dependency graph
requires:
  - phase: 04-01
    provides: BaseDeConhecimentoModule, VectorSearchService, TemplateResolverService, MandatoryInfoResolverService, LlmModelConfig entity with 4 seeded configs
  - phase: 02-access-layer
    provides: RegulatorioModule with Persona entity
provides:
  - ModelSelectorService (DB-driven model selection: getModel, getConfig, callWithFallback, buildLanguageModel, getEmbeddingModel)
  - PromptBuilderService (buildClassificationPrompt, buildDraftResponsePrompt, buildCompliancePrompt)
  - ComplaintParsingAgent (generateObject + ComplaintParseSchema Zod, classificacao model, classify() dispatch interface)
  - DraftGeneratorAgent (generateText, composicao model, full context assembly with KB/template/mandatory fields)
  - IaModule wired and ready for ExecucaoModule import in 04-03
affects: [04-03-step-execution-real, 04-04-evaluator, 05-hitl]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - callWithFallback: primary model failure -> fallbackConfigId retry chain
    - buildLanguageModel: createOpenAI/createAnthropic factory from DB config
    - generateObject with Zod schema for structured LLM output (classificacao)
    - generateText for free-form output (composicao)
    - temperature from DB config (not hardcoded) per step type
    - classify()/generate() dispatch interface for skill router compatibility

key-files:
  created:
    - backend/src/modules/ia/services/model-selector.service.ts
    - backend/src/modules/ia/services/prompt-builder.service.ts
    - backend/src/modules/ia/services/complaint-parsing.agent.ts
    - backend/src/modules/ia/services/draft-generator.agent.ts
    - backend/src/modules/ia/ia.module.ts
  modified: []

key-decisions:
  - "callWithFallback generic pattern: single method wraps primary+fallback, callFn receives ModelWithConfig"
  - "classify()/generate() shaped as Record<string,unknown> for TicketExecutionService skill dispatch interface"
  - "IaModule not added to AppModule directly — will be imported transitively via ExecucaoModule in 04-03"
  - "PromptBuilderService has 3 prompt builders: classification (generateObject), draft (generateText), compliance (generateObject in 04-04)"

patterns-established:
  - "DB-driven model selection: LlmModelConfig.functionalityType as key, provider factory (openai/anthropic) at call time"
  - "Fallback chain: primary error -> check fallbackConfigId -> load fallback config -> retry callFn"
  - "Prompt assembly: system contains context (KB chunks, template, mandatory fields, persona), user contains ticket data"
  - "Agent dispatch interface: input/output as Record<string,unknown> for skill router generic dispatch"

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 4 Plan 2: AI Service Module Summary

**IaModule with ModelSelectorService (DB-driven multi-model routing + fallback chain), PromptBuilderService (KB/template/mandatory fields context assembly), ComplaintParsingAgent (generateObject + Zod schema via classificacao), and DraftGeneratorAgent (generateText via composicao with full regulatory context)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T01:30:52Z
- **Completed:** 2026-03-18T01:32:58Z
- **Tasks:** 3
- **Files modified:** 5 (all created)

## Accomplishments

- ModelSelectorService: DB-driven model loading from LlmModelConfig by functionalityType, constructs LanguageModel via createOpenAI/createAnthropic; callWithFallback retries with fallbackConfigId on primary failure
- PromptBuilderService: 3 context-rich prompt builders — classification (with KB chunks), draft response (with template, mandatory fields, persona, previous step outputs), compliance evaluation
- ComplaintParsingAgent: generateObject with ComplaintParseSchema (Zod) returns tipologyKey, confidence, summary, keyFacts, consumerIntent, urgencyLevel, mentionedValues + usage metadata
- DraftGeneratorAgent: generateText with composicao config (gpt-4o/temp:0.7); resolves KB chunks, IQI template, mandatory fields for full prompt context
- IaModule cleanly imports BaseDeConhecimentoModule + RegulatorioModule, exports all 4 AI services; no circular deps

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ModelSelectorService with DB-driven model selection and fallback** - `571bf39` (feat)
2. **Task 2: Create PromptBuilderService, ComplaintParsingAgent, and DraftGeneratorAgent** - `2c1f540` (feat)
3. **Task 3: Create IaModule and wire into application** - `773dbd5` (feat)

## Files Created/Modified

- `backend/src/modules/ia/services/model-selector.service.ts` - DB-driven LLM model selection: getModel, getConfig, callWithFallback (primary+fallback chain), buildLanguageModel (openai/anthropic), getEmbeddingModel
- `backend/src/modules/ia/services/prompt-builder.service.ts` - 3 prompt builders: buildClassificationPrompt (KB chunks), buildDraftResponsePrompt (template + mandatory fields + persona), buildCompliancePrompt (mandatory check list + KB rules)
- `backend/src/modules/ia/services/complaint-parsing.agent.ts` - generateObject with ComplaintParseSchema (Zod 8-field schema with .describe()); classify() dispatch interface for skill router
- `backend/src/modules/ia/services/draft-generator.agent.ts` - generateText via composicao config; resolves KB chunks + IQI template + mandatory fields; returns draftResponse + templateUsed + usage metadata
- `backend/src/modules/ia/ia.module.ts` - NestJS module imports BaseDeConhecimentoModule + RegulatorioModule, exports all 4 AI services

## Decisions Made

- **callWithFallback generic:** Single method accepts callFn that receives ModelWithConfig — keeps agent code clean, fallback logic centralized in one place
- **classify()/generate() as Record<string,unknown>:** Shaped for compatibility with TicketExecutionService skill dispatch interface in ExecucaoModule (04-03)
- **IaModule not in AppModule:** Will be imported by ExecucaoModule in 04-03 transitively; NestJS deduplicates module imports so adding it to AppModule is optional but not required
- **PromptBuilderService has 3 builders:** classification uses generateObject (structured), draft uses generateText (free-form), compliance will use generateObject in 04-04 (evaluator plan)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required at this phase. OPENAI_API_KEY is already added as optional Joi env var in AppModule (from 04-01).

## Next Phase Readiness

- IaModule is ready to be imported by ExecucaoModule in 04-03 (step execution engine with real AI skill dispatch)
- ComplaintParsingAgent.classify() and DraftGeneratorAgent.generate() are shaped as skill dispatch interface — ready for TicketExecutionService skill router to call them directly
- ModelSelectorService.callWithFallback is the standard pattern for all future AI calls (04-03, 04-04)
- PromptBuilderService.buildCompliancePrompt is available for 04-04 evaluator agent (generateObject with compliance schema)

---
*Phase: 04-intelligence-layer*
*Completed: 2026-03-18*
