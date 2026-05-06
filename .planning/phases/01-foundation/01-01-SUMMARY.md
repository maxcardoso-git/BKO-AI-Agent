---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nestjs, nextjs, typeorm, postgresql, pgvector, redis, docker, typescript, tailwind]

# Dependency graph
requires: []
provides:
  - NestJS 11 backend project with TypeORM configured (synchronize:false, migrationsRun:true)
  - Next.js 16 frontend with TypeScript, Tailwind v4, App Router
  - Docker Compose with pgvector/pgvector:pg17 (port 5433), Redis 7, backend, frontend slots
  - PgvectorBootstrapService registering pgvector types on pg pool connection
  - EnableExtensions migration enabling vector and uuid-ossp extensions
  - 5 domain module placeholders (operacao, regulatorio, orquestracao, execucao, memoria)
  - /api/health endpoint returning {"status":"ok","db":true}
  - TypeORM data-source.ts for CLI migration generation
affects:
  - 01-02 (domain schema — builds entities on top of this TypeORM config)
  - 01-03 (seed data — uses typeorm-extension DataSource from data-source.ts)
  - All future plans — depend on this foundation booting and connecting to DB

# Tech tracking
tech-stack:
  added:
    - "@nestjs/core@11.x + @nestjs/typeorm@11.x + typeorm@0.3.28"
    - "pg@8.x + pgvector@0.2.1"
    - "@nestjs/config@4.x + joi@18.x"
    - "class-validator@0.15.x + class-transformer@0.5.x"
    - "typeorm-extension@3.9.x + @faker-js/faker@10.x"
    - "next@16.1.7 + react@19.x + tailwindcss@4.x"
    - "docker: pgvector/pgvector:pg17 + redis:7-alpine"
  patterns:
    - "TypeORM explicit migrations only (synchronize:false) — never auto-sync"
    - "ConfigModule.forRoot with Joi validation for all env vars at startup"
    - "TypeOrmModule.forRootAsync with ConfigService injection"
    - "PgvectorBootstrapService hooks into pg pool afterConnect for type registration"
    - "Domain modules imported in AppModule with exports: [TypeOrmModule] pattern"

key-files:
  created:
    - "backend/src/database/data-source.ts (TypeORM CLI DataSource)"
    - "backend/src/database/init.sql (CREATE EXTENSION at first container start)"
    - "backend/src/database/migrations/1773773983000-EnableExtensions.ts"
    - "backend/src/database/pgvector-bootstrap.service.ts (pgvector pool hook)"
    - "backend/src/modules/operacao/operacao.module.ts"
    - "backend/src/modules/regulatorio/regulatorio.module.ts"
    - "backend/src/modules/orquestracao/orquestracao.module.ts"
    - "backend/src/modules/execucao/execucao.module.ts"
    - "backend/src/modules/memoria/memoria.module.ts"
    - "docker-compose.yml"
    - "backend/.env.example"
    - "backend/Dockerfile"
    - "frontend/Dockerfile"
  modified:
    - "backend/src/main.ts (global prefix api, port 3001)"
    - "backend/src/app.module.ts (ConfigModule + TypeOrmModule.forRootAsync + domain modules)"
    - "backend/src/app.controller.ts (/api/health endpoint with DataSource injection)"
    - "backend/package.json (migration:run, migration:revert, migration:generate, seed scripts)"

key-decisions:
  - "TypeORM synchronize:false from day one — synchronize:true drops vector columns on restart"
  - "Docker postgres mapped to port 5433 to avoid conflict with local postgres on 5432"
  - "pgvector.registerTypes() via PgvectorBootstrapService pool hook (pgvector 0.2.x API change)"
  - "Migration class names must include JS timestamp suffix (TypeORM 0.3.x requirement)"
  - "Extensions enabled via both init.sql (first container start) and 000-EnableExtensions migration"

patterns-established:
  - "Pattern: All migrations in dist/database/migrations/*.js, built before migration:run"
  - "Pattern: Domain modules export TypeOrmModule so downstream modules can inject repositories"
  - "Pattern: Env vars validated at startup with Joi schema — app fails fast if misconfigured"

# Metrics
duration: 11min
completed: 2026-03-17
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**NestJS 11 + Next.js 16 monorepo with TypeORM (synchronize:false), pgvector/pg17 Docker image on port 5433, Redis 7, /api/health endpoint returning {"status":"ok","db":true}**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-17T18:50:17Z
- **Completed:** 2026-03-17T19:01:36Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- NestJS 11 backend boots, connects to PostgreSQL, and runs the EnableExtensions migration on startup
- `/api/health` responds `{"status":"ok","db":true}` confirming live DB connection
- Next.js 16 frontend builds successfully with Turbopack, TypeScript, and Tailwind v4
- Docker Compose starts pgvector/pgvector:pg17 (with vector and uuid-ossp extensions) + Redis 7 in one command
- 5 domain module placeholders wired into AppModule, ready for entity definitions in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold NestJS backend with TypeORM, pgvector, and Docker Compose** - `445d7b3` (feat)
2. **Task 2: Scaffold Next.js frontend and verify full stack boots** - `0c4a8f9` (feat)

