---
phase: 02-access-layer
plan: "03"
subsystem: ui
tags: [next.js, react, jose, shadcn-ui, session, auth, tailwind]

# Dependency graph
requires:
  - phase: 02-01
    provides: JWT auth endpoints (POST /api/auth/login), User entity with role
  - phase: 02-02
    provides: Complaint BFF endpoints (GET /api/complaints, GET /api/complaints/:id, sub-resources)
provides:
  - Next.js frontend with login page, session management, and complaint management UI
  - jose-encrypted httpOnly session cookie (8h TTL, stores accessToken + user profile)
  - Route protection middleware for /tickets/* on Edge runtime
  - DAL verifySession() with React cache() for deduplication across server components
  - Complaint queue at /tickets with paginated table and URL-based filter dropdowns
  - Ticket detail at /tickets/[id] with header, rawText, details, history timeline, executions, artifacts
  - Navigation bar with BKO Agent branding, user name, and Sair logout server action
affects:
  - 03-processing-pipeline (frontend will add execution progress views)
  - 04-hitl (frontend will add human review/approval UI)
  - 05-configuration (admin UI for LLM provider config)

# Tech tracking
tech-stack:
  added:
    - jose (JWT sign/verify on Edge and Node.js)
    - server-only (import guard for server-exclusive modules)
    - zod (form validation in server actions)
    - shadcn/ui (Button, Input, Label, Card, Table, Badge, Select components)
  patterns:
    - DAL pattern: verifySession() with React cache() in src/lib/dal.ts isolates auth check
    - Server actions for form mutations (login, logout) — no API routes in Next.js
    - URL searchParams as single source of truth for filter state (shareable, SSR-friendly)
    - fetchAuthAPI helper: extracts session token and adds Authorization header for all backend calls
    - All data fetching in Server Components only — no useEffect + fetch pattern in client components

key-files:
  created:
    - frontend/src/lib/session.ts
    - frontend/src/lib/dal.ts
    - frontend/src/lib/api.ts
    - frontend/src/middleware.ts
    - frontend/src/app/login/page.tsx
    - frontend/src/app/login/actions.ts
    - frontend/src/app/tickets/page.tsx
    - frontend/src/app/tickets/components/ticket-table.tsx
    - frontend/src/app/tickets/components/ticket-filters.tsx
    - frontend/src/app/tickets/[id]/page.tsx
    - frontend/src/app/tickets/[id]/components/ticket-header.tsx
    - frontend/src/app/tickets/[id]/components/ticket-details.tsx
    - frontend/src/app/tickets/[id]/components/ticket-history.tsx
    - frontend/src/app/tickets/[id]/components/ticket-executions.tsx
    - frontend/src/app/tickets/[id]/components/ticket-artifacts.tsx
    - frontend/src/components/nav-bar.tsx
  modified:
    - frontend/package.json
    - frontend/src/app/layout.tsx
    - frontend/.env.example

key-decisions:
  - "jose used for session encryption (HS256) — works on both Edge (middleware) and Node.js (server components)"
  - "Session cookie stores backend JWT (accessToken) encrypted — frontend never exposes raw backend token to browser"
  - "cookies() is async in Next.js 15+ — all session/DAL code uses await cookies()"
  - "redirect() throws NEXT_REDIRECT internally — called outside try/catch in server actions"
  - "useActionState from 'react' (React 19) not from 'react-dom' — useFormState is deprecated"
  - "Filter state in URL searchParams, not useState — enables server-side rendering and shareable URLs"

patterns-established:
  - "DAL pattern: src/lib/dal.ts has verifySession() wrapped in React cache() — call at top of any protected server component"
  - "fetchAuthAPI: always use this helper for authenticated backend calls in server components/actions"
  - "Server action mutation pattern: validate with zod -> call backend -> createSession -> redirect() outside try/catch"
  - "Client filter components: useSearchParams + router.push to update URL, never manage filter state locally"

# Metrics
duration: 45min
completed: 2026-03-17
---

# Phase 2 Plan 3: Frontend Access Layer Summary

**Next.js 16 frontend with jose-encrypted session cookies, shadcn/ui complaint queue table with URL-driven filters, and full ticket detail page consuming the NestJS BFF APIs**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-03-17
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** ~20

## Accomplishments

- Login page with Portuguese form (email/senha), server action calling backend POST /api/auth/login, redirect to /tickets on success
- Session layer: jose HS256 encrypt/decrypt in src/lib/session.ts, DAL verifySession() with React cache(), Edge-compatible middleware protecting /tickets/*
- Complaint queue at /tickets: paginated table with Protocolo, Tipologia, Status, Risco, SLA, Data columns; URL-based filter dropdowns for Status, Risco, SLA vencido
- Ticket detail at /tickets/[id]: header card (protocol, status badge, risk badge, SLA), rawText block, details table, vertical history timeline, empty Execucoes and Artefatos sections ready for Phase 3
- Nav bar with BKO Agent branding, logged-in user name, Sair logout server action

## Task Commits

Each task was committed atomically:

1. **Task 1: Session management, shadcn/ui setup, and login page** - `2522989` (feat)
2. **Task 2: Complaint queue page and ticket detail pages** - `44f6ffd` (feat)
3. **Task 3: Checkpoint human-verify** - approved by user

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `frontend/src/lib/session.ts` — jose encrypt/decrypt, createSession, deleteSession
- `frontend/src/lib/dal.ts` — verifySession() DAL with React cache()
- `frontend/src/lib/api.ts` — fetchAPI and fetchAuthAPI helpers for server components
- `frontend/src/middleware.ts` — Edge route protection for /tickets/*, redirect unauthenticated to /login
- `frontend/src/app/login/page.tsx` — login form with useActionState (React 19)
- `frontend/src/app/login/actions.ts` — login server action (validate -> call backend -> createSession -> redirect)
- `frontend/src/app/tickets/page.tsx` — complaint queue server component with pagination
- `frontend/src/app/tickets/components/ticket-table.tsx` — table with status/risk Badge components
- `frontend/src/app/tickets/components/ticket-filters.tsx` — URL-based filter dropdowns (client component)
- `frontend/src/app/tickets/[id]/page.tsx` — ticket detail server component, fetches complaint + executions + artifacts
- `frontend/src/app/tickets/[id]/components/ticket-header.tsx` — protocol, status, risk, SLA card
- `frontend/src/app/tickets/[id]/components/ticket-details.tsx` — rawText block, details definition list, attachments
- `frontend/src/app/tickets/[id]/components/ticket-history.tsx` — vertical timeline of history entries
- `frontend/src/app/tickets/[id]/components/ticket-executions.tsx` — execution list with step breakdown, empty state
- `frontend/src/app/tickets/[id]/components/ticket-artifacts.tsx` — artifact list with JSON content, empty state
- `frontend/src/components/nav-bar.tsx` — top nav with branding, user name, Sair logout
- `frontend/package.json` — added jose, server-only, zod, shadcn/ui components
- `frontend/src/app/layout.tsx` — Inter font, lang="pt-BR", NavBar integration
- `frontend/.env.example` — SESSION_SECRET, BACKEND_URL

## Decisions Made

- **jose for session encryption:** Chosen because it works on Edge runtime (middleware) and Node.js (server components) without polyfills. HS256 symmetric key from SESSION_SECRET env var.
- **Session cookie stores encrypted backend JWT:** Browser never sees the raw backend access_token; only the encrypted session cookie. Decryption only happens server-side.
- **cookies() is async in Next.js 15+:** All session and DAL code uses `await cookies()` — important gotcha for anyone extending these files.
- **redirect() outside try/catch:** Next.js redirect() throws NEXT_REDIRECT internally; wrapping in try/catch swallows the throw and causes silent failures. Server actions call redirect() after all async work, outside any try block.
- **useActionState from 'react':** React 19 moved form action state to the core react package. useFormState from react-dom is deprecated and will be removed.
- **URL searchParams for filters:** Filter state lives in the URL, not in useState. This means filter changes trigger server-side re-renders with fresh data, URLs are shareable, and no hydration mismatches.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Environment variables required for local development:

```
SESSION_SECRET=any-random-string-at-least-32-chars
BACKEND_URL=http://localhost:3001
```

Create `frontend/.env.local` with these values. `.env.example` documents them.

## Next Phase Readiness

- Full auth flow operational: login, session persistence, logout, route protection
- Complaint queue and ticket detail consuming live backend data
- Requirements AUTH-01, AUTH-02, AUTH-03, TICK-01, TICK-02, TICK-04, TICK-05, TICK-06 all satisfied
- Phase 2 complete — all 3 plans (02-01 auth API, 02-02 complaint BFF, 02-03 frontend) done
- Phase 3 (Processing Pipeline) can extend ticket detail Execucoes and Artefatos sections with live data as agent executions are implemented

---
*Phase: 02-access-layer*
*Completed: 2026-03-17*
