# Phase 1: Foundation - Research

**Researched:** 2026-03-17
**Domain:** Database schema (PostgreSQL + pgvector), NestJS scaffolding, Next.js scaffolding, Docker Compose
**Confidence:** HIGH (stack locked by project decisions; all core tools verified via official sources)

## Summary

Phase 1 establishes the entire data foundation for the BKO Agent platform: ~35 tables across 5 domains with pgvector enabled, seed data for regulatory reference tables, mock complaint injection, and two runnable applications (NestJS backend, Next.js frontend). This is a pure scaffolding and schema phase — no business logic, no auth, no API contracts beyond a health endpoint.

The standard approach is NestJS v11 + TypeORM 0.3.x for the backend with explicitly written SQL migrations (never `synchronize: true`), pgvector/pgvector:pg17 Docker image so the vector extension is pre-installed, typeorm-extension for seed data, and `create-next-app` with TypeScript + Tailwind for the frontend. All services are orchestrated via Docker Compose for local development; the remote server at 72.61.52.70 runs the production PostgreSQL instance.

The single most important decision in this phase is to write explicit TypeORM migration files from day one rather than relying on `synchronize: true`. With 35 tables across 5 domains and the vector column type, auto-sync will cause silent drops and column re-adds, destroying data and breaking subsequent phases.

**Primary recommendation:** Use TypeORM explicit migrations + typeorm-extension seeders for all schema and data work; use `pgvector/pgvector:pg17` Docker image so `CREATE EXTENSION IF NOT EXISTS vector` works without custom builds.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/core` | 11.1.x | NestJS application framework | Locked decision; latest stable as of Mar 2026 |
| `@nestjs/cli` | 11.0.16 | Project scaffolding and code generation | Official NestJS generator |
| `typeorm` | 0.3.x | ORM with migration support | Official NestJS recommendation for PostgreSQL |
| `@nestjs/typeorm` | 11.x | TypeORM integration module for NestJS | Official integration package |
| `pg` | 8.x | PostgreSQL Node.js driver | Required by TypeORM for PostgreSQL |
| `pgvector` | 0.2.x | pgvector npm client for TypeORM/Node.js | Only official pgvector npm package for TypeORM |
| `next` | 16.x | Next.js frontend framework | Locked decision; latest is 16.1.7 (Mar 2026) |
| `react` | 19.x | UI library | Bundled with Next.js 16 |
| `tailwindcss` | 4.x | CSS framework | Locked decision; v4 is current default with Next.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/config` | 4.x | Environment variable management via ConfigModule | Required for DB connection from env |
| `typeorm-extension` | 3.x | Database seeding framework for TypeORM | Seed and mock data injection (DB-08, DB-09) |
| `@faker-js/faker` | 9.x | Fake data generation | Mock complaint data injection |
| `class-validator` | 0.14.x | DTO validation decorators | NestJS standard validation layer |
| `class-transformer` | 0.5.x | Object transformation for DTOs | Pairs with class-validator in NestJS |
| `joi` | 17.x | Environment variable schema validation | Validate required env vars at startup |
| `redis` | 4.x | Redis client for Node.js | Cache/queue — container needed in Docker Compose |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeORM | Prisma | Prisma has better DX but TypeORM is the NestJS standard and supports raw SQL migrations needed for pgvector |
| typeorm-extension | Custom seed scripts | typeorm-extension integrates with TypeORM DataSource, handles factories; custom scripts are simpler but fragile |
| pgvector/pgvector Docker image | Custom Dockerfile with pgvector build | Custom build adds complexity; official image is maintained and versioned |

**Installation (backend):**
```bash
npm install --save @nestjs/typeorm typeorm pg pgvector @nestjs/config class-validator class-transformer joi typeorm-extension @faker-js/faker
npm install --save-dev @nestjs/cli
```

**Installation (frontend):**
```bash
npx create-next-app@latest frontend --yes
# --yes uses defaults: TypeScript, Tailwind CSS v4, ESLint, App Router, Turbopack
```

---

## Architecture Patterns

### Recommended Project Structure

