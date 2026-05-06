# Phase 09: Operator UI, Token Auth & RBAC - Research

**Researched:** 2026-05-06
**Domain:** NestJS opaque-token auth guard, Next.js token-in-URL session flow, ticket lock service, ComplaintUserNote versioning, RBAC sidebar, admin token/lock management UI
**Confidence:** HIGH (all findings verified against actual codebase)

---

## Summary

Phase 9 wires up a complete operator entry point: a token-in-URL flow that bootstraps a session, a `/processar` page with lock, note, and progress bar, and admin pages for token/lock management. All database entities (AccessToken, TicketLock, ComplaintUserNote) already exist from the Phase 8 migration — no schema changes are needed, only service/controller/frontend code.

The token auth entry point must operate as an alternative to the standard JWT login. The existing APP_GUARD architecture (JwtAuthGuard as APP_GUARD, @Public() to opt out) does not need to be replaced. The correct approach is to add a dedicated `@Public() POST /auth/token-exchange` endpoint that validates the opaque token, calls `authService.login()` to produce a standard JWT, and returns it — mirroring exactly what `POST /auth/login` does. The frontend Next.js server action (or route handler) calls this endpoint, stores the JWT in the session cookie via `createSession()`, then redirects to `/processar` — removing the token from the URL. No second APP_GUARD is needed.

The BKOConsole (not BKOAgent/frontend) is the target for all frontend work. The `(app)` layout wraps pages that require a session cookie. The `/processar` page lives outside the existing `/tickets` matcher in `middleware.ts` — that matcher must be extended or a new one added.

**Primary recommendation:** Token exchange = @Public() POST endpoint producing a JWT → frontend stores via existing createSession() → redirect strips token from URL. Do not implement a custom Passport strategy for the opaque token; a plain service method lookup is simpler and already fits the codebase pattern.

---

## Standard Stack

No new libraries are required. Everything needed is already installed.

### Backend (already installed)
| Library | Purpose | Notes |
|---------|---------|-------|
| `@nestjs/common` | Guards, decorators, controllers | In use |
| `@nestjs/jwt` / `JwtService` | Sign JWT after token exchange | Already exported from AuthModule |
| `typeorm` / `Repository` | AccessToken, TicketLock, ComplaintUserNote CRUD | All entities registered in OperacaoModule |
| `crypto` (Node built-in) | `randomBytes(32).toString('hex')` for 64-char token | No install needed |

### Frontend (already installed)
| Library | Purpose | Notes |
|---------|---------|-------|
| `jose` | Session encrypt/decrypt | Already in BKOConsole session.ts |
| `zustand` | Auth store (`bko-auth-v1`) | Already in use |
| React `useEffect` + `setInterval` | Polling progress bar | Standard pattern, no new dependency |

---

## Architecture Patterns

### Recommended Backend Structure
```
src/modules/operacao/
├── controllers/
│   ├── access-token.controller.ts    # NEW: CRUD for admin token management
│   ├── ticket-lock.controller.ts     # NEW: acquire/renew/release/force-release
│   └── complaint-user-note.controller.ts  # NEW: upsert note
├── services/
│   ├── access-token.service.ts       # NEW: generate, list, revoke, validate
│   ├── ticket-lock.service.ts        # NEW: acquire/renew/release/force-release
│   └── complaint-user-note.service.ts  # NEW: create new version, deactivate old
src/modules/auth/
├── auth.controller.ts                # EXTEND: add @Public() POST /auth/token-exchange
└── auth.service.ts                  # EXTEND: add tokenExchange(token) method
```

### Frontend Structure (BKOConsole)
```
src/app/(app)/
├── processar/
│   └── page.tsx                      # NEW: operator complaint processing page
├── admin/
│   ├── tokens/
│   │   └── page.tsx                  # NEW: admin token management
│   └── locks/
│       └── page.tsx                  # NEW: supervisor/admin lock management
src/app/(auth)/
│   └── token-auth/
│       └── page.tsx                  # NEW: token exchange server-rendered page
```

