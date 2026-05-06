# Coding Conventions

**Analysis Date:** 2026-05-06

## Language and TypeScript Style

**TypeScript everywhere.** Both `backend/` (NestJS) and `frontend/` (Next.js) are 100% TypeScript.

**tsconfig settings (backend, `backend/tsconfig.json`):**
- `target: ES2023`, `module: nodenext`
- `strictNullChecks: true`, but `noImplicitAny: false` and `strictBindCallApply: false`
- `experimentalDecorators: true`, `emitDecoratorMetadata: true` (required for NestJS + TypeORM)

**tsconfig settings (frontend, `frontend/tsconfig.json`):**
- Full `strict: true` mode
- `target: ES2017`, `jsx: react-jsx`, `moduleResolution: bundler`
- Path alias: `@/*` -> `./src/*` (use `@/lib/api`, `@/components/ui/...`)

**Nullish coalescing and optional chaining:**
- Prefer `??` over `||` for null/undefined defaults. See `backend/src/modules/execucao/services/ticket-execution.service.ts` lines 109, 122, 256, 387.
- Use optional chaining (`?.`) liberally on possibly-null relations: `complaint.tipology?.key ?? null`.
- Frontend mirrors the same style: `complaint.details ?? []` (`frontend/src/app/tickets/[id]/components/ticket-details.tsx`).

**Linting:**
- Backend: ESLint + Prettier (`backend/eslint.config.mjs`). `@typescript-eslint/no-explicit-any` is **off**, `no-floating-promises` is **warn**.
- Frontend: `eslint-config-next` core-web-vitals + typescript (`frontend/eslint.config.mjs`).
- Run `npm run lint` (both projects); backend has `--fix` on by default.
- Run `npm run format` in backend to apply Prettier.

## File and Directory Naming

- **Source files:** `kebab-case.ts` (e.g. `ticket-execution.service.ts`, `complaint-filter.dto.ts`, `ticket-table.tsx`).
- **NestJS class files** use a dotted suffix matching their role: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.entity.ts`, `*.dto.ts`, `*.agent.ts`.
- **Modules** are named `<domain>.module.ts` and live at the module root (e.g. `backend/src/modules/operacao/operacao.module.ts`).
- **Frontend route segments** follow Next.js App Router: `page.tsx`, `layout.tsx`, `actions.ts` per route. Co-located components live in `components/` subdirectories of the route (e.g. `frontend/src/app/tickets/[id]/components/ticket-header.tsx`).
- **Classes/components:** PascalCase (`ComplaintController`, `TicketHeader`, `TicketExecutionService`).
- **Enums:** PascalCase type, SCREAMING_SNAKE_CASE values (see `ComplaintStatus` in `backend/src/modules/operacao/entities/complaint.entity.ts`).
- **Variables/functions:** camelCase.
- **Database table names:** snake_case via `@Entity('complaint')`.

## NestJS Patterns

**Module structure (canonical example: `backend/src/modules/operacao/`):**
```
<domain>/
  controllers/      # one *.controller.ts per resource
  services/         # one *.service.ts per resource
  entities/         # one *.entity.ts per table
  dto/              # request/response DTOs
  <domain>.module.ts
```

**Module declaration** (`backend/src/modules/operacao/operacao.module.ts`):
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Complaint, ComplaintDetail, /* ... */])],
  controllers: [ComplaintController, /* ... */],
  providers: [ComplaintService, /* ... */],
  exports: [TypeOrmModule],   // export TypeOrmModule when other modules need the entities
})
export class OperacaoModule {}
```

**Controllers** (`backend/src/modules/operacao/controllers/complaint.controller.ts`):
- Decorated with `@Controller('resource-plural')` (kebab-case, lowercase).
- Apply `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` at class level.
- Apply interceptors at class level via `@UseInterceptors(SensitiveDataInterceptor)`.
- Use `@Param('id', ParseUUIDPipe)` for UUID path params.
- Use `@Query()` with a typed DTO for query strings — never raw `Record<string, string>`.
- Methods return `Promise<Entity>` or `Promise<ResponseDto>`; do **not** wrap in `{ data: ... }` at the controller layer (the service is responsible for response shape).
- Constructor injection only: `constructor(private readonly service: ComplaintService) {}`.

