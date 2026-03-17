# Phase 02: Access Layer - Research

**Researched:** 2026-03-17
**Domain:** NestJS JWT/RBAC authentication + Next.js App Router session management + BFF ticket APIs
**Confidence:** HIGH

## Summary

Phase 02 delivers three things: (1) a NestJS auth service with JWT + RBAC, (2) BFF endpoints for tickets/artifacts/logs, and (3) a Next.js frontend with login flow, complaint queue, and ticket detail pages. The stack is fixed by prior decisions: NestJS 11 + TypeORM 0.3 on the backend, Next.js 16 (App Router) + Tailwind v4 on the frontend.

The standard NestJS auth pattern uses `@nestjs/passport` + `@nestjs/jwt` with a LocalStrategy (email/password login) and JwtStrategy (request guard). RBAC is implemented with custom `@Roles()` decorators + a `RolesGuard` that reads metadata via NestJS `Reflector`. On the frontend, Next.js 16 official docs (version 16.1.7, fetched 2026-03-16) prescribe: `jose` for JWT operations, `httpOnly` cookies for session storage, a `middleware.ts` file for route protection, and a Data Access Layer (DAL) with `verifySession()` to enforce auth close to data.

The `user` table does not yet exist — it must be created via a new TypeORM migration following the project's established pattern (raw SQL in `queryRunner.query`, `synchronize: false`). The frontend has no installed component library yet; shadcn/ui with Tailwind v4 is the correct choice (shadcn now ships Tailwind v4 + React 19 support natively).

**Primary recommendation:** Backend uses `@nestjs/passport` + `@nestjs/jwt` + `bcrypt`. Frontend uses `jose` + `cookies()` API + shadcn/ui. No session library like NextAuth — custom implementation per the architecture doc.

## Standard Stack

### Core — Backend (add to existing NestJS)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/passport` | 11.0.5 | Passport integration for NestJS guards/strategies | NestJS-official, matches NestJS 11 |
| `@nestjs/jwt` | 11.0.2 | JWT signing/verification module | NestJS-official, wraps jsonwebtoken |
| `passport` | ^0.7 | Core Passport.js | Peer dep of @nestjs/passport |
| `passport-local` | ^1.0 | Username/password strategy | Standard for login endpoint |
| `passport-jwt` | ^4.0 | JWT extraction from Bearer header | Standard for API guard |
| `bcrypt` | ^6.0 | Password hashing (native C++) | 3-4x faster than bcryptjs; NestJS server-only, no edge |
| `@types/passport-jwt` | ^4.0 | Types for passport-jwt | Dev dependency |
| `@types/bcrypt` | ^5.0 | Types for bcrypt | Dev dependency |
| `@types/passport-local` | ^1.0 | Types for passport-local | Dev dependency |

### Core — Frontend (add to Next.js)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jose` | ^6.0 | JWT sign/verify (Edge-compatible) | Next.js official docs prescribe this; Edge Runtime compatible |
| `server-only` | latest | Marks session code as server-only | Next.js official pattern to prevent client leakage |
| shadcn/ui | latest CLI | UI components (Table, Form, Badge, Select) | Ships Tailwind v4 + React 19 support; data table via TanStack Table |
| `@tanstack/react-table` | ^8 | Headless table logic | shadcn data-table is built on this |

### Supporting — Frontend
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | ^5 | Server state + caching for client components | Ticket list polling, filter state, mutations |
| `zustand` | ^5 | Client-side UI state | Auth context for client components, filter UI state |
| `zod` | ^3 | Schema validation | Login form validation on server action |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `bcrypt` | `bcryptjs` | bcryptjs is pure JS, slower (~3x), but works on edge. NestJS is Node.js-only so use bcrypt |
| custom JWT frontend | NextAuth.js / Auth.js | Architecture doc explicitly specifies custom auth; NextAuth adds complexity and opinionation we don't need |
| `jose` | `jsonwebtoken` | jsonwebtoken doesn't work in Edge Runtime (middleware). jose works everywhere |
| shadcn/ui | Radix UI primitives directly | shadcn gives pre-styled components; for an internal PoC, shadcn is the right speed/quality tradeoff |

**Backend installation:**
```bash
cd backend
npm install @nestjs/passport @nestjs/jwt passport passport-local passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt @types/passport-local @types/passport
```

**Frontend installation:**
```bash
cd frontend
npm install jose server-only @tanstack/react-query zustand zod
# Initialize shadcn/ui (detects Tailwind v4 automatically)
npx shadcn@latest init
# Add components as needed
npx shadcn@latest add table button input badge select form label card
```

## Architecture Patterns

