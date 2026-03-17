---
phase: 01-foundation
plan: 03
subsystem: database
tags: [typeorm, postgresql, nestjs, seeds, faker, typeorm-extension, regulatorio, orquestracao]

# Dependency graph
requires:
  - phase: 01-02
    provides: 31 TypeORM entities across 5 domains, 32 PostgreSQL tables, FK constraints, pgvector columns
provides:
  - Regulatory reference data seeded: 4 tipologias, 8 subtipologias, 5 situations, 4 regulatory actions
  - 10 regulatory rules from Manual Anatel (SLA, mandatory_field, action_condition, blocking types)
  - 4 IQI response templates with placeholder structure (one per tipology)
  - 6 mandatory info rules (numero_protocolo, cpf_reclamante, nome_reclamante, descricao_fato, providencia_adotada, data_resolucao)
  - 19 skill definitions with full input/output JSON schemas
  - 20 mock complaints distributed across 4 tipologias with subtipology/situation relations
  - 82 complaint_detail records using faker pt_BR (names, CPF, phone, email, plano, UF, tipology-specific fields)
  - 34 complaint_history records (created + classified actions)
  - Idempotent seeder infrastructure (run.ts + main.seeder.ts orchestrating sub-seeders in order)
affects:
  - 02-01 and all Phase 2 plans (complaint queue UI needs tipology, situation, complaint data)
  - 04-01 (AI skill execution maps to skill_definition catalog)
  - All phases — 20 mock complaints provide development/test data for UI, API, and logic testing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency via upsert (conflictPaths by unique key) for reference tables with natural keys"
    - "Idempotency via count check (skip if >= N exists) for bulk generated data (complaint mock)"
    - "Raw SQL DELETE (dataSource.query) instead of repo.delete({}) for table truncation — TypeORM rejects empty criteria"
    - "Seeder signature must match interface: run(dataSource, factoryManager) with factoryManager param even if unused"
    - "data-source.ts seeds glob should point to main.seeder.js only, not *.js (avoids run.js being treated as seeder)"

key-files:
  created:
    - "backend/src/database/seeds/run.ts"
    - "backend/src/database/seeds/main.seeder.ts"
    - "backend/src/database/seeds/regulatorio.seeder.ts"
    - "backend/src/database/seeds/orquestracao.seeder.ts"
    - "backend/src/database/seeds/complaint-mock.seeder.ts"
    - "backend/src/database/factories/complaint.factory.ts"
  modified:
    - "backend/src/database/data-source.ts (seeds glob narrowed to main.seeder.js)"

key-decisions:
  - "data-source.ts seeds points to dist/database/seeds/main.seeder.js not *.js to prevent run.js being executed as a seeder class"
  - "Idempotent truncate via dataSource.query('DELETE FROM table') not repo.delete({}) — TypeORM 0.3.x rejects empty criteria"
  - "Seeder interface requires (dataSource, factoryManager) signature — unused factoryManager named _factoryManager to satisfy TypeScript"
  - "ComplaintMockSeeder uses count check (>= 20) not upsert because protocol numbers are generated at runtime and not deterministic"
  - "All mock complaint dates set to 2024, so all are overdue as of 2026 — this satisfies 'some complaints overdue > 0' correctly"

patterns-established:
  - "Pattern: typeorm-extension Seeder.run() always takes (dataSource: DataSource, _factoryManager: SeederFactoryManager) for interface compliance"
  - "Pattern: data-source.ts seeds glob = specific main.seeder.js path, not wildcard, prevents script files from being treated as seeders"
  - "Pattern: idempotent reference data via upsert (unique key conflict), bulk mock data via existence count check before insert"

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 1 Plan 03: Seed Data Summary

**Regulatory reference data and 20 mock complaints seeded via idempotent typeorm-extension seeders: 4 tipologias, 5 situations, 4 actions, 10 rules, 19 skills, 82 complaint details, all queryable via SQL and NestJS /api/health**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T19:17:09Z
- **Completed:** 2026-03-17T19:25:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Regulatory reference tables fully populated: 4 tipologias, 8 subtipologias, 5 situations, 4 regulatory actions, 10 rules, 4 response templates, 6 mandatory info rules — all idempotent via upsert
- 19 skill definitions seeded with complete JSON input/output schemas for all skills in the 19-skill catalog
- 20 mock complaints created with faker pt_BR data distributed as 6 cobranca, 5 cancelamento, 5 portabilidade, 4 qualidade, with subtipology and situation relations
- 82 complaint_detail records (3-5 per complaint) and 34 complaint_history records verified
- Idempotency confirmed: second seed run produces same row counts, complaints skip if already >= 20
- All Phase 1 success criteria satisfied: pgvector extension, 32 tables, seed data queryable, 20 mock complaints, /api/health returns {"status":"ok","db":true}

## Task Commits

Each task was committed atomically:

