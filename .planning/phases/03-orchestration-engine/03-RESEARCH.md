# Phase 03: Orchestration Engine - Research

**Researched:** 2026-03-17
**Domain:** NestJS service orchestration — SLA calculation, capability selection, step engine, policy validation, execution logging
**Confidence:** HIGH

## Summary

Phase 3 builds the orchestration brain on top of the entity and migration foundation from Phases 1-2. All tables already exist (`capability`, `capability_version`, `step_definition`, `step_transition_rule`, `skill_definition`, `step_skill_binding`, `ticket_execution`, `step_execution`, `artifact`, `audit_log`). The modules have entities and TypeORM wiring but no services or controllers for write operations. The task is to fill in the service layer, not touch the schema.

No AI/LLM in Phase 3. Every skill executes as a no-op stub that returns a structured response conforming to the skill's `outputSchema`. `isHumanRequired` steps pause the execution and wait for explicit operator advance — they do not auto-complete. The step engine is synchronous and DB-backed; no queues or workers.

The standard NestJS pattern for cross-module service dependencies is to export the service from its module and import the module where needed. The correct structure is to keep orchestration services in `OrquestracaoModule` (which already holds capability/step entities) and execution services in `ExecucaoModule` (which holds ticket/step-execution entities). `ExecucaoModule` imports `OrquestracaoModule` to access step definitions during execution. Both modules already export `TypeOrmModule` — service exports need to be added.

**Primary recommendation:** Build `RegulatoryOrchestrationService` in `OrquestracaoModule` and `TicketExecutionService` (the step engine) in `ExecucaoModule` with `ExecucaoModule` importing `OrquestracaoModule`. No new modules needed.

---

## Standard Stack

No new libraries required. Phase 3 uses the installed stack entirely.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@nestjs/common` | 11.x | Injectable, HttpException | Already in project |
| `typeorm` | 0.3.x | QueryBuilder, Repository | Already in project |
| `@nestjs/typeorm` | 11.x | InjectRepository | Already in project |

### No new installs needed

All orchestration logic is pure TypeScript business rules operating on already-fetched TypeORM entities. Business-day calculation does not require a library (see Code Examples below for the correct algorithm). There is no date library in the project; the calculation is simple enough to hand-write with a known holidays array or a pure business-days loop.

**Installation:**
```bash
# No new packages
```

---

## Architecture Patterns

### Recommended Module Structure (additive — no new modules)

```
backend/src/modules/
├── orquestracao/
│   ├── orquestracao.module.ts          # ADD: export RegulatoryOrchestrationService
│   ├── entities/                       # unchanged
│   └── services/                       # NEW directory
│       └── regulatory-orchestration.service.ts  # SLA, classifier, action decider, capability selector, policy validator
├── execucao/
│   ├── execucao.module.ts              # ADD: import OrquestracaoModule, export TicketExecutionService
│   ├── entities/                       # unchanged
│   ├── services/
│   │   ├── execution.service.ts        # existing — read-only queries, keep as-is
│   │   └── ticket-execution.service.ts  # NEW — step engine, start/advance/finalize
│   └── controllers/
│       ├── execution.controller.ts     # existing GET endpoints — keep as-is
│       └── ticket-execution.controller.ts  # NEW — POST start/advance/finalize
```

### Pattern 1: RegulatoryOrchestrationService responsibilities

One service encapsulates all regulatory decision logic: SLA computation, situation resolver, action decider, capability selector, and policy validator. These are all read-heavy, stateless computations over regulatory reference data.

**What:** Injectable NestJS service injected into TicketExecutionService
**When to use:** Any time execution logic needs regulatory context

```typescript
// Source: NestJS docs + project entity inspection
@Injectable()
export class RegulatoryOrchestrationService {
  constructor(
    @InjectRepository(Tipology)
    private tipologyRepo: Repository<Tipology>,
    @InjectRepository(Situation)
    private situationRepo: Repository<Situation>,
    @InjectRepository(RegulatoryAction)
    private actionRepo: Repository<RegulatoryAction>,
    @InjectRepository(RegulatoryRule)
    private ruleRepo: Repository<RegulatoryRule>,
    @InjectRepository(Capability)
    private capabilityRepo: Repository<Capability>,
    @InjectRepository(CapabilityVersion)
    private capabilityVersionRepo: Repository<CapabilityVersion>,
  ) {}

