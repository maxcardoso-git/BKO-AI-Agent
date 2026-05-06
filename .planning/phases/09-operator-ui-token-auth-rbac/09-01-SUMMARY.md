---
phase: 09
plan: 01
subsystem: operator-auth-backend
tags: [nestjs, typeorm, jwt, opaque-token, rbac, ticket-lock, complaint-notes, migration]
requires: ["08-03"]
provides: ["access-token-exchange", "ticket-locking", "complaint-user-notes", "by-protocol-search", "rbac-execution-detail"]
affects: ["09-02", "09-03", "09-04"]
tech-stack:
  added: []
  patterns: ["opaque-token-exchange", "delete-insert-unique-lock", "transactional-note-versioning"]
key-files:
  created:
    - backend/src/database/migrations/1773910000000-AddResponsavelFinalToComplaint.ts
    - backend/src/modules/operacao/services/access-token.service.ts
    - backend/src/modules/operacao/services/ticket-lock.service.ts
    - backend/src/modules/operacao/services/complaint-user-note.service.ts
    - backend/src/modules/operacao/controllers/access-token.controller.ts
    - backend/src/modules/operacao/controllers/ticket-lock.controller.ts
    - backend/src/modules/operacao/controllers/complaint-user-note.controller.ts
  modified:
    - backend/src/modules/operacao/entities/complaint.entity.ts
    - backend/src/modules/operacao/operacao.module.ts
    - backend/src/modules/operacao/controllers/admin-users.controller.ts
    - backend/src/modules/operacao/controllers/complaint.controller.ts
    - backend/src/modules/operacao/services/complaint.service.ts
    - backend/src/modules/auth/auth.controller.ts
    - backend/src/modules/auth/auth.module.ts
    - backend/src/modules/execucao/controllers/ticket-execution.controller.ts
decisions:
  - "AccessTokenService registered in both AuthModule (for token-exchange) and OperacaoModule (for admin endpoints + user create hook) — each module has its own TypeOrmModule.forFeature([AccessToken]) to avoid cross-module repo injection"
  - "TicketLockService uses DataSource.transaction() with DELETE+INSERT — never plain save() to avoid UNIQUE constraint violation on complaintId"
  - "ComplaintUserNoteService emits note_saved timing event outside transaction with try/catch — non-fatal, timing event failure does not block note persistence"
  - "GET /api/executions/:execId/steps restricted to SUPERVISOR/ADMIN via @Roles — OPERATOR gets 403 from global RolesGuard"
  - "by-protocol search uses ILIKE with LOWER() cast for robust case-insensitive matching on both protocolNumber and protocoloPrestadora"
metrics:
  duration: "~15 min"
  completed: "2026-05-06"
---

# Phase 9 Plan 01: Backend Token Auth, Lock & Notes Summary

**One-liner:** Opaque-token JWT exchange via crypto.randomBytes(32), DELETE+INSERT ticket locking with 409 conflict, transactional versioning of complaint user notes with note_saved timing event, RBAC guard on execution detail route.

## What Was Built

### Task 1: responsavelFinal Migration
- Migration `1773910000000-AddResponsavelFinalToComplaint` adds nullable UUID column to `complaint` table
- Applied to remote DB at 72.61.52.70:5433
- `Complaint` entity updated with `responsavelFinal: string | null`

### Task 2: AccessTokenService + token-exchange endpoint
- `AccessTokenService.generateForUser(userId)` creates 64-char hex token (32 random bytes), expiresAt = now + 30 days
- `AccessTokenService.validateToken(token)` checks isActive + expiry, updates lastUsedAt
- `POST /api/auth/token-exchange` is `@Public()`, validates opaque token, returns JWT via `authService.login()`
- `AuthModule` imports `TypeOrmModule.forFeature([User, AccessToken])` and provides `AccessTokenService` directly — no circular dep

### Task 3: AccessTokenController + user create hook
- `GET /api/admin/access-tokens` lists all tokens
- `POST /api/admin/access-tokens/:id/revoke` sets isActive=false
- `AdminUsersController.createUser()` calls `accessTokenService.generateForUser()` after saving user

### Task 4: TicketLockService + TicketLockController
- `acquire()` runs in transaction: DELETE existing + INSERT new — 409 if active lock by another user (includes lockedBy name)
- `GET /api/complaints/:id/lock` — current lock state
- `POST /api/complaints/:id/lock` — acquire lock
- `PATCH /api/complaints/:id/lock/renew` — renew expiresAt
- `DELETE /api/complaints/:id/lock/force` — @Roles(SUPERVISOR, ADMIN) only

### Task 5: Notes, by-protocol search, RBAC
- `ComplaintUserNoteService.create()` runs in transaction: deactivate active notes → insert new version → emit note_saved
- `GET/POST /api/complaints/:id/notes`
- `GET /api/complaints/by-protocol?q=XXX` — ILIKE search on protocolNumber + protocoloPrestadora
- `GET /api/executions/:execId/steps` now has `@Roles(SUPERVISOR, ADMIN)` — OPERATOR gets 403

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 9 Plan 02 (Operator UI) can proceed. All backend APIs are in place:
- Token exchange for mobile/integration clients
- Lock acquire/renew/force-release for concurrent editing prevention
- Note versioning with timing event emission
- Protocol search for complaint lookup
- RBAC enforcement on execution detail view