### Pattern 1: Token-in-URL → Session Cookie Flow

The frontend handles this entirely server-side. The `/processar?token=XXX` page's `page.tsx` should be a Server Component that:

1. Reads `searchParams.token`
2. If token present: calls backend `POST /auth/token-exchange` with the token (server-to-server via BACKEND_URL)
3. On success: calls `createSession(backendJwt, user)` from `session.ts` — sets the `session` cookie
4. Redirects to `/processar` (no query param) using Next.js `redirect()`

This is a Next.js Server Component + redirect pattern — no client JS involved, token never touches the browser history after redirect.

```typescript
// src/app/(app)/processar/page.tsx  (Server Component)
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/session'

export default async function ProcesarPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  if (searchParams.token) {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/token-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: searchParams.token }),
    })
    if (res.ok) {
      const { access_token, user } = await res.json()
      await createSession(access_token, user)
      redirect('/processar')  // strips token from URL
    }
    // On failure: render error state or redirect to /login?error=invalid_token
    redirect('/login?error=invalid_token')
  }
  // Normal render — session already exists
  return <ProcesarClient />
}
```

**Critical detail:** `redirect()` in Next.js Server Components throws internally — it must not be inside a try/catch block. If token exchange fails, `redirect()` to an error page before `createSession` is called.

### Pattern 2: Backend Token Exchange Endpoint

The `POST /auth/token-exchange` endpoint is marked `@Public()` (bypasses JwtAuthGuard) and validates the opaque token against the `access_token` table:

```typescript
// In auth.controller.ts
@Public()
@Post('token-exchange')
async tokenExchange(@Body() body: { token: string }) {
  return this.authService.tokenExchange(body.token)
}

// In auth.service.ts — needs AccessToken repo injected (or delegated to AccessTokenService)
async tokenExchange(rawToken: string) {
  const record = await this.accessTokenRepo.findOne({
    where: { token: rawToken, isActive: true },
    relations: ['user'],
  })
  if (!record || record.expiresAt < new Date() || !record.user.isActive) {
    throw new UnauthorizedException('Token inválido ou expirado')
  }
  await this.accessTokenRepo.update(record.id, { lastUsedAt: new Date() })
  return this.login(record.user)  // reuses existing login() — produces JWT + user
}
```

**Note:** AuthModule does not currently import AccessToken entity. Two options:
- Option A (preferred): Create `AccessTokenService` in OperacaoModule, export it, import OperacaoModule in AuthModule — but this risks circular dependency since OperacaoModule already exports TypeOrmModule.
- Option B (cleaner): Move the `tokenExchange` logic to `AccessTokenService` in OperacaoModule, expose a `POST /auth/token-exchange` controller in OperacaoModule (or a new AccessTokenController), and have it inject both AccessToken repo and JwtService. AuthModule exports JwtService — add it to `exports` array in AuthModule.

Option B avoids circular dependency. `AccessTokenController` (in OperacaoModule) handles the exchange, imports JwtService by adding `JwtModule` or importing `AuthModule` (AuthModule currently does not export JwtModule/JwtService).

**Simplest resolution:** Add `JwtService` to `exports` in AuthModule, then `AccessTokenController` in OperacaoModule imports `AuthModule` → gets `JwtService` injected → calls `jwtService.sign(payload)` directly. No circular dependency.

### Pattern 3: TicketLock Acquire/Renew/Release

The `ticket_lock` table has a `UNIQUE ("complaintId")` constraint — only one lock per complaint. The lock service uses TypeORM `upsert` or `delete + insert` pattern:

