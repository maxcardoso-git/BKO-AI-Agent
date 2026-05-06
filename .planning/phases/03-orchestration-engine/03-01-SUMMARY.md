---
phase: 03-orchestration-engine
plan: 01
subsystem: api
tags: [nestjs, typeorm, regulatory, sla, orchestration, capability, policy]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypeORM entities — Tipology, Situation, RegulatoryRule, RegulatoryAction, Capability, CapabilityVersion
  - phase: 02-access-layer
    provides: Module structure and NestJS bootstrap patterns

provides:
  - RegulatoryOrchestrationService with computeSla, selectCapabilityVersion, validatePolicyRules
  - OrquestracaoModule wired with RegulatorioModule import and service export

affects:
  - 03-02-step-execution (consumes RegulatoryOrchestrationService for ticket start/advance/finalize)
  - 03-03 onwards (all processing pipeline plans depend on this foundation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-module service injection: OrquestracaoModule imports RegulatorioModule to access its TypeORM repositories"
    - "Business days calculation: addBusinessDays private helper skips weekends, no holiday handling Phase 3"
    - "Conservative policy validation: unknown rules block by default (fail-safe)"
    - "422 HttpException for unprocessable entity (missing capability/version)"

key-files:
  created:
    - backend/src/modules/orquestracao/services/regulatory-orchestration.service.ts
  modified:
    - backend/src/modules/orquestracao/orquestracao.module.ts

key-decisions:
  - "03-01: One-way dependency chain ExecucaoModule -> OrquestracaoModule -> RegulatorioModule prevents circular imports"
  - "03-01: computeSla is synchronous — pure computation on already-loaded entities, no DB calls"
  - "03-01: validatePolicyRules uses conservative strategy — unknown rule types add violations (fail-safe)"
  - "03-01: Phase 3 stub for requires_complete_checklist — always passes, deferred to Phase 4"

patterns-established:
  - "SLA computation: situation.slaOverrideDays ?? tipology.slaBusinessDays — situation overrides tipology"
  - "Capability selection: find isActive capability by tipologyId, then find isCurrent+isActive version"
  - "Policy validation: filter BLOCKING rules by tipologyId and blocks_action, evaluate or fail-safe block"

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 3 Plan 01: Regulatory Orchestration Service Summary

**Injectable RegulatoryOrchestrationService with SLA computation (weekend-skipping business days), capability version selection (422 on missing), and conservative BLOCKING policy validation wired into OrquestracaoModule via RegulatorioModule cross-module import**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T22:47:22Z
- **Completed:** 2026-03-17T22:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created RegulatoryOrchestrationService with all three regulatory decision methods
- computeSla computes SLA deadline using business days (skips weekends), picks situation override over tipology default
- selectCapabilityVersion finds the active+current capability version for a tipologyId or throws 422
- validatePolicyRules filters BLOCKING rules by tipologyId and blocks_action, evaluates with conservative fail-safe strategy
- OrquestracaoModule wired with RegulatorioModule in imports, RegulatoryOrchestrationService in providers+exports
- NestJS bootstraps cleanly with no dependency resolution errors

## Task Commits

1. **Task 1: Create RegulatoryOrchestrationService** - `e17c4b5` (feat)
2. **Task 2: Wire OrquestracaoModule** - `38b9ca1` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified
- `backend/src/modules/orquestracao/services/regulatory-orchestration.service.ts` - SLA computation, capability version selection, policy validation service
- `backend/src/modules/orquestracao/orquestracao.module.ts` - Added RegulatorioModule import, RegulatoryOrchestrationService provider+export

## Decisions Made
- One-way dependency chain enforced: ExecucaoModule -> OrquestracaoModule -> RegulatorioModule. No ExecucaoModule import in OrquestracaoModule to prevent circular dependency crash.
- computeSla is synchronous: no DB calls needed, caller provides already-loaded Tipology and Situation entities.
- Conservative policy validation: any BLOCKING rule whose evaluation logic is not recognized adds to violations array (fail-safe, not fail-open).
- Phase 3 stub for `requires_complete_checklist` metadata: always passes with comment for Phase 4 implementation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RegulatoryOrchestrationService is injectable and exported from OrquestracaoModule
- Plan 03-02 (TicketExecutionService/step engine) can import OrquestracaoModule and inject RegulatoryOrchestrationService
- SLA computation, capability selection, and policy validation are ready for the execution pipeline to consume

---
*Phase: 03-orchestration-engine*
*Completed: 2026-03-17*
