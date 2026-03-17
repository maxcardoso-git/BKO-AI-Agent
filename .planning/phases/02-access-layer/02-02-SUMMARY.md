---
phase: 02-access-layer
plan: 02
subsystem: api
tags: [nestjs, typeorm, rest-api, pagination, query-builder, jwt, class-validator]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Complaint entity with all relations (tipology, subtipology, situation, regulatoryAction, details, history, attachments), TicketExecution/StepExecution/Artifact/AuditLog entities
  - phase: 02-access-layer plan 01
    provides: Global JWT guard (APP_GUARD pattern), @Public() decorator, RBAC infrastructure — all new endpoints auto-protected

provides:
  - GET /api/complaints — paginated complaint list with 7 optional filters (status, tipologyId, subtipologyId, situationId, riskLevel, isOverdue, search)
  - GET /api/complaints/:id — complaint detail with full relations (tipology, subtipology, situation, regulatoryAction, details, history, attachments)
  - GET /api/complaints/:complaintId/executions — ticket executions with step executions per complaint
  - GET /api/complaints/:complaintId/artifacts — artifacts per complaint
  - GET /api/complaints/:complaintId/logs — audit logs per complaint (entityType=complaint)
  - Global ValidationPipe with transform:true enabling DTO class-transformer coercion

affects:
  - 03-agent-core (consumes complaint detail to spawn executions)
  - 04-human-in-the-loop (reads execution/artifact endpoints)
  - frontend complaint queue page (consumes paginated list with filters)
  - frontend ticket detail page (consumes findOne with all relations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - QueryBuilder with conditional andWhere for optional filter composition
    - allowedSortFields whitelist to prevent SQL injection via sortBy param
    - isOverdue string-to-boolean coercion in service (query params are always strings)
    - Controller-level @UsePipes(ValidationPipe) alongside global pipe for belt-and-suspenders DTO validation

key-files:
  created:
    - backend/src/modules/operacao/dto/complaint-filter.dto.ts
    - backend/src/modules/operacao/dto/complaint-list-response.dto.ts
    - backend/src/modules/operacao/services/complaint.service.ts
    - backend/src/modules/operacao/controllers/complaint.controller.ts
    - backend/src/modules/execucao/services/execution.service.ts
    - backend/src/modules/execucao/controllers/execution.controller.ts
  modified:
    - backend/src/modules/operacao/operacao.module.ts
    - backend/src/modules/execucao/execucao.module.ts
    - backend/src/main.ts

key-decisions:
  - "Global ValidationPipe added to main.ts with transform:true and whitelist:true — enables @Type(() => Number) coercion on page/limit query params"
  - "isOverdue filter accepts string 'true'/'false' (HTTP query params are always strings) and parses in service"
  - "Artifact entity has direct complaintId FK — findArtifactsByComplaintId queries artifact.complaintId directly, no join chain needed"
  - "sortBy param guarded with allowedSortFields whitelist before interpolating into QueryBuilder orderBy"
  - "ExecutionController uses @Controller('complaints/:complaintId') prefix — routes become /api/complaints/:id/executions etc."

patterns-established:
  - "QueryBuilder conditional filters: call andWhere only when filter value is defined — avoids empty WHERE clauses"
  - "NotFoundException thrown in findOne when getOne() returns null — consistent 404 behavior"
  - "leftJoinAndSelect on all relations in findOne to avoid N+1 queries on ticket detail page"

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 2 Plan 02: Complaint Tickets BFF — Access Layer Summary

**REST endpoints for paginated complaint queue with 7 filters, full ticket detail with all relations, and execution/artifact/audit-log sub-resources — all auto-protected by global JWT guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T21:51:24Z
- **Completed:** 2026-03-17T21:53:24Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Complaint list endpoint with paginated TypeORM QueryBuilder, conditional filters for status/tipology/subtipology/situation/riskLevel/isOverdue/search, sorted and paginated with total count
- Complaint detail endpoint returning full complaint with all 7 relations loaded via leftJoinAndSelect (no N+1)
- Execution sub-resources: three endpoints under /api/complaints/:id/{executions,artifacts,logs} returning empty arrays until Phase 3 populates data

## Task Commits

1. **Task 1: Complaint service and controller with filters and pagination** - `6caaae3` (feat)
2. **Task 2: Execution logs and artifacts endpoints** - `a2dfc28` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `backend/src/modules/operacao/dto/complaint-filter.dto.ts` - Query params DTO with class-validator, @Type coercion for page/limit
- `backend/src/modules/operacao/dto/complaint-list-response.dto.ts` - Response interface with data/total/page/limit/totalPages
- `backend/src/modules/operacao/services/complaint.service.ts` - findAll with QueryBuilder + conditional filters, findOne with full leftJoinAndSelect
- `backend/src/modules/operacao/controllers/complaint.controller.ts` - GET /complaints and GET /complaints/:id
- `backend/src/modules/execucao/services/execution.service.ts` - findByComplaintId, findArtifactsByComplaintId, findAuditLogsByComplaintId
- `backend/src/modules/execucao/controllers/execution.controller.ts` - GET /complaints/:id/executions, /artifacts, /logs
- `backend/src/modules/operacao/operacao.module.ts` - Register ComplaintService + ComplaintController
- `backend/src/modules/execucao/execucao.module.ts` - Register ExecutionService + ExecutionController
- `backend/src/main.ts` - Add global ValidationPipe with transform:true

## Decisions Made

- Global ValidationPipe added to `main.ts` with `transform: true` and `whitelist: true` — enables `@Type(() => Number)` coercion so `page`/`limit` query params arrive as numbers in the DTO
- `isOverdue` accepted as string `'true'`/`'false'` and parsed to boolean in the service, since all HTTP query params are strings
- `Artifact` entity already has a direct `complaintId` FK column — `findArtifactsByComplaintId` queries it directly without a join chain through `stepExecution -> ticketExecution`
- `sortBy` validated against an `allowedSortFields` whitelist before interpolation into `QueryBuilder.orderBy()` to prevent SQL injection
- `ExecutionController` uses `@Controller('complaints/:complaintId')` prefix so routes resolve to `/api/complaints/:id/executions` etc. matching the plan contract

## Deviations from Plan

None — plan executed exactly as written. The Artifact entity's direct `complaintId` FK (discovered during entity review) made `findArtifactsByComplaintId` simpler than the plan's described join chain, but the external API contract is identical.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complaint queue API fully operational — frontend can integrate GET /api/complaints with filters immediately
- Ticket detail API returns full entity graph — frontend ticket detail page has all data it needs
- Execution/artifact/log endpoints exist and return 200 — Phase 3 (agent core) populates them when executions run
- No blockers for Phase 3 (agent-core) or 02-03 (remaining access layer plans)

---
*Phase: 02-access-layer*
*Completed: 2026-03-17*