```typescript
// Acquire lock (upsert pattern)
async acquire(complaintId: string, userId: string): Promise<{ success: true } | { success: false; lockedBy: string }> {
  const existing = await this.lockRepo.findOne({
    where: { complaintId },
    relations: ['user'],
  })
  if (existing && existing.expiresAt > new Date() && existing.userId !== userId) {
    return { success: false, lockedBy: existing.user.name }
  }
  // Either expired or same user — upsert
  await this.lockRepo.delete({ complaintId })
  await this.lockRepo.save({
    complaintId,
    userId,
    lockedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),  // 30 min TTL
  })
  return { success: true }
}
```

**Pitfall:** The UNIQUE constraint on `complaintId` means you cannot `INSERT` if a row exists — must `DELETE` then `INSERT`, not `UPDATE`. TypeORM's `save()` with a new entity object (no id) will try INSERT and fail if a lock exists. Pattern is always `delete({ complaintId })` then `save(newLock)`.

### Pattern 4: ComplaintUserNote Versioning

Version history = new row per save, old row flipped to `isActive=false`. No UPDATE ever touches `content` or `parameters` — only `isActive` is patched.

```typescript
// In ComplaintUserNoteService
async create(complaintId: string, userId: string, content: string, parameters: Record<string, unknown> | null): Promise<ComplaintUserNote> {
  // 1. Get current max version
  const current = await this.noteRepo.findOne({
    where: { complaintId, userId, isActive: true },
    order: { version: 'DESC' },
  })
  const nextVersion = current ? current.version + 1 : 1

  // 2. Deactivate current active note (if any)
  if (current) {
    await this.noteRepo.update(current.id, { isActive: false })
  }

  // 3. Insert new version
  const note = await this.noteRepo.save(
    this.noteRepo.create({ complaintId, userId, content, parameters, version: nextVersion, isActive: true })
  )

  // 4. Emit timing event
  await this.timingEventService.emit('note_saved', complaintId, null, userId)

  return note
}
```

### Pattern 5: Polling Progress Bar

Use `useEffect` with `setInterval` on the client component. Poll `GET /complaints/:id/executions/latest` (or the existing execution status endpoint) every 3 seconds. Stop polling when `status === 'completed' || status === 'failed'`.

```typescript
// Client component
useEffect(() => {
  if (!executionId || isTerminal) return
  const interval = setInterval(async () => {
    const status = await fetchExecutionStatus(executionId)
    setProgress(status.progressPercent)
    if (status.status === 'completed' || status.status === 'failed') {
      clearInterval(interval)
      setIsTerminal(true)
    }
  }, 3000)
  return () => clearInterval(interval)
}, [executionId, isTerminal])
```

**SSE vs polling decision:** Use polling. SSE requires a persistent connection which adds complexity (reconnection, edge runtime compatibility). The execution phase completes in a bounded time. Polling at 3s intervals is appropriate.

### Pattern 6: Lock Conflict UI

The `/processar` page tries to acquire the lock immediately when a complaint is loaded. If `success: false`, show a non-blocking conflict banner:

```
"Esta reclamação está sendo processada por [lockedBy]"
[Tentar novamente] [Escolher outra reclamação]
```

Do not block the page — show the complaint header card in read-only mode. The "Tentar novamente" button re-calls the acquire endpoint. No optimistic UI — always confirm from the server before enabling note/processing controls.

### Pattern 7: RBAC — Sidebar + Route Guard

The existing `navItems` array in `navigation.ts` already filters by `roles`. Add new items:
```typescript
{ path: '/processar', label: 'Processar', icon: 'clipboard-list', roles: ['OPERATOR'], group: 'operacao' },
{ path: '/admin/tokens', label: 'Tokens de Acesso', icon: 'key', roles: ['ADMIN'], group: 'config' },
{ path: '/admin/locks', label: 'Bloqueios', icon: 'lock', roles: ['ADMIN', 'SUPERVISOR'], group: 'config' },
```

OPERATOR default redirect: the `middleware.ts` currently redirects authenticated users at `/login` to `/tickets`. Add a role-based redirect: if `session.role === 'operator'` and pathname is `/`, redirect to `/processar`.

