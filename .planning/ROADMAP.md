# Roadmap: BKO Agent

## Overview

BKO Agent is built in seven phases following the natural dependency order of the system: database schema and project scaffolding come first, then the access layer (auth + ticket management), then the regulatory orchestration engine and MCP runtime that form the core of the platform, then the intelligence layers (AI service + knowledge base), then the 19 skills wired to the runtime, then the human-facing pipeline (HITL + step processor + artifacts), and finally memory, personas, configuration admin, observability, and security hardening. Each phase delivers a coherent, independently verifiable capability that unblocks the next.

## Phases

- [x] **Phase 1: Foundation** - Database schema, pgvector, seed data, NestJS/Next.js project scaffolding
- [x] **Phase 2: Access Layer** - Authentication, RBAC, BFF, ticket management CRUD and UI
- [x] **Phase 3: Orchestration Engine** - Regulatory orchestration (SLA, classify, situacao, action, policy) + MCP runtime (capability registry, step engine, skill router, context, artifacts, retry)
- [x] **Phase 4: Intelligence Layer** - AI service (prompt builder, model selector, agents, token tracking) + Knowledge base (ingestion, vector search, template/mandatory resolvers, versioning)
- [ ] **Phase 5: Skills Pipeline** - All 19 skills implemented and registered; end-to-end execution with artifact production
- [ ] **Phase 6: Human Review Pipeline** - HITL editor, step processor UI, artifact viewer, diff capture, steps designer
- [ ] **Phase 7: Polish & Compliance** - Memory & learning, personas, configuration admin, observability dashboards, security/LGPD hardening

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
- [ ] 01-01-PLAN.md — NestJS + Next.js scaffolding, Docker Compose, TypeORM + pgvector config
- [ ] 01-02-PLAN.md — All 31 entity definitions across 5 domains, domain-scoped migrations
- [ ] 01-03-PLAN.md — Seed data (tipologias, situations, rules, skills) + mock complaint injection

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
- [ ] 02-01-PLAN.md — Auth module (JWT + RBAC + guards), user migration, seed test users
- [ ] 02-02-PLAN.md — Complaint CRUD endpoints (list with filters/pagination, detail, executions, artifacts)
- [ ] 02-03-PLAN.md — Frontend login, complaint queue page, ticket detail page

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
- [ ] 03-01-PLAN.md — RegulatoryOrchestrationService: SLA calculator, capability selector, policy validator
- [ ] 03-02-PLAN.md — TicketExecutionService: step engine (start, advance, finalize, retry), skill stub router
- [ ] 03-03-PLAN.md — TicketExecutionController: BFF endpoints + end-to-end verification

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
- [ ] 04-01: Knowledge base — document ingestion pipeline, pgvector indexing, vector + SQL search, template and mandatory info resolvers, document versioning
- [ ] 04-02: AI service — prompt builder, model selector (multi-model + fallback + temperature policy), complaint parsing agent, draft generator
- [ ] 04-03: AI service — compliance evaluator, final response composer, token usage tracker; KB Manager BFF endpoints

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
- [ ] 05-01: Data & regulatory skills (SKLL-01 to SKLL-08: load, normalize, compute SLA, classify, action, validations)
- [ ] 05-02: Knowledge retrieval & generation skills (SKLL-09 to SKLL-14: retrieve manual, IQI template, checklist, generate artifact, apply persona, draft response)
- [ ] 05-03: Quality, memory & instrumentation skills (SKLL-15 to SKLL-20: compliance check, human diff, persist memory, token tracking, audit trail) + artifact end-to-end validation

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
**Plans**: TBD

Plans:
- [ ] 06-01: Step processor UI — 4-column layout (ticket data, current step, generated artifact, human review), advance button, step blocking
- [ ] 06-02: HITL editor — AI text view, diff panel, regulatory checklist, observations, approval action; BFF human-review endpoint; diff persistence
- [ ] 06-03: Steps designer — visual flow builder, step/skill/LLM bindings, condition rules, situacao variations, risk deviations

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
**Plans**: TBD

Plans:
- [ ] 07-01: Memory & learning — case memory, human correction memory, style memory, similarity matcher for cases and corrections, approved pattern suggestions
- [ ] 07-02: Personas catalog + configuration admin UI (personas, templates, steps, skills, capabilities, LLM models)
- [ ] 07-03: Observability — logs per ticket, metric panels (latency, cost, error rate, HITL rate, conformance, tokens), Trace Explorer, compliance score
- [ ] 07-04: Security & LGPD — CPF/phone masking, prompt redaction, access audit trail, profile segregation enforcement, prompt/template versioning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | ✓ Complete | 2026-03-17 |
| 2. Access Layer | 4/4 | ✓ Complete | 2026-03-17 |
| 3. Orchestration Engine | 3/3 | ✓ Complete | 2026-03-17 |
| 4. Intelligence Layer | 3/3 | ✓ Complete | 2026-03-18 |
| 5. Skills Pipeline | 0/3 | Not started | - |
| 6. Human Review Pipeline | 0/3 | Not started | - |
| 7. Polish & Compliance | 0/4 | Not started | - |
