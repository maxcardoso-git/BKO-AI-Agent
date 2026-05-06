# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**LLM Providers (OpenAI primary, Anthropic supported but not active):**

- **OpenAI** — production LLM and embeddings provider
  - SDK: `@ai-sdk/openai` (`createOpenAI`) and `ai` package (`generateText`, `generateObject`, `embed`)
  - API key resolution: dual path
    1. `OPENAI_API_KEY` env var (validated optional in `backend/src/app.module.ts:31`)
    2. The `resource` DB table (`backend/src/modules/orquestracao/entities/resource.entity.ts:9`) — stores per-resource credentials (`apiKeyValue`, `bearerToken`, `basicUser/Password`) and is linked to LLM models via `llm_model_config.resourceId` (`backend/src/database/migrations/1773880000000-AddResourcesTable.ts:32-36`). The current runtime `ModelSelectorService` reads from env (see below); DB-backed credential resolution is structurally available but not wired into model construction yet.
  - Current code path: `ModelSelectorService.buildLanguageModel` reads `config.apiKeyEnvVar` (always `'OPENAI_API_KEY'` per seed), then calls `this.configService.get<string>(apiKeyEnvVar)` and passes it to `createOpenAI({ apiKey })` (`backend/src/modules/ia/services/model-selector.service.ts:110-126`)
  - Embedding key path mirrors the same pattern (`backend/src/modules/ia/services/model-selector.service.ts:132-140`)

- **Anthropic** — supported by `ModelSelectorService` (`createAnthropic` at `backend/src/modules/ia/services/model-selector.service.ts:120-122`) but no active `llm_model_config` row currently uses provider `'anthropic'` (seeds insert OpenAI rows only — `backend/src/database/seeds/llm-model-config.seeder.ts:18-23`)

**LLM model configurations seeded into `llm_model_config`** (`backend/src/database/seeds/llm-model-config.seeder.ts:16-23`):

| functionalityType | provider | modelId                  | temperature | maxTokens |
|-------------------|----------|--------------------------|-------------|-----------|
| `classificacao`   | openai   | `gpt-4o-mini`            | 0.1         | 1024      |
| `composicao`      | openai   | `gpt-4o`                 | 0.7         | 4096      |
| `avaliacao`       | openai   | `gpt-4o-mini`            | 0.2         | 2048      |
| `embeddings`      | openai   | `text-embedding-3-small` | 0.0         | null      |

Functionality types are looked up by skills via `ModelSelectorService.callWithFallback(functionalityType, ...)`. The entity also defines `fallbackConfigId` (`backend/src/modules/base-de-conhecimento/entities/llm-model-config.entity.ts:51`) which `callWithFallback` follows on primary failure (`backend/src/modules/ia/services/model-selector.service.ts:64-105`).

**Skills that call OpenAI** (orchestrated by `SkillRegistryService.execute` in `backend/src/modules/execucao/services/skill-registry.service.ts`):

| Skill key                    | Where (file:line)                                                                              | Mode             | LLM functionalityType |
|------------------------------|------------------------------------------------------------------------------------------------|------------------|-----------------------|
| `ClassifyTypology`           | `skill-registry.service.ts:214`                                                                | `generateObject` | `classificacao`       |
| `DetermineRegulatoryAction`  | `skill-registry.service.ts:506-543` (uses `DetermineActionSchema` zod schema, line 26-30)      | `generateObject` | `classificacao`       |
| `AnalyzeCustomerSentiment`   | `skill-registry.service.ts:1117-1157` (uses `CustomerSentimentSchema`, line 32-45)             | `generateObject` | `avaliacao`           |
| `DraftFinalResponse`         | `skill-registry.service.ts:248-274` (RAG: also calls `getEmbeddingModel` + `embed`, line 254)  | `generateText`   | `composicao`          |
| `ComplianceCheck`            | `skill-registry.service.ts:305-306`                                                            | `generateObject` | `avaliacao`           |
| `ApplyPersonaTone`           | `skill-registry.service.ts:368, 818-901` (LLM with rule-based fallback on error, line 901)     | `generateText`   | `composicao`          |

Additional LLM-using services:
- `ComplaintParsingAgent` — `generateObject` (`backend/src/modules/ia/services/complaint-parsing.agent.ts:64-68`)
- `DraftGeneratorAgent` — `generateText` (`backend/src/modules/ia/services/draft-generator.agent.ts:86-90`)
- `ComplianceEvaluatorAgent` — `generateObject` (`backend/src/modules/ia/services/compliance-evaluator.agent.ts:87-91`)
- `FinalResponseComposerAgent` — `generateText` (`backend/src/modules/ia/services/final-response-composer.agent.ts:84-88`)
- `MemoryFeedbackService` — embeddings (`backend/src/modules/memoria/services/memory-feedback.service.ts:33`)
- `DocumentIngestionService` — embeddings during KB ingestion (`backend/src/modules/base-de-conhecimento/services/document-ingestion.service.ts:124-127`)
- `VectorSearchService` — embeddings for KB query (`backend/src/modules/base-de-conhecimento/services/vector-search.service.ts:41-44`)