The 403 guard for OPERATOR on the execution page: in the execution page component, read from the auth store (`useAuthStore`) — if `role === 'OPERATOR'`, redirect or render the unauthorized page. The backend also enforces this with `@Roles(UserRole.SUPERVISOR, UserRole.ADMIN)` on the execution endpoint.

### Pattern 8: middleware.ts Extension

The current middleware only matches `/tickets/:path*` and `/login`. It must also protect `/processar` and `/admin`:

```typescript
export const config = {
  matcher: ['/tickets/:path*', '/login', '/processar/:path*', '/admin/:path*'],
}
```

Add auth check for `/processar` and `/admin` paths. For OPERATOR: redirect if trying to access `/admin`. The middleware reads `session.role` from the decrypted cookie — `session.ts`'s `decrypt()` is already available in middleware context since it uses `jose` (Edge-compatible).

**Gotcha:** `middleware.ts` uses `request.cookies.get()` (correct Edge API). `session.ts` uses `cookies()` from `next/headers` which is NOT available in middleware. The `decrypt()` function in `session.ts` takes a plain string — it's safe to call from middleware because it only uses `jose` (Edge-compatible). Call `decrypt(sessionCookie)` in middleware as currently done.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Token generation | Custom UUID or hash | `crypto.randomBytes(32).toString('hex')` — 64 hex chars, cryptographically random |
| Session cookie encryption | Custom AES | Existing `encrypt()`/`decrypt()` from `session.ts` |
| JWT after token exchange | New JWT logic | Reuse `authService.login()` which calls `jwtService.sign()` |
| Lock expiry cleanup | Background job/cron | Query-time check: `expiresAt > NOW()` on read, stale rows are safe to overwrite |
| Progress percentage calculation | Complex logic | Simple: `(completedSteps / totalSteps) * 100` using existing step execution data |
| Role-based page guard | Custom middleware | Read `role` from Zustand store in client components, or from session in Server Components |

---

## Common Pitfalls

### Pitfall 1: Token Exchange Circular Dependency
**What goes wrong:** AuthModule imports OperacaoModule (for User repo) and OperacaoModule imports AuthModule (for JwtService) → circular dependency at startup.
**How to avoid:** Export only `JwtService` from AuthModule by adding `JwtModule` to `exports`. OperacaoModule's `AccessTokenController` injects `JwtService` directly without importing AuthModule — import `JwtModule.registerAsync(...)` in OperacaoModule separately, or use `forwardRef()`.
**Simpler:** Don't import AuthModule in OperacaoModule. Instead, duplicate the `JwtModule.registerAsync()` registration in OperacaoModule. NestJS handles multiple registrations via the same `JwtModule` — the second import reuses the existing instance if the module is global, or registers independently. Since `JwtModule` is not global, add `JwtModule.registerAsync(...)` to OperacaoModule's imports array.

### Pitfall 2: TicketLock INSERT fails on conflict
**What goes wrong:** `lockRepo.save({ complaintId, ... })` without an `id` creates a new entity — TypeORM does an `INSERT` which fails on the `UNIQUE ("complaintId")` constraint if a lock row exists (even expired).
**How to avoid:** Always `DELETE WHERE complaintId = X` before inserting a new lock row. Never use `upsert()` with complaintId as conflict target in TypeORM 0.3 (the API is `createQueryBuilder().insert().orUpdate(...)` which is verbose — DELETE+INSERT is simpler and equally correct).

### Pitfall 3: redirect() inside try/catch
**What goes wrong:** Next.js `redirect()` works by throwing an internal error (`NEXT_REDIRECT`). If called inside a try/catch block, the catch intercepts it and the redirect never happens.
**How to avoid:** Structure token exchange flow as: check result, call `redirect()` outside any try/catch block. Use `if (!res.ok) redirect('/login?error=invalid_token')` then `await createSession(...)` then `redirect('/processar')`.

