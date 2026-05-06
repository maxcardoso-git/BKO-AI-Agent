# Technology Stack

**Analysis Date:** 2026-05-06

This monorepo contains two applications: a NestJS backend (`backend/`) and a Next.js frontend (`frontend/`). A second, more feature-rich frontend (`bko-console`) lives in a separate repository on the production server at `/root/EngDB/BKOConsole`; it is not part of this workspace and is referenced only when relevant.

## Languages

**Primary:**
- TypeScript ~5.7 (backend) / ~5 (frontend) — all application code
- SQL — TypeORM migrations under `backend/src/database/migrations/`

**Secondary:**
- JavaScript — only compiled output in `dist/` and Tailwind CSS

## Runtime

**Environment:**
- Node.js 20 (Alpine) — pinned by `backend/Dockerfile:1` and `frontend/Dockerfile:1` (`FROM node:20-alpine`)
- No `.nvmrc` is committed; production runtime is the Docker image

**Package Manager:**
- npm — `package-lock.json` present in both `backend/` and `frontend/`

## Backend Framework Stack (NestJS)

Source of truth: `backend/package.json`.

**Core (NestJS 11):**
- `@nestjs/common` ^11.0.1, `@nestjs/core` ^11.0.1, `@nestjs/platform-express` ^11.0.1
- `@nestjs/config` ^4.0.3 — env loading + `Joi` schema validation (`backend/src/app.module.ts:21-32`)
- `@nestjs/typeorm` ^11.0.0 — TypeORM integration (`backend/src/app.module.ts:34-49`)
- `@nestjs/jwt` ^11.0.2 — JWT issuance (`backend/src/modules/auth/auth.module.ts:23-31`)
- `@nestjs/passport` ^11.0.5 — Passport bridge for `JwtAuthGuard` / `LocalStrategy`
- `@nestjs/websockets` ^11.0.0 — declared in `package-lock.json` and used by `backend/src/events.gateway.ts:6`. Peer-installed; not listed in `backend/package.json` dependencies (gap to track)

**Persistence:**
- `typeorm` ^0.3.28 + `pg` ^8.20.0
- `pgvector` ^0.2.1 — vector type registration via `backend/src/database/pgvector-bootstrap.service.ts:1-32` (hooks `pgvector.registerTypes` into the pg pool on connect)
- `typeorm-extension` ^3.9.0 — seeders (`backend/src/database/seeds/`)

**AI / LLM:**
- `ai` ^6.0.116 (Vercel AI SDK) — `generateText`, `generateObject`, `embed` are used directly (e.g. `backend/src/modules/execucao/services/skill-registry.service.ts:5`)
- `@ai-sdk/openai` ^3.0.41 — `createOpenAI` provider used in `backend/src/modules/ia/services/model-selector.service.ts:5,116`
- `@ai-sdk/anthropic` ^3.0.58 — `createAnthropic` provider; supported by `ModelSelectorService` (`backend/src/modules/ia/services/model-selector.service.ts:6,121`) but no active config currently uses it (`backend/src/database/seeds/llm-model-config.seeder.ts:18-23` seeds OpenAI only)
- `@langchain/core` ^1.1.33 + `@langchain/textsplitters` ^1.0.1 — chunking helpers used by KB ingestion
- `pdf-parse` 1.1.1 — PDF extraction for the knowledge base
- `zod` ^4 (transitive via `ai`) — used directly in `backend/src/modules/execucao/services/skill-registry.service.ts:7` for `generateObject` schemas (`DetermineActionSchema`, `CustomerSentimentSchema`)

**Auth / Crypto:**
- `bcrypt` ^6.0.0 + `@types/bcrypt` ^6.0.0 — password hashing in `backend/src/modules/auth/auth.service.ts:24` and `backend/src/database/seeds/user.seeder.ts:1` (cost factor 10)
- `passport` ^0.7.0, `passport-jwt` ^4.0.1, `passport-local` ^1.0.0

**Realtime:**
- `socket.io` (peer of `@nestjs/websockets`) — `Server`/`Socket` imported in `backend/src/events.gateway.ts:7`. Gateway is a global provider in `backend/src/app.module.ts:59`