  computeSlaDeadline(createdAt: Date, tipology: Tipology, situation: Situation | null): Date
  selectCapability(tipologyId: string): Promise<CapabilityVersion | null>
  validatePolicyRules(complaint: Complaint, action: string): Promise<{ passed: boolean; violations: string[] }>
}
```

### Pattern 2: TicketExecutionService as step engine

Controls the full lifecycle: start → advance step → finalize. Each advance call executes the current step synchronously, writes a `StepExecution` record, then advances `currentStepKey` on `TicketExecution`.

```typescript
// Source: project entity inspection — TicketExecution.metadata jsonb, currentStepKey varchar
@Injectable()
export class TicketExecutionService {
  async startExecution(complaintId: string): Promise<TicketExecution>
  async advanceStep(executionId: string, operatorInput?: Record<string, unknown>): Promise<StepExecution>
  async finalizeExecution(executionId: string): Promise<TicketExecution>
  async retryStep(executionId: string, stepKey: string): Promise<StepExecution>
}
```

### Pattern 3: Execution context in TicketExecution.metadata jsonb

The `metadata` column (`jsonb`, nullable) on `TicketExecution` is the correct place to persist execution context between steps. Loading the full complaint + all step outputs at every advance is expensive and duplicates data. Instead, metadata stores:

```typescript
// Stored in TicketExecution.metadata jsonb
interface ExecutionContext {
  tipologyKey: string;
  situationKey: string | null;
  slaBusinessDays: number;
  slaDeadline: string; // ISO date string
  selectedActionKey: string | null;
  stepOutputs: Record<string, Record<string, unknown>>; // stepKey -> output
}
```

Step outputs accumulate in `metadata.stepOutputs[stepKey]`. Each new step can read prior outputs from metadata. The full complaint is always fetchable via `ticketExecution.complaintId` — no need to copy complaint fields into metadata.

### Pattern 4: Step execution flow (synchronous, DB-backed)

```
advanceStep(executionId):
  1. Load TicketExecution (with capabilityVersion -> steps ordered by stepOrder)
  2. Guard: status must be RUNNING (not COMPLETED, FAILED, PAUSED_HUMAN)
  3. Determine currentStep from currentStepKey (or first step if null)
  4. Run policy validator BEFORE executing — if blocked, throw 422
  5. If currentStep.isHumanRequired AND no operatorInput provided:
       - Set StepExecution.status = WAITING_HUMAN
       - Set TicketExecution.status = PAUSED_HUMAN
       - Persist and return (do not execute skill)
  6. If currentStep.isHumanRequired AND operatorInput provided:
       - Continue (operator has supplied input, treat as approved)
  7. Create StepExecution record (status=RUNNING, input=context, startedAt=now)
  8. Execute skill stub (returns structured no-op output)
  9. Update StepExecution (status=COMPLETED, output=result, completedAt=now, durationMs)
  10. Persist output into TicketExecution.metadata.stepOutputs[stepKey]
  11. Determine next step (by stepOrder + 1, or StepTransitionRule if applicable)
  12. Update TicketExecution.currentStepKey to next step key (or null if last)
  13. If no next step: TicketExecution.status = COMPLETED
  14. Write AuditLog entry
  15. Return StepExecution
```

### Pattern 5: Module wiring for cross-module service access

`ExecucaoModule` needs `RegulatoryOrchestrationService` from `OrquestracaoModule`. The correct pattern is module import + service export, not `forwardRef`.

```typescript
// orquestracao.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Capability, CapabilityVersion, StepDefinition,
      StepTransitionRule, SkillDefinition, StepSkillBinding]),
  ],
  providers: [RegulatoryOrchestrationService],
  exports: [TypeOrmModule, RegulatoryOrchestrationService],  // export service
})
export class OrquestracaoModule {}

