# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Cada reclamacao tratada com conformidade regulatoria, artefatos rastreaveis, HITL obrigatorio, sem perder prazo
**Current focus:** Phase 2 — Backend API

## Current Position

Phase: 1 of 7 (Foundation) — COMPLETE
Plan: 3 of 3 in phase 01 (all plans complete)
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-03-17 — Completed 01-03-PLAN.md (Seed Data — regulatory reference + 20 mock complaints)

Progress: [███░░░░░░░] 14% (3/21 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 9.7 min
- Total execution time: 0.48 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 DONE | 29 min | 9.7 min |

**Recent Trend:**
- Last 5 plans: 11 min, 10 min, 8 min
- Trend: consistent ~9-11 min per plan

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

### Pending Todos

None.

### Blockers/Concerns

- **pgvector 0.2.x API change:** The `pgvector/typeorm` subpath no longer exists. Use `pgvector/pg` with pool hook. Pattern established in `PgvectorBootstrapService`.
- **Local postgres on 5432:** Docker postgres mapped to 5433. `.env.example` documents this. All future plans should use port 5433 for local dev.
- **Phase 1 complete:** All 3 foundation plans done. Database has 32 tables, seed data, 20 mock complaints. Ready for Phase 2 backend API work.

## Session Continuity

Last session: 2026-03-17T19:25:30Z
Stopped at: Completed 01-03-PLAN.md — regulatory reference data, 19 skills, 20 mock complaints with details and history seeded
Resume file: None
