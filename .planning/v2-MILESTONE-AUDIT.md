---
milestone: v2
audited: 2026-05-26
status: gaps_found
scores:
  requirements: 24/28 (3 partial, 1 fail)
  phases: 3/3 complete
  integration: 5/7 flows PASS, 1 PARTIAL, 1 FAIL
  flows: 5/7
gaps:
  critical:
    - "BUG-1 [10-03 frontend]: ValidarClient operator note panel always blank — `notes?latest=true` returns array but lib treats as object. Fix: 1 line in BKOConsole/src/lib/validation-api.ts:82"
    - "BUG-2 [08 timing chain]: `ticket_created` event never emitted because TimingEventService.emitOnce() has no caller. Result: tempoTotalMin and tempoSlaMin in /admin/audit/timings always null. Fix: call emitOnce('ticket_created', complaint.id) at complaint creation (turbina-import.service.ts and/or seed)."
tech_debt:
  - phase: 08-schema-pipeline-simplification
    items:
      - "complaint.enrichedText DB column never read or written by any service — dead column"
      - "TimingMilestone type includes 'ticket_discarded' but TicketLockService.discard() never emits it"
  - phase: 09-operator-ui-token-auth-rbac
    items:
      - "Lock TTL: code uses 15 min (ticket-lock.service.ts:13) vs Phase 9-01 SUMMARY/spec says 30 min — pick one and update"
      - "VERIFICATION.md never generated for Phase 9 (verifier was not part of workflow at the time)"
  - phase: 10-validation-ui-training-memory-audit-reports
    items:
      - "MEMORY_INJECTION_LIMIT env var not documented in .env.example"
  - phase: 08-schema-pipeline-simplification
    items:
      - "VERIFICATION.md never generated for Phase 8 (verifier was not part of workflow at the time)"
deploy_pending:
  - "Run Phase 10 migration on prod (72.61.52.70): cd /opt/bko-agent && npx typeorm migration:run -d dist/data-source.js"
  - "Rebuild backend + pm2 restart bko-backend"
  - "Deploy BKOConsole build + pm2 restart bko-console + hard-reload (Ctrl+Shift+R)"
---

# Milestone v2 Audit — Operator Workflow

**Status:** gaps_found (2 critical bugs, both one-line fixes; 7 tech-debt items)
**Phases:** 8 / 9 / 10 (all 3 complete, 10 plans executed)
**Audit date:** 2026-05-26

Detailed cross-phase integration analysis is in `.planning/v2-MILESTONE-INTEGRATION.md`.

---

## 1. Milestone Goal vs. Delivery

**Goal (from PROJECT.md):** Simplificar UX de revisão para usuário final via bloco de notas e fluxo aprovar/reprovar/corrigir que alimenta o aprendizado da IA. Remover dependência de tabelas externas (faturas/descontos) do pipeline.

**Delivery:** Achieved end-to-end. Operator pulls ticket → writes structured note → starts processing → pipeline pauses at compliance → operator validates (approve/correct/reject) → feedback persists to HumanFeedbackMemory → next ticket's draft includes past corrections. Pipeline shrunk 16→14 steps via deactivation of `retrieve_discounts/invoices`.

**Caveat:** The validation screen's "Nota do operador" panel renders blank due to BUG-1 (one-line frontend fix). The note IS reaching the LLM correctly (verified in Flow 1) — only the display in `/validar` is broken.

---

## 2. Requirements Coverage (28 v2 requirements)

| Group | Total | Satisfied | Partial | Fail |
|-------|-------|-----------|---------|------|
| SCHEMA-01..04 | 4 | 4 | 0 | 0 |
| PIPE-01..05 | 5 | 5 | 0 | 0 |
| AUTH-TOKEN-01..07 | 7 | 7 | 0 | 0 |
| AUDIT-TIMING-01..05 | 5 | 3 | 2 | 0 |
| LOCK-01..05 | 5 | 4 | 1 | 0 |
| OPUI-01..09 | 9 | 9 | 0 | 0 |
| RBAC-01..04 | 4 | 3 | 1 | 0 |
| VALUI-01..07 | 7 | 6 | 1 | 0 |
| TRAIN-01..05 | 5 | 5 | 0 | 0 |
| **Total** | **51** (note: requirements re-counted by group) | **46** | **5** | **0** |

(Header table: distinct REQ-IDs = 28; per-group sub-totals exceed because some IDs appear in multiple groups in REQUIREMENTS.md — see traceability matrix in INTEGRATION report for IDs.)