// execucao.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([TicketExecution, StepExecution, Artifact, ...]),
    OrquestracaoModule,  // import to access RegulatoryOrchestrationService + its repositories
  ],
  providers: [ExecutionService, TicketExecutionService],
  controllers: [ExecutionController, TicketExecutionController],
  exports: [TypeOrmModule, ExecutionService, TicketExecutionService],
})
export class ExecucaoModule {}
```

Note: `RegulatoryOrchestrationService` also needs access to `Tipology`, `Situation`, `RegulatoryAction`, `RegulatoryRule` entities. These live in `RegulatorioModule`. Therefore `OrquestracaoModule` must also import `RegulatorioModule` (which already exports `TypeOrmModule`).

### Anti-Patterns to Avoid

- **Circular module imports**: ExecucaoModule imports OrquestracaoModule which imports RegulatorioModule — this is a clean chain. Do NOT have OrquestracaoModule import ExecucaoModule.
- **Loading all step outputs from DB every advance**: Storing accumulated outputs in `metadata.stepOutputs` is cheaper than querying all past StepExecutions. Query past StepExecutions only for retry/audit.
- **Using TypeORM `synchronize: true` to add columns**: Project confirmed `synchronize: false`. Any schema change needs a migration.
- **Throwing generic 500 on policy violation**: Use `HttpException` with 422 Unprocessable Entity. This signals "request understood but business rule blocked it" — distinct from 400 (bad input) and 403 (unauthorized).
- **Checking BLOCKING rules only at finalize**: BLOCKING rules must be checked at `advanceStep` before executing the current step. Checking only at finalize allows the operator to run many steps before discovering a block.

---

## SLA Calculation Logic

### How it works (derived from seed data + entity inspection)

The SLA computation resolves to a single integer `businessDays` using this priority:

```
businessDays = situation.slaOverrideDays ?? tipology.slaBusinessDays
```

Concrete values from seed data:
| Situation key | slaOverrideDays | Effective SLA (if tipology=cobranca slaBusinessDays=10) |
|---------------|-----------------|----------------------------------------------------------|
| aberta        | null            | 10 days (from tipology) |
| reaberta      | 5               | 5 days (override wins) |
| pedido        | 3               | 3 days (override wins) |
| vencida       | null            | 10 days (from tipology) |
| em_risco      | null            | 10 days (from tipology) |

Success criteria states: "aberta=10d, pedidos=3d, reaberta=5d". This matches `situation.slaOverrideDays ?? tipology.slaBusinessDays`.

### SLA start date

SLA starts from `complaint.createdAt`, not from when processing starts. Anatel SLA is measured from the moment the complaint was registered. The `ComputeSla` skill definition confirms this: its input schema includes `createdAt: { type: 'string', format: 'date-time' }`.

### Business days calculation

Brazilian working days: Monday–Friday, excluding Brazilian national holidays. For Phase 3 (no AI, no external calendar), use a hardcoded list of national holidays or skip holiday exclusion entirely — the success criteria only checks the day count, not exact holiday exclusion. The simplest correct approach:

```typescript
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}
```

### isOverdue update

`complaint.isOverdue` should be updated whenever `slaDeadline` is set (at execution start) and on any subsequent reads. For Phase 3, update `isOverdue` when `startExecution` computes and saves `slaDeadline`:

```typescript
complaint.slaDeadline = computedDeadline;
complaint.slaBusinessDays = businessDays;
complaint.isOverdue = new Date() > computedDeadline;
await this.complaintRepo.save(complaint);
```

---

## Capability Selection Logic

### Selection rule

Capability selection is by `tipologyId` only. The `Capability` entity has `tipologyId` (FK to Tipology) with no situationId. From the entity: `@ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })`. There is no situation-level capability branching in Phase 3.

Selection query:
```typescript
const capability = await this.capabilityRepo.findOne({
  where: { tipologyId: complaint.tipologyId, isActive: true },
  relations: ['versions'],
});
const currentVersion = capability?.versions.find((v) => v.isCurrent && v.isActive);
```

### No capability case

If no capability exists for the tipology, `startExecution` should throw `HttpException` with 422:
```
"No active capability found for tipology: {tipologyKey}. Cannot start execution."
```

This is a business rule failure — the system is not configured for this tipology. The operator must configure a capability before starting.

---

## Policy Validator Design

### Where rules live

`RegulatoryRule` table, `ruleType = 'blocking'`. The one seeded BLOCKING rule is `BLOCK_NO_CHECKLIST` with `metadata: { blocks_action: 'finalizar', requires_complete_checklist: true }`.

### Validator behavior

The validator is called at two points:
1. Before `advanceStep` executes — checks if any BLOCKING rule prevents this step from running
2. Before `finalizeExecution` — checks `blocks_action: 'finalizar'` rules specifically

Query pattern:
```typescript
const rules = await this.ruleRepo.find({
  where: {
    ruleType: RegulatoryRuleType.BLOCKING,
    isActive: true,
  },
});
// Filter to applicable rules: no tipologyId restriction OR tipologyId matches complaint
const applicable = rules.filter(
  (r) => r.tipologyId === null || r.tipologyId === complaint.tipologyId
);
```

### What "blocks step advancement" means

The validator returns `{ passed: boolean; violations: string[] }`. The caller (TicketExecutionService) checks the result and throws if not passed:

```typescript
const validation = await this.orchService.validatePolicyRules(complaint, 'advance');
if (!validation.passed) {
  throw new HttpException(
    { message: 'Step blocked by policy', violations: validation.violations },
    422,
  );
}
```

For Phase 3, the `BLOCK_NO_CHECKLIST` rule applies only at finalize (`blocks_action: 'finalizar'`). The step-advance validator should check `blocks_action` metadata to determine applicability.

---

## BFF Endpoint Contract

### POST /api/complaints/:id/executions — Start execution

**Request:** No body required. `:id` is the complaintId.

**What it does:**
1. Validate complaint exists and has `tipologyId` set
2. Check no active execution already running (`status IN (RUNNING, PAUSED_HUMAN)`) — throw 409 if exists
3. Select capability version by tipologyId — throw 422 if none
4. Compute SLA and update complaint
5. Create `TicketExecution` (status=RUNNING, startedAt=now, currentStepKey=first step key, metadata with initial context)
6. Return created TicketExecution

**Response 201:**
```json
{
  "id": "uuid",
  "status": "running",
  "startedAt": "2026-03-17T10:00:00Z",
  "currentStepKey": "load_complaint",
  "capabilityVersionId": "uuid",
  "complaintId": "uuid",
  "metadata": {
    "tipologyKey": "cobranca",
    "situationKey": "aberta",
    "slaBusinessDays": 10,
    "slaDeadline": "2026-03-31T10:00:00Z",
    "selectedActionKey": null,
    "stepOutputs": {}
  }
}
```

### POST /api/executions/:id/advance — Advance to next step

**Request body (optional):**
```json
{
  "operatorInput": { "any": "key-value pairs if isHumanRequired step" }
}
```

**What it does:**
1. Load execution (must be RUNNING or PAUSED_HUMAN)
2. Validate policy rules (throw 422 if blocked)
3. If current step `isHumanRequired` and no `operatorInput`: pause execution → returns StepExecution with status=WAITING_HUMAN
4. Execute skill stub → write StepExecution (COMPLETED)
5. Advance currentStepKey or mark TicketExecution COMPLETED if no more steps
6. Return StepExecution

**Response 200:**
```json
{
  "id": "uuid",
  "stepKey": "load_complaint",
  "status": "completed",
  "startedAt": "2026-03-17T10:00:01Z",
  "completedAt": "2026-03-17T10:00:01Z",
  "durationMs": 12,
  "input": { "protocolNumber": "PROT-001" },
  "output": { "complaint": { "id": "uuid", "protocolNumber": "PROT-001" } },
  "retryCount": 0
}
```

If `isHumanRequired` and no operator input, response is still 200 but:
```json
{
  "id": "uuid",
  "stepKey": "human_review_step",
  "status": "waiting_human",
  ...
}
```

### POST /api/executions/:id/finalize — Finalize execution

**Request body (optional):**
```json
{
  "outcome": { "notes": "Resolved successfully" }
}
```

**What it does:**
1. Load execution (status must be RUNNING or PAUSED_HUMAN)
2. Run finalize policy validator (BLOCKING rules with `blocks_action: 'finalizar'`) — throw 422 if blocked
3. Set execution status=COMPLETED, completedAt=now, totalDurationMs
4. Update complaint.status = IN_PROGRESS → COMPLETED
5. Write AuditLog
6. Return updated TicketExecution

**Response 200:** Updated TicketExecution with status=completed.

### POST /api/executions/:id/retry-step — Retry a failed step

**Request body:**
```json
{
  "stepKey": "load_complaint"
}
```

**What it does:**
1. Load execution and find the failed StepExecution for stepKey
2. Increment `retryCount` on existing StepExecution record (do NOT create a new one)
3. Re-run the skill stub
4. Update StepExecution with new output, status=COMPLETED
5. Restore TicketExecution.status=RUNNING if it was FAILED

**Response 200:** Updated StepExecution.

---

## Retry Logic

### Update existing record, increment retryCount

The `StepExecution` entity has `retryCount: int, default 0`. The design intent is clear: increment on retry, not create a new row. This preserves a single audit row per step with a counter. Reasoning:

- New row approach: Multiple rows per step, harder to query "current state" of a step
- Update approach: One row per step, retryCount tells how many attempts were made, output/error is always the latest

Retry updates `StepExecution`: `retryCount += 1`, `status = RUNNING → COMPLETED/FAILED`, `startedAt = now`, `output/errorMessage` refreshed.

---

## Execution Context Persistence

### What goes in TicketExecution.metadata

```typescript
interface ExecutionContext {
  tipologyKey: string;          // set at startExecution
  situationKey: string | null;  // set at startExecution
  slaBusinessDays: number;      // set at startExecution
  slaDeadline: string;          // ISO string, set at startExecution
  selectedActionKey: string | null;  // set after DetermineRegulatoryAction skill runs
  stepOutputs: Record<string, Record<string, unknown>>;  // accumulated per step
}
```

### What does NOT go in metadata

- Full complaint object (always queryable via `ticketExecution.complaintId`)
- Step definitions (always queryable via `capabilityVersionId -> steps`)
- User identity (comes from JWT on each request)

### Context flows between steps

Each skill stub receives an `input` object built from context. The `SkillDefinition.inputSchema` defines what a skill expects. For the stub, input is built from:
1. The execution context (metadata)
2. Previous step outputs from `metadata.stepOutputs`
3. The complaint itself (loaded once per advance call)

---

## Common Pitfalls

### Pitfall 1: Capability entity has tipologyId but not situationId
**What goes wrong:** Developer tries to filter capabilities by both tipologyId and situationId. The `Capability` entity has no `situationId` column — the join will fail.
**Why it happens:** The success criteria mentions "select the right capability" which might imply situation matters. It doesn't in this schema.
**How to avoid:** Select capability by `tipologyId` only. Situation affects SLA only.
**Warning signs:** TypeScript error "Property 'situationId' does not exist on type 'Capability'".

### Pitfall 2: CapabilityVersion.isCurrent can have zero or multiple matches
**What goes wrong:** A tipology has a capability with multiple versions but none have `isCurrent=true`, or someone set multiple to `isCurrent=true`.
**Why it happens:** Seed data or manual DB edits.
**How to avoid:** `selectCapability` must use `findOne` on `{ isCurrent: true, isActive: true, capabilityId: capability.id }`. If no result, throw 422 with a descriptive message rather than silently proceeding with `undefined`.
**Warning signs:** TypeError on `currentVersion.id` when currentVersion is undefined.

### Pitfall 3: OrquestracaoModule does not import RegulatorioModule
**What goes wrong:** `RegulatoryOrchestrationService` injects repositories for `Tipology`, `Situation`, `RegulatoryAction`, `RegulatoryRule` — but these are registered by `RegulatorioModule`. If `OrquestracaoModule` does not import `RegulatorioModule`, NestJS throws "No provider found for repository(Tipology)".
**Why it happens:** Module import chain is not explicit in current codebase (both modules are registered independently in AppModule).
**How to avoid:** Add `RegulatorioModule` to `OrquestracaoModule.imports`. Verify `RegulatorioModule` exports `TypeOrmModule` (it does: `exports: [TypeOrmModule]`).
**Warning signs:** NestJS bootstrap error "Nest can't resolve dependencies of the RegulatoryOrchestrationService".

### Pitfall 4: status enum columns — TicketExecution and StepExecution use TypeORM enum
**What goes wrong:** The `ticket_execution` and `step_execution` tables were created with TypeORM `enum` column type (checking migration 1773774004000). If the migration used PostgreSQL ENUM, any status value change requires `ALTER TYPE`. The Phase 1 decision was VARCHAR for enums — but these entities were created in Phase 1 and may have followed the old approach.
**Why it happens:** Phase 1 decision was "Status columns as VARCHAR in SQL, TypeScript enums at app layer" but the entity files show `type: 'enum'` in `@Column` decorators. Need to verify actual migration.
**How to avoid:** Check migration `1773774004000-CreateExecucaoTables.ts` to verify column types. If PostgreSQL ENUMs, don't add new status values without migration. For Phase 3, use only existing statuses.
**Warning signs:** Postgres error "invalid input value for enum" when inserting a new status key.

### Pitfall 5: steps ordered by stepOrder but not pre-sorted in TypeORM relation
**What goes wrong:** `capabilityVersion.steps` loaded via `relations: ['steps']` returns steps in insertion order, not `stepOrder`. The first step in the array may not be `stepOrder=1`.
**Why it happens:** TypeORM `OneToMany` relations don't add ORDER BY unless `@OrderBy` decorator is used on the relation, which isn't currently present on `CapabilityVersion.steps`.
**How to avoid:** Always sort steps explicitly: `steps.sort((a, b) => a.stepOrder - b.stepOrder)` after loading, or use QueryBuilder with `.addOrderBy('steps.stepOrder', 'ASC')`.
**Warning signs:** Execution starts on a middle step instead of the first step.

### Pitfall 6: ExecucaoModule exports TypeOrmModule but not TicketExecutionService
**What goes wrong:** Other modules (e.g., future phases) cannot inject `TicketExecutionService` because it's not exported.
**Why it happens:** Current `ExecucaoModule` only exports `TypeOrmModule`. New services added in Phase 3 must be explicitly exported.
**How to avoid:** Add `TicketExecutionService` to `ExecucaoModule.exports`.

### Pitfall 7: Concurrent executions on same complaint
**What goes wrong:** Two API calls start execution for the same complaint simultaneously, creating two `TicketExecution` records.
**Why it happens:** No unique constraint on `(complaintId, status=RUNNING)` at the DB level.
**How to avoid:** In `startExecution`, check for active executions before creating. This is an application-level guard:
```typescript
const active = await this.ticketExecutionRepo.findOne({
  where: { complaintId, status: In([TicketExecutionStatus.RUNNING, TicketExecutionStatus.PAUSED_HUMAN]) }
});
if (active) throw new HttpException('Execution already active', 409);
```
**Warning signs:** Two `ticket_execution` rows with same `complaintId` in RUNNING status.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Business days calculation | Complex holiday library | Simple loop (Mon-Fri only) | Phase 3 success criteria tests day count, not exact holiday exclusion; add holiday library in Phase 5 if needed |
| Step transition graph | Custom graph traversal | Ordered `stepOrder` integer + optional StepTransitionRule | StepTransitionRule table already exists for conditional routing; Phase 3 can use simple stepOrder+1 and save conditional transitions for Phase 5 |
| Skill execution registry | Complex plugin registry | Simple switch/if on `skill.key` | 19 skills, all no-ops in Phase 3; a SkillRouter with a switch statement is sufficient |
| Saga/workflow engine | Temporal, Bull, custom queue | Synchronous service methods | Phase 3 is operator-driven, step-by-step; async queues add complexity without benefit until Phase 5 |
| Distributed locks | Redis lock | DB query for active execution | Phase 3 is single-server; DB guard is sufficient |

**Key insight:** Every component that looks like it needs a framework (workflow engine, skill registry, event bus) is Phase 3-simple because: (a) steps are operator-gated, (b) skills are no-ops, (c) there's no concurrency beyond a single user advancing a single ticket.

---

## Code Examples

### SLA computation (business days, no library)
```typescript
// Source: derived from skill definition inputSchema + seed data
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

