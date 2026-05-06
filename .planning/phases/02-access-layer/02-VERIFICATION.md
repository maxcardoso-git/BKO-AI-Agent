---
phase: 02-access-layer
verified: 2026-03-17T22:12:17Z
status: gaps_found
score: 27/29 must-haves verified
gaps:
  - truth: "Visiting /tickets without login redirects to /login"
    status: partial
    reason: "middleware.ts does not exist; route protection file is named proxy.ts which Next.js does not recognize as Edge middleware. The middleware-manifest.json confirms no middleware is registered. Application-level protection via verifySession() in server components does redirect unauthenticated users, so the redirect works — but it happens after a server render attempt rather than at the Edge before any server code runs. The must-have is functionally met via DAL, but the Edge guard is absent."
    artifacts:
      - path: "frontend/src/middleware.ts"
        issue: "MISSING — file does not exist at this path"
      - path: "frontend/src/proxy.ts"
        issue: "Contains the middleware logic but is named proxy.ts, not middleware.ts. Next.js only picks up middleware from src/middleware.ts or middleware.ts at project root. Compiled middleware-manifest.json has middleware: {} confirming it is not active."
    missing:
      - "Rename frontend/src/proxy.ts to frontend/src/middleware.ts so Next.js recognizes it as Edge middleware"
      - "Verify export is named 'middleware' not 'proxy' (currently exports async function proxy)"
  - truth: "Filters on /tickets allow filtering by status, tipologia, risco, and overdue"
    status: partial
    reason: "ticket-filters.tsx has dropdowns for status, riskLevel (risco), and isOverdue (SLA) — but has no tipologia filter dropdown. The backend supports tipologyId filtering (ComplaintFilterDto, complaint.service.ts), the /tickets page passes other URL params to the API, but tipologyId is never forwarded from the frontend. A user cannot filter by tipologia from the UI."
    artifacts:
      - path: "frontend/src/app/tickets/components/ticket-filters.tsx"
        issue: "No tipologyId/tipologia dropdown. SearchParams interface in page.tsx has no tipologyId field. The param is never forwarded to fetchAuthAPI."
      - path: "frontend/src/app/tickets/page.tsx"
        issue: "SearchParams interface has status, riskLevel, isOverdue, page — tipologyId is absent. Not passed to the backend query."
    missing:
      - "Add tipologyId to SearchParams interface in tickets/page.tsx"
      - "Forward tipologyId param to backend API query in tickets/page.tsx"
      - "Add tipologia dropdown to TicketFilters component (requires fetching tipology list from backend or hardcoding known values)"
---

# Phase 02: Access Layer Verification Report

