# BKO AI Agent — Backend

NestJS 11 + TypeScript backend that automates ANATEL complaint response
generation for telecom operators. Pairs with the BKO Console frontend
(repo: `maxcardoso-git/BKO-Console`).

> **Read first:** [GLOSSARY.md](./GLOSSARY.md) for domain terms,
> [ARCHITECTURE.md](./ARCHITECTURE.md) for module map + /processar flow,
> [HANDOFF.md](./HANDOFF.md) for current state and known issues.

## Stack

- **Runtime:** Node 22, NestJS 11, TypeScript 5
- **DB:** PostgreSQL 17 + `pgvector` extension (1536-dim embeddings)
- **ORM:** TypeORM with explicit migrations under `src/database/migrations/`
- **Auth:** JWT (Passport) + opaque access tokens for token-exchange
- **LLM:** `@ai-sdk/openai` + `@ai-sdk/anthropic`, model selection via
  the `llm_model_config` + `resource` tables (see [LLM resolution](#llm-resolution))
- **Realtime:** `@nestjs/websockets` + `@nestjs/platform-socket.io` (gateway
  registered but not yet consumed by frontend)

## Commands

```bash
cd backend
npm install
npm run start:dev               # watch mode (port 3111)
npm run build                   # nest build → dist/
npm run start:prod              # node dist/main
npm run migration:generate -- src/database/migrations/$NAME  # NAME via env
npm run migration:run
npm run migration:revert
npm run seed                    # run src/database/seeds/run.ts
```

Backend runs on **port 3111**. Frontend expects `NEXT_PUBLIC_API_URL=http://<host>:3111`.

## Project layout

```
backend/src/
├── main.ts                       # bootstrap, /api global prefix, CORS
├── app.module.ts                 # registers all feature modules
├── events.gateway.ts             # WS gateway (idle, ready for future use)
├── database/
│   ├── data-source.ts            # TypeORM CLI datasource
│   ├── migrations/               # timestamped migrations — append, never edit
│   ├── seeds/                    # idempotent seed scripts
│   └── pgvector-bootstrap.service.ts  # registers pgvector type on pool
├── guards/                       # global guards (api-key on ingest webhook)
└── modules/
    ├── auth/                     # login, token-exchange, JWT strategy, RolesGuard
    ├── operacao/                 # complaint, lock, user, access-token, turbina, template-override, admin-users
    ├── execucao/                 # ticket-execution, analytics, observability, human-review, audit, feedback
    ├── ia/                       # smart-note + 4 agents (parse, draft, compliance, composer) + model-selector
    ├── base-de-conhecimento/     # KB ingestion, vector search, template resolver
    ├── memoria/                  # human-feedback memory + retrieval (RAG over past corrections)
    ├── regulatorio/              # response-templates, mandatory-info-rule
    └── orquestracao/             # resource registry, steps-designer
```

## Conventions

### Role-based access

`UserRole` enum is **lowercase** at the DB / JWT / RolesGuard level:

```ts
export enum UserRole {
  OPERATOR = 'operator',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
}
```

Frontend uppercases for its own route guards — backend never converts.
RolesGuard does strict `requiredRoles.includes(user.role)` matching.

**Rule of thumb when adding endpoints:** if the operator uses it in
the `/processar` flow, allow `OPERATOR, SUPERVISOR, ADMIN`. Admin-only is
reserved for config tables (templates, personas, resources, users, reset).
See [HANDOFF.md](./HANDOFF.md) for an incident where this rule was violated.

### Secret masking

Any controller that returns rows from the `resource` table MUST pass them
through `maskResource()` in `orquestracao/services/resource.service.ts`.
Raw `apiKeyValue` / `bearerToken` / `basicPassword` never leave the backend.
The masked echo (`first8***last4`) is detected on `update()` and skipped so
the secret isn't overwritten when the operator re-saves the dialog.

### LLM resolution

For any LLM call, resolve the API key in this priority order:
1. `resource.apiKeyValue` (if `resourceId` is set on the model config)
2. `resource.bearerToken`
3. `OPENAI_API_KEY` from `.env` (fallback only)

Embeddings use the same chain (see `vector-search.service.resolveEmbeddingConfig()`).
There is **no per-user LLM config** — it's global per functionality
(`CLASSIFICATION`, `GENERATION`, `ANALYSIS`, `EXTRACTION`, `REVIEW`).

### Migrations

- Filenames are `{epoch_ms}-{Description}.ts` — use `Date.now()` for the prefix.
- Never edit a migration that has already run in any environment. Add a new one.
- The dump in `BKO-Deploy/` already contains all schema; `migration:run`
  on a restored DB is a no-op for the existing migrations.

### Conventions to keep

- No unsolicited refactors. Bug fixes stay surgical.
- Don't add error handling for cases that can't happen (trust internal
  contracts; validate at boundaries: webhook ingest, login, file upload).
- Avoid feature flags / backward-compat shims — change the code directly.
- Comments only when the WHY isn't obvious from code.

## Environment

Required `.env` (see `BKO-Deploy/backend.env.example`):
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME`
- `EMBEDDING_DIMENSIONS=1536`
- `JWT_SECRET`, `JWT_EXPIRES_IN=7d`
- `OPENAI_API_KEY` (optional fallback)
- `INGEST_API_KEY` (validates `/webhooks/ingest` requests when wired)

## Production reference

- **VPS:** `root@72.61.52.70`
- **Path:** `/root/EngDB/BKOAgent/backend`
- **Process manager:** `pm2`, app name `bko-backend`, port 3111
- **DB:** Docker container `bkoagent-postgres-1` (`pgvector/pgvector:pg17`) on host port 5433
- **Logs:** `pm2 logs bko-backend`
- **Deploy:** see [`BKO-Deploy/DEPLOY.md`](../BKO-Deploy/DEPLOY.md) (delivered out-of-band)
