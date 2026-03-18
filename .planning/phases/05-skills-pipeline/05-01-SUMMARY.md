---
phase: 05-skills-pipeline
plan: 01
subsystem: api
tags: [nestjs, typeorm, skill-registry, ai-dispatch, postgres, seeder]

# Dependency graph
requires:
  - phase: 04-intelligence-layer
    provides: AI agents (ComplaintParsingAgent, DraftGeneratorAgent, ComplianceEvaluatorAgent, FinalResponseComposerAgent), TokenUsageTrackerService, ModelSelectorService, VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
  - phase: 03-orchestration-engine
    provides: TicketExecutionService step engine with 19 skill stubs, ExecucaoModule, RegulatoryOrchestrationService
  - phase: 01-foundation
    provides: Artifact entity with complaintId FK, Persona entity, Tipology entity, MemoriaModule (CaseMemory, HumanFeedbackMemory)
provides:
  - SkillRegistryService as central skill dispatcher handling all 19 skill keys
  - Wave 1 real skill implementations: LoadComplaint, NormalizeComplaintText, ComputeSla, DetermineRegulatoryAction, ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento
  - Artifact persistence for all Phase 4 AI skills (draft_response, compliance_evaluation, final_response, kb_context, iqi_template, mandatory_checklist)
  - PersonaSeeder with 4 personas (cobranca=objetiva, cancelamento=defensavel, portabilidade=explicativa, qualidade=empatica)
  - MemoriaModule wired into ExecucaoModule (closes dependency gap)
affects:
  - 05-02 (ApplyPersonaTone skill — Wave 2, needs Persona repo from SkillRegistryService)
  - 05-03 (HumanDiffCapture, PersistMemory, TrackTokenUsage, AuditTrail — Wave 3 stubs)
  - 06-hitl (HumanReview step, uses PersistMemory and AuditTrail skills)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SkillRegistryService as central dispatcher: single execute(skillKey, input, stepExecutionId, complaintId) routes all 19 skills"
    - "complaintId passed as explicit 4th arg from execution.complaintId — never derived from metadata/input"
    - "All artifact-producing skills persist typed artifacts (artifactType enum) before returning output"
    - "Deterministic validation skills (ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento) are synchronous and pure — no DB/LLM"
    - "DetermineRegulatoryAction uses generateObject with Zod schema (classificacao functionalityType) for structured regulatory action output"

key-files:
  created:
    - backend/src/modules/execucao/services/skill-registry.service.ts
    - backend/src/database/seeds/persona.seeder.ts
  modified:
    - backend/src/modules/execucao/services/ticket-execution.service.ts
    - backend/src/modules/execucao/execucao.module.ts
    - backend/src/database/seeds/main.seeder.ts

key-decisions:
  - "SkillRegistryService owns all skill implementations — TicketExecutionService is reduced to thin delegation wrapper"
  - "complaintId flows as explicit 4th parameter — never extracted from input metadata to prevent stale-data bugs"
  - "MemoriaModule added to ExecucaoModule imports to unlock CaseMemory + HumanFeedbackMemory repositories for Wave 3 PersistMemory skill"
  - "Wave 2/3 skills return stubs that won't break pipeline — ApplyPersonaTone passes through draftText, PersistMemory/HumanDiffCapture/TrackTokenUsage/AuditTrail return stub IDs"
  - "PersonaSeeder uses count-based idempotency (skip if >= 4) — consistent with established seeder pattern from 01-03"
  - "DetermineRegulatoryAction uses 'classificacao' functionalityType (light model) for cost efficiency on frequent regulatory classification"

patterns-established:
  - "Skill dispatch pattern: SkillRegistryService.execute() is the single entry point — callers never invoke skills directly"
  - "Artifact persistence pattern: each skill that produces output saves a typed Artifact row before returning"
  - "Seeder ordering: RegulatorioSeeder → PersonaSeeder (Persona has FK to Tipology)"

# Metrics
duration: 12min
completed: 2026-03-17
---

# Phase 5 Plan 1: Skills Pipeline Wave 1 Summary

**SkillRegistryService central dispatcher with 7 Wave 1 skill implementations (LoadComplaint through ValidateCancelamento), artifact persistence for all AI skills, MemoriaModule wiring, and PersonaSeeder for 4 tipology-mapped personas**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-17T00:00:00Z
- **Completed:** 2026-03-17T00:12:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Created SkillRegistryService as the central skill dispatcher handling all 19 skill keys with a single `execute(skillKey, input, stepExecutionId, complaintId)` interface
- Implemented 7 Wave 1 real skills: LoadComplaint (ART-01), NormalizeComplaintText (ART-02), ComputeSla (ART-03), DetermineRegulatoryAction (ART-04 + generateObject + Zod), ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento
- Moved Phase 4 AI skill dispatch into SkillRegistryService with artifact persistence added to DraftFinalResponse (ART-08), ComplianceCheck (ART-09), GenerateArtifact (ART-10), RetrieveManualContext, RetrieveIQITemplate, BuildMandatoryChecklist
- Refactored TicketExecutionService.executeSkill() to a thin delegation wrapper; passes execution.complaintId as 4th arg in advanceStep and retryStep
- Added MemoriaModule to ExecucaoModule imports (closes the wiring gap for CaseMemory and HumanFeedbackMemory repositories)
- Created PersonaSeeder with 4 personas mapped to tipology keys (cobranca, cancelamento, portabilidade, qualidade); wired after RegulatorioSeeder in MainSeeder

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SkillRegistryService and wire module dependencies** - `6111289` (feat)
2. **Task 2: Create PersonaSeeder and wire into MainSeeder** - `aa48dac` (feat)

## Files Created/Modified
- `backend/src/modules/execucao/services/skill-registry.service.ts` — New central skill dispatcher with all 19 skills (7 real Wave 1 + 6 AI delegations + 5 stubs)
- `backend/src/modules/execucao/services/ticket-execution.service.ts` — Removed AI/KB service constructor params; added SkillRegistryService injection; thin executeSkill delegation with complaintId
- `backend/src/modules/execucao/execucao.module.ts` — Added MemoriaModule import and SkillRegistryService as provider + export
- `backend/src/database/seeds/persona.seeder.ts` — New PersonaSeeder with 4 personas (one per tipology)
- `backend/src/database/seeds/main.seeder.ts` — PersonaSeeder added after RegulatorioSeeder

## Decisions Made
- **SkillRegistryService as sole owner of skill logic:** Reduces TicketExecutionService to an orchestrator that knows nothing about skill internals — cleaner separation of concerns and easier to test skills in isolation
- **complaintId as explicit 4th parameter:** Prevents subtle bugs where complaintId might be extracted from stale metadata; ensures artifact FKs are always authoritative
- **MemoriaModule gap closed now:** Wave 3 PersistMemory skill needs CaseMemory + HumanFeedbackMemory repos — adding MemoriaModule now means no module wiring changes needed in 05-03
- **Wave 2/3 stubs return safe pass-through values:** ApplyPersonaTone echoes draftText, stubs return deterministic non-null values so pipeline can proceed without errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SkillRegistryService and module wiring complete — 05-02 can implement ApplyPersonaTone (Wave 2) with Persona repository already injected
- PersonaSeeder data ready for 05-02 persona-based tone adjustment skill
- Wave 3 stubs (HumanDiffCapture, PersistMemory, TrackTokenUsage, AuditTrail) return stub values — pipeline will not fail on these steps
- CaseMemory and HumanFeedbackMemory repositories available in SkillRegistryService constructor for 05-03 PersistMemory implementation

---
*Phase: 05-skills-pipeline*
*Completed: 2026-03-17*
