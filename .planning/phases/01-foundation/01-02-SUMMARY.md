---
phase: 01-foundation
plan: 02
subsystem: database
tags: [typeorm, postgresql, pgvector, nestjs, migrations, uuid, jsonb, entities]

# Dependency graph
requires:
  - phase: 01-01
    provides: NestJS TypeORM config (synchronize:false, migrationsRun:true), Docker pgvector:pg17, PgvectorBootstrapService, 5 domain module placeholders
provides:
  - 31 TypeORM entity files across 5 domain modules (operacao, regulatorio, orquestracao, execucao, memoria)
  - 5 domain-scoped migration files creating all 31 tables in dependency order
  - 32 tables in PostgreSQL (31 domain + migrations table) with 38 foreign key constraints
  - pgvector(1536) columns on kb_chunk, case_memory, human_feedback_memory
  - All 5 domain modules export TypeOrmModule for cross-module repository injection
affects:
  - 01-03 (seed data — inserts into tipology, situation, regulatory_action, skill_definition)
  - 02-01 and beyond — all subsequent plans depend on this stable schema

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain-scoped migrations (one per domain, numbered 001-005) for granular rollback control"
    - "FK constraint strategy: CASCADE for owned-by relations, SET NULL for optional references, RESTRICT for critical joins"
    - "Status fields as VARCHAR (not enum) in SQL for migration flexibility; TypeScript enums on entity side"
    - "Audit-log table without updatedAt column — append-only immutability pattern"
    - "pgvector(1536) column on 3 memoria entities (kb_chunk, case_memory, human_feedback_memory)"

key-files:
  created:
    - "backend/src/modules/operacao/entities/complaint.entity.ts"
    - "backend/src/modules/operacao/entities/complaint-detail.entity.ts"
    - "backend/src/modules/operacao/entities/complaint-history.entity.ts"
    - "backend/src/modules/operacao/entities/complaint-attachment.entity.ts"
    - "backend/src/modules/regulatorio/entities/tipology.entity.ts"
    - "backend/src/modules/regulatorio/entities/subtipology.entity.ts"
    - "backend/src/modules/regulatorio/entities/situation.entity.ts"
    - "backend/src/modules/regulatorio/entities/regulatory-rule.entity.ts"
    - "backend/src/modules/regulatorio/entities/regulatory-action.entity.ts"
    - "backend/src/modules/regulatorio/entities/persona.entity.ts"
    - "backend/src/modules/regulatorio/entities/response-template.entity.ts"
    - "backend/src/modules/regulatorio/entities/mandatory-info-rule.entity.ts"
    - "backend/src/modules/orquestracao/entities/capability.entity.ts"
    - "backend/src/modules/orquestracao/entities/capability-version.entity.ts"
    - "backend/src/modules/orquestracao/entities/step-definition.entity.ts"
    - "backend/src/modules/orquestracao/entities/step-transition-rule.entity.ts"
    - "backend/src/modules/orquestracao/entities/skill-definition.entity.ts"
    - "backend/src/modules/orquestracao/entities/step-skill-binding.entity.ts"
    - "backend/src/modules/execucao/entities/ticket-execution.entity.ts"
    - "backend/src/modules/execucao/entities/step-execution.entity.ts"
    - "backend/src/modules/execucao/entities/artifact.entity.ts"
    - "backend/src/modules/execucao/entities/llm-call.entity.ts"
    - "backend/src/modules/execucao/entities/token-usage.entity.ts"
    - "backend/src/modules/execucao/entities/human-review.entity.ts"
    - "backend/src/modules/execucao/entities/audit-log.entity.ts"
    - "backend/src/modules/memoria/entities/kb-document.entity.ts"
    - "backend/src/modules/memoria/entities/kb-document-version.entity.ts"
    - "backend/src/modules/memoria/entities/kb-chunk.entity.ts"
    - "backend/src/modules/memoria/entities/case-memory.entity.ts"
    - "backend/src/modules/memoria/entities/human-feedback-memory.entity.ts"
    - "backend/src/modules/memoria/entities/style-memory.entity.ts"
    - "backend/src/database/migrations/1773774001000-CreateOperacaoTables.ts"
    - "backend/src/database/migrations/1773774002000-CreateRegulatorioTables.ts"
    - "backend/src/database/migrations/1773774003000-CreateOrquestracaoTables.ts"
    - "backend/src/database/migrations/1773774004000-CreateExecucaoTables.ts"
    - "backend/src/database/migrations/1773774005000-CreateMemoriaTables.ts"
  modified:
    - "backend/src/modules/operacao/operacao.module.ts (TypeOrmModule.forFeature + exports)"
    - "backend/src/modules/regulatorio/regulatorio.module.ts (TypeOrmModule.forFeature + exports)"
    - "backend/src/modules/orquestracao/orquestracao.module.ts (TypeOrmModule.forFeature + exports)"
    - "backend/src/modules/execucao/execucao.module.ts (TypeOrmModule.forFeature + exports)"
    - "backend/src/modules/memoria/memoria.module.ts (TypeOrmModule.forFeature + exports)"

