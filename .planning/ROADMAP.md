# Roadmap: BKO Agent

## Overview

BKO Agent is built in ten phases following the natural dependency order of the system: database schema and project scaffolding come first, then the access layer (auth + ticket management), then the regulatory orchestration engine and MCP runtime that form the core of the platform, then the intelligence layers (AI service + knowledge base), then the 19 skills wired to the runtime, then the human-facing pipeline (HITL + step processor + artifacts), then memory, personas, configuration admin, observability, and security hardening. Milestone v2 adds three additional phases that simplify the pipeline, introduce an operator-facing note-taking and processing UI, and close the feedback loop with training memory.

## Phases

- [x] **Phase 1: Foundation** - Database schema, pgvector, seed data, NestJS/Next.js project scaffolding
- [x] **Phase 2: Access Layer** - Authentication, RBAC, BFF, ticket management CRUD and UI
- [x] **Phase 3: Orchestration Engine** - Regulatory orchestration (SLA, classify, situacao, action, policy) + MCP runtime (capability registry, step engine, skill router, context, artifacts, retry)
- [x] **Phase 4: Intelligence Layer** - AI service (prompt builder, model selector, agents, token tracking) + Knowledge base (ingestion, vector search, template/mandatory resolvers, versioning)
- [x] **Phase 5: Skills Pipeline** - All 19 skills implemented and registered; end-to-end execution with artifact production
- [x] **Phase 6: Human Review Pipeline** - HITL editor, step processor UI, artifact viewer, diff capture, steps designer
- [x] **Phase 7: Polish & Compliance** - Memory & learning, personas, configuration admin, observability dashboards, security/LGPD hardening
- [x] **Phase 8: Schema & Pipeline Simplification** - DB migrations for operator note + human_review extensions; pipeline reduced to 14 steps; LoadComplaint and DraftFinalResponse updated to consume operator note
- [ ] **Phase 9: Operator UI & RBAC** - `/processar` screen with note-taking, search, progress tracking; sidebar routing rules per role
- [ ] **Phase 10: Validation UI & Training Memory** - `/processar/:protocolo/validar` approve/correct/reject flow; feedback persisted to HumanFeedbackMemory; admin feedback audit page

## Phase Details

### Phase 1: Foundation
**Goal**: The database and project scaffolding exist, enabling every other phase to build on a stable, correctly-structured foundation
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09
**Success Criteria** (what must be TRUE):
  1. PostgreSQL database with pgvector extension runs and all ~35 tables exist across 5 domains (Operacao, Regulatorio, Orquestracao, Execucao, Memoria)
  2. Seed data is loaded: tipologias, situacoes, and regulatory rules are queryable via SQL
  3. Mock complaint data from the spreadsheet is injected and queryable
  4. NestJS backend and Next.js frontend boot without errors and can reach the database
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — NestJS + Next.js scaffolding, Docker Compose, TypeORM + pgvector config
- [x] 01-02-PLAN.md — All 31 entity definitions across 5 domains, domain-scoped migrations
- [x] 01-03-PLAN.md — Seed data (tipologias, situations, rules, skills) + mock complaint injection

### Phase 2: Access Layer
**Goal**: Authenticated users with appropriate roles can access the system and view, filter, and inspect complaint tickets
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, TICK-01, TICK-02, TICK-03, TICK-04, TICK-05, TICK-06
**Success Criteria** (what must be TRUE):
  1. User can log in with email/password and stay logged in across browser refreshes
  2. Operator, supervisor, and admin profiles see only the features their role permits
  3. Operator can see the complaint queue with filters (tipologia, SLA, status, risco, etapa)
  4. Operator can open a ticket and see request details, attachments, and full history
  5. Operator can see all artifacts and execution logs for a ticket
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Auth module (JWT + RBAC + guards), user migration, seed test users
- [x] 02-02-PLAN.md — Complaint CRUD endpoints (list with filters/pagination, detail, executions, artifacts)
- [x] 02-03-PLAN.md — Frontend login, complaint queue page, ticket detail page

