# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Cada reclamacao tratada com conformidade regulatoria, artefatos rastreaveis, HITL obrigatorio, sem perder prazo
**Current focus:** Phase 3 — Processing Pipeline

## Current Position

Phase: 2 of 7 (Access Layer) — COMPLETE (incl. gap closure)
Plan: 4 of 4 in phase 02 (all complete, incl. 02-04 gap closure)
Status: Phase 2 fully closed — 02-01, 02-02, 02-03, 02-04 done
Last activity: 2026-03-17 — Completed 02-04-PLAN.md (gap closure: Edge middleware fix + tipologia filter)

Progress: [██████░░░░] 30% (7/22 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 10.3 min
- Total execution time: 0.69 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 DONE | 29 min | 9.7 min |
| 02-access-layer | 4/4 DONE | ~61 min | ~15 min |

**Recent Trend:**
- Last 5 plans: 10 min, 8 min, 14 min, 45 min, 2 min
- Trend: Gap closure plans are very fast (~2 min). UI plans take longer (~45 min).

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Arquitetura completa (nao MVP) — provar viabilidade da plataforma inteira na PoC
- Init: NestJS + Next.js + PostgreSQL + pgvector — stack conforme documento de arquitetura
- Init: LLM provider-agnostic com pagina de cadastro por funcionalidade
- 01-01: TypeORM synchronize:false from day one — auto-sync drops vector columns
- 01-01: Docker postgres on port 5433 (local postgres conflict on 5432)
- 01-01: pgvector type registration via PgvectorBootstrapService pool hook (pgvector 0.2.x API)
- 01-01: Migration class names must include JS timestamp suffix (TypeORM 0.3.x requirement)
- 01-01: Extensions enabled in both init.sql (first container) and migration (all DBs)
- 01-02: FK constraints complaint->regulatorio added via ALTER TABLE in migration 002 (dependency order)
- 01-02: Status columns as VARCHAR in SQL, TypeScript enums at app layer (avoids ALTER TYPE migrations)
- 01-02: audit_log has no updatedAt — append-only immutability enforced at schema level
- 01-02: token_usage as separate OneToOne entity with DECIMAL(10,6) for precision cost tracking
- 01-02: pgvector(1536) on exactly 3 entities: kb_chunk, case_memory, human_feedback_memory
- 01-03: data-source.ts seeds glob must point to main.seeder.js specifically — *.js causes run.js to be treated as seeder class
- 01-03: TypeORM 0.3.x rejects repo.delete({}) with empty criteria — use dataSource.query('DELETE FROM table') for full truncation
- 01-03: typeorm-extension Seeder.run() requires (dataSource, factoryManager) signature even if factoryManager unused
- 01-03: Complaint mock seeder uses count-based idempotency (skip if >= 20) since protocol numbers are runtime-generated
- 02-01: APP_GUARD pattern for global guards — all endpoints auto-protected, @Public() to opt out
- 02-01: JwtStrategy fetches full User from DB on each request — ensures live isActive check (not stale from token)
- 02-01: UserSeeder runs first in MainSeeder sequence for FK readiness in future plans
- 02-02: Global ValidationPipe with transform:true in main.ts — enables @Type(() => Number) coercion on query params
- 02-02: isOverdue query param accepted as string 'true'/'false', parsed to boolean in service (HTTP query params are always strings)
- 02-02: sortBy guarded with allowedSortFields whitelist before interpolation into QueryBuilder.orderBy() — SQL injection prevention
- 02-02: Artifact.complaintId direct FK — artifact queries by complaint don't need join chain through stepExecution
- 02-03: jose used for session encryption (HS256) — works on both Edge (middleware) and Node.js (server components)
- 02-03: Session cookie stores encrypted backend JWT — browser never sees raw access_token
- 02-03: cookies() is async in Next.js 15+ — all session/DAL code must use await cookies()
- 02-03: redirect() throws NEXT_REDIRECT internally — must be called outside try/catch in server actions
- 02-03: useActionState from 'react' (React 19), not from 'react-dom' — useFormState is deprecated
- 02-03: Filter state in URL searchParams, not useState — server-rendered, shareable, no hydration mismatches
- 02-04: Next.js 16.x flipped middleware/proxy convention — middleware.ts emits deprecation warning but IS registered in middleware-manifest.json
- 02-04: Edge middleware must use request.cookies.get() not next/headers cookies() — cookies() is Node.js only
- 02-04: TipologyController auto-protected by global JwtAuthGuard (APP_GUARD) — no @Public() needed

### Pending Todos

None.

### Blockers/Concerns

- **pgvector 0.2.x API change:** The `pgvector/typeorm` subpath no longer exists. Use `pgvector/pg` with pool hook. Pattern established in `PgvectorBootstrapService`.
- **Local postgres on 5432:** Docker postgres mapped to 5433. `.env.example` documents this. All future plans should use port 5433 for local dev.
- **Phase 1 complete:** All 3 foundation plans done. Database has 32 tables, seed data, 20 mock complaints. Ready for Phase 2 backend API work.
- **Auth operational (02-01 done):** JWT guard global, RBAC via @Roles, 3 test users seeded (operator/supervisor/admin). All subsequent endpoints auto-protected.
- **Complaint API operational (02-02 done):** GET /api/complaints (paginated, 7 filters), GET /api/complaints/:id (full relations), /executions, /artifacts, /logs sub-resources all live. Frontend can integrate immediately.
- **Phase 2 complete (02-03 done):** Next.js frontend with login, session management (jose HS256 cookie), complaint queue with URL-driven filters, ticket detail with all sections. AUTH-01..03 and TICK-01,02,04,05,06 satisfied. Ready for Phase 3 processing pipeline.
- **Phase 2 gap closure complete (02-04 done):** Edge middleware registered, GET /api/tipologies endpoint live, tipologia filter end-to-end in /tickets. All 3 verified gaps closed.

## Session Continuity

Last session: 2026-03-17
Stopped at: Completed 02-04-PLAN.md — gap closure: Edge middleware (middleware.ts), GET /api/tipologies, tipologia filter
Resume file: None