```
bko-agent/
├── backend/                     # NestJS application (nest new backend)
│   ├── src/
│   │   ├── database/
│   │   │   ├── migrations/      # All TypeORM migration files
│   │   │   ├── seeds/           # typeorm-extension seed classes
│   │   │   ├── factories/       # typeorm-extension factory classes
│   │   │   └── data-source.ts   # DataSource used by TypeORM CLI
│   │   ├── modules/
│   │   │   ├── operacao/        # complaint, complaint_detail, etc.
│   │   │   ├── regulatorio/     # tipology, situation, regulatory_rule, etc.
│   │   │   ├── orquestracao/    # capability, step_definition, skill_definition, etc.
│   │   │   ├── execucao/        # ticket_execution, step_execution, artifact, etc.
│   │   │   └── memoria/         # kb_document, kb_chunk, case_memory, etc.
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env                     # Local env vars (gitignored)
│   ├── .env.example             # Committed template
│   ├── typeorm.config.ts        # TypeORM CLI config (imports data-source.ts)
│   └── package.json
├── frontend/                    # Next.js application (create-next-app)
│   ├── app/
│   │   └── page.tsx
│   └── package.json
├── docker-compose.yml           # PostgreSQL + Redis + backend + frontend
└── .planning/
```

### Pattern 1: TypeORM DataSource with Async Config

**What:** Separate `data-source.ts` file that is used both by the NestJS app at runtime and by the TypeORM CLI for migration generation and execution.
**When to use:** Always — this is required to run `typeorm migration:generate` from the CLI.

```typescript
// Source: https://typeorm.io/docs/migrations/why/
// backend/src/database/data-source.ts
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import * as dotenv from 'dotenv';
dotenv.config();

export const dataSourceOptions: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  seeds: ['dist/database/seeds/*.js'],
  factories: ['dist/database/factories/*.js'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);
```

```typescript
// backend/src/app.module.ts — async config reads from ConfigService
// Source: https://docs.nestjs.com/techniques/database
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({
      DB_HOST: Joi.string().required(),
      DB_PORT: Joi.number().default(5432),
      DB_USER: Joi.string().required(),
      DB_PASS: Joi.string().required(),
      DB_NAME: Joi.string().required(),
    })}),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/database/migrations/*.js'],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Pattern 2: pgvector Column in TypeORM Entity

**What:** Registering the vector type and declaring vector columns on entities that need embedding fields.
**When to use:** On `kb_chunk`, `case_memory`, `human_feedback_memory`, `style_memory` — any table that stores embeddings.

```typescript
// Source: https://github.com/pgvector/pgvector-node
// backend/src/modules/memoria/entities/kb-chunk.entity.ts
import pgvector from 'pgvector/typeorm';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { KbDocument } from './kb-document.entity';

// Call once at app startup (main.ts or in a provider bootstrap)
pgvector.registerTypes();

@Entity('kb_chunk')
export class KbChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => KbDocument)
  document: KbDocument;

  @Column('text')
  content: string;

  @Column('vector', { length: 1536 })
  embedding: string; // stored as string; pgvector handles conversion
}
```

**Important:** The `CREATE EXTENSION IF NOT EXISTS vector;` SQL must run before migrations. Place this in the first migration file or in the Docker init script.

### Pattern 3: Domain Module Structure

**What:** Each of the 5 domains (Operacao, Regulatorio, Orquestracao, Execucao, Memoria) is a NestJS feature module that exports its entities for cross-module use in later phases.
**When to use:** From the start — prevents circular dependencies in later phases.

```typescript
// backend/src/modules/regulatorio/regulatorio.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tipology } from './entities/tipology.entity';
import { Situation } from './entities/situation.entity';
import { RegulatoryRule } from './entities/regulatory-rule.entity';
// ... other entities

@Module({
  imports: [TypeOrmModule.forFeature([
    Tipology, Subtipology, Situation, RegulatoryRule,
    RegulatoryAction, Persona, ResponseTemplate, MandatoryInfoRule,
  ])],
  exports: [TypeOrmModule],  // Export so other modules can inject repositories
})
export class RegulatorioModule {}
```

### Pattern 4: typeorm-extension Seeder

**What:** Structured seed classes that implement `Seeder` interface and insert reference data.
**When to use:** DB-08 (tipologias, situacoes, regulatory rules) and DB-09 (mock complaint data).

```typescript
// Source: https://typeorm-extension.tada5hi.net/guide/seeding.html
// backend/src/database/seeds/regulatorio.seeder.ts
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Tipology } from '../../modules/regulatorio/entities/tipology.entity';