### Recommended Backend Module Structure
```
src/
├── modules/
│   ├── auth/                    # NEW - auth domain
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts   # POST /auth/login, POST /auth/logout, GET /auth/me
│   │   ├── auth.service.ts      # validateUser(), login(), getProfile()
│   │   ├── strategies/
│   │   │   ├── local.strategy.ts   # LocalStrategy(email, password)
│   │   │   └── jwt.strategy.ts     # JwtStrategy(Bearer token)
│   │   ├── guards/
│   │   │   ├── local-auth.guard.ts  # extends AuthGuard('local')
│   │   │   ├── jwt-auth.guard.ts    # extends AuthGuard('jwt'), global
│   │   │   └── roles.guard.ts       # reads @Roles() metadata
│   │   └── decorators/
│   │       ├── roles.decorator.ts   # @Roles('operator', 'admin')
│   │       └── public.decorator.ts  # @Public() skips JWT guard
│   ├── tickets/                 # NEW - BFF layer for complaint access
│   │   ├── tickets.module.ts
│   │   ├── tickets.controller.ts  # GET /tickets, GET /tickets/:id, etc.
│   │   └── tickets.service.ts     # queries complaint + related entities
│   └── usuarios/                # NEW - user management
│       ├── usuarios.module.ts
│       ├── usuarios.service.ts  # findByEmail(), findById()
│       └── entities/
│           └── usuario.entity.ts
├── database/
│   ├── migrations/
│   │   └── 1773774006000-CreateUsuarioTable.ts  # NEW
│   └── seeds/  # may add user seeder for dev
```

### Recommended Frontend Structure
```
app/
├── (auth)/                  # Route group - no layout chrome
│   └── login/
│       ├── page.tsx          # Login page (Server Component)
│       └── login-form.tsx    # 'use client' form component
├── (protected)/             # Route group - requires auth
│   ├── layout.tsx            # Verifies session via DAL
│   ├── tickets/
│   │   ├── page.tsx          # Complaint queue (Server Component)
│   │   └── [id]/
│   │       └── page.tsx      # Ticket detail (Server Component)
│   └── components/
│       ├── complaint-table.tsx   # shadcn DataTable with filters
│       └── ticket-detail.tsx     # tabs: details / history / artifacts / logs
lib/
├── session.ts               # encrypt(), decrypt(), createSession(), deleteSession()
├── dal.ts                   # verifySession(), getCurrentUser()
└── api.ts                   # fetch wrappers calling backend BFF
middleware.ts                # Protects /tickets routes, redirects unauthenticated
```

### Pattern 1: NestJS Global JWT Guard with @Public() escape hatch

Register JwtAuthGuard globally. Routes that don't need auth get `@Public()` decorator. This avoids forgetting `@UseGuards()` on protected routes.

**What:** Global APP_GUARD for JWT; `@Public()` SetMetadata for login endpoint
**When to use:** Always — this is the production pattern

```typescript
// Source: NestJS official docs + oneuptime.com/blog/post/2026-01-25-rbac-custom-guards-nestjs
// app.module.ts providers
providers: [
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
],

// decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### Pattern 2: RBAC with @Roles() decorator + RolesGuard

```typescript
// Source: NestJS docs + medium.com/@dev.muhammet.ozen RBAC in NestJS
// decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}
```

### Pattern 3: Next.js Session with jose + httpOnly cookies

Official Next.js 16.1.7 docs (2026-03-16) prescribe this exact pattern:

```typescript
// Source: nextjs.org/docs/app/guides/authentication (fetched 2026-03-16, version 16.1.7)
// lib/session.ts
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: { userId: string; role: string; expiresAt: Date }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, role, expiresAt });
  (await cookies()).set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  (await cookies()).delete('session');
}
```

### Pattern 4: Next.js middleware.ts for route protection

```typescript
// Source: nextjs.org/docs/app/guides/authentication (fetched 2026-03-16, version 16.1.7)
// middleware.ts (root of project)
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';