**Partials/Issues:**
- **VALUI-02** — Tela exibe nota do operador → **partial** due to BUG-1 (panel blank, fix one-line)
- **AUDIT-TIMING-02** — `tempo_total`/`tempo_sla` → **partial** due to BUG-2 (no ticket_created emit)
- **AUDIT-TIMING-03** — Same root cause as above (panel renders but shows null for total/sla columns)
- **RBAC-03** — `/executions/:id/steps` is OPERATOR-permitted (intentionally — needed for ProgressBar polling). Spec said 403. Either spec correction or controller scoping; recommend updating spec since ProgressBar needs the data.
- **LOCK-02** — TTL is 15 min in code vs 30 min in 09-01 spec. Functional, but inconsistent.

---

## 3. Cross-Phase Integration (7 flows)

| Flow | Status |
|------|--------|
| 1. Note → Pipeline → Prompt | ✓ PASS (Task 0 fix from 10-02 closed the dormant Phase 8-03 gap) |
| 2. HITL Pause → Validation UI redirect | ✓ PASS |
| 3. Rejection → Retry (VALUI-06) | ✓ PASS |
| 4. Training Memory loop (TRAIN-01..05) | ✓ PASS |
| 5. Token Auth → Operator Session | ✓ PASS |
| 6. Timing Audit Chain | ⚠ PARTIAL (BUG-2 — no ticket_created) |
| 7. Lock Lifecycle | ⚠ PARTIAL (TTL doc mismatch, no ticket_discarded emit) |

---

## 4. Critical Gaps (must fix before declaring v2 complete)

### BUG-1: ValidarClient operator note panel always blank

**Where:** `BKOConsole/src/lib/validation-api.ts:82`
**Cause:** `GET /api/complaints/:id/notes?latest=true` returns `ComplaintUserNote[]`, but client code assigns the array directly to `operatorNote`. Subsequent `.content` reads return `undefined`.
**Impact:** Operator opens `/processar/[protocolo]/validar` and sees blank note panel — even though the data IS in the prompt sent to the LLM.
**Fix:** One line — `operatorNote: (await nRes.json())?.[0] ?? null`.

### BUG-2: `ticket_created` timing event never emitted

**Where:** `backend/src/modules/operacao/services/timing-event.service.ts:50` — `emitOnce()` defined but no caller.
**Cause:** Phase 8-02 loadComplaint was supposed to backfill `ticket_created` idempotently, but the call site was removed/never added.
**Impact:** `/admin/audit/timings` always shows null for `tempoTotalMin` and `tempoSlaMin`. Observability `human_review_avg_time` works (uses paused_human/decision_made).
**Fix:** Add `await this.timingEventService.emitOnce('ticket_created', complaint.id, null, null, complaint.createdAt)` at complaint creation paths. Candidates: `TurbinaImportService.import()`, `ComplaintService.create()`, or the existing seed runner.

---

## 5. Non-Critical Tech Debt

| # | Phase | Item | Severity |
|---|-------|------|----------|
| 1 | 08 | `complaint.enrichedText` column unused | low (dead column, no cost) |
| 2 | 08 | `TimingMilestone='ticket_discarded'` declared but `TicketLockService.discard()` doesn't emit it | low |
| 3 | 09 | Lock TTL mismatch (15min code vs 30min spec) | medium (UX expectation) |
| 4 | 10 | `MEMORY_INJECTION_LIMIT` not in `.env.example` | low (deployer-facing) |
| 5 | 8+9 | No VERIFICATION.md files (verifier not in workflow at the time) | low (audit gap, not code gap) |

---

## 6. Deploy Pending (Phase 10 not yet in production)

The Phase 10 backend changes were committed and ready but **not yet deployed to 72.61.52.70**:

```bash
ssh root@72.61.52.70 "cd /opt/bko-agent && npx typeorm migration:run -d dist/data-source.js"
ssh root@72.61.52.70 "cd /opt/bko-agent && npm run build --prefix backend && pm2 restart bko-backend"
ssh root@72.61.52.70 "cd /root/EngDB/BKOConsole && git pull && npm run build && pm2 restart bko-console"
```

After deploy: hard-reload Chrome (`Ctrl+Shift+R`).

---

## 7. What to Do Next

**Option A — Fix the 2 critical bugs now, then ship.**
Both are <5 minutes of work. After fixing, v2 is genuinely complete. Recommended.

**Option B — Plan a gap-closure phase.**
Formal `/gsd:plan-milestone-gaps` flow. Overkill for 2 one-liners but cleaner audit trail.

**Option C — Accept gaps as tech debt and ship v2 anyway.**
The 2 bugs don't break core flows; they break secondary UX (blank note panel, missing timing columns). User-facing impact is limited.

Recommendation: **A** — fix inline, no new phase needed.