### Phase 3: Orchestration Engine
**Goal**: The system can classify a complaint, compute its SLA and situation, decide the regulatory action, select the right capability, and execute a configured step flow end-to-end
**Depends on**: Phase 2
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, ORCH-07, ORCH-08, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08
**Success Criteria** (what must be TRUE):
  1. System automatically calculates correct SLA deadline for aberta (10 days), pedidos (3 days), and reaberta (5 days) complaints
  2. System classifies tipologia and situacao and decides regulatory action (responder, reclassificar, reencaminhar, cancelar) for a given complaint
  3. Policy Validator blocks step advancement when Manual Anatel rules are not satisfied
  4. Operator can start ticket processing and advance step-by-step through a configured capability flow
  5. Each step execution is logged in full (input, output, status, errors); failed steps can be retried individually
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — RegulatoryOrchestrationService: SLA calculator, capability selector, policy validator
- [x] 03-02-PLAN.md — TicketExecutionService: step engine (start, advance, finalize, retry), skill stub router
- [x] 03-03-PLAN.md — TicketExecutionController: BFF endpoints + end-to-end verification

### Phase 4: Intelligence Layer
**Goal**: The AI service can build context-rich prompts, call configured LLM models, parse complaints, generate drafts, evaluate compliance, and retrieve relevant knowledge from the indexed knowledge base
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07, KB-08
**Success Criteria** (what must be TRUE):
  1. Manual Anatel and Guia IQI are ingested, chunked, and indexed; a query returns relevant chunks via vector search
  2. Template Resolver returns the correct IQI template for a given tipologia/situacao combination; Mandatory Info Resolver returns the required fields
  3. AI service generates a structured complaint parse, a draft response, and a compliance evaluation for a test ticket
  4. Model Selector routes classification calls to a lighter model and composition calls to a heavier model based on configuration, with fallback
  5. Token usage and cost are tracked per LLM call
**Plans**: TBD

Plans:
- [x] 04-01: Knowledge base — document ingestion pipeline, pgvector indexing, vector + SQL search, template and mandatory info resolvers, document versioning
- [x] 04-02: AI service — prompt builder, model selector (multi-model + fallback + temperature policy), complaint parsing agent, draft generator
- [x] 04-03: AI service — compliance evaluator, final response composer, token usage tracker; KB Manager BFF endpoints

### Phase 5: Skills Pipeline
**Goal**: All 19 skills are implemented, registered in the MCP capability registry, and execute correctly in sequence — producing the full set of artifacts for a complaint from load through audit trail
**Depends on**: Phase 4
**Requirements**: SKLL-01, SKLL-02, SKLL-03, SKLL-04, SKLL-05, SKLL-06, SKLL-07, SKLL-08, SKLL-09, SKLL-10, SKLL-11, SKLL-12, SKLL-13, SKLL-14, SKLL-15, SKLL-16, SKLL-17, SKLL-18, SKLL-19, SKLL-20, ART-01, ART-02, ART-03, ART-04, ART-05, ART-06, ART-07, ART-08, ART-09, ART-10, ART-11
**Success Criteria** (what must be TRUE):
  1. LoadComplaint through AuditTrail skills all execute without error on a test complaint and are registered in the capability registry
  2. Each skill persists its execution record (input, output, status, duration, cost, model, prompt version, template version, errors)
  3. A full end-to-end execution of a complaint produces all 11 artifact types (ART-01 through ART-11) stored in the artifact store
  4. Validation skills (reclassificacao, reencaminhamento, cancelamento) correctly block or allow their respective actions per Manual Anatel rules
**Plans**: TBD

Plans:
- [x] 05-01: Data & regulatory skills (SKLL-01 to SKLL-08: load, normalize, compute SLA, classify, action, validations)
- [x] 05-02: Knowledge retrieval & generation skills (SKLL-09 to SKLL-14: retrieve manual, IQI template, checklist, generate artifact, apply persona, draft response)
- [x] 05-03: Quality, memory & instrumentation skills (SKLL-15 to SKLL-20: compliance check, human diff, persist memory, token tracking, audit trail) + artifact end-to-end validation