**Phase Goal:** Authenticated users with appropriate roles can access the system and view, filter, and inspect complaint tickets
**Verified:** 2026-03-17T22:12:17Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | POST /api/auth/login returns 200 with access_token and user object | VERIFIED | AuthController.login calls authService.login which signs JWT and returns {access_token, user}. LocalStrategy validates bcrypt via authService.validateUser. |
| 2  | POST /api/auth/login with invalid credentials returns 401 | VERIFIED | LocalStrategy.validate throws UnauthorizedException when validateUser returns null. bcrypt.compare guards password. |
| 3  | GET /api/auth/me returns authenticated user profile | VERIFIED | AuthController.me returns req.user with passwordHash stripped. JwtStrategy fetches full User from DB on every request. |
| 4  | Requests without Bearer token return 401 | VERIFIED | JwtAuthGuard registered as APP_GUARD globally. All endpoints not marked @Public() go through AuthGuard('jwt'). |
| 5  | @Roles('admin') rejects 'operator' role users with 403 | VERIFIED | RolesGuard registered as APP_GUARD. requiredRoles.includes(user.role) returns false; returns false = forbidden. NestJS converts false canActivate to 403. |
| 6  | Three test users exist in DB: operator, supervisor, admin | VERIFIED | UserSeeder seeds all three with bcrypt hashes. upsert by email for idempotency. Migration creates user table. |
| 7  | GET /api/complaints returns paginated list with total count | VERIFIED | ComplaintService.findAll uses getManyAndCount(), returns {data, total, page, limit, totalPages}. |
| 8  | GET /api/complaints?status=pending filters by status | VERIFIED | ComplaintFilterDto has status field. Service andWhere('complaint.status = :status') when defined. |
| 9  | GET /api/complaints?tipologyId=uuid filters by tipology | VERIFIED | Backend: ComplaintFilterDto.tipologyId, Service andWhere('complaint.tipologyId = :tipologyId'). |
| 10 | GET /api/complaints?isOverdue=true filters overdue | VERIFIED | Service parses isOverdue string to bool, andWhere('complaint.isOverdue = :isOverdue'). |
| 11 | GET /api/complaints?riskLevel=high filters by risk level | VERIFIED | ComplaintFilterDto.riskLevel, Service andWhere('complaint.riskLevel = :riskLevel'). |
| 12 | GET /api/complaints/:id returns complaint with full relations | VERIFIED | findOne uses leftJoinAndSelect for tipology, subtipology, situation, regulatoryAction, details, history, attachments. Throws NotFoundException on miss. |
| 13 | GET /api/complaints/:id/executions returns ticket executions with steps | VERIFIED | ExecutionService.findByComplaintId queries ticketExecutionRepository with leftJoinAndSelect stepExecutions and stepDefinition. |
| 14 | GET /api/complaints/:id/artifacts returns artifacts | VERIFIED | ExecutionService.findArtifactsByComplaintId queries artifact.complaintId directly. |
| 15 | All complaint endpoints require Bearer token | VERIFIED | No @Public() on any complaint or execution controller. Global JwtAuthGuard protects all. |
| 16 | User sees login form at /login with email and password fields | VERIFIED | login/page.tsx renders Input[name=email] and Input[name=password] with Label components. |
| 17 | Submitting valid credentials redirects to /tickets | VERIFIED | login/actions.ts calls fetchAPI, createSession, then redirect('/tickets') outside try/catch. |
| 18 | Submitting invalid credentials shows error message | VERIFIED | Server action returns {error: data.message ?? 'Email ou senha inválidos.'}. Page renders {state.error && <p role="alert">...}. |
| 19 | Refreshing /tickets keeps user logged in (session cookie persists) | VERIFIED | session.ts sets httpOnly cookie with maxAge: 8*60*60 (8h). jose decrypt runs on each request via verifySession(). |
| 20 | Visiting /tickets without login redirects to /login | PARTIAL | verifySession() in both page.tsx files calls redirect('/login') when no session. DAL protection works. However middleware.ts is absent (file is proxy.ts) — Edge middleware layer not active per middleware-manifest.json. |
| 21 | Complaint queue at /tickets shows table with expected columns | VERIFIED | TicketTable renders TableHead for Protocolo, Tipologia, Status, Risco, SLA, Criado em. Each row wraps all cells in Link to /tickets/[id]. |
| 22 | Filters on /tickets allow filtering by status, tipologia, risco, and overdue | PARTIAL | ticket-filters.tsx has status, riskLevel, isOverdue dropdowns. Tipologia filter dropdown is absent. tipologyId not in SearchParams interface and not forwarded to backend. |
| 23 | Clicking a complaint row navigates to /tickets/[id] | VERIFIED | TicketTable: each cell is wrapped in Link href={`/tickets/${complaint.id}`}. |
| 24 | Ticket detail page shows complaint text, details, history, executions, artifacts | VERIFIED | tickets/[id]/page.tsx fetches all three APIs and renders TicketHeader, TicketDetails (rawText + details), TicketHistory (timeline), TicketExecutions, TicketArtifacts. |