**Services** (`backend/src/modules/operacao/services/complaint.service.ts`):
- Decorated with `@Injectable()`.
- Repositories injected via `@InjectRepository(Entity) private readonly repo: Repository<Entity>`.
- Use TypeORM `QueryBuilder` for filtered list endpoints with sorting/pagination; whitelist sortable fields against an explicit allowlist (see `allowedSortFields` in `complaint.service.ts`).
- Use `repo.findOne({ where, relations })` for simple lookups.

**DTOs and Validation** (`backend/src/modules/operacao/dto/complaint-filter.dto.ts`):
- Use `class-validator` decorators (`@IsOptional`, `@IsUUID`, `@IsInt`, `@IsIn`, `@Min`, `@Max`, `@IsString`).
- Use `@Type(() => Number)` from `class-transformer` to coerce query string numerics.
- Provide defaults with `=` initializer at the property: `page?: number = 1`.
- Global `ValidationPipe` is also enabled in `backend/src/main.ts` with `{ transform: true, whitelist: true, forbidNonWhitelisted: false }`.

**Application bootstrap** (`backend/src/main.ts`):
- `app.setGlobalPrefix('api')` — every route is mounted under `/api`.
- CORS enabled with `{ origin: true, credentials: true }`.

## TypeORM Patterns

**Entities** (`backend/src/modules/operacao/entities/complaint.entity.ts`):
- `@Entity('snake_case_table_name')` — always pass an explicit table name.
- `@PrimaryGeneratedColumn('uuid')` for id columns.
- `@Column({ type: 'varchar', nullable: true })` — always declare `type` explicitly; nullable columns must declare `| null` in the TS type (e.g. `motivo: string | null`).
- Enums declared as `export enum Foo { ... }` and stored with `@Column({ type: 'enum', enum: Foo, default: Foo.PENDING })`.
- `@CreateDateColumn()` and `@UpdateDateColumn()` for audit timestamps.
- JSON blobs use `@Column({ type: 'jsonb', nullable: true }) field: Record<string, unknown> | null`.
- Decimals use explicit precision: `@Column({ type: 'decimal', precision: 5, scale: 3, nullable: true })`.

**Relations:**
- `@ManyToOne(() => Tipology, { nullable: true, eager: false })` paired with `@JoinColumn({ name: 'tipologyId' })` and an explicit FK column `@Column({ type: 'uuid', nullable: true }) tipologyId: string | null`.
- Always `eager: false` — load relations explicitly via `relations: [...]` or `leftJoinAndSelect`.
- `@OneToMany(() => Detail, (detail) => detail.complaint)` for inverse side.

**Migrations:** Generated and run via npm scripts (`migration:generate`, `migration:run`, `migration:revert`) defined in `backend/package.json`. `synchronize: false`, `migrationsRun: true` at startup (`backend/src/app.module.ts`).

## Frontend Patterns (Next.js 16 App Router + React 19)

**Server-first by default.** Pages and layouts are server components; components opt into the client via `'use client'` at the top of the file.

**Server components fetch data** (`frontend/src/app/tickets/page.tsx`, `frontend/src/app/tickets/[id]/page.tsx`):
```typescript
export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  await verifySession()
  const params = await searchParams
  const res = await fetchAuthAPI(`/api/complaints?${query.toString()}`)
  // ...
}
```

**API helpers** live in `frontend/src/lib/api.ts`:
- `fetchAPI(path, options?)` — unauthenticated.
- `fetchAuthAPI(path, options?)` — pulls JWT from session cookie via `verifySession()` and attaches `Authorization: Bearer ...`.
- **Note:** there is no `apiGet`/`apiPost`/`apiPatch` wrapper and no `react-query`. Code passes `{ method: 'POST' | 'PATCH' | 'DELETE', body: JSON.stringify(...) }` directly to `fetchAuthAPI`. Always check `res.ok` and parse with `res.json()`.

**Mutations use Server Actions** (`frontend/src/app/admin/personas/actions.ts`):
- File top declares `'use server'`.
- Export an `ActionState` type: `export type ActionState = { error?: string; success?: boolean }`.
- Action signature: `(_prev: ActionState, formData: FormData) => Promise<ActionState>`.
- Call `fetchAuthAPI` with `method: 'POST' | 'PATCH' | 'DELETE'` and a JSON body.
- After success call `revalidatePath('/admin/personas')` to refresh the server-rendered page.
- Forms call the action via `useActionState` from React 19 (`frontend/src/app/admin/personas/create-persona-form.tsx`).