### Phase 6: Human Review Pipeline
**Goal**: Operators can process a complaint step-by-step through the UI, review and edit AI-generated content, approve the final response, and the system captures all human corrections
**Depends on**: Phase 5
**Requirements**: STEP-01, STEP-02, STEP-03, STEP-04, HITL-01, HITL-02, HITL-03, HITL-04, HITL-05, HITL-06, HITL-07, DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, DSGN-07, DSGN-08, DSGN-09
**Success Criteria** (what must be TRUE):
  1. Operator can advance a ticket step-by-step through the UI; steps requiring human review block automatic advancement
  2. HITL editor shows AI-generated text, diff vs human edit, regulatory checklist, and an observations field
  3. Operator can approve the final response only after completing the HITL checklist; approval is recorded with timestamp and user
  4. System persists diff and correction reason for every human edit (feeds memory layer)
  5. Admin can create and edit step flows in the visual designer, including skill bindings, LLM model per step, conditions (SLA, risk, procedencia), and human-required flag
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Backend BFF: HumanReviewController + HumanReviewService (diff computation, ART-11 update), HitlPolicyService (risk-aware HITL gate), StepsDesignerController + StepsDesignerService (atomic step CRUD)
- [x] 06-02-PLAN.md — Step processor UI: 4-column layout (ticket data, current step, artifact viewer, human action panel), advance/retry server actions, HITL editor link on paused_human
- [x] 06-03-PLAN.md — HITL editor UI (AI view, edit, diff panel, regulatory checklist, approval) + Steps designer admin pages (/admin/steps list and detail with reorder)

### Phase 7: Polish & Compliance
**Goal**: The platform has memory-driven response improvement, governed persona catalog, full configuration admin, operational observability dashboards, and LGPD/security controls in place
**Depends on**: Phase 6
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, PERS-01, PERS-02, PERS-03, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, OBS-09, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. When processing a complaint, the AI receives similar past cases and human corrections as context, and approved response patterns are surfaced
  2. Admin can create and modify personas (name, tipologia, formality, empathy, assertiveness, required/forbidden expressions) without recompiling; 4 pre-configured personas exist
  3. Admin can configure all catalog items (personas, templates, steps, skills, capabilities, LLM models) from the UI without recompiling the application
  4. Observability dashboard shows latency per step, cost per ticket, error rate per skill, human intervention rate, regulatory conformance by tipologia, and token/cost totals; Trace Explorer allows end-to-end debug of any execution
  5. CPF and phone numbers are masked in the frontend; prompt logs have sensitive data redacted; access trail is auditable; profile segregation is enforced
**Plans**: 4 plans

Plans:
- [x] 07-01-PLAN.md — Memory & learning: MemoryRetrievalService (similar cases + corrections via pgvector), MemoryFeedbackService (human review → HumanFeedbackMemory), PromptContext extension, wired into SkillRegistryService and HumanReviewService
- [x] 07-02-PLAN.md — Personas catalog + configuration admin UI: AdminConfigController/Service (12 endpoints), frontend admin pages for personas, templates, skills, capabilities, and LLM models
- [x] 07-03-PLAN.md — Observability dashboards: ObservabilityService/Controller (8 endpoints), recharts install, 6 metric panels, Trace Explorer, per-ticket logs
- [x] 07-04-PLAN.md — Security & LGPD: SensitiveDataInterceptor on complaint/execution controllers, frontend maskSensitive utilities, ticket detail page masking

---

## Milestone v2 — Operator Workflow

