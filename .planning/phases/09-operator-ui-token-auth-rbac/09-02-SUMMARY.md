---
plan: 09-02
status: complete
phase: 09-operator-ui-token-auth-rbac
---

# Summary: Frontend RBAC + Token Auth

## What Was Built

### Task 1: Navigation RBAC (navigation.ts)
- Added `/processar` nav item for roles `['OPERATOR', 'SUPERVISOR', 'ADMIN']`
- Changed `/tickets` roles to `['SUPERVISOR', 'ADMIN']` (OPERATOR no longer sees it)
- Added `/admin/tokens` (ADMIN) and `/admin/locks` (ADMIN, SUPERVISOR)
- Status: ✅ Complete

### Task 2: Middleware (middleware.ts)
- Created `src/middleware.ts` with matcher for `/processar/:path*`, `/admin/:path*`, `/tickets/:path*`
- Reads `bko-session` and `bko-role` cookies (set by auth store)
- Blocks OPERATOR from `/admin` → redirects to `/unauthorized`
- OPERATOR default: `/` → `/processar`
- Redirects authenticated OPERATOR from `/login` → `/processar`
- Status: ✅ Complete

### Task 3: Auth Store Cookie Integration (auth.store.ts)
- `setAuth()` now sets `bko-session=1` and `bko-role={role}` cookies automatically
- `clearAuth()` now expires both cookies
- Works for both normal login and token exchange flows
- Status: ✅ Complete

### Task 4: /processar Page — Token Exchange (processar/page.tsx)
- Client Component that reads `?token=` from URL params
- Calls `POST /api/auth/token-exchange` with token
- On success: calls `setAuth()` (which sets cookies) and redirects to `/processar` (clean URL)
- On failure: shows "Token expirado, contate o administrador"
- Shows spinner while exchanging
- Status: ✅ Complete

### Task 5: Unauthorized Page
- Already existed at `/app/unauthorized/page.tsx` with proper UI
- Status: ✅ Already present

### Task 6: Execution Detail Guard
- Backend guard already added in 09-01 (`@Roles(SUPERVISOR, ADMIN)` on execution controller)
- Client-side: `useRequireAuth` hook in `hooks/use-require-auth.ts` handles role-based redirect
- Status: ✅ Backend protected; client hook available

## Notes
- BKOConsole git repository had pack index corruption (disk full during gsd-executor run); files written correctly but commits deferred pending filesystem recovery
- iCloud sync appears to be causing read timeouts on large files (26KB+ files)
- Cookie-based middleware approach chosen over jose session (no session lib in BKOConsole)

## Commits
- BKOAgent repo: no changes (frontend only plan)
- BKOConsole: files written (git commit pending filesystem repair)