key-decisions:
  - "FK constraints added via ALTER TABLE in migration 002, not in migration 001, because regulatorio tables must exist first"
  - "Status/enum columns stored as VARCHAR in SQL migrations for future flexibility; TypeScript enum types on entity side"
  - "audit_log has no updatedAt — immutable append-only record"
  - "token_usage is separate entity (OneToOne with llm_call) for normalized cost tracking per call"
  - "vector columns on only 3 entities: kb_chunk (RAG), case_memory (similar case search), human_feedback_memory (correction pattern matching)"

patterns-established:
  - "Pattern: domain FK columns exposed as both relation property and FK UUID column for efficient queries"
  - "Pattern: domain migrations numbered 001-005 in dependency order (operacao first, then regulatorio that refs it, etc.)"
  - "Pattern: TypeORM entity status enums use TypeScript enum at app layer; VARCHAR at SQL layer for flexibility"

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 1 Plan 02: Domain Schema Summary

**31 TypeORM entities across 5 NestJS domain modules with domain-scoped SQL migrations creating 32 PostgreSQL tables, 38 FKs, and pgvector(1536) columns on 3 memoria entities**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T19:04:26Z
- **Completed:** 2026-03-17T19:14:34Z
- **Tasks:** 2
- **Files modified:** 41

## Accomplishments
- 31 TypeORM entity files created across 5 domain modules — all compile without errors
- 5 domain-scoped SQL migrations run in order, creating all tables with correct columns, types, constraints, and indexes
- PostgreSQL has 32 tables (31 domain + 1 migrations tracking), 38 foreign key constraints — all domains fully connected
- pgvector(1536) columns on kb_chunk, case_memory, human_feedback_memory confirmed as USER-DEFINED type
- All 5 domain modules export TypeOrmModule — downstream modules can inject repositories without EntityMetadataNotFoundError
- Backend boots and /api/health returns {"status":"ok","db":true} with no migrations to run (all already applied)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all 31 entity definitions across 5 domain modules** - `a70335d` (feat)
2. **Task 2: Generate and run TypeORM migrations to create all tables** - `4d95fa7` (feat)

## Files Created/Modified