### Phase 8: Schema & Pipeline Simplification
**Goal**: The database has all v2 tables (operator note, access_token, ticket_timing_event, ticket_lock) and human_review extensions; the pipeline runs 14 steps cleanly without invoice/discount data; timing events are recorded for every milestone
**Depends on**: Phase 7 (v1 complete)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, AUTH-TOKEN-01, AUDIT-TIMING-01, AUDIT-TIMING-02, AUDIT-TIMING-05, LOCK-01
**Success Criteria** (what must be TRUE):
  1. Migration runs cleanly: `complaint_user_note`, `access_token`, `ticket_timing_event`, `ticket_lock` tables exist; `enrichedText` and `rejectionReason` columns exist; HumanReviewStatus enum includes `rejected` and `corrected`
  2. 14-step capability executes end-to-end without calling `retrieve_discounts` or `retrieve_invoices`
  3. LoadComplaint skill output includes `enrichedText` (rawText + last active note) with graceful fallback
  4. DraftFinalResponse receives operator note content in LLM prompt and produces a draft that reflects it
  5. `ticket_timing_event` rows are persisted automatically at: ticket_created, note_saved, execution_started, paused_human, decision_made, approved, completed
  6. `GET /api/complaints/:id/timing` returns calculated metrics (tempo_total, tempo_sla, tempo_revisao_humana, tempo_nota_a_processamento, tempo_aprovacao_a_conclusao)
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — TypeORM migrations + entities: `complaint_user_note`, `access_token`, `ticket_timing_event`, `ticket_lock`; `enrichedText` and `rejectionReason` columns; module wiring (OperacaoModule, ExecucaoModule)
- [x] 08-02-PLAN.md — Pipeline simplification: deactivate `retrieve_discounts`/`retrieve_invoices` step definitions (UPDATE isActive=false); update LoadComplaint skill to read latest active note + emit enrichedText + emit timing event; ensure BuildMandatoryChecklist tolerates missing invoice/discount fields
- [x] 08-03-PLAN.md — DraftFinalResponse prompt context (inject operator note via PromptBuilderService); TimingEventService + auto-instrumentation in TicketExecutionService (lifecycle events); GET /api/complaints/:id/timing endpoint; smoke test for 14-step run

### Phase 9: Operator UI, Token Auth & RBAC
**Goal**: Operators access `/processar` via personal token (no login screen), search complaints by protocol, take an exclusive lock, fill the structured note, and start processing with a visible progress indicator; admin manages tokens; sidebar routing enforces role boundaries
**Depends on**: Phase 8
**Requirements**: OPUI-01, OPUI-02, OPUI-03, OPUI-04, OPUI-05, OPUI-06, OPUI-07, OPUI-08, OPUI-09, RBAC-01, RBAC-02, RBAC-03, RBAC-04, AUTH-TOKEN-02, AUTH-TOKEN-03, AUTH-TOKEN-04, AUTH-TOKEN-05, AUTH-TOKEN-06, AUTH-TOKEN-07, LOCK-02, LOCK-03, LOCK-04, LOCK-05
**Success Criteria** (what must be TRUE):
  1. New users get a token auto-generated on creation; admin can issue new tokens and revoke existing ones at `/admin/tokens` (list with user, expiresAt, lastUsedAt, isActive)
  2. URL `/processar?token=XXX` validates token, creates session, redirects to `/processar` (token removed from URL); expired/invalid token shows "Token expirado, contate o administrador"
  3. Sidebar shows `/processar` for OPERATOR, SUPERVISOR, ADMIN; `/tickets` only for SUPERVISOR/ADMIN; OPERATOR lands on `/processar` after token auth
  4. Operator searches by Anatel or internal protocol and sees complaint header (protocol, tipologia, SLA, risk, raw text); search auto-creates lock for current user (TTL 30min)
  5. Another user trying to access locked ticket sees "Ticket sendo tratado por {nome} desde {hora}"; SUPERVISOR/ADMIN can force-release
  6. Operator fills/saves structured note as draft (plano, valor, motivo, data, observação); saving creates new version + emits `note_saved` timing event
  7. Clicking "Iniciar Processamento" validates note, persists, calls `startExecution`, displays 0/14 → 14/14 progress; lock renews on each action
  8. OPERATOR receives 403 on `/tickets/[id]/execution/[execId]` direct access
**Plans**: 4 plans

Plans:
- [ ] 09-01-PLAN.md — Backend Token & Lock: AccessTokenController + AccessTokenService (generate on user create, list, revoke, validate); TokenAuthGuard middleware for `/processar?token=XXX`; TicketLockService (acquire/renew/release/force-release); ComplaintUserNoteController + Service (upsert with version, history); protocol-lookup endpoint; RBAC guard for execution page (403 for OPERATOR)
- [ ] 09-02-PLAN.md — Frontend RBAC + Token Auth: sidebar by role; OPERATOR default redirect to `/processar`; token auth flow page (validates `?token=` then redirects); 403 guard on execution page; error page for expired token
- [ ] 09-03-PLAN.md — Frontend `/processar` page: protocol search bar (Anatel + internal); complaint header card; lock acquisition + visual lock-conflict UI; structured note form; save-as-draft + "Iniciar Processamento" buttons with validation; progress bar component (polling)
- [ ] 09-04-PLAN.md — Admin token management UI: `/admin/tokens` page with table (user, token preview, expiresAt, lastUsedAt, isActive), "Novo Token" modal (select user + TTL), "Revogar" action; `/admin/locks` table for supervisors with force-release

