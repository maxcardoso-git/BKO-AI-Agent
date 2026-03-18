---
phase: 06-human-review-pipeline
verified: 2026-03-18T03:23:47Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Admin can create and edit step flows in the visual designer, including skill bindings, LLM model per step, conditions (SLA, risk, procedencia), and human-required flag"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Operator advances ticket from paused_human state via HITL editor"
    expected: "After submitting HITL review the execution resumes, the next step runs, and the operator is redirected back to the step processor"
    why_human: "Full end-to-end flow through real DB and backend HITL gate cannot be verified statically"
  - test: "Approve button is disabled until all required checklist items are checked"
    expected: "Clicking Approve is only possible after all isRequired checklist items have checkboxes ticked"
    why_human: "Client-side state logic with dynamic checklist data from ART-06 requires browser interaction"
---

# Phase 6: Human Review Pipeline — Verification Report

**Phase Goal:** Operators can process a complaint step-by-step through the UI, review and edit AI-generated content, approve the final response, and the system captures all human corrections

**Verified:** 2026-03-18T03:23:47Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (transition condition schema mismatch fix)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator can advance a ticket step-by-step through the UI; steps requiring human review block automatic advancement | ✓ VERIFIED | `StepProcessor` renders advance/retry buttons and HITL link; `TicketExecutionService.advanceStep()` pauses to `PAUSED_HUMAN` via `HitlPolicyService.shouldRequireHumanReview()` when `isHumanRequired=true` or `riskLevel=high/critical` |
| 2 | HITL editor shows AI-generated text, diff vs human edit, regulatory checklist, and an observations field | ✓ VERIFIED | `hitl-editor.tsx` has 4 tabs: "Texto IA" (read-only aiDraft), "Editar" (Textarea), "Comparacao" (ReactDiffViewer), "Checklist" (checkboxes from ART-06); observations Textarea present |
| 3 | Operator can approve the final response only after completing the HITL checklist; approval is recorded with timestamp and user | ✓ VERIFIED | `canApprove = allRequiredChecked && !isAlreadyApproved` gates the Approve button; `HumanReviewService.createReview()` persists `reviewedAt: new Date()` and `reviewerUserId` from JWT |
| 4 | System persists diff and correction reason for every human edit (feeds memory layer) | ✓ VERIFIED | `HumanReviewService.createReview()` calls `diffWords(aiGeneratedText, humanFinalText)`, stores `diffSummary` as JSON with changesCount/additions/removals, persists `correctionReason`, and updates ART-11 (`human_diff`) |
| 5 | Admin can create and edit step flows in the visual designer, including skill bindings, LLM model per step, conditions (SLA, risk, procedencia), and human-required flag | ✓ VERIFIED | Gap closed: `getTransitions()` now correctly maps `conditionType → condition.field`, `conditionExpression.operator/value → condition.operator/value`, `targetStepKey` preserved; `saveTransitions()` now serializes to `{ conditionType, conditionExpression: { operator, value }, targetStepKey }` — exact match to `TransitionRuleDto` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/modules/execucao/services/human-review.service.ts` | HumanReviewService + HitlPolicyService | ✓ VERIFIED | 151 lines; `HitlPolicyService.shouldRequireHumanReview()` + `HumanReviewService.createReview()` with diffWords; fully substantive |
| `backend/src/modules/execucao/controllers/human-review.controller.ts` | POST/GET review endpoints | ✓ VERIFIED | 67 lines; POST and GET `executions/:execId/steps/:stepExecId/review` — both wired to service |
| `backend/src/modules/execucao/dto/submit-review.dto.ts` | Review DTO with all fields | ✓ VERIFIED | 22 lines; `approved`, `humanFinalText`, `correctionReason`, `checklistItems`, `observations` — all present with class-validator decorators |
| `backend/src/modules/execucao/entities/human-review.entity.ts` | HumanReview DB entity | ✓ VERIFIED | All columns present: `reviewerUserId`, `status`, `aiGeneratedText`, `humanFinalText`, `diffSummary`, `correctionReason`, `checklistItems`, `checklistCompleted`, `observations`, `reviewedAt` |
| `backend/src/modules/orquestracao/dto/update-steps.dto.ts` | TransitionRuleDto matching entity fields | ✓ VERIFIED | `TransitionRuleDto` defines `conditionType: string`, `conditionExpression: Record<string,unknown>`, `targetStepKey: string`, `priority?: number` — exact match to frontend serialization |
| `backend/src/modules/orquestracao/services/steps-designer.service.ts` | StepsDesignerService with CRUD | ✓ VERIFIED | 189 lines; `listCapabilities()`, `getCapabilityVersion()`, `updateSteps()`, `getTransitions()`, `updateTransitions()` |
| `backend/src/modules/orquestracao/controllers/steps-designer.controller.ts` | 5 admin endpoints | ✓ VERIFIED | 76 lines; GET capabilities, GET version, PUT steps, GET transitions, PUT transitions |
| `frontend/src/app/admin/steps/[capabilityId]/actions.ts` | saveSteps, saveTransitions, getTransitions | ✓ VERIFIED | 103 lines; `getTransitions()` maps backend fields correctly; `saveTransitions()` serializes to exact `TransitionRuleDto` shape |
| `frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx` | StepsDesigner + TransitionsEditor | ✓ VERIFIED | 311 lines; `condition.field` is UI abstraction for `conditionType`; `targetStepKey` used in selector and new-row defaults; `handleSave()` passes through `saveTransitions` with correct serialization |
| `frontend/src/app/tickets/[id]/execution/[execId]/components/step-processor.tsx` | 4-column step processor | ✓ VERIFIED | 199 lines; HITL link shown when `execution.status === 'paused_human'`; advance/retry buttons wired to server actions |
| `frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/components/hitl-editor.tsx` | 4-tab HITL editor | ✓ VERIFIED | 189 lines; AI text, Edit, Diff viewer, Checklist; approval gate `canApprove = allRequiredChecked && !isAlreadyApproved` |
| `frontend/src/app/tickets/[id]/execution/[execId]/review/[stepExecId]/actions.ts` | submitHumanReview server action | ✓ VERIFIED | 60 lines; POSTs review, advances execution with `operatorInput`, redirects |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `actions.ts getTransitions()` | `GET /api/admin/steps/:stepId/transitions` | `fetchAuthAPI` | ✓ WIRED | Response typed as `{ conditionType, conditionExpression, targetStepKey }[]`; all fields mapped correctly |
| `actions.ts saveTransitions()` | `PUT /api/admin/steps/:stepId/transitions` | `fetchAuthAPI` | ✓ WIRED | Sends `{ transitions: [{ conditionType, conditionExpression: { operator, value }, targetStepKey }] }` — matches `UpdateTransitionsDto` + `TransitionRuleDto` exactly |
| `TransitionsEditor` | `getTransitions` action | `loadTransitions()` | ✓ WIRED | Lazy-loads on open; response populates `condition.field/operator/value` and `targetStepKey` correctly via UI abstraction layer |
| `TransitionsEditor` | `saveTransitions` action | `handleSave()` | ✓ WIRED | Passes transitions + steps to action; action resolves `targetStepKey` from explicit key or stepOrder fallback |
| `hitl-editor.tsx` | `submitHumanReview` action | `useActionState` inline wrapper | ✓ WIRED | `(_prev, formData) => submitHumanReview(execId, stepExecId, complaintId, _prev, formData)` |
| `submitHumanReview` action | `POST /api/executions/:execId/steps/:stepExecId/review` | `fetchAuthAPI` | ✓ WIRED | Sends `approved`, `humanFinalText`, `correctionReason`, `checklistItems`, `observations` |
| `submitHumanReview` action | `POST /api/executions/:execId/advance` | `fetchAuthAPI` | ✓ WIRED | Second call with `operatorInput: { humanReviewId, approved: true }` to bypass HITL gate |
| `HumanReviewService` | `diff` npm package | `diffWords()` | ✓ WIRED | `diffWords(aiGeneratedText, humanFinalText)` with changesCount/additions/removals |
| `TicketExecutionService` | `HitlPolicyService` | DI constructor | ✓ WIRED | `shouldRequireHumanReview(isHumanRequired, riskLevel)` at `advanceStep()` line 217 |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| HITL-01: Operator advances ticket step-by-step | ✓ SATISFIED | `StepProcessor` advance button + `advanceStep` server action |
| HITL-02: HITL steps block automatic advancement | ✓ SATISFIED | `HitlPolicyService` gate in `advanceStep()` pauses to `PAUSED_HUMAN` |
| HITL-03: HITL editor shows AI text + diff + checklist + observations | ✓ SATISFIED | 4-tab HitlEditor with all required sections |
| HITL-04: Approval recorded with timestamp and user | ✓ SATISFIED | `reviewedAt: new Date()` + `reviewerUserId` from JWT in HumanReview entity |
| HITL-05: Approve gated on checklist completion | ✓ SATISFIED | `canApprove = allRequiredChecked` client-side gate |
| HITL-06: Diff and correction reason persisted | ✓ SATISFIED | `diffSummary` (JSON), `correctionReason`, ART-11 updated in `createReview()` |
| DSGN-01: Admin can list capabilities | ✓ SATISFIED | `GET /api/admin/capabilities` + `/admin/steps` page |
| DSGN-02: Admin can update step order and skill bindings | ✓ SATISFIED | `PUT /api/admin/capabilities/:capId/versions/:verId/steps` with atomic transaction |
| DSGN-03: isHumanRequired toggle per step | ✓ SATISFIED | Toggle in StepsDesigner, saved via `saveSteps` |
| DSGN-04/05: Transition condition CRUD | ✓ SATISFIED | Gap closed: frontend serialization now matches `TransitionRuleDto`; read and write both correctly aligned to backend entity |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | None found | — | All previous blockers resolved |

### Human Verification Required

#### 1. End-to-end HITL flow

**Test:** Start an execution for a complaint with `riskLevel=high`, advance the step, observe the execution pauses at `paused_human`, open the HITL editor, tick all required checklist items, submit, verify redirect to step processor with execution resumed.
**Expected:** Full cycle completes without errors; `human_review` row exists in DB with `status=approved`, `reviewedAt` set, `diffSummary` populated, and ART-11 artifact updated.
**Why human:** Full pipeline through live DB, NestJS backend, and Next.js frontend cannot be verified statically.

#### 2. Approval gate enforcement in browser

**Test:** Open HITL editor page with a checklist that has required items. Verify the "Aprovar Resposta Final" button is disabled initially. Tick all required items. Verify button becomes enabled.
**Expected:** Button remains disabled until all `isRequired: true` checklist items are checked.
**Why human:** Client-side `useState` with dynamic checklist data from ART-06 requires browser interaction.

### Re-verification Summary

**Gap closed:** Transition condition CRUD schema mismatch between frontend and backend has been fully resolved.

The previous gap had two failure modes:

1. **Read path broken:** `getTransitions()` was trying to read `t.condition.field/operator/value` from the backend response, but the backend returns `conditionType/conditionExpression/targetStepKey`. The fixed version correctly types the API response and maps: `conditionType → condition.field`, `conditionExpression.operator → condition.operator`, `conditionExpression.value → condition.value`, `targetStepKey → targetStepKey`.

2. **Write path broken:** `saveTransitions()` was sending `{ condition: { field, operator, value }, targetStepOrder }` which `TransitionRuleDto` class-validator would reject. The fixed version serializes `condition.field → conditionType`, `{ operator, value } → conditionExpression`, and resolves `targetStepKey` from the explicit key field (falling back to stepOrder-based lookup).

The UI in `steps-designer.tsx` correctly uses `targetStepKey` as the select value (line 120), and new rows are initialized with `targetStepKey` from the first available step (line 43). The frontend `TransitionCondition` interface preserves both `targetStepOrder` (for UI display) and `targetStepKey` (for backend serialization), which is a stable adapter pattern.

All 5 must-haves are now fully verified at the structural level. Two items remain for human verification due to their real-time/browser-interactive nature.

---

_Verified: 2026-03-18T03:23:47Z_
_Verifier: Claude (gsd-verifier)_
