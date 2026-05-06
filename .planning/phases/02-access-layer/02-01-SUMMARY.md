---
phase: 02-access-layer
plan: 01
subsystem: auth
tags: [nestjs, passport, jwt, bcrypt, rbac, guards, typeorm, postgresql]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypeORM setup, migrations infrastructure, seeder pattern, PostgreSQL schema

provides:
  - Global JWT authentication guard (JwtAuthGuard via APP_GUARD)
  - RBAC guard with @Roles decorator (RolesGuard via APP_GUARD)
  - POST /api/auth/login — email/password login returns JWT + user object
  - GET /api/auth/me — returns authenticated user profile from Bearer token
  - User entity (id, email, passwordHash, name, role, isActive)
  - Migration 1773774006000 creating user table with unique email index
  - UserSeeder with 3 test users (operator, supervisor, admin)
  - @Public() decorator to bypass auth on public endpoints
  - @Roles() decorator for role-based access control

affects:
  - 02-02 (complaint endpoints need auth, will use @Roles and JWT guard)
  - 02-03 (all subsequent API plans depend on auth foundation)
  - All future phases with protected endpoints

# Tech tracking
tech-stack:
  added:
    - "@nestjs/passport ^10"
    - "@nestjs/jwt ^10"
    - "passport"
    - "passport-local"
    - "passport-jwt"
    - "bcrypt"
    - "@types/passport-local"
    - "@types/passport-jwt"
    - "@types/bcrypt"
  patterns:
    - "Global guard via APP_GUARD provider (JwtAuthGuard + RolesGuard)"
    - "@Public() metadata key bypasses JWT guard globally"
    - "LocalStrategy for login (email field renamed from username)"
    - "JwtStrategy validates Bearer token, fetches full User from DB"
    - "AuthService.validateUser returns user without passwordHash"
    - "bcrypt.hashSync at seed time, bcrypt.compare at runtime"

key-files:
  created:
    - backend/src/modules/auth/auth.module.ts
    - backend/src/modules/auth/auth.service.ts
    - backend/src/modules/auth/auth.controller.ts
    - backend/src/modules/auth/strategies/local.strategy.ts
    - backend/src/modules/auth/strategies/jwt.strategy.ts
    - backend/src/modules/auth/guards/jwt-auth.guard.ts
    - backend/src/modules/auth/guards/roles.guard.ts
    - backend/src/modules/auth/decorators/roles.decorator.ts
    - backend/src/modules/auth/decorators/public.decorator.ts
    - backend/src/modules/auth/dto/login.dto.ts
    - backend/src/modules/operacao/entities/user.entity.ts
    - backend/src/database/migrations/1773774006000-CreateUserTable.ts
    - backend/src/database/seeds/user.seeder.ts
  modified:
    - backend/src/modules/operacao/operacao.module.ts (added User to forFeature)
    - backend/src/app.module.ts (added AuthModule + JWT Joi validation)
    - backend/src/app.controller.ts (added @Public on health + root endpoints)
    - backend/src/database/seeds/main.seeder.ts (UserSeeder first)
    - backend/.env (added JWT_SECRET + JWT_EXPIRES_IN)
    - backend/.env.example (added JWT_SECRET + JWT_EXPIRES_IN)

key-decisions:
  - "02-01: role column as VARCHAR (not PostgreSQL enum) per project decision from 01-02"
  - "02-01: APP_GUARD pattern for global guards — no need to apply guards per-controller"
  - "02-01: LocalStrategy uses usernameField: 'email' to match LoginDto"
  - "02-01: JwtStrategy fetches full User from DB (not just payload) for up-to-date isActive check"
  - "02-01: UserSeeder uses upsert by email for idempotency (same as regulatorio pattern)"

patterns-established:
  - "Public endpoints: annotate with @Public() decorator from auth/decorators/public.decorator"
  - "Role-protected endpoints: annotate with @Roles(UserRole.ADMIN) from auth/decorators/roles.decorator"
  - "Import AuthModule in any module needing access to AuthService"

# Metrics
duration: 14min
completed: 2026-03-17
---

# Phase 2 Plan 1: Auth Module Summary