All embedding calls use `text-embedding-3-small` with output dimension 1536 (matches `EMBEDDING_DIMENSIONS=1536` and pgvector column types).

**Resource registry (`resource` table)** — generic credential / endpoint store consumed by orchestration. Schema at `backend/src/database/migrations/1773880000000-AddResourcesTable.ts:6-29`:
- `type`: `API_HTTP | DATABASE | WEBSOCKET | OTHER`
- `subtype`: `LLM | NONE`
- `authMode`: `NONE | BEARER_TOKEN | API_KEY | BASIC_AUTH`
- Stores `bearerToken`, `apiKeyHeader`, `apiKeyValue`, `basicUser`, `basicPassword`, plus `connectionJson`, `configurationJson`, `metadataJson`
- `environment`: `PROD | HML | DEV`
- Managed via `ResourceController` / `ResourceService` (`backend/src/modules/orquestracao/controllers/resource.controller.ts`, `.../services/resource.service.ts`)

## Data Storage

**Primary database — PostgreSQL 17 + pgvector:**
- Connection (dev `.env`): `host=72.61.52.70`, `port=5433`, `db=bkoagent`, `user=bko` (`backend/.env:1-5`)
- Container in compose: `bkoagent-postgres-1`, image `pgvector/pgvector:pg17`, exposed on `localhost:5433` (`docker-compose.yml:2-15`)
- Driver: `pg` ^8.20.0; ORM: `typeorm` ^0.3.28
- pgvector type registration: `PgvectorBootstrapService` (`backend/src/database/pgvector-bootstrap.service.ts:17-31`) attaches a `connect` listener to TypeORM's underlying pg pool and runs `pgvector.registerTypes(client)` so `vector` columns deserialize correctly
- Extensions installed by `backend/src/database/init.sql`: `vector`, `uuid-ossp`
- Migrations auto-run on app boot: `migrationsRun: true` (`backend/src/app.module.ts:44`); CLI scripts in `backend/package.json:21-23`

**Vector embeddings:**
- Stored as `vector(1536)` pgvector columns (e.g. KB chunks, case memory, human-feedback memory)
- Generated via `ModelSelectorService.getEmbeddingModel()` + `embed()` from the `ai` SDK

**File storage:**
- Local filesystem only (no S3/GCS integration). PDF parsing is done in-process with `pdf-parse` during KB ingestion.

**Caching / queue:**
- None configured. The `PROJECT.md` references Redis as a target, but no Redis client (`ioredis`, `redis`, `bull`, `bullmq`) is in `backend/package.json`.

## Authentication & Identity

**Backend — JWT (Bearer) over Passport:**
- Token issuance (`backend/src/modules/auth/auth.service.ts:33-44`): `JwtService.sign({ sub: user.id, email, role })` after `bcrypt.compare` (`auth.service.ts:24`)
- Module wiring: `JwtModule.registerAsync` reads `JWT_SECRET` and `JWT_EXPIRES_IN` (default `'8h'`) from config (`backend/src/modules/auth/auth.module.ts:23-31`)
- Strategies under `backend/src/modules/auth/strategies/`:
  - `LocalStrategy` — email + password against `User` repo
  - `JwtStrategy` (`backend/src/modules/auth/strategies/jwt.strategy.ts:16-37`) — `ExtractJwt.fromAuthHeaderAsBearerToken()`, re-loads `User` by `payload.sub` and rejects inactive users
- Global guards registered as `APP_GUARD` (`backend/src/modules/auth/auth.module.ts:38-45`): `JwtAuthGuard` then `RolesGuard`. `@Public()` decorator opts routes out
- Password hashing: `bcrypt` cost 10 (`backend/src/modules/auth/auth.service.ts:24`, `backend/src/modules/operacao/controllers/admin-users.controller.ts:33,56`, `backend/src/database/seeds/user.seeder.ts:16,22,28`)
- Seeded users (dev): `operator123` / `supervisor123` / `admin123` (`backend/src/database/seeds/user.seeder.ts`)

**Frontend — encrypted session cookie wrapping the JWT:**
- `frontend/src/lib/session.ts:18-36` — `jose` (HS256) signs the payload `{ accessToken, userId, role, email, name }` with `SESSION_SECRET`, 8h expiry
- Cookie `session` is HttpOnly, `sameSite=lax`, `secure` toggled by `SECURE_COOKIE` env (`frontend/src/lib/session.ts:48-54`)
- `frontend/src/lib/api.ts:17-29` — `fetchAuthAPI` reads the session via `verifySession`, then forwards `Authorization: Bearer ${session.accessToken}` to the NestJS API
- Route protection: `frontend/src/middleware.ts` and `frontend/src/lib/dal.ts`

## Realtime — WebSocket Gateway