export default class RegulatorioSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(Tipology);
    await repo.insert([
      { key: 'cobranca',       label: 'Cobrança' },
      { key: 'cancelamento',   label: 'Cancelamento' },
      { key: 'portabilidade',  label: 'Portabilidade' },
      { key: 'qualidade',      label: 'Qualidade / Reparo' },
    ]);
  }
}
```

### Pattern 5: Docker Compose with pgvector

**What:** Use the official `pgvector/pgvector:pg17` image instead of plain `postgres:17` so the vector extension is pre-installed.

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: bko
      POSTGRES_PASSWORD: bko_secret
      POSTGRES_DB: bkoagent
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/src/database/init.sql:/docker-entrypoint-initdb.d/01-init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: bko
      DB_PASS: bko_secret
      DB_NAME: bkoagent
    ports:
      - "3001:3001"

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

```sql
-- backend/src/database/init.sql  (runs at first container start)
CREATE EXTENSION IF NOT EXISTS vector;
```

### Anti-Patterns to Avoid

- **`synchronize: true` in any non-throwaway environment:** TypeORM's sync will DROP and RE-ADD vector columns every restart because it doesn't recognize the custom type correctly. Use explicit migrations only.
- **Putting all entities in `app.module.ts`:** With 35 entities, the root module becomes unmaintainable. Group entities into domain modules and use `autoLoadEntities: true`.
- **Single migration file for all 35 tables:** If a migration fails mid-run, partial schema is applied with no rollback. Write domain-scoped migrations (one per domain).
- **Hardcoding DB credentials:** Use `@nestjs/config` + Joi validation from the first commit. Prevents the "works locally, fails on server" issue.
- **Using `pgvector.registerTypes()` inside an entity file:** It has side effects and must be called exactly once, at application bootstrap in `main.ts` or a dedicated bootstrap provider.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration tracking | Custom migration table | TypeORM migrations | TypeORM handles `migrations` table, checksums, ordering, and CLI generation |
| Seed data management | Ad-hoc SQL scripts | typeorm-extension seeders | Integrates with DataSource; runs in correct order; idempotent with factories |
| Environment validation | `if (!process.env.X) throw` | @nestjs/config + Joi | Validates all vars at startup with clear error messages; handles type coercion |
| pgvector type registration | Custom TypeORM column type | `pgvector` npm package | Official package handles type registration, similarity operator helpers, and TypeORM integration |
| Docker pgvector setup | Custom Dockerfile apt-get build | `pgvector/pgvector:pg17` image | Official image is maintained, versioned, and requires no custom build steps |
| Mock data generation | Manual JSON fixtures | @faker-js/faker + typeorm-extension factories | Faker generates realistic Brazilian names/data; factories integrate with seeder lifecycle |

**Key insight:** The pgvector integration is the highest-risk custom area. The `pgvector` npm package's TypeORM adapter (`pgvector/typeorm`) is the only supported path — do not attempt raw SQL column definitions in entity files or custom column type overrides in TypeORM's driver.

---

## Common Pitfalls

### Pitfall 1: synchronize:true Drops Vector Columns

**What goes wrong:** TypeORM's `synchronize: true` does not fully recognize the `vector` column type. On each restart it treats the column as changed, drops it, and re-creates it — destroying all stored embeddings.
**Why it happens:** TypeORM's introspection normalizes column types against its known types list; `vector` is a custom extension type and gets misidentified.
**How to avoid:** Set `synchronize: false` from the first line of configuration. Only ever evolve schema through migration files.
**Warning signs:** `ALTER TABLE ... DROP COLUMN embedding; ADD COLUMN embedding vector(1536)` in TypeORM startup logs.

### Pitfall 2: pgvector Extension Missing at Migration Time

**What goes wrong:** First migration runs `CREATE TABLE kb_chunk (embedding vector(1536))` but the `vector` extension has not been created yet — migration fails with `type "vector" does not exist`.
**Why it happens:** Extension creation is separate from table creation. Docker init scripts run only on first container start; the extension may not exist in a fresh database.
**How to avoid:** Create a dedicated first migration `000-enable-extensions.ts` that runs `CREATE EXTENSION IF NOT EXISTS vector` before any table migrations. Alternatively, put it in Docker's `docker-entrypoint-initdb.d/` init SQL.
**Warning signs:** Migration fails with `type "vector" does not exist`.

### Pitfall 3: TypeORM CLI Cannot Find Entities in src/

**What goes wrong:** Running `typeorm migration:generate` fails or generates empty migration files because the CLI resolves entities from `dist/` but TypeScript files haven't been compiled yet.
**Why it happens:** `data-source.ts` entity globs point to `dist/**/*.entity.js`. If the project isn't built, CLI finds nothing.
**How to avoid:** Add a `build:migration` script that runs `tsc` then `typeorm migration:generate`. Or configure entities to resolve from `src/**/*.entity.ts` in development only and switch to `dist/` for CLI commands.
**Warning signs:** `No changes in database schema were found` when you know you added a new entity.

### Pitfall 4: pgvector.registerTypes() Called Multiple Times or Too Late

**What goes wrong:** Multiple calls to `pgvector.registerTypes()` cause warnings or TypeORM registration conflicts. Calling it after entity scan means the first query fails.
**Why it happens:** Developers put the call inside entity constructors or module constructors that may initialize multiple times.
**How to avoid:** Call `pgvector.registerTypes()` exactly once in `main.ts`, before `NestFactory.create()`.
**Warning signs:** `DataType already registered` warnings, or first vector query throwing `invalid input syntax for type vector`.

### Pitfall 5: TypeORM forFeature Entities Not Exported Cause Phase 2+ Failures

**What goes wrong:** In Phase 2 when auth/ticket modules need to reference `complaint` or `tipology` entities, TypeORM throws "Entity not registered" because the owning module didn't export `TypeOrmModule`.
**Why it happens:** By default, `TypeOrmModule.forFeature([])` registers entities only within the current module scope.
**How to avoid:** Every domain module must `exports: [TypeOrmModule]` so downstream modules can inject repositories by importing the domain module.
**Warning signs:** `EntityMetadataNotFoundError` in Phase 2.

### Pitfall 6: NestJS 11 Requires Node.js v20+

**What goes wrong:** Running `nest new` or booting the application on Node.js 18 produces cryptic errors.
**Why it happens:** NestJS 11 dropped support for Node.js < 20.
**How to avoid:** Verify `node --version >= 20.9` before scaffolding. The dev environment is on Node.js v24.6.0 — this is fine.
**Warning signs:** `engine` validation errors during `npm install`, or mysterious startup failures.

### Pitfall 7: Next.js 16 Defaults to Turbopack

**What goes wrong:** Some Tailwind v4 PostCSS configurations don't work with Turbopack out of the box; `next dev` may fail with config errors.
**Why it happens:** Next.js 16 defaults to Turbopack as the bundler; `--yes` in `create-next-app` enables it by default.
**How to avoid:** For the scaffolding phase, test that `next dev` starts with a simple health page before wiring up complex Tailwind configs. Use `next dev --webpack` as a fallback if Turbopack causes issues.
**Warning signs:** `Module not found` for CSS files, or PostCSS plugin errors on `next dev`.

---

## Code Examples

Verified patterns from official sources:

### Enable pgvector Extension (first migration)

```typescript
// Source: https://github.com/pgvector/pgvector-node
// backend/src/database/migrations/000-EnableExtensions.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableExtensions000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Extensions are kept on rollback to prevent data loss
  }
}
```

### pgvector.registerTypes() in main.ts

```typescript
// Source: https://github.com/pgvector/pgvector-node (TypeORM section)
// backend/src/main.ts
import pgvector from 'pgvector/typeorm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  pgvector.registerTypes();  // Must be first, before NestFactory
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3001);
}
bootstrap();
```

### typeorm-extension seeder run script

```typescript
// Source: https://typeorm-extension.tada5hi.net/guide/seeding.html
// backend/src/database/seeds/run.ts  (called by npm run seed)
import { runSeeders } from 'typeorm-extension';
import { AppDataSource } from '../data-source';

