---
plan: 09-04
status: complete
phase: 09-operator-ui-token-auth-rbac
---

# Summary: Admin Token & Lock Management

## What Was Built

### Backend Changes

**AccessTokenService** (`access-token.service.ts`)
- `generateForUser(userId, ttlDaysOverride?)` — accepts optional TTL override; defaults to 30 days
- `findAll()` — now includes `relations: ['user']` for admin display

**AccessTokenController** (`access-token.controller.ts`)
- Added `POST /api/admin/access-tokens/generate` endpoint (`@Roles(ADMIN)`)
- Added `@Roles(ADMIN)` to `GET /api/admin/access-tokens` and `POST :id/revoke`

**TicketLockService** (`ticket-lock.service.ts`)
- Added `findAll()` — returns active locks (expiresAt > now) with user + complaint relations

**AdminLocksController** (new: `admin-locks.controller.ts`)
- `GET /api/admin/locks` — returns active locks (`@Roles(SUPERVISOR, ADMIN)`)

**OperacaoModule** — wired `AdminLocksController`

### Frontend Pages

**`/admin/tokens/page.tsx`**
- Table: user name, token preview (first 8 chars + ...), expiresAt, lastUsedAt (or 'Nunca'), isActive badge
- "Novo Token" button → modal with user select dropdown + optional TTL days
- After generation: shows full token once with "Copiar" button (token shown only once)
- "Revogar" per row → calls `POST /api/admin/access-tokens/:id/revoke`
- Protected by `useRequireAuth(['ADMIN'])`

**`/admin/locks/page.tsx`**
- Table: protocol, locked by user, lockedAt time, expires countdown
- "Forçar Liberação" per row → calls `DELETE /api/complaints/:complaintId/lock/force`
- "Atualizar" button for manual refresh
- Protected by `useRequireAuth(['SUPERVISOR', 'ADMIN'])`

## Commits
- `feat(09-04): add generate endpoint, admin/locks endpoint, ttlDays override` (7022a7f)
- BKOConsole: files written (git commit pending filesystem repair)