1. **Task 1: Create regulatory seed data, orquestracao seeder, and seeder infrastructure** - `c442c51` (feat)
2. **Task 2: Create complaint factory and mock data seeder** - `3f3e372` (feat)

**Plan metadata:** pending (docs commit after SUMMARY + STATE)

## Files Created/Modified

- `backend/src/database/seeds/run.ts` - Entry point: AppDataSource.initialize, runSeeders, destroy
- `backend/src/database/seeds/main.seeder.ts` - Orchestrator calling RegulatorioSeeder, OrquestracaoSeeder, ComplaintMockSeeder in dependency order
- `backend/src/database/seeds/regulatorio.seeder.ts` - Tipologias, subtipologias, situations, regulatory actions, rules, response templates, mandatory info rules via upsert
- `backend/src/database/seeds/orquestracao.seeder.ts` - 19 skill definitions with full I/O JSON schemas via upsert
- `backend/src/database/seeds/complaint-mock.seeder.ts` - 20 mock complaints with faker pt_BR details and history records, idempotent count check
- `backend/src/database/factories/complaint.factory.ts` - Complaint data builder: protocol numbers, rawText per tipology, SLA deadline calculation, risk/status randomization
- `backend/src/database/data-source.ts` - seeds glob narrowed to main.seeder.js

## Decisions Made

1. **seeds glob narrowed to main.seeder.js** — Original `*.js` glob caused `run.js` to be attempted as a Seeder class, throwing errors. Changed to `dist/database/seeds/main.seeder.js` to precisely target only the orchestrating seeder.

2. **Idempotent truncate via raw SQL** — TypeORM 0.3.x rejects `repository.delete({})` with "Empty criteria not allowed". Used `dataSource.query('DELETE FROM table')` for response_template and mandatory_info_rule tables which lack natural unique keys.

3. **Seeder interface requires factoryManager parameter** — typeorm-extension 3.x Seeder interface declares `run(dataSource, factoryManager)`. Sub-seeders that don't use it declare `_factoryManager: SeederFactoryManager` to satisfy TypeScript without lint errors.

4. **ComplaintMockSeeder uses count-based idempotency** — Protocol numbers (`ANATEL-2024-NNNNNN`) are generated at runtime with a sequential counter, so re-running would create duplicates if not guarded. Count check (>= 20 skips) is simpler and more robust than a partial-upsert strategy.

5. **Mock complaint dates set to 2024** — All mock complaints use faker.date.between 2024-01-01/2024-12-31 for realistic historical data. As of 2026-03-17, all SLA deadlines are past due, so all 20 complaints show `isOverdue = true`. This satisfies the "some complaints overdue > 0" criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript signature mismatch on Seeder.run() method**
- **Found during:** Task 1 build
- **Issue:** Sub-seeders declared `run(dataSource: DataSource)` but the Seeder interface requires `run(dataSource: DataSource, factoryManager: SeederFactoryManager)`. TypeScript compiler error TS2554.
- **Fix:** Added `_factoryManager: SeederFactoryManager` parameter to all three sub-seeder `run()` methods
- **Files modified:** regulatorio.seeder.ts, orquestracao.seeder.ts, complaint-mock.seeder.ts
- **Committed in:** c442c51 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeORM empty criteria rejection on DELETE**
- **Found during:** Task 1 runtime (first seed execution)
- **Issue:** `repository.delete({})` throws "Empty criteria(s) are not allowed for the delete method" in TypeORM 0.3.x
- **Fix:** Replaced with `dataSource.query('DELETE FROM response_template')` and `dataSource.query('DELETE FROM mandatory_info_rule')` raw SQL
- **Files modified:** regulatorio.seeder.ts
- **Committed in:** c442c51 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed data-source.ts seeds glob collision**
- **Found during:** Task 1 analysis (pre-emptive)
- **Issue:** Original `seeds: ['dist/database/seeds/*.js']` would cause `run.js` to be treated as a Seeder class, failing at runtime
- **Fix:** Changed seeds glob to point only to `dist/database/seeds/main.seeder.js`
- **Files modified:** backend/src/database/data-source.ts
- **Committed in:** c442c51 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All three bugs were blocking or would cause runtime failures. No scope creep.

## Issues Encountered

None beyond the three auto-fixed TypeScript/runtime bugs. All seed data inserted on first run. Idempotency verified by running seeder twice with identical final row counts.

## User Setup Required

None - seeders run against the existing Docker PostgreSQL container. No external service configuration required.

## Next Phase Readiness

- All regulatory reference data queryable: tipology, situation, regulatory_action, regulatory_rule, skill_definition
- 20 mock complaints with tipology/situation/subtipology relations ready for Phase 2 queue UI
- 82 complaint_detail records provide field-level data for complaint detail views
- `npm run seed` is idempotent and safe to re-run at any time
- All Phase 1 success criteria verified and satisfied — Phase 2 can start

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