**Client components** (`'use client'` directive):
- Used for interactivity only: form components, toggles, charts, designers (e.g. `toggle-capability-button.tsx`, `edit-model-form.tsx`, `*-chart.tsx`).
- Keep them small and composed inside server components.

**Auth and session** (`frontend/src/lib/dal.ts`):
- `verifySession()` is `cache()`-wrapped, reads the `session` cookie, decrypts a JWE via `jose`, and `redirect('/login')` if missing. Imported from `'server-only'` so it cannot be bundled into client code.

**Types** (`frontend/src/lib/types.ts`):
- All shared API/domain types live here (`Complaint`, `ComplaintListResponse`, `Execution`, `Artifact`, etc.).
- Status/risk enums are string-literal unions: `export type ComplaintStatus = 'pending' | 'in_progress' | ...`.
- Components import via `import type { Complaint } from '@/lib/types'`.

**Component conventions:**
- Functional components only, named exports: `export function TicketHeader(...) { ... }`.
- Props typed with a colocated interface: `interface TicketHeaderProps { complaint: Complaint }`.
- UI primitives in `frontend/src/components/ui/` are shadcn-generated (lowercase filenames, e.g. `button.tsx`, `badge.tsx`).
- Styling: Tailwind utilities only; merge classes with `cn(...)` from `@/lib/utils` (`clsx` + `tailwind-merge`).
- Status/variant maps use `Record<EnumLike, Variant>` lookup tables (see `statusVariants` in `ticket-header.tsx`).

**Zod usage:**
- Used on the **backend** for AI structured-output schemas (e.g. `DetermineActionSchema` in `backend/src/modules/execucao/services/skill-registry.service.ts`, all `*.agent.ts` files in `backend/src/modules/ia/services/`).
- The frontend lists `zod` in `frontend/package.json` but no current usages were found in `frontend/src`. Validation on the frontend is currently inline inside server actions (e.g. `if (!name) return { error: 'Nome obrigatorio' }`).

## Error Handling

**Backend HTTP errors:**
- Throw `HttpException('message', statusCode)` for status-coded errors. Status codes used: 404 (not found), 409 (conflict), 422 (unprocessable entity). See `backend/src/modules/execucao/services/ticket-execution.service.ts`.
- `NotFoundException` from `@nestjs/common` is also used (e.g. `complaint.service.ts` line 108) — equivalent and acceptable for 404s.
- Throw at the **service** layer; controllers do not wrap in try/catch.

**Skill soft-fail pattern** (`backend/src/modules/execucao/services/skill-registry.service.ts`):
- Skill methods catch all errors and return a result object instead of throwing:
  ```typescript
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`Skill ${skillKey} failed: ${errorMessage}`);
    return { error: errorMessage, skillKey, failedAt: new Date().toISOString() };
  }
  ```
- Inline soft-fail for missing prerequisites: `if (!complaint) return { error: 'Complaint not found', complaintId };` (line 409).
- This keeps the orchestration loop alive when one skill fails; the orchestrator inspects `output.error` to decide whether to halt.

**Frontend errors:**
- Server actions return `{ error: string }` instead of throwing; the form surfaces it via `useActionState` state.
- Page-level `notFound()` from `next/navigation` for missing resources (`frontend/src/app/tickets/[id]/page.tsx` line 28).
- API responses must check `res.ok` before `await res.json()`; provide a fallback empty value when not ok.

## Logging and Imports

**Logging:** Use `Logger` from `@nestjs/common`, instantiated as `private readonly logger = new Logger(SkillRegistryService.name)`. Use `this.logger.error(...)`, `this.logger.warn(...)`. Avoid raw `console.*` in backend code.

**Import order (observed convention, not enforced by lint):**
1. Node/framework imports (`@nestjs/common`, `next/navigation`, `react`).
2. Third-party packages (`typeorm`, `class-validator`, `zod`, `ai`).
3. Cross-module imports (relative paths into other `modules/`).
4. Same-module imports (`./entities/...`, `../dto/...`).

**Path imports:**
- Backend: relative paths only (no path aliases configured).
- Frontend: `@/*` alias for everything under `src/`.

---

*Convention analysis: 2026-05-06*