**NestJS JWT auth with global Passport guards, bcrypt user login, RBAC via @Roles decorator, and 3 seeded test users enabling all subsequent protected endpoints**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T21:43:50Z
- **Completed:** 2026-03-17T21:57:40Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Full auth module: LocalStrategy + JwtStrategy + JwtAuthGuard (global) + RolesGuard (global)
- POST /api/auth/login validates bcrypt password, returns JWT + user object
- GET /api/auth/me returns authenticated user profile via Bearer token
- @Public() decorator allows health endpoint and login to bypass global JWT guard
- Migration 1773774006000 creates user table with unique email constraint
- UserSeeder seeds operator@bko.ai, supervisor@bko.ai, admin@bko.ai idempotently

## Task Commits

Each task was committed atomically:

1. **Task 1: User entity, migration, JWT auth + RBAC module** - `4a4597f` (feat)
2. **Task 2: Seed test users and verify full auth flow** - `8d9f831` (feat)

## Files Created/Modified

- `backend/src/modules/auth/auth.module.ts` - Auth module: Passport + JWT config, APP_GUARD providers
- `backend/src/modules/auth/auth.service.ts` - validateUser (bcrypt) + login (JWT sign)
- `backend/src/modules/auth/auth.controller.ts` - POST /api/auth/login + GET /api/auth/me
- `backend/src/modules/auth/strategies/local.strategy.ts` - Passport local strategy (email field)
- `backend/src/modules/auth/strategies/jwt.strategy.ts` - Bearer token validation + user DB lookup
- `backend/src/modules/auth/guards/jwt-auth.guard.ts` - Global JWT guard with @Public() bypass
- `backend/src/modules/auth/guards/roles.guard.ts` - RBAC guard checks req.user.role vs @Roles()
- `backend/src/modules/auth/decorators/roles.decorator.ts` - @Roles(...UserRole[]) decorator
- `backend/src/modules/auth/decorators/public.decorator.ts` - @Public() decorator
- `backend/src/modules/auth/dto/login.dto.ts` - LoginDto with @IsEmail + @IsNotEmpty
- `backend/src/modules/operacao/entities/user.entity.ts` - User entity with UserRole enum
- `backend/src/database/migrations/1773774006000-CreateUserTable.ts` - user table migration
- `backend/src/database/seeds/user.seeder.ts` - 3 test users with bcrypt hashes
- `backend/src/database/seeds/main.seeder.ts` - UserSeeder added first in sequence
- `backend/src/app.module.ts` - AuthModule imported, JWT vars in Joi validation
- `backend/src/app.controller.ts` - @Public() on / and /health endpoints
- `backend/.env` - JWT_SECRET + JWT_EXPIRES_IN added
- `backend/.env.example` - JWT_SECRET + JWT_EXPIRES_IN documented

## Decisions Made

- APP_GUARD pattern chosen over per-controller guards — any endpoint without @Public() is automatically protected, zero chance of accidentally leaving an endpoint unprotected
- JwtStrategy fetches full User from database (not just JWT claims) — ensures isActive check is live, not stale from token
- UserSeeder runs first in MainSeeder sequence — no FK dependencies on users yet, but establishes user-first order for future plans
- LocalStrategy field override: `usernameField: 'email'` to match LoginDto field name

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors on JWT config and strategy**

- **Found during:** Task 1 (build verification)
- **Issue:** JwtModule `expiresIn` type expects `StringValue | number | undefined`, not plain string. JwtStrategy `secretOrKey` cannot be `string | undefined`, requires `string | Buffer`.
- **Fix:** Cast `expiresIn` to `any`, cast `secretOrKey` to `string` (guaranteed by Joi validation)
- **Files modified:** auth.module.ts, jwt.strategy.ts
- **Verification:** `npm run build` succeeds with zero errors
- **Committed in:** 4a4597f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** TypeScript strict checks on @nestjs/jwt types — minimal fix, no scope creep.

## Issues Encountered

- Docker daemon was not running when migration:run was first attempted. Started Docker Desktop and postgres container, then migration ran successfully.

## Next Phase Readiness

- Auth fully operational: JWT guard global, RBAC via @Roles, 3 test users seeded
- All subsequent endpoints in phase 02 plans are automatically protected — just add @Roles() where needed
- To make an endpoint public: add @Public() decorator
- passwordHash never returned in API responses (stripped in AuthService.validateUser and AuthController.me)

---
*Phase: 02-access-layer*
*Completed: 2026-03-17*