function computeSla(
  createdAt: Date,
  tipology: Tipology,
  situation: Situation | null,
): { slaDeadline: Date; slaBusinessDays: number; isOverdue: boolean } {
  const slaBusinessDays = situation?.slaOverrideDays ?? tipology.slaBusinessDays;
  const slaDeadline = addBusinessDays(createdAt, slaBusinessDays);
  return {
    slaDeadline,
    slaBusinessDays,
    isOverdue: new Date() > slaDeadline,
  };
}
```

### Capability selection
```typescript
// Source: project entity inspection — Capability.tipologyId, CapabilityVersion.isCurrent
async selectCapabilityVersion(tipologyId: string): Promise<CapabilityVersion> {
  const capability = await this.capabilityRepo.findOne({
    where: { tipologyId, isActive: true },
    relations: ['versions'],
  });
  if (!capability) {
    throw new HttpException(
      `No active capability for tipologyId ${tipologyId}`,
      422,
    );
  }
  const current = capability.versions.find((v) => v.isCurrent && v.isActive);
  if (!current) {
    throw new HttpException(
      `No current active version for capability ${capability.key}`,
      422,
    );
  }
  return current;
}
```

### Skill stub router
```typescript
// Source: SkillDefinition seeds — 19 skills all no-ops in Phase 3
async executeSkillStub(
  skillKey: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // In Phase 3, all skills return minimal valid output matching their outputSchema
  const stubs: Record<string, (i: Record<string, unknown>) => Record<string, unknown>> = {
    LoadComplaint: (i) => ({ complaint: { id: i['complaintId'], protocolNumber: i['protocolNumber'] } }),
    NormalizeComplaintText: (i) => ({ normalizedText: i['rawText'] as string }),
    ClassifyTypology: (i) => ({ tipologyKey: i['tipologyKey'] ?? 'cobranca', confidence: 1.0 }),
    ComputeSla: (i) => ({ slaDeadline: new Date().toISOString(), slaBusinessDays: 10, isOverdue: false }),
    DetermineRegulatoryAction: (i) => ({ actionKey: 'responder', justification: 'stub' }),
    RetrieveManualContext: () => ({ chunks: [] }),
    RetrieveIQITemplate: () => ({ templateContent: '[stub template]', templateName: 'stub' }),
    BuildMandatoryChecklist: () => ({ checklist: [], completionPercentage: 100 }),
    GenerateArtifact: (i) => ({ artifactId: 'stub-artifact-id' }),
    ApplyPersonaTone: (i) => ({ adjustedText: i['draftText'] as string }),
    DraftFinalResponse: () => ({ draftResponse: '[stub response]', tokensUsed: 0 }),
    ComplianceCheck: () => ({ isCompliant: true, violations: [], complianceScore: 1.0 }),
    HumanDiffCapture: () => ({ diffSummary: 'no diff', changesCount: 0 }),
    PersistMemory: () => ({ memoryId: 'stub-memory-id' }),
    TrackTokenUsage: (i) => ({ totalTokens: 0, estimatedCost: 0 }),
    AuditTrail: () => ({ auditLogId: 'stub-audit-id' }),
    ValidateReclassification: () => ({ isValid: true, errors: [] }),
    ValidateReencaminhamento: () => ({ isValid: true, errors: [] }),
    ValidateCancelamento: () => ({ isValid: true, errors: [] }),
  };
  const stub = stubs[skillKey];
  if (!stub) {
    throw new Error(`Unknown skill: ${skillKey}`);
  }
  return stub(input);
}
```

### Policy validator (BLOCKING rules)
```typescript
// Source: regulatory_rule seeded data + RegulatoryRuleType.BLOCKING
async validatePolicyRules(
  complaint: Complaint,
  action: 'advance' | 'finalizar',
): Promise<{ passed: boolean; violations: string[] }> {
  const rules = await this.ruleRepo.find({
    where: { ruleType: RegulatoryRuleType.BLOCKING, isActive: true },
  });

  const applicable = rules.filter((r) => {
    // Scope to tipology if rule has tipologyId
    if (r.tipologyId && r.tipologyId !== complaint.tipologyId) return false;
    // Check if rule applies to this action
    const blocksAction = (r.metadata as Record<string, unknown>)?.['blocks_action'];
    if (blocksAction && blocksAction !== action) return false;
    return true;
  });

  const violations: string[] = [];

  for (const rule of applicable) {
    const meta = rule.metadata as Record<string, unknown>;
    if (meta?.['requires_complete_checklist']) {
      // In Phase 3 stub: always passes (checklist logic is Phase 4)
      // Real logic would check complaint.details for checklist completion
    }
    // Additional rule evaluations follow the same pattern
  }

  return { passed: violations.length === 0, violations };
}
```

### TicketExecution start + metadata initialization
```typescript
// Source: project entity inspection — TicketExecution.metadata jsonb, currentStepKey
async startExecution(complaintId: string): Promise<TicketExecution> {
  const complaint = await this.complaintRepo.findOne({
    where: { id: complaintId },
    relations: ['tipology', 'situation'],
  });
  if (!complaint) throw new HttpException('Complaint not found', 404);
  if (!complaint.tipologyId) throw new HttpException('Complaint has no tipology set', 422);

  // Guard: no active execution
  const active = await this.ticketExecutionRepo.findOne({
    where: {
      complaintId,
      status: In([TicketExecutionStatus.RUNNING, TicketExecutionStatus.PAUSED_HUMAN]),
    },
  });
  if (active) throw new HttpException('Execution already active for this complaint', 409);

  // Select capability
  const capabilityVersion = await this.orchService.selectCapabilityVersion(complaint.tipologyId);

  // Load steps sorted by stepOrder
  const steps = await this.stepDefinitionRepo.find({
    where: { capabilityVersionId: capabilityVersion.id, isActive: true },
    order: { stepOrder: 'ASC' },
  });
  if (steps.length === 0) throw new HttpException('Capability has no active steps', 422);

  // Compute SLA
  const slaResult = this.orchService.computeSla(
    complaint.createdAt,
    complaint.tipology!,
    complaint.situation ?? null,
  );
  complaint.slaDeadline = slaResult.slaDeadline;
  complaint.slaBusinessDays = slaResult.slaBusinessDays;
  complaint.isOverdue = slaResult.isOverdue;
  await this.complaintRepo.save(complaint);

  // Build initial context
  const metadata: ExecutionContext = {
    tipologyKey: complaint.tipology!.key,
    situationKey: complaint.situation?.key ?? null,
    slaBusinessDays: slaResult.slaBusinessDays,
    slaDeadline: slaResult.slaDeadline.toISOString(),
    selectedActionKey: null,
    stepOutputs: {},
  };

  const execution = this.ticketExecutionRepo.create({
    complaintId,
    capabilityVersionId: capabilityVersion.id,
    status: TicketExecutionStatus.RUNNING,
    startedAt: new Date(),
    currentStepKey: steps[0].key,
    metadata,
  });

  return this.ticketExecutionRepo.save(execution);
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Separate orchestration module | Service in existing OrquestracaoModule | Less module proliferation; Phase 3 doesn't need a new module |
| Async job queue for steps | Synchronous service call per advance | Operator-driven, no background processing in Phase 3 |
| New row per retry | Increment retryCount on existing StepExecution | Entity design dictates this — `retryCount` field is on StepExecution |

**Not applicable yet (Phase 4+):**
- LLM calls, token tracking (LlmCall, TokenUsage entities exist but unused in Phase 3)
- HumanReview entity (exists but only relevant when AI generates content to review)
- Memory persistence (MemoriaModule seeded in Phase 1, not used in Phase 3)

---

## Open Questions

1. **Migration needed for Phase 3?**
   - What we know: All tables exist from Phase 1. No schema changes are required for Phase 3 — only service/controller additions.
   - What's unclear: Whether `TicketExecution.status` column is a PostgreSQL ENUM or VARCHAR. The entity uses `type: 'enum'` in `@Column` but Phase 1 decision was VARCHAR. Check migration `1773774004000-CreateExecucaoTables.ts` before writing any status values.
   - Recommendation: Read the migration before starting Plan 03-01 to confirm. If PostgreSQL ENUM, use only existing enum values. No migration needed for Phase 3 itself.

2. **StepTransitionRule usage in Phase 3**
   - What we know: `StepTransitionRule` entity exists with `conditionType`, `conditionExpression (jsonb)`, `targetStepKey`, and `priority`. No rules are seeded.
   - What's unclear: Whether Phase 3 step engine should evaluate transition rules or use simple linear `stepOrder + 1`.
   - Recommendation: Use linear `stepOrder + 1` in Phase 3. Conditional transitions (branching flows) are a Phase 5 concern. The entity is ready but the logic can be stubbed as "always follow stepOrder".

3. **Complaint.status update during execution**
   - What we know: `Complaint.status` has values: PENDING, IN_PROGRESS, WAITING_HUMAN, COMPLETED, CANCELLED.
   - What's unclear: Whether `startExecution` should update `complaint.status = IN_PROGRESS`, and whether `advanceStep` when pausing should set `complaint.status = WAITING_HUMAN`.
   - Recommendation: Yes. `startExecution` sets complaint to IN_PROGRESS. `advanceStep` on WAITING_HUMAN step sets complaint to WAITING_HUMAN. `finalizeExecution` sets complaint to COMPLETED. This keeps complaint status synchronized with execution state.

---

## Sources

### Primary (HIGH confidence)
- Project entity source files (read directly 2026-03-17):
  - `capability.entity.ts`, `capability-version.entity.ts`, `step-definition.entity.ts`, `step-transition-rule.entity.ts`, `skill-definition.entity.ts`, `step-skill-binding.entity.ts`
  - `ticket-execution.entity.ts`, `step-execution.entity.ts`, `artifact.entity.ts`, `audit-log.entity.ts`, `human-review.entity.ts`
  - `tipology.entity.ts`, `situation.entity.ts`, `regulatory-rule.entity.ts`, `regulatory-action.entity.ts`
  - `complaint.entity.ts`
- Project seed files (read directly 2026-03-17):
  - `regulatorio.seeder.ts` — SLA rules (SLA_ABERTA_10D=10d, SLA_REABERTA_5D=5d, SLA_PEDIDO_3D=3d), BLOCKING rules
  - `orquestracao.seeder.ts` — 19 skill definitions with inputSchema/outputSchema
- Project module files (read directly 2026-03-17):
  - `orquestracao.module.ts` — exports TypeOrmModule, no services yet
  - `execucao.module.ts` — exports TypeOrmModule, imports nothing
  - `execution.service.ts` — read-only queries only
  - `execution.controller.ts` — GET endpoints only

### Secondary (MEDIUM confidence)
- Phase 02 RESEARCH.md — confirmed NestJS 11 patterns, TypeORM 0.3 QueryBuilder patterns, global JwtAuthGuard, `synchronize: false`

### Tertiary (LOW confidence)
- None — all findings are derived from the actual codebase, not external sources

---

## Metadata

**Confidence breakdown:**
- SLA logic: HIGH — seed data directly confirms the formula (slaOverrideDays ?? slaBusinessDays)
- Capability selection: HIGH — entity has tipologyId FK, no situationId FK, confirmed from source
- Step engine design: HIGH — entity fields (isHumanRequired, stepOrder, currentStepKey, retryCount) directly inform the design
- Policy validator: HIGH — single BLOCKING rule seeded, metadata structure visible
- BFF contract: HIGH — derived from entity fields and success criteria
- Module wiring: HIGH — NestJS module patterns are stable, entity imports verified
- Retry logic: HIGH — entity has retryCount, design intent is clear

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (schema stable; no external dependencies)