**Validation / Transport:**
- `class-validator` ^0.15.1 + `class-transformer` ^0.5.1 — DTO validation through `ValidationPipe` (`backend/src/main.ts:12-18`)
- `joi` ^18.0.2 — env schema (`backend/src/app.module.ts:21-32`)

**Other utilities:**
- `diff` ^8.0.0 — text diffs (HITL editor support)
- `@faker-js/faker` ^10.3.0 — seed/test data factories under `backend/src/database/factories/`
- `rxjs` ^7.8.1, `reflect-metadata` ^0.2.2 (NestJS standard runtime)

**Backend dev tooling:**
- `@nestjs/cli` ^11, `@nestjs/schematics` ^11
- `jest` ^30 + `ts-jest` ^29 + `supertest` ^7 (config inline in `backend/package.json:86-102`, e2e in `backend/test/jest-e2e.json`)
- `eslint` ^9 + `typescript-eslint` ^8.20 + `prettier` ^3.4
- `ts-node` ^10.9, `tsconfig-paths` ^4.2

## Frontend Framework Stack (Next.js)

Source of truth: `frontend/package.json`.

**Core:**
- `next` 16.1.7 (App Router; `frontend/src/app/`)
- `react` 19.2.3 + `react-dom` 19.2.3
- TypeScript ^5

**UI / Styling:**
- `tailwindcss` ^4 (PostCSS plugin `@tailwindcss/postcss` ^4)
- `tw-animate-css` ^1.4.0
- `shadcn` ^4.0.8 + `@base-ui/react` ^1.3.0 — shadcn registry generates components into `frontend/src/components/ui/` (config: `frontend/components.json`, style: `base-nova`, base color: `neutral`, icon library: `lucide`)
- `lucide-react` ^0.577.0 — icons
- `class-variance-authority` ^0.7.1, `clsx` ^2.1.1, `tailwind-merge` ^3.5.0 — `cn()` helper in `frontend/src/lib/utils.ts`
- `recharts` ^2.13.3 — charts
- `react-diff-viewer-continued` ^4.2.0 — HITL diff view

**Forms / Validation:**
- `zod` ^4.3.6 — schema validation
- No `react-hook-form` or `@tanstack/react-query` in this app's `package.json`. Server actions + RSC are used (see `frontend/src/app/login/actions.ts`, `frontend/src/app/actions.ts`). The richer `bko-console` repo (separate, on production server) is where form/query libs live.

**Auth / Session:**
- `jose` ^6.2.1 — signs/verifies the session cookie (`frontend/src/lib/session.ts:3,18-36`)
- `server-only` ^0.0.1 — gates server modules
- Session stored in an HttpOnly cookie named `session`, HS256, 8h TTL (`frontend/src/lib/session.ts:38-55`); JWT bearer token from backend is wrapped inside the session payload and forwarded by `fetchAuthAPI` (`frontend/src/lib/api.ts:17-29`)

**No socket.io-client present** in this frontend; the local UI does not consume the backend `EventsGateway`. The bko-console frontend is the websocket consumer.

**Frontend dev tooling:**
- `eslint` ^9 + `eslint-config-next` 16.1.7
- `@types/node` ^20, `@types/react` ^19, `@types/react-dom` ^19
- `overrides`: `react-is` pinned to `^19.0.0-rc-69d4b800-20241021`

## Build / Dev Scripts

**Backend (`backend/package.json:8-25`):**
- `npm run start:dev` — `nest start --watch`
- `npm run start:prod` — `node dist/main`
- `npm run build` — `nest build`
- `npm test` / `npm run test:e2e` / `npm run test:cov`
- `npm run migration:generate` / `migration:run` / `migration:revert` — TypeORM CLI bound to `dist/database/data-source.js`
- `npm run seed` — `ts-node src/database/seeds/run.ts`

**Frontend (`frontend/package.json:5-10`):**
- `npm run dev` — `next dev`
- `npm run build` — `next build`
- `npm start` — `next start`
- `npm run lint` — `eslint`

## TypeScript Configuration