**Score:** 22/24 truths fully verified, 2 partial (gaps found)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/modules/auth/auth.controller.ts` | POST /auth/login + GET /auth/me | VERIFIED | Real implementation, 22 lines, both endpoints present |
| `backend/src/modules/auth/auth.service.ts` | validateUser + login with JWT | VERIFIED | bcrypt.compare, JWT sign, strips passwordHash |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | Global JWT guard | VERIFIED | APP_GUARD + @Public() bypass |
| `backend/src/modules/auth/guards/roles.guard.ts` | RBAC guard | VERIFIED | Reads ROLES_KEY metadata, checks user.role |
| `backend/src/modules/auth/strategies/local.strategy.ts` | Passport local | VERIFIED | usernameField: 'email', throws UnauthorizedException |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | JWT Bearer | VERIFIED | Fetches full User from DB, checks isActive |
| `backend/src/modules/auth/decorators/roles.decorator.ts` | @Roles decorator | VERIFIED | SetMetadata(ROLES_KEY, roles) |
| `backend/src/modules/auth/decorators/public.decorator.ts` | @Public decorator | VERIFIED | SetMetadata(IS_PUBLIC_KEY, true) |
| `backend/src/modules/operacao/entities/user.entity.ts` | User entity with UserRole | VERIFIED | All columns, UserRole enum with OPERATOR/SUPERVISOR/ADMIN |
| `backend/src/database/migrations/1773774006000-CreateUserTable.ts` | user table migration | VERIFIED | Creates user table, unique email constraint |
| `backend/src/database/seeds/user.seeder.ts` | 3 test users | VERIFIED | operator@bko.ai, supervisor@bko.ai, admin@bko.ai with bcrypt hashes |
| `backend/src/modules/operacao/controllers/complaint.controller.ts` | GET /complaints + GET /complaints/:id | VERIFIED | 29 lines, both endpoints, ParseUUIDPipe on :id |
| `backend/src/modules/operacao/services/complaint.service.ts` | findAll with filters + findOne | VERIFIED | 113 lines, QueryBuilder with all 7 conditional filters, getManyAndCount |
| `backend/src/modules/operacao/dto/complaint-filter.dto.ts` | Filter DTO | VERIFIED | All filter fields, @Type(() => Number) for page/limit |
| `backend/src/modules/execucao/controllers/execution.controller.ts` | /executions + /artifacts + /logs | VERIFIED | Controller prefix complaints/:complaintId, 3 endpoints |
| `backend/src/modules/execucao/services/execution.service.ts` | 3 query methods | VERIFIED | findByComplaintId, findArtifactsByComplaintId, findAuditLogsByComplaintId |
| `frontend/src/lib/session.ts` | jose session encrypt/decrypt | VERIFIED | SignJWT HS256, createSession with httpOnly cookie, deleteSession |
| `frontend/src/lib/dal.ts` | verifySession() with React cache | VERIFIED | cache() wrapper, redirect('/login') on no session |
| `frontend/src/lib/api.ts` | fetchAPI + fetchAuthAPI | VERIFIED | fetchAuthAPI injects Authorization: Bearer header |
| `frontend/src/middleware.ts` | Edge route protection | MISSING | File does not exist. Logic lives in proxy.ts which Next.js does not pick up as Edge middleware. |
| `frontend/src/app/login/page.tsx` | Login form | VERIFIED | 59 lines, email + password fields, error display, useActionState |
| `frontend/src/app/login/actions.ts` | Login server action | VERIFIED | Validates, calls backend, createSession, redirect |
| `frontend/src/app/tickets/page.tsx` | Complaint queue server page | VERIFIED | verifySession(), fetchAuthAPI, filters forwarded to backend, renders TicketFilters + TicketTable |
| `frontend/src/app/tickets/components/ticket-table.tsx` | Table with all columns | VERIFIED | 130 lines, 6 columns, Link navigation, Badge status/risk |
| `frontend/src/app/tickets/components/ticket-filters.tsx` | Filter dropdowns | PARTIAL | 98 lines, has status/riskLevel/isOverdue — missing tipologyId filter |
| `frontend/src/app/tickets/[id]/page.tsx` | Ticket detail server page | VERIFIED | Fetches complaint + executions + artifacts in parallel, renders all 5 sub-components |
| `frontend/src/app/tickets/[id]/components/ticket-header.tsx` | Header card | VERIFIED | Protocol, status badge, risk badge, SLA, tipology, situation, regulatoryAction |
| `frontend/src/app/tickets/[id]/components/ticket-details.tsx` | rawText + details + attachments | VERIFIED | rawText block, details definition list, attachments list |
| `frontend/src/app/tickets/[id]/components/ticket-history.tsx` | History timeline | VERIFIED | Vertical timeline with action, description, status transitions |
| `frontend/src/app/tickets/[id]/components/ticket-executions.tsx` | Executions list | VERIFIED | Real render loop with steps, empty state |
| `frontend/src/app/tickets/[id]/components/ticket-artifacts.tsx` | Artifacts list | VERIFIED | Real render loop, empty state |
| `frontend/src/components/nav-bar.tsx` | Nav with user name + logout | VERIFIED | BKO Agent branding, session.name, logout form action |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| LoginPage | login server action | useActionState(login, {}) | WIRED | Action called on form submit |
| login action | POST /api/auth/login | fetchAPI('/api/auth/login') | WIRED | Returns access_token + user |
| login action | session cookie | createSession(accessToken, user) | WIRED | jose encrypt, httpOnly cookie |
| TicketsPage | GET /api/complaints | fetchAuthAPI('/api/complaints') | WIRED | Auth header injected, filters in query string |
| TicketPage | GET /api/complaints/:id | fetchAuthAPI('/api/complaints/${id}') | WIRED | Promise.all with executions + artifacts |
| fetchAuthAPI | verifySession() | await verifySession() | WIRED | Retrieves accessToken from session |
| verifySession() | session cookie | await cookies() + decrypt() | WIRED | jose verify, redirects on failure |
| JwtAuthGuard | @Public() | reflector.getAllAndOverride | WIRED | Login bypassed, all other endpoints protected |
| RolesGuard | @Roles() | reflector.getAllAndOverride | WIRED | user.role checked against ROLES_KEY metadata |
| proxy.ts | Next.js Edge | BROKEN | NOT_WIRED | proxy.ts exports 'proxy' not 'middleware'; file is at wrong path; middleware-manifest.json shows empty |

### Requirements Coverage

| Requirement Area | Status | Notes |
|-----------------|--------|-------|
| AUTH-01: Login with JWT | SATISFIED | Full bcrypt + JWT flow |
| AUTH-02: Protected endpoints | SATISFIED | Global APP_GUARD pattern |
| AUTH-03: Role-based access | SATISFIED | RolesGuard + @Roles decorator |
| TICK-01: Complaint list with pagination | SATISFIED | getManyAndCount, totalPages |
| TICK-02: Complaint filtering | PARTIAL | Backend supports all filters; frontend missing tipologyId UI |
| TICK-04: Ticket detail with full relations | SATISFIED | leftJoinAndSelect all 7 relations |
| TICK-05: Execution sub-resources | SATISFIED | /executions, /artifacts, /logs |
| TICK-06: Frontend complaint queue | PARTIAL | Table present, tipologia filter missing |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend/src/proxy.ts` | Wrong filename for Next.js middleware | Blocker (partial) | Edge middleware layer inactive; route protection falls back to server component DAL only |
| `frontend/src/app/tickets/components/ticket-filters.tsx` | Missing tipologia filter | Warning | Users cannot filter by tipology from the UI despite backend support |