**Entities (31 files created):**
- `backend/src/modules/operacao/entities/complaint.entity.ts` - Main complaint record with status, risk, SLA, and 4 nullable FK relations to regulatorio
- `backend/src/modules/operacao/entities/complaint-detail.entity.ts` - Structured extracted fields per complaint
- `backend/src/modules/operacao/entities/complaint-history.entity.ts` - Append-only status change log
- `backend/src/modules/operacao/entities/complaint-attachment.entity.ts` - File attachment metadata
- `backend/src/modules/regulatorio/entities/tipology.entity.ts` - 4 main tipologias with SLA defaults
- `backend/src/modules/regulatorio/entities/subtipology.entity.ts` - Subtipologias linked to tipology
- `backend/src/modules/regulatorio/entities/situation.entity.ts` - Regulatory situations with SLA override
- `backend/src/modules/regulatorio/entities/regulatory-rule.entity.ts` - Anatel rules with typed enum
- `backend/src/modules/regulatorio/entities/regulatory-action.entity.ts` - Available response actions
- `backend/src/modules/regulatorio/entities/persona.entity.ts` - Response tone personas with expression arrays
- `backend/src/modules/regulatorio/entities/response-template.entity.ts` - IQI template content per tipology/situation
- `backend/src/modules/regulatorio/entities/mandatory-info-rule.entity.ts` - Required field rules per case type
- `backend/src/modules/orquestracao/entities/capability.entity.ts` - Versioned processing flow
- `backend/src/modules/orquestracao/entities/capability-version.entity.ts` - Version with isCurrent flag
- `backend/src/modules/orquestracao/entities/step-definition.entity.ts` - Step with isHumanRequired HITL flag
- `backend/src/modules/orquestracao/entities/step-transition-rule.entity.ts` - Conditional JSONB transitions
- `backend/src/modules/orquestracao/entities/skill-definition.entity.ts` - Skill catalog with I/O schemas
- `backend/src/modules/orquestracao/entities/step-skill-binding.entity.ts` - Step-to-skill mapping with LLM override
- `backend/src/modules/execucao/entities/ticket-execution.entity.ts` - Complaint execution instance
- `backend/src/modules/execucao/entities/step-execution.entity.ts` - Per-step execution record
- `backend/src/modules/execucao/entities/artifact.entity.ts` - Typed JSONB artifacts per step
- `backend/src/modules/execucao/entities/llm-call.entity.ts` - LLM API call with cost tracking
- `backend/src/modules/execucao/entities/token-usage.entity.ts` - Normalized token/cost record
- `backend/src/modules/execucao/entities/human-review.entity.ts` - HITL review with diff and checklist
- `backend/src/modules/execucao/entities/audit-log.entity.ts` - Append-only audit trail (no updatedAt)
- `backend/src/modules/memoria/entities/kb-document.entity.ts` - Knowledge base document
- `backend/src/modules/memoria/entities/kb-document-version.entity.ts` - Document version with chunk count
- `backend/src/modules/memoria/entities/kb-chunk.entity.ts` - Text chunk with vector(1536) embedding
- `backend/src/modules/memoria/entities/case-memory.entity.ts` - Past case with vector(1536) for similarity
- `backend/src/modules/memoria/entities/human-feedback-memory.entity.ts` - Correction pattern with vector(1536)
- `backend/src/modules/memoria/entities/style-memory.entity.ts` - Approved/forbidden expression registry

**Domain modules (5 files updated):**
- Each updated to `TypeOrmModule.forFeature([...entities])` and `exports: [TypeOrmModule]`

**Migrations (5 files created):**
- `backend/src/database/migrations/1773774001000-CreateOperacaoTables.ts` - 4 complaint tables
- `backend/src/database/migrations/1773774002000-CreateRegulatorioTables.ts` - 8 regulatorio tables + complaint FKs
- `backend/src/database/migrations/1773774003000-CreateOrquestracaoTables.ts` - 6 orquestracao tables
- `backend/src/database/migrations/1773774004000-CreateExecucaoTables.ts` - 7 execucao tables
- `backend/src/database/migrations/1773774005000-CreateMemoriaTables.ts` - 6 memoria tables with vector columns

## Decisions Made

1. **FK constraints from complaint to regulatorio tables added in migration 002** — Complaint table is created in migration 001 (without FKs), then FK constraints are added via ALTER TABLE in migration 002 once tipology, subtipology, situation, and regulatory_action tables exist. Required by dependency order.

2. **Status columns as VARCHAR in SQL, TypeScript enums at app layer** — Migration SQL uses VARCHAR for status/ruleType/expressionType columns. TypeScript enums define valid values on the entity side. This avoids ALTER TYPE migrations when adding enum values in the future.

3. **audit_log without updatedAt** — Audit records are append-only by design. No updatedAt column enforces immutability at the schema level.

4. **token_usage as separate OneToOne entity** — Normalized cost data from llm_call into its own table with DECIMAL(10,6) for precision. LlmCall.tokenUsageId FK with SET NULL allows cost data to be archived independently.

5. **pgvector columns on exactly 3 entities** — Only kb_chunk (RAG lookups), case_memory (similar past case retrieval), and human_feedback_memory (correction pattern search) need vector columns. style_memory uses simple text matching, not vector search.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All entities compiled on first attempt. All 5 migrations ran successfully in sequence without errors. pgvector(1536) columns created without issues (extensions already enabled by migration 000 from Plan 01).

## User Setup Required

None - no external service configuration required. Tables created in the existing Docker PostgreSQL container.

## Next Phase Readiness

- All 31 tables exist in PostgreSQL at localhost:5433 — Plan 03 seeders can immediately insert reference data
- tipology, situation, regulatory_action, skill_definition tables are empty and ready for seed data
- TypeOrmModule.forFeature entities exported from all domain modules — Phase 2 services can inject any repository without circular dependency issues
- pgvector columns exist and are validated — Phase 4 AI layer can insert embeddings directly
- audit_log table exists as append-only store — Phase 2 can begin logging from day one

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