const protectedRoutes = ['/tickets'];
const publicRoutes = ['/login'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  const isPublic = publicRoutes.includes(path);

  const cookie = req.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL('/tickets', req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```

### Pattern 5: Next.js DAL verifySession()

```typescript
// Source: nextjs.org/docs/app/guides/authentication (fetched 2026-03-16, version 16.1.7)
// lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { decrypt } from './session';
import { redirect } from 'next/navigation';

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value;
  const session = await decrypt(cookie);
  if (!session?.userId) redirect('/login');
  return { isAuth: true, userId: session.userId as string, role: session.role as string };
});
```

### Pattern 6: TypeORM Migration for user table

Follow the existing project pattern (raw SQL, no synchronize):

```typescript
// Source: existing project migrations pattern (1773774001000-CreateOperacaoTables.ts)
// Timestamp: 1773774006000
export class CreateUsuarioTable1773774006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "usuario" (
        "id"           UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "email"        VARCHAR   NOT NULL,
        "passwordHash" VARCHAR   NOT NULL,
        "name"         VARCHAR   NOT NULL,
        "role"         VARCHAR   NOT NULL DEFAULT 'operator',
        "isActive"     BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usuario" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_usuario_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_usuario_email" ON "usuario" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_usuario_role" ON "usuario" ("role")`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "usuario"`);
  }
}
```

### Pattern 7: BFF Ticket endpoint with filters + pagination

The GET /tickets endpoint must support query params: `status`, `tipologyId`, `riskLevel`, `isOverdue`, `situationId` (etapa), `page`, `limit`.

```typescript
// Source: TypeORM 0.3 QueryBuilder pattern
// tickets.service.ts
async findAll(filters: TicketFilterDto): Promise<{ data: Complaint[]; total: number }> {
  const qb = this.complaintRepo.createQueryBuilder('c')
    .leftJoinAndSelect('c.tipology', 'tipology')
    .leftJoinAndSelect('c.situation', 'situation')
    .orderBy('c.createdAt', 'DESC');

  if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });
  if (filters.riskLevel) qb.andWhere('c.riskLevel = :riskLevel', { riskLevel: filters.riskLevel });
  if (filters.tipologyId) qb.andWhere('c.tipologyId = :tipologyId', { tipologyId: filters.tipologyId });
  if (filters.isOverdue !== undefined) qb.andWhere('c.isOverdue = :isOverdue', { isOverdue: filters.isOverdue });

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  qb.skip((page - 1) * limit).take(limit);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}
```

### Anti-Patterns to Avoid

- **Storing JWT in localStorage**: Always use httpOnly cookies. localStorage is XSS-vulnerable.
- **Trusting middleware as sole auth check**: Middleware is "optimistic check". Every server action / route handler must call `verifySession()` independently.
- **Using `synchronize: true` for user table**: Confirmed pitfall from Phase 1. Always use migrations.
- **Using `eager: true` on complaint relations**: The complaint entity has `eager: false`. Loading all relations eagerly causes N+1 and over-fetching. Use explicit `leftJoinAndSelect` per query.
- **Using `@BeforeInsert` on entity for password hashing**: Tempting but couples hashing to persistence layer. Hash in service before calling `repo.save()`.
- **Putting role check in Layout only**: Next.js partial rendering means layout does not re-run on navigation. Auth checks belong in DAL/page, not layout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification (backend) | Custom crypto | `@nestjs/jwt` | Handles secret, expiry, signing algorithm |
| Passport strategy wiring | Custom middleware | `@nestjs/passport` + `PassportStrategy` | Integrates with NestJS guards pipeline |
| Password hashing | Custom hash | `bcrypt` | bcrypt has proper salt rounds, timing-safe comparison |
| Frontend JWT operations | Custom crypto | `jose` | Edge Runtime compatible, maintained, used in Next.js docs |
| Table/sort/filter logic | Custom table | `@tanstack/react-table` via shadcn | Handles pagination state, column visibility, sorting |
| Form validation (frontend) | Custom validators | `zod` + `useActionState` | Type-safe schemas, works in Server Actions |
| Route protection | Custom redirect logic | `middleware.ts` + DAL pattern | Official Next.js recommended approach |

**Key insight:** Auth has many edge cases (token expiry, timing attacks, CSRF, session fixation). Every layer already has a standard library. Don't build any of it custom.

## Common Pitfalls

### Pitfall 1: TypeORM enum columns vs VARCHAR — schema already uses VARCHAR
**What goes wrong:** Phase 1 decision (02-01-02: Status columns as VARCHAR in SQL, TypeScript enums at app layer). If the user `role` column is created as a PostgreSQL `ENUM` type, adding a new role later requires `ALTER TYPE` — complex in production.
**Why it happens:** NestJS/TypeORM docs show `enum` column type as the default example.
**How to avoid:** Create `role` as `VARCHAR NOT NULL DEFAULT 'operator'` in migration. Use TypeScript enum only at app layer.
**Warning signs:** Migration SQL contains `CREATE TYPE "user_role_enum"`.

### Pitfall 2: JWT secret not set / using wrong env var name
**What goes wrong:** `@nestjs/jwt` signing fails silently or throws `SecretOrPublicKey` error.
**Why it happens:** JWT_SECRET missing from `.env` or ConfigService not injected into JwtModule.
**How to avoid:** Add `JWT_SECRET` and `JWT_EXPIRES_IN` to Joi validation schema in AppModule. Use `JwtModule.registerAsync()` with ConfigService.
**Warning signs:** 500 errors on login with no useful message; test with `curl -v POST /auth/login`.

### Pitfall 3: Next.js cookies() must be awaited in Next.js 15+
**What goes wrong:** `cookies().get('session')` returns undefined or throws.
**Why it happens:** Next.js 15+ made `cookies()` async. Official docs show `await cookies()`.
**How to avoid:** Always `const cookieStore = await cookies(); cookieStore.get(...)`.
**Warning signs:** TypeScript type error "Property 'get' does not exist on type 'Promise'".

### Pitfall 4: Middleware runs on all routes including static assets
**What goes wrong:** Auth check runs on `_next/static`, `favicon.ico`, causing errors.
**Why it happens:** Default middleware matches everything.
**How to avoid:** Use the `matcher` config to exclude static paths (see Pattern 4 above).
**Warning signs:** 302 redirect loops or 401 errors on CSS/JS requests.

### Pitfall 5: N+1 queries on ticket list
**What goes wrong:** Loading complaint list triggers separate queries for each tipology/situation relation.
**Why it happens:** Relations are `eager: false` in entity (correct), but service doesn't join.
**How to avoid:** Use `createQueryBuilder` with `leftJoinAndSelect` for the specific relations needed by the list view (tipology label, situation label, no full detail loading).
**Warning signs:** 20+ SQL queries in logs for a single `GET /tickets` call.

### Pitfall 6: shadcn/ui with Tailwind v4 needs `new-york` style
**What goes wrong:** `npx shadcn@latest init` defaults to `new-york` style now; old guides reference `default` style which is deprecated.
**Why it happens:** shadcn deprecated `default` style for Tailwind v4 projects.
**How to avoid:** Accept `new-york` default during init. Use `tw-animate-css` instead of `tailwindcss-animate`.
**Warning signs:** Animation utilities not working; components look unstyled.

### Pitfall 7: @BeforeUpdate not called by TypeORM QueryBuilder
**What goes wrong:** If using `repo.update()` or QueryBuilder `.update()`, TypeORM hooks (`@BeforeUpdate`) do NOT fire.
**Why it happens:** TypeORM hooks only fire when using `repo.save()` with a managed entity instance.
**How to avoid:** For the `Complaint` status update (`POST /tickets/:id/start`), load entity first, mutate, then `repo.save()`.
**Warning signs:** `updatedAt` not changing, or hooks not triggering.

## Code Examples

### Login flow — backend auth controller
```typescript
// Source: NestJS passport docs pattern + oneuptime.com 2026 RBAC guide
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
    // Returns: { access_token: string, user: { id, email, role } }
  }

  @Get('me')
  getProfile(@Request() req) {
    return req.user; // Injected by JwtStrategy.validate()
  }

  @Post('logout')
  async logout(@Response() res) {
    res.clearCookie('session');
    return res.json({ message: 'logged out' });
  }
}
```

### Login flow — frontend Server Action
```typescript
// Source: nextjs.org/docs/app/guides/authentication (fetched 2026-03-16, version 16.1.7)
// app/actions/auth.ts
'use server';
import { z } from 'zod';
import { createSession } from '@/lib/session';
import { redirect } from 'next/navigation';

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function login(state: unknown, formData: FormData) {
  const validated = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };

  const res = await fetch(`${process.env.BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated.data),
  });

  if (!res.ok) return { errors: { email: ['Invalid credentials'] } };

  const { access_token, user } = await res.json();
  await createSession(user.id, user.role);
  redirect('/tickets');
}
```

### Complaint queue with URL-based filter state
```typescript
// Source: nextjs.org/learn/dashboard-app/adding-search-and-pagination
// app/(protected)/tickets/page.tsx (Server Component)
export default async function TicketsPage({ searchParams }) {
  const { status, riskLevel, tipologyId, page = '1' } = await searchParams;
  const session = await verifySession();

  const params = new URLSearchParams({ status, riskLevel, tipologyId, page });
  const res = await fetch(`${process.env.BACKEND_URL}/api/tickets?${params}`, {
    headers: { Authorization: `Bearer ${/* token from session */}` },
    cache: 'no-store',
  });
  const { data: tickets, total } = await res.json();

  return <ComplaintTable tickets={tickets} total={total} currentPage={Number(page)} />;
}
```

### Artifacts endpoint
```typescript
// GET /tickets/:id/artifacts — joins artifact through step_execution to complaint
async findArtifacts(complaintId: string): Promise<Artifact[]> {
  return this.artifactRepo.find({
    where: { complaintId },
    order: { createdAt: 'DESC' },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous | `await cookies()` async | Next.js 15 | Must await everywhere |
| `tailwindcss-animate` | `tw-animate-css` | shadcn v4 migration | Install tw-animate-css not tailwindcss-animate |
| shadcn `default` style | shadcn `new-york` style | Tailwind v4 | Default on init; no action needed |
| `React.forwardRef` in shadcn | Standard function + `data-slot` | shadcn v4 | No impact for usage, only for custom component authoring |
| `@BeforeInsert` for password | Service-layer hash | Best practice | Hash in AuthService.register(), not entity hook |

**Deprecated/outdated:**
- `tailwindcss-animate`: Deprecated by shadcn in Tailwind v4 projects. Use `tw-animate-css`.
- `session.cookies()` (without await): Will throw in Next.js 15+. Always await.
- `localStorage` for JWT: Never correct for production auth. httpOnly cookies only.

## Open Questions

1. **Backend token strategy: Bearer header vs httpOnly cookie**
   - What we know: Architecture doc says BFF pattern. Frontend fetches backend via Server Actions/Route Handlers (server-to-server). Tokens can be passed as Authorization headers from server to backend since they never hit the browser.
   - What's unclear: Whether the frontend will ever call the backend directly from client components (which would require cookie-based backend auth or exposing the token to client).
   - Recommendation: Backend accepts Bearer token in Authorization header (standard). Frontend stores session in httpOnly cookie via `jose`. Frontend server actions extract the token from session and forward as Bearer header to backend. Client components use TanStack Query pointing to Next.js Route Handlers (not directly to backend).

2. **User seeding for development**
   - What we know: Phase 1 seeded 20 mock complaints. No user records exist.
   - What's unclear: Whether a seed script should create test users (operator/supervisor/admin) automatically.
   - Recommendation: Add user seeding to the existing seed infrastructure. Hash passwords with bcrypt at seed time.

3. **Token storage in frontend session cookie**
   - What we know: Next.js docs recommend storing minimal payload (userId, role) in session cookie, not the JWT itself.
   - What's unclear: Whether to store the backend JWT in the session cookie or re-sign with a separate SESSION_SECRET.
   - Recommendation: Store the backend JWT in the session cookie encrypted via `jose` (SESSION_SECRET). The backend JWT IS the access token; this avoids double-token management.

## Sources

### Primary (HIGH confidence)
- `nextjs.org/docs/app/guides/authentication` — Fetched 2026-03-16, version 16.1.7. Complete auth patterns, session management, DAL, middleware examples.
- `ui.shadcn.com/docs/tailwind-v4` — Fetched 2026-03-17. Tailwind v4 breaking changes, `tw-animate-css` migration, `new-york` style default.
- `ui.shadcn.com/docs/components/data-table` — Fetched 2026-03-17. TanStack Table integration, server-side pagination approach.
- Existing project codebase — Phase 1 migration pattern, entity structure, AppModule config, TypeORM 0.3 usage.

### Secondary (MEDIUM confidence)
- WebSearch: `@nestjs/passport` 11.0.5, `@nestjs/jwt` 11.0.2 versions (multiple sources agree, including jsDocs.io package page)
- WebSearch (oneuptime.com/blog 2026-01-25): RBAC custom guards NestJS — global APP_GUARD pattern, RolesGuard + Reflector pattern. Consistent with NestJS official docs pattern.
- WebSearch (workos.com/blog 2026): Next.js App Router auth guide — jose library recommendation, httpOnly cookie pattern. Consistent with official docs.

### Tertiary (LOW confidence)
- WebSearch: bcrypt vs bcryptjs comparison (pkgpulse.com, stackshare.io) — performance claims (~3-4x) not independently verified but consistent across sources. Recommendation (use bcrypt for Node.js) is LOW for the specific numbers, HIGH for the recommendation direction.

## Metadata

**Confidence breakdown:**
- Standard stack (backend): HIGH — @nestjs/passport 11.0.5 + @nestjs/jwt 11.0.2 confirmed, bcrypt for Node.js confirmed
- Standard stack (frontend): HIGH — jose + httpOnly cookies from official Next.js 16.1.7 docs; shadcn Tailwind v4 confirmed
- Architecture patterns: HIGH — directly from official Next.js docs and existing project patterns
- Pitfalls: HIGH for project-specific ones (VARCHAR not enum, await cookies()), MEDIUM for N+1 and shadcn style

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable ecosystem; shadcn moves fast but core patterns are stable)
