---
phase: 07-polish-and-compliance
plan: 03
subsystem: observability
tags: [recharts, shadcn, sql, nestjs, nextjs, observability, dashboard, monitoring]

requires:
  - phase: 07-01
    provides: MemoriaModule wired into ExecucaoModule; execucao.module.ts already modified
  - phase: 06-01
    provides: HumanReviewController, StepExecution entity with status/stepKey fields
  - phase: 04-03
    provides: LlmCall entity (model, provider, latencyMs, costUsd), TokenUsage, Artifact entities

provides:
  - ObservabilityService with 8 raw-SQL methods (latency/cost/error/hitl/conformance/tokens/trace/logs)
  - ObservabilityController: 8 routes — 6 admin-only metrics + trace/:execId + tickets/:complaintId/logs
  - recharts 2.13.3 installed with react-is override for React 19 compat
  - shadcn chart.tsx (ChartContainer, ChartTooltipContent, ChartLegend)
  - /admin/observability dashboard: 6 metric panels in 2-column grid
  - /admin/observability/trace/[execId]: Trace Explorer with steps, LLM calls, artifacts
  - /tickets/[id]/logs: per-ticket audit log chronological table

affects:
  - 07-04 (SensitiveDataInterceptor — does NOT apply to ObservabilityController per SEC-02 analysis)

tech-stack:
  added:
    - recharts 2.13.3
    - shadcn chart component
  patterns:
    - ObservabilityService uses @InjectDataSource() + raw SQL — no QueryBuilder/ORM for analytics
    - All chart components have 'use client' + ChartContainer wrapper
    - Dashboard page uses Promise.all for parallel metric fetching (server component)

key-files:
  created:
    - backend/src/modules/execucao/services/observability.service.ts
    - backend/src/modules/execucao/controllers/observability.controller.ts
    - frontend/src/components/ui/chart.tsx
    - frontend/src/app/admin/observability/page.tsx
    - frontend/src/app/admin/observability/_components/latency-chart.tsx
    - frontend/src/app/admin/observability/_components/cost-chart.tsx
    - frontend/src/app/admin/observability/_components/conformance-chart.tsx
    - frontend/src/app/admin/observability/trace/[execId]/page.tsx
    - frontend/src/app/tickets/[id]/logs/page.tsx
  modified:
    - backend/src/modules/execucao/execucao.module.ts
    - frontend/package.json

key-decisions:
  - "ObservabilityService uses @InjectDataSource() with raw SQL — consistent with plan, performant for analytics aggregations"
  - "getTicketLogs uses UNION pattern: entityType='complaint' OR entityType='ticket_execution' IN subquery — audit_log has no ticketExecutionId FK"
  - "getCostByTicket joins via llm_call.costUsd (not token_usage.estimatedCostUsd which does not exist)"
  - "getTokenTotals aggregates from llm_call (not token_usage) since costUsd column is on llm_call"
  - "recharts installed with --legacy-peer-deps for React 19 compat; react-is override added to package.json"
  - "shadcn chart add --yes succeeded on VPS without TTY fallback needed"

patterns-established:
  - "Raw SQL observability: @InjectDataSource() + dataSource.query() for multi-table aggregations"
  - "Chart client components: 'use client' + ChartContainer + recharts primitives — no SSR crash"
  - "Server component dashboard: Promise.all parallel fetch, pass arrays to client components"

duration: 20min
completed: 2026-03-18
---

# Phase 7 Plan 3: Observability Dashboards Summary

**8-endpoint ObservabilityService (raw SQL) + 6-panel admin dashboard + Trace Explorer + per-ticket audit logs — recharts + shadcn chart with React 19 compat**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-18T~start
- **Completed:** 2026-03-18
- **Tasks:** 2
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments
- ObservabilityService with 8 raw-SQL analytics methods covering all OBS-01..OBS-09 requirements
- 6-panel /admin/observability dashboard: latency/cost/conformance charts + error rate table + HITL card + token totals card
- Trace Explorer at /admin/observability/trace/[execId] rendering steps with LLM calls and artifacts
- Per-ticket logs at /tickets/[id]/logs querying audit_log via entityType/entityId pattern
- recharts 2.13.3 installed on VPS; shadcn chart.tsx added; all chart components have 'use client'

## Task Commits

1. **Task 1: ObservabilityService + ObservabilityController (backend)** - `b5bf37d` (feat)
2. **Task 2: recharts + dashboard page + trace page + ticket logs page (frontend)** - `8122cfe` (feat)

## Files Created/Modified