- Implementation: `backend/src/events.gateway.ts` (`@WebSocketGateway` with CORS allow-list)
- Allowed origins (`backend/src/events.gateway.ts:11-17`): `http://72.61.52.70:3205`, `http://72.61.52.70:3210`, `http://localhost:3000`, `http://localhost:3205`, `http://localhost:3210`
- Transport: `socket.io` `Server` / `Socket` from the `socket.io` package (`backend/src/events.gateway.ts:7`)
- Handlers:
  - `handleConnection(client)` emits `'connected'` to the new client (`events.gateway.ts:25-27`)
  - `handleDisconnect(_client)` is a no-op (`events.gateway.ts:29`)
- Server-side broadcasters:
  - `emitExecutionUpdate(complaintId, payload)` — broadcasts `'execution:update'` (`events.gateway.ts:31-33`)
  - `emitTicketUpdate(complaintId, payload)` — broadcasts `'ticket:update'` (`events.gateway.ts:35-37`)
- Registered as a global provider in `backend/src/app.module.ts:59` (alongside `AppService` and `PgvectorBootstrapService`)
- Current call sites: only the gateway itself and `app.module.ts` reference `EventsGateway`. No service yet calls `emitExecutionUpdate` / `emitTicketUpdate` from inside this repo (consumers / publishers will be wired by future phases). The frontend `bko-console` (separate repo) is the intended client.

## Inbound HTTP API

- NestJS HTTP server bootstrapped in `backend/src/main.ts:8-21`
- Global prefix: `/api` (`backend/src/main.ts:11`)
- CORS: `origin: true, credentials: true` (`backend/src/main.ts:10`) — permissive for browser clients
- Global `ValidationPipe` with `transform: true, whitelist: true` (`backend/src/main.ts:12-18`)
- Listening port: `process.env.PORT ?? 3001` locally; `3111` in compose (`docker-compose.yml:32-34`)

## Monitoring & Observability

**Error tracking / APM:** None (no Sentry, Datadog, OpenTelemetry packages in `backend/package.json`).

**Application logs:** NestJS built-in `Logger` (`@nestjs/common`). Examples: `ModelSelectorService` logs primary/fallback transitions (`backend/src/modules/ia/services/model-selector.service.ts:77,95`), `SkillRegistryService` logs skill failures and persona-tone fallbacks.

**Domain observability:**
- `ObservabilityService` + controller (`backend/src/modules/execucao/services/observability.service.ts`, `.../controllers/observability.controller.ts`) — exposes error-rate-by-skill (`observability.controller.ts:26`)
- `TokenUsageTrackerService` (`backend/src/modules/ia/services/token-usage-tracker.service.ts`) — persists token usage from `generateText` / `generateObject` results

**TypeORM SQL logging:** enabled when `NODE_ENV=development` (`backend/src/app.module.ts:46`).

## CI/CD & Deployment

**CI:** No `.github/workflows`, no GitLab CI, no CircleCI config in this repo. Builds happen at `docker compose build` time on the host server.

**Hosting:**
- Custom Linux server `72.61.52.70` (referenced in `backend/.env:1`, `events.gateway.ts:11-12`, `PROJECT.md`)
- Postgres on host port `5433`; backend on `3111`; frontend on `3210` (`docker-compose.yml`)
- A second frontend (`bko-console`, separate repo) runs on `3205` (per CORS allow-list); managed under PM2 on the same server

## Environment Configuration

**Backend required env vars** (validated by Joi in `backend/src/app.module.ts:21-32`):
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — postgres connection
- `JWT_SECRET` — JWT signing key (no default; required)

**Backend defaulted env vars:**
- `DB_PORT=5432`, `EMBEDDING_DIMENSIONS=1536`, `NODE_ENV=development`, `JWT_EXPIRES_IN=8h`

**Backend optional env vars:**
- `OPENAI_API_KEY` — read by `ModelSelectorService`, `DocumentIngestionService`, `VectorSearchService` via `ConfigService.get('OPENAI_API_KEY')`
- `PORT` — listen port (`backend/src/main.ts:19`, defaults to 3001; compose sets 3111)

**Frontend env vars:**
- `BACKEND_URL` (default `http://localhost:3001`) — consumed by `frontend/src/lib/api.ts:3`
- `SESSION_SECRET` (HMAC for session cookie) — `frontend/src/lib/session.ts:7`
- `SECURE_COOKIE` (`'true'` enables `secure` flag) — `frontend/src/lib/session.ts:50`
- `PORT` (compose sets 3210)

**Secrets location:** `.env` files in each app root (gitignored — `backend/.env` exists locally; `backend/.env.example` is committed). No secrets manager integration. Resource credentials may also live encrypted-at-rest in the `resource` Postgres table (plain columns today).

## Webhooks & Callbacks

- **Incoming webhooks:** None registered. No webhook controllers exist under `backend/src/modules/`.
- **Outgoing webhooks / callbacks:** None. The `resource` entity is structurally capable of representing outbound HTTP integrations (`type='API_HTTP'`, `httpMethod`, `endpoint`, `authMode`), and `ResourceService` exists, but no skill currently performs an HTTP call to an arbitrary registered resource.

---

*Integration audit: 2026-05-06*