### Pitfall 4: session.ts cookies() in middleware
**What goes wrong:** Importing `createSession()` or `deleteSession()` from `session.ts` in `middleware.ts` will fail — `cookies()` from `next/headers` is not available in Edge middleware.
**How to avoid:** Only use `decrypt()` from `session.ts` in middleware (it takes a string, no cookies() call). Session creation/deletion happens in Server Components and Server Actions only, never in middleware.

### Pitfall 5: OPERATOR accessing /admin routes
**What goes wrong:** If middleware doesn't block `/admin` for OPERATOR role, they can navigate directly.
**How to avoid:** In middleware, after decrypting session, check `session.role === 'operator' && pathname.startsWith('/admin')` → redirect to `/unauthorized`.

### Pitfall 6: Token not removed from URL → browser history leaks token
**What goes wrong:** If the frontend doesn't redirect after token exchange, the token stays in the URL and browser history — security issue.
**How to avoid:** The Server Component pattern with `redirect('/processar')` after `createSession()` ensures the client never sees the token URL in its final state. The Server Component renders server-side and redirects before the client gets any HTML.

### Pitfall 7: Lock renewal on note save vs. on page action
**What goes wrong:** If renewal only happens on explicit button clicks, an operator who types for 30 minutes without saving loses the lock.
**How to avoid:** Renew lock on every API call that touches the complaint (note autosave, any form interaction). Add a `PATCH /ticket-locks/:complaintId/renew` endpoint and call it from the frontend on a 10-minute timer (well within the 30-min TTL).

---

## Code Examples

### Token generation (Node crypto)
```typescript
// In AccessTokenService.generate()
import * as crypto from 'crypto'
const rawToken = crypto.randomBytes(32).toString('hex')  // 64 hex chars
```

### ComplaintUserNote version upsert (TypeORM)
```typescript
// Deactivate old, insert new — in a transaction for consistency
await this.dataSource.transaction(async (em) => {
  await em.update(ComplaintUserNote, { complaintId, userId, isActive: true }, { isActive: false })
  await em.save(ComplaintUserNote, em.create(ComplaintUserNote, {
    complaintId, userId, content, parameters, version: nextVersion, isActive: true,
  }))
})
```

### Lock acquire with conflict response
```typescript
// HTTP 409 for lock conflict
@Post(':complaintId/lock')
async acquireLock(@Param('complaintId') complaintId: string, @Request() req: any) {
  const result = await this.lockService.acquire(complaintId, req.user.id)
  if (!result.success) {
    throw new HttpException({ message: 'Locked', lockedBy: result.lockedBy }, 409)
  }
  return { success: true }
}
```

### Frontend lock conflict UI
```typescript
// Client component
const [lockState, setLockState] = useState<'acquiring' | 'held' | 'conflict' | null>(null)
const [lockedBy, setLockedBy] = useState<string | null>(null)

const acquireLock = async (complaintId: string) => {
  setLockState('acquiring')
  const res = await fetch(`/api/complaints/${complaintId}/lock`, { method: 'POST' })
  if (res.ok) {
    setLockState('held')
  } else if (res.status === 409) {
    const { lockedBy } = await res.json()
    setLockedBy(lockedBy)
    setLockState('conflict')
  }
}
```