## Files Created/Modified
- `backend/src/database/data-source.ts` - TypeORM DataSource with SeederOptions for CLI and runtime
- `backend/src/database/init.sql` - CREATE EXTENSION vector and uuid-ossp at container init
- `backend/src/database/migrations/1773773983000-EnableExtensions.ts` - Migration to enable extensions
- `backend/src/database/pgvector-bootstrap.service.ts` - Registers pgvector types on pg pool afterConnect
- `backend/src/app.module.ts` - ConfigModule + TypeOrmModule.forRootAsync + 5 domain modules
- `backend/src/main.ts` - Global prefix api, port 3001
- `backend/src/app.controller.ts` - /api/health endpoint with DataSource injection
- `backend/src/modules/*/` - 5 domain module placeholders (operacao, regulatorio, orquestracao, execucao, memoria)
- `docker-compose.yml` - pgvector:pg17 (port 5433), redis:7-alpine, backend (3001), frontend (3000)
- `backend/.env.example` - DB_HOST, DB_PORT=5433, DB_USER, DB_PASS, DB_NAME, EMBEDDING_DIMENSIONS=1536
- `backend/Dockerfile` - node:20-alpine, npm build, node dist/main.js
- `frontend/Dockerfile` - node:20-alpine, npm build, npm start
- `backend/package.json` - migration:run, migration:revert, migration:generate, seed scripts added

## Decisions Made

1. **TypeORM synchronize:false** - Set from day one as per RESEARCH.md pitfall 1. Auto-sync drops vector columns on restart because TypeORM doesn't recognize the custom type.

2. **Docker postgres on port 5433** - Local machine has postgres running on port 5432. Mapped Docker container to 5433 to avoid collision.

3. **pgvector registration via PgvectorBootstrapService** - pgvector 0.2.x removed the `pgvector/typeorm` subpath and synchronous `registerTypes()`. The correct 0.2.x API uses `pgvector/pg` with an async `registerTypes(client)` hooked into the pg pool's connect event.

4. **Migration timestamp naming** - TypeORM 0.3.x requires migration class names to include a JavaScript timestamp suffix. The plan's example `EnableExtensions000` would throw `migration name is wrong` at runtime. Fixed to `EnableExtensions1773773983000`.

5. **Extensions in both init.sql and migration** - Init.sql runs only on first container start (good for dev resets); the migration runs on every fresh DB (good for CI/production). Belt-and-suspenders approach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pgvector 0.2.x does not export `pgvector/typeorm` subpath**
- **Found during:** Task 1 (NestJS backend scaffold)
- **Issue:** `import pgvector from 'pgvector/typeorm'` throws TS2307 - the TypeORM subpath was removed in pgvector 0.2.x. The research doc referenced an older API.
- **Fix:** Created `PgvectorBootstrapService` that uses `pgvector/pg`'s async `registerTypes(client)` hooked into TypeORM's underlying pg pool via `pool.on('connect', ...)`. This is the correct pgvector 0.2.x pattern for TypeORM integration.
- **Files modified:** `backend/src/database/pgvector-bootstrap.service.ts` (created), `backend/src/app.module.ts`, `backend/src/main.ts`
- **Verification:** Build succeeds, backend boots without errors
- **Committed in:** 445d7b3 (Task 1 commit)

**2. [Rule 1 - Bug] TypeORM migration class must include timestamp suffix**
- **Found during:** Task 2 (full stack verification)
- **Issue:** `EnableExtensions000` throws `TypeORMError: migration name is wrong. Migration class name should have a JavaScript timestamp appended.` at runtime.
- **Fix:** Renamed file and class to `EnableExtensions1773773983000` with a valid JS timestamp.
- **Files modified:** `backend/src/database/migrations/1773773983000-EnableExtensions.ts`
- **Verification:** Migration runs successfully at startup, extensions confirmed in pg_extension
- **Committed in:** 0c4a8f9 (Task 2 commit)

**3. [Rule 3 - Blocking] Local postgres conflict on port 5432**
- **Found during:** Task 2 (health endpoint test)
- **Issue:** Dev machine has local postgres running on port 5432. Docker container was shadowed, causing `role "bko" does not exist` errors when NestJS tried to connect.
- **Fix:** Changed Docker port mapping from `5432:5432` to `5433:5432` and updated `.env.example` and `.env` to use `DB_PORT=5433`.
- **Files modified:** `docker-compose.yml`, `backend/.env.example`, `backend/.env`
- **Verification:** `curl /api/health` returns `{"status":"ok","db":true}`
- **Committed in:** 0c4a8f9 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes were necessary for correct operation. No scope creep. The pgvector fix is actually the more robust approach for TypeORM integration per current 0.2.x docs.

## Issues Encountered
- pgvector 0.2.x removed TypeORM-specific subpath export that research doc referenced. Resolved by using the `pgvector/pg` pool hook approach which is the documented 0.2.x method.
- TypeORM strict timestamp requirement for migration class names not mentioned in research. Fixed with proper timestamp naming convention.

## User Setup Required

None - no external service configuration required. Everything runs via Docker Compose locally.

## Next Phase Readiness

- PostgreSQL with pgvector is running and accessible at `localhost:5433`
- TypeORM is configured with `synchronize:false` and `migrationsRun:true` — Plan 02 entities will be applied via migrations
- 5 domain module files exist at `backend/src/modules/` — Plan 02 adds entity files to each
- `data-source.ts` is configured for TypeORM CLI — migration generation will work once entities exist
- `.env.example` documents all required env vars — no blockers for Plan 02

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