**Backend (`backend/tsconfig.json`):**
- `target: ES2023`, `module: nodenext`, `moduleResolution: nodenext`
- `strictNullChecks: true`, `noImplicitAny: false`, `strictBindCallApply: false` (loosened)
- Decorators enabled (`emitDecoratorMetadata`, `experimentalDecorators`) — required for NestJS / TypeORM
- `outDir: ./dist`, `incremental: true`, `sourceMap: true`

**Frontend (`frontend/tsconfig.json`):**
- `target: ES2017`, `module: esnext`, `moduleResolution: bundler`
- `strict: true`, `noEmit: true` (Next handles emit), `jsx: react-jsx`
- Path alias `@/* -> ./src/*`
- Includes `.next/types/**/*.ts` for Next's generated route types

## Infrastructure

**PostgreSQL (with pgvector):**
- Image: `pgvector/pgvector:pg17` (`docker-compose.yml:3`)
- Container: `bkoagent-postgres-1`
- Host port: `5433` -> container `5432` (`docker-compose.yml:11-12`)
- DB name: `bkoagent`, user: `bko`, password: `bko_secret` (dev defaults)
- Extensions enabled by `backend/src/database/init.sql:1-2`: `vector`, `uuid-ossp`
- Embedding dimensions: 1536 (`EMBEDDING_DIMENSIONS` env var, default in `backend/src/app.module.ts:27`)
- Local dev `.env` points at remote server: `DB_HOST=72.61.52.70`, `DB_PORT=5433` (`backend/.env:1-2`)
- Migrations auto-run on boot (`backend/src/app.module.ts:44 migrationsRun: true`); 14 migrations in `backend/src/database/migrations/`

**Docker Compose stack (`docker-compose.yml`):**
- `postgres` — pgvector image, named volume `bkoagent_pgdata` (external)
- `backend` — built from `./backend/Dockerfile`, container `bkoagent-backend`, port 3111, depends on `postgres`
- `frontend` — built from `./frontend/Dockerfile`, container `bkoagent-frontend`, port 3210, depends on `backend`
- All services on external network `bkoagent_default` (`docker-compose.yml:62-64`)
- Frontend reaches backend over the docker network: `BACKEND_URL=http://backend:3111`

**Process management:**
- No `ecosystem.config.js` (PM2) or `pm2-*` files exist in this repo. Production process management on the server (PM2) lives outside this workspace.

**Dockerfiles:**
- Both Dockerfiles are single-stage (`node:20-alpine`, `npm install`, `npm run build`, run). No multi-stage build, no production-only deps pruning.
- Backend: `CMD ["node", "dist/main.js"]` (`backend/Dockerfile:11`)
- Frontend: `CMD ["npm", "start"]` (`frontend/Dockerfile:11`)

## Configuration

**Backend env (validated by Joi in `backend/src/app.module.ts:21-32`):**
- Required: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`
- Defaulted: `DB_PORT=5432`, `EMBEDDING_DIMENSIONS=1536`, `NODE_ENV=development`, `JWT_EXPIRES_IN=8h`
- Optional: `OPENAI_API_KEY`, `PORT` (`backend/src/main.ts:19` falls back to 3001)
- Example file: `backend/.env.example`

**Frontend env (read at runtime):**
- `BACKEND_URL` — backend base URL (`frontend/src/lib/api.ts:3`, defaults to `http://localhost:3001`)
- `SESSION_SECRET` — session cookie HMAC key (`frontend/src/lib/session.ts:7`)
- `SECURE_COOKIE` — toggles `secure` cookie flag (`frontend/src/lib/session.ts:50`)
- `PORT` — set to 3210 in compose

## Platform Requirements

**Development:**
- Node 20+, npm
- Docker + Docker Compose for Postgres (or remote DB on `72.61.52.70:5433`)
- pgvector and uuid-ossp Postgres extensions (created by `backend/src/database/init.sql`)

**Production:**
- Linux server at `72.61.52.70` (per `backend/.env`)
- Docker Compose stack for postgres/backend/frontend on external network `bkoagent_default`
- PM2-managed processes for the second `bko-console` UI (separate repo)

---

*Stack analysis: 2026-05-06*