### Middleware extension for /processar and /admin
```typescript
// middleware.ts — extend the protection logic
if (!isAuthenticated && (pathname.startsWith('/processar') || pathname.startsWith('/admin'))) {
  return NextResponse.redirect(new URL('/login', request.url))
}
if (isAuthenticated && session?.role === 'operator' && pathname.startsWith('/admin')) {
  return NextResponse.redirect(new URL('/unauthorized', request.url))
}

export const config = {
  matcher: ['/tickets/:path*', '/login', '/processar/:path*', '/admin/:path*'],
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Custom session management | `jose` HS256 signed cookies | Already in use — don't change |
| Passport strategy per auth type | @Public() + dedicated exchange endpoint | Simpler — no new Passport strategy needed |
| Long-poll or SSE for progress | 3-second polling interval | Sufficient for bounded execution time |

---

## Open Questions

1. **Token TTL / renewal policy**
   - What we know: `expiresAt` exists on AccessToken, no TTL specified in requirements
   - What's unclear: Should tokens expire after 24h, 7d, never (admin-revoke only)?
   - Recommendation: Default to 30-day expiry, revocable by admin. Make configurable via env var `ACCESS_TOKEN_TTL_DAYS`.

2. **Protocol search scope**
   - What we know: The complaint entity has a `protocol` field (inferred from requirements: "search by protocol")
   - What's unclear: Which field in the Complaint entity maps to the user-visible protocol number?
   - Recommendation: Verify the actual column name in the complaint entity before implementing the search endpoint.

3. **"Iniciar Processamento" — what it triggers**
   - What we know: It should start execution (producing a progress bar)
   - What's unclear: Does it call the existing `POST /execucoes` endpoint or a new one?
   - Recommendation: Reuse the existing execution start endpoint from ExecucaoModule (Phase 3/4).

4. **Admin token page — who can generate tokens**
   - What we know: ADMIN manages tokens (RBAC-01)
   - What's unclear: Can tokens be auto-generated on user creation, or only manually?
   - Recommendation: Manual generation by ADMIN only; "Novo Token" modal generates and displays the token once (copy-and-send to operator).

---

## Sources

### Primary (HIGH confidence — verified against actual codebase)
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/auth/auth.module.ts` — APP_GUARD pattern, JwtAuthGuard + RolesGuard as two APP_GUARDs
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/auth/guards/jwt-auth.guard.ts` — @Public() bypass logic
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/auth/auth.service.ts` — login() method reusable for token exchange
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/operacao/entities/access-token.entity.ts` — token schema confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/operacao/entities/ticket-lock.entity.ts` — UNIQUE complaintId confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/operacao/entities/complaint-user-note.entity.ts` — version + isActive pattern confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/database/migrations/1773900000000-CreateV2OperatorWorkflowTables.ts` — schema confirmed (IDX, UNIQUE constraints)
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/frontend/src/middleware.ts` — request.cookies.get() pattern confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/frontend/src/lib/session.ts` — jose HS256, createSession(), decrypt() patterns confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOConsole/src/store/auth.store.ts` — UserRole = 'OPERATOR' | 'SUPERVISOR' | 'ADMIN', bko-auth-v1 key
- `/Users/maxcardoso/Documents/EngDB/BKOConsole/src/config/navigation.ts` — navItems role filter pattern confirmed
- `/Users/maxcardoso/Documents/EngDB/BKOAgent/backend/src/modules/operacao/services/timing-event.service.ts` — emit() signature confirmed

### Secondary (MEDIUM confidence)
- NestJS docs pattern: multiple APP_GUARDs execute in registration order; both JwtAuthGuard and RolesGuard are already using this pattern in this codebase
- Next.js Server Component `redirect()` must not be inside try/catch — established Next.js behavior

---

## Metadata

**Confidence breakdown:**
- Token exchange pattern: HIGH — verified against actual auth module code
- TicketLock acquire/conflict: HIGH — verified against entity schema and migration
- ComplaintUserNote versioning: HIGH — entity and migration match the described pattern
- Middleware extension: HIGH — existing middleware.ts read, pattern is clear
- Frontend token-in-URL flow: HIGH — session.ts and actions.ts patterns confirmed
- Progress bar polling: HIGH — standard React pattern, no library needed
- Admin UI structure: HIGH — navItems pattern confirmed, no new library needed

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (stable stack, no fast-moving dependencies)