### Phase 10: Validation UI, Training Memory & Audit Reports
**Goal**: After the pipeline pauses for human review, operators are routed to a validation screen where they approve/correct/reject the AI draft (releasing the ticket lock); every decision feeds HumanFeedbackMemory + ticket_timing_event for AI training and audit reporting; admin can audit feedback and timing metrics
**Depends on**: Phase 9
**Requirements**: VALUI-01, VALUI-02, VALUI-03, VALUI-04, VALUI-05, VALUI-06, VALUI-07, TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, TRAIN-05, AUDIT-TIMING-03, AUDIT-TIMING-04
**Success Criteria** (what must be TRUE):
  1. Pipeline pause auto-redirects to `/processar/:protocolo/validar` with AI draft pre-loaded + conformance score, template, KB chunks, operator note, and injected past corrections
  2. Aprovar/Corrigir/Reprovar each produce correct human_review status, emit `decision_made` timing event with userId, finalize execution, release ticket lock, set ticket `responsavelFinal` to current user
  3. Rejection allows operator to update note and start new execution from `/processar` without navigating away (note carries forward, lock re-acquired)
  4. Every correction persists to `human_feedback_memory` with `feedbackType: 'correction'` + embedding; every rejection persists with `feedbackType: 'rejection'` + embedding; both retrievable by tipologia
  5. DraftFinalResponse injects up to N similar past corrections into LLM prompt; injected examples visible in validation screen's context panel
  6. `/admin/feedback` lists all feedback entries filterable by tipologia (read-only)
  7. `/admin/audit/timings` shows ticket timing metrics (tempo total, tempo SLA, tempo revisão humana, tempo nota→processamento, tempo aprovação→conclusão); filters by tipologia, período, perfil
  8. Observability dashboard shows new metric `human_review_avg_time` (média entre paused_human → decision_made)
**Plans**: 3 plans

Plans:
- [ ] 10-01-PLAN.md — Backend: extend HumanReviewService for approved/corrected/rejected with timing event emission + lock release + responsavelFinal set; MemoryFeedbackService persistence with embeddings; GET /api/admin/feedback endpoint (ADMIN); GET /api/admin/audit/timings endpoint with filters; observability service adds human_review_avg_time metric
- [ ] 10-02-PLAN.md — DraftFinalResponse prompt update: MemoryRetrievalService.findSimilarFeedback (correction + rejection), inject into PromptBuilderService draft context, expose injected examples in execution artifact output for UI display
- [ ] 10-03-PLAN.md — Frontend: `/processar/:protocolo/validar` page (editable draft, conformance score, context panel, Aprovar/Corrigir/Reprovar with rejection modal); auto-redirect from `/processar` on paused_human; `/admin/feedback` read-only; `/admin/audit/timings` table with filters; observability panel update

## Progress

**Execution Order:**
v1: Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
v2: 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | ✓ Complete | 2026-03-17 |
| 2. Access Layer | 4/4 | ✓ Complete | 2026-03-17 |
| 3. Orchestration Engine | 3/3 | ✓ Complete | 2026-03-17 |
| 4. Intelligence Layer | 3/3 | ✓ Complete | 2026-03-18 |
| 5. Skills Pipeline | 3/3 | ✓ Complete | 2026-03-18 |
| 6. Human Review Pipeline | 4/4 | ✓ Complete | 2026-03-18 |
| 7. Polish & Compliance | 4/4 | ✓ Complete | 2026-03-18 |
| 8. Schema & Pipeline Simplification | 0/3 | Not started | — |
| 9. Operator UI & RBAC | 0/3 | Not started | — |
| 10. Validation UI & Training Memory | 0/3 | Not started | — |
