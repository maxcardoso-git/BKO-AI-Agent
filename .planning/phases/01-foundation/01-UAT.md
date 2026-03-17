---
status: testing
phase: 01-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-03-17T20:00:00Z
updated: 2026-03-17T20:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 3
name: Frontend boots successfully
expected: |
  Running the Next.js frontend (port 3000), it builds with Turbopack and serves the default page at `http://localhost:3000` without errors.
awaiting: user response

## Tests

### 1. Docker Compose starts all services
expected: Running `docker compose up -d` starts PostgreSQL (pgvector:pg17 on port 5433) and Redis 7. Both containers show as healthy/running in `docker compose ps`.
result: pass

### 2. Backend boots and health check passes
expected: Running the NestJS backend (port 3001), then `curl http://localhost:3001/api/health` returns `{"status":"ok","db":true}` confirming live DB connection.
result: pass

### 3. Frontend boots successfully
expected: Running the Next.js frontend (port 3000), it builds with Turbopack and serves the default page at `http://localhost:3000` without errors.
result: [pending]

### 4. Database has all 32 tables across 5 domains
expected: Connecting to PostgreSQL on port 5433 and running `\dt` (or equivalent) shows 32 tables: 4 operacao, 8 regulatorio, 6 orquestracao, 7 execucao, 6 memoria, plus the migrations table.
result: [pending]

### 5. Regulatory reference data is queryable
expected: SQL queries against tipology, situation, regulatory_action, and skill_definition return data: 4 tipologias, 5 situations, 4 regulatory actions, 19 skill definitions.
result: [pending]

### 6. Mock complaints are seeded and queryable
expected: `SELECT count(*) FROM complaint` returns 20. Complaints are distributed across 4 tipologias with subtipology and situation relations. `SELECT count(*) FROM complaint_detail` returns ~82 records.
result: [pending]

### 7. Seeder is idempotent
expected: Running `npm run seed` a second time completes without errors and produces the same row counts (no duplicates created).
result: [pending]

## Summary

total: 7
passed: 2
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