async function main() {
  await AppDataSource.initialize();
  await runSeeders(AppDataSource);
  await AppDataSource.destroy();
}

main().catch(console.error);
```

### TypeORM migration generate command (package.json scripts)

```json
{
  "scripts": {
    "build": "nest build",
    "migration:generate": "npm run build && typeorm migration:generate -d dist/database/data-source.js src/database/migrations/$NAME",
    "migration:run": "npm run build && typeorm migration:run -d dist/database/data-source.js",
    "migration:revert": "npm run build && typeorm migration:revert -d dist/database/data-source.js",
    "seed": "npm run build && ts-node src/database/seeds/run.ts"
  }
}
```

### Health check endpoint

```typescript
// backend/src/app.controller.ts — simple health check for Success Criterion 4
@Controller()
export class AppController {
  constructor(private dataSource: DataSource) {}

  @Get('health')
  async health() {
    const isConnected = this.dataSource.isInitialized;
    return { status: isConnected ? 'ok' : 'error', db: isConnected };
  }
}
```

---

## Entity Map (All 35 Tables Across 5 Domains)

This is the definitive entity list from the architecture document:

### Domain: Operacao (4 entities)
- `complaint` — main complaint record (ReclamacaoAnatel)
- `complaint_detail` — structured fields extracted from raw complaint
- `complaint_history` — status change log
- `complaint_attachment` — file attachments

### Domain: Regulatorio / Governanca (8 entities)
- `tipology` — 4 main tipologias (cobranca, cancelamento, portabilidade, qualidade)
- `subtipology` — subtipologias linked to tipology
- `situation` — regulatory situations (aberta, reaberta, vencida, em_risco, pedido)
- `regulatory_rule` — rules from Manual Anatel
- `regulatory_action` — actions (responder, reclassificar, reencaminhar, cancelar)
- `persona` — response personas
- `response_template` — IQI templates per tipology/situation
- `mandatory_info_rule` — required fields per case type

### Domain: Orquestracao (6 entities)
- `capability` — a versioned processing flow
- `capability_version` — version of a capability
- `step_definition` — individual step within a capability
- `step_transition_rule` — conditional transitions between steps
- `skill_definition` — catalog of the 19 skills
- `step_skill_binding` — maps a skill to a step within a capability version

### Domain: Execucao (7 entities)
- `ticket_execution` — execution instance of a complaint through a capability
- `step_execution` — execution record per step
- `artifact` — output produced by a step (typed)
- `llm_call` — individual LLM API call record
- `token_usage` — token count and cost per call
- `human_review` — HITL review record
- `audit_log` — append-only audit trail

### Domain: Memoria (6 entities)
- `kb_document` — uploaded knowledge base document
- `kb_document_version` — version of a document
- `kb_chunk` — text chunk with vector embedding (uses pgvector)
- `case_memory` — past complaint + decision + outcome (uses pgvector for similarity)
- `human_feedback_memory` — human correction records (AI text vs final text)
- `style_memory` — approved/forbidden expressions per tipology

**Total: 31 entities listed.** The architecture document claims ~35; 4 additional tables may exist as junction/lookup tables (e.g., `user`, `role`, auth tables for Phase 2 are not in scope here). Phase 1 should create the 31 listed above plus any implicit junction tables (e.g., many-to-many bindings).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeORM `synchronize: true` for dev | Explicit migrations from day one | Best practice, always | Prevents data loss with vector columns |
| `ankane/pgvector` Docker image | `pgvector/pgvector:pg17` official image | 2023 | Official is actively maintained with Postgres version tags |
| `typeorm-seeding` (w3tech) | `typeorm-extension` | 2022 | `typeorm-seeding` is archived and unmaintained |
| Next.js Pages Router | App Router (default since Next.js 13) | 2022 | App Router is the current standard; do not use Pages Router |
| Next.js webpack bundler | Turbopack (default in Next.js 16) | Mar 2026 | `next dev` now uses Turbopack; `--webpack` flag reverts |
| NestJS v10 + Express v4 | NestJS v11 + Express v5 | Jan 2025 | Route wildcard syntax changed: `/*` → `/*splat` |

**Deprecated/outdated:**
- `typeorm-seeding` (npm: w3tecch): Archived, incompatible with TypeORM 0.3. Use `typeorm-extension` instead.
- `ankane/pgvector` Docker image: Still functional but `pgvector/pgvector` is the official maintained image.
- `synchronize: true` with pgvector: Functionally broken — drops vector columns on restart.

---

## Open Questions

1. **Mock complaint data format (DB-09)**
   - What we know: A spreadsheet of reclamacoes exists and needs to be injected
   - What's unclear: The exact spreadsheet format, column names, and how many records; whether it's CSV, XLSX, or another format
   - Recommendation: The seeder should use `xlsx` or `csv-parser` npm package to read the spreadsheet file. Implement this as a separate seeder class `ComplaintMockSeeder` that reads a file path from an env variable.

2. **Vector embedding dimensions (DB-07)**
   - What we know: `kb_chunk`, `case_memory`, and related tables need vector columns
   - What's unclear: The embedding model and its output dimensions (1536 for OpenAI text-embedding-ada-002, 768 for others). Phase 1 schema must declare a specific length.
   - Recommendation: Default to 1536 (OpenAI ada-002 standard) and make it configurable via an env variable `EMBEDDING_DIMENSIONS=1536`. This can be changed in Phase 4 when the AI layer is built.

3. **Remote PostgreSQL server access (72.61.52.70)**
   - What we know: The production DB server exists at 72.61.52.70
   - What's unclear: Whether Docker Compose should target this server or run a local PostgreSQL in containers for Phase 1 development
   - Recommendation: Phase 1 uses Docker Compose with a local containerized PostgreSQL for development. The remote server connection should be added as a separate `.env.production` configuration file. Migrations are run against remote server via `DB_HOST=72.61.52.70 npm run migration:run`.

---

## Sources

### Primary (HIGH confidence)
- `https://github.com/nestjs/nest/releases` — NestJS v11.1.17 confirmed as latest (Mar 16, 2026)
- `https://nextjs.org/docs/app/getting-started/installation` — Next.js 16.1.7 confirmed; `create-next-app --yes` defaults verified
- `https://github.com/pgvector/pgvector-node` — pgvector TypeORM integration pattern (registerTypes, @Column('vector', {length: N}))
- `https://typeorm.io/docs/drivers/postgres/` — vector/halfvec column type official support confirmed
- `https://typeorm-extension.tada5hi.net/guide/seeding.html` — Seeder class structure and runSeeders API
- `https://trilon.io/blog/announcing-nestjs-11-whats-new` — NestJS 11 breaking changes (Express v5 default, Node.js v20+, lifecycle hook order)
- `nest --version` (local): 11.0.16 confirmed installed

### Secondary (MEDIUM confidence)
- WebSearch "pgvector postgres docker image 2025" → `pgvector/pgvector:pg17` as official Docker image, verified against Docker Hub listing
- WebSearch "NestJS TypeORM migrations 2026" → `synchronize: false` + explicit migrations is the established pattern, multiple sources agree
- WebSearch "typeorm-extension seeder NestJS 2025" → typeorm-extension is the current replacement for deprecated typeorm-seeding

### Tertiary (LOW confidence)
- `typeorm.io` route wildcard change details — not directly verified but consistent with NestJS 11/Express v5 release notes
- Embedding dimension default of 1536 — based on OpenAI ada-002 prevalence; actual model not yet decided (Phase 4 concern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries verified via official release pages and documentation
- Architecture: HIGH — patterns verified via official NestJS and TypeORM docs; entity list from project requirements
- Pitfalls: HIGH — pgvector + synchronize issue verified via GitHub issues; Node.js v20 requirement from official NestJS 11 announcement; others from well-documented TypeORM patterns
- Seed approach: HIGH — typeorm-extension docs fetched and verified
- Mock data format: LOW — spreadsheet not inspected; format unknown

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days; stable ecosystem — NestJS, TypeORM, pgvector are slow-moving)