- `backend/src/modules/execucao/services/observability.service.ts` — 8 raw-SQL methods: getLatencyByStep, getCostByTicket, getErrorRateBySkill, getHitlRate, getConformanceByTipologia, getTokenTotals, getExecutionTrace, getTicketLogs
- `backend/src/modules/execucao/controllers/observability.controller.ts` — 8 routes with @Roles(ADMIN) on dashboard endpoints, all 3 roles on ticket logs
- `backend/src/modules/execucao/execucao.module.ts` — ObservabilityController + ObservabilityService registered
- `frontend/src/components/ui/chart.tsx` — shadcn ChartContainer, ChartTooltip, ChartLegend wrapper
- `frontend/src/app/admin/observability/page.tsx` — server component, Promise.all 6 fetches, 2-col grid
- `frontend/src/app/admin/observability/_components/latency-chart.tsx` — 'use client' BarChart
- `frontend/src/app/admin/observability/_components/cost-chart.tsx` — 'use client' BarChart
- `frontend/src/app/admin/observability/_components/conformance-chart.tsx` — 'use client' BarChart
- `frontend/src/app/admin/observability/trace/[execId]/page.tsx` — step trace with LLM calls + artifacts
- `frontend/src/app/tickets/[id]/logs/page.tsx` — audit log chronological table with back-link
- `frontend/package.json` — recharts added, react-is override added

## Decisions Made

- **getTicketLogs UNION approach:** audit_log has no ticketExecutionId FK — uses entityType/entityId pattern. Query: `WHERE (entityType='complaint' AND entityId=$1) OR (entityType='ticket_execution' AND entityId IN (SELECT id FROM ticket_execution WHERE complaintId=$1))`
- **Cost aggregation from llm_call:** plan SQL used `token_usage.estimatedCostUsd` but token_usage has no such column and no stepExecutionId. Cost is `llm_call.costUsd`. getCostByTicket and getTokenTotals both aggregate from llm_call.
- **stepKey not skillKey:** step_execution entity/migration uses `stepKey` column; plan SQL used `skillKey`. All observability queries corrected.
- **recharts --legacy-peer-deps:** React 19.2.3 peer dep conflict resolved with --legacy-peer-deps flag + react-is override.
- **shadcn chart --yes on VPS:** succeeded without TTY fallback needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stepKey vs skillKey column name**
- **Found during:** Task 1 (ObservabilityService)
- **Issue:** Plan SQL used `"skillKey"` but step_execution entity and migration use `"stepKey"` — would cause SQL error at runtime
- **Fix:** All observability SQL queries changed to `"stepKey"` and column alias `step_key`
- **Files modified:** observability.service.ts
- **Committed in:** b5bf37d (Task 1 commit)

**2. [Rule 1 - Bug] token_usage has no estimatedCostUsd or stepExecutionId**
- **Found during:** Task 1 (getCostByTicket and getTokenTotals)
- **Issue:** Plan SQL joined `token_usage tu ON tu."stepExecutionId" = se.id` and used `tu."estimatedCostUsd"` — neither column exists in token_usage (actual schema: costUsd on llm_call, no stepExecutionId on token_usage)
- **Fix:** getCostByTicket joins via `llm_call lc ON lc."stepExecutionId" = se.id` using `lc."costUsd"`; getTokenTotals aggregates from llm_call directly
- **Files modified:** observability.service.ts
- **Committed in:** b5bf37d (Task 1 commit)

**3. [Rule 1 - Bug] audit_log has no ticketExecutionId FK**
- **Found during:** Task 1 (getTicketLogs)
- **Issue:** Plan SQL did `INNER JOIN ticket_execution te ON al."ticketExecutionId" = te.id` — audit_log uses entityType/entityId pattern, no FK to ticket_execution
- **Fix:** Query uses UNION: entityType='complaint' + entityType='ticket_execution' IN subquery
- **Files modified:** observability.service.ts
- **Committed in:** b5bf37d (Task 1 commit)

**4. [Rule 1 - Bug] TypeScript type mismatch for ConformanceItem.evaluated_count**
- **Found during:** Task 2 (frontend build)
- **Issue:** ConformanceChart expected `evaluated_count: number` but SQL returns strings; page.tsx type had `string`
- **Fix:** Changed chart component interface to `evaluated_count: number | string`; similar fix for LatencyDataItem and CostDataItem
- **Files modified:** conformance-chart.tsx, latency-chart.tsx, cost-chart.tsx
- **Committed in:** 8122cfe (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs)
**Impact on plan:** All fixes required for correct SQL execution and TypeScript compilation. No scope creep.

## Issues Encountered

- VPS path discovery: initial rsync to `/opt/bko-agent/` failed — actual VPS project is at `/root/EngDB/BKOAgent/`. Resolved by finding nest-cli.json on VPS.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ObservabilityController + ObservabilityService live in backend; 8 routes verified to build clean
- recharts + shadcn chart installed; 3 chart components with 'use client' confirmed
- 07-04 (SensitiveDataInterceptor) can proceed: ObservabilityController confirmed SEC-02 compliant (no raw text columns), does NOT need interceptor
- Phase 07 progress: 3/4 plans done

---
*Phase: 07-polish-and-compliance*
*Completed: 2026-03-18*