### Human Verification Required

#### 1. Login Flow End-to-End

**Test:** Start both services. Navigate to /login. Enter operator@bko.ai / operator123. Submit.
**Expected:** Redirect to /tickets, navbar shows "Ana Operadora", complaint table loads.
**Why human:** Visual confirmation of session, redirect, and data load.

#### 2. Invalid Login Error Display

**Test:** Submit /login with wrong password.
**Expected:** "Email ou senha inválidos." message appears below password field without page reload.
**Why human:** Error state rendering requires actual form submission.

#### 3. Session Persistence on Refresh

**Test:** Log in, then refresh /tickets.
**Expected:** Stay on /tickets (not redirected to /login), data still loads.
**Why human:** Cookie persistence across requests requires browser verification.

#### 4. Unauthenticated Access Redirect

**Test:** Clear cookies, navigate directly to /tickets.
**Expected:** Redirect to /login.
**Why human:** Confirms server-component DAL protection works in practice (Edge middleware not active).

#### 5. Ticket Detail Navigation

**Test:** On /tickets, click any row. Observe URL and page content.
**Expected:** Navigate to /tickets/[uuid], header shows protocol number, status, risk badges.
**Why human:** Navigation and data binding require browser interaction.

### Gaps Summary

Two gaps were found against the 29 must-haves:

**Gap 1 — Missing Edge Middleware (partial functional impact):** The planned `src/middleware.ts` file does not exist. Route protection logic was implemented in `src/proxy.ts`, which Next.js does not recognise as Edge middleware. The compiled `middleware-manifest.json` confirms no middleware is registered. Route protection is still functional via `verifySession()` called at the top of both `/tickets` server components — unauthenticated users are redirected to `/login`. The gap is architectural (no Edge-layer interception) rather than a complete protection failure.

**Gap 2 — Missing Tipologia Filter in Frontend (functional gap):** The must-have specifies "Filters on /tickets allow filtering by status, tipologia, risco, and overdue." The backend `ComplaintFilterDto` accepts `tipologyId` and the service filters correctly. However, `ticket-filters.tsx` only exposes three dropdowns (status, riskLevel, isOverdue) and `ticket-table.tsx`'s parent page does not include `tipologyId` in `SearchParams`. Users cannot filter the complaint queue by tipology from the UI.

All other 27 must-haves are fully verified against the actual implementation.

---
_Verified: 2026-03-17T22:12:17Z_
_Verifier: Claude (gsd-verifier)_
