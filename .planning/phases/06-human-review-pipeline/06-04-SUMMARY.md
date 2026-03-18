---
phase: 06-human-review-pipeline
plan: 04
subsystem: ui
tags: [nextjs, typescript, server-actions, step-transitions, dto-mapping]

# Dependency graph
requires:
  - phase: 06-human-review-pipeline
    provides: TransitionRuleDto with conditionType/conditionExpression/targetStepKey backend entity shape; StepsDesignerController with PUT /api/admin/steps/:stepId/transitions endpoint
provides:
  - getTransitions server action correctly maps backend conditionType/conditionExpression/targetStepKey to UI model
  - saveTransitions serializes UI model to backend DTO shape matching TransitionRuleDto exactly
  - TransitionsEditor receives steps prop and renders step-key dropdown for target step selection
affects: [07-reporting-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontend DTO adapter pattern: UI model (field/operator/value + targetStepOrder) ↔ backend DTO (conditionType/conditionExpression/targetStepKey) mapped in server action, never in component"
    - "Key-based resolution: saveTransitions resolves targetStepKey from explicit key or falls back to stepOrder lookup in steps array"

key-files:
  created: []
  modified:
    - frontend/src/app/admin/steps/[capabilityId]/actions.ts
    - frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx

key-decisions:
  - "TransitionCondition adds optional targetStepKey — populated on load (from backend), resolved on save (from dropdown selection)"
  - "getTransitions maps conditionType→condition.field, conditionExpression.operator/value→condition.operator/value"
  - "saveTransitions receives steps[] as 4th param for server-side key resolution; conditionType/conditionExpression/targetStepKey sent to backend"
  - "TransitionsEditor target step input changed from number input to select dropdown listing steps by key with order.name display"

patterns-established:
  - "DTO adapter in actions.ts: All backend ↔ UI shape translation stays in server actions, components only see the UI model"

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 6 Plan 04: Transition Schema Gap Closure Summary

**Frontend TransitionsEditor now sends conditionType/conditionExpression/targetStepKey to match TransitionRuleDto exactly, and loads transitions via correct backend field mapping — eliminating 422 validation errors on every save.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T03:39:07Z
- **Completed:** 2026-03-18T03:47:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed `getTransitions` to read backend shape (`conditionType`, `conditionExpression`, `targetStepKey`) instead of non-existent `condition.field/operator/value`
- Fixed `saveTransitions` to serialize to backend DTO shape (`{ conditionType, conditionExpression: { operator, value }, targetStepKey }`) instead of rejected `{ condition, targetStepOrder }` shape
- `TransitionsEditor` upgraded: `steps` prop passed through, `<input type="number">` replaced with `<select>` listing available steps by key for UX-correct target selection
- VPS TypeScript check and `npm run build` both pass clean

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Fix getTransitions/saveTransitions + update TransitionsEditor** - `e8b7065` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/app/admin/steps/[capabilityId]/actions.ts` - TransitionCondition adds targetStepKey; getTransitions maps backend fields correctly; saveTransitions accepts steps[] param and sends conditionType/conditionExpression/targetStepKey
- `frontend/src/app/admin/steps/[capabilityId]/components/steps-designer.tsx` - TransitionsEditor accepts steps prop; addRow defaults targetStepKey; number input replaced with step-key select; handleSave passes steps to saveTransitions; usage site passes steps={steps}

## Decisions Made
- Kept the UI model (`condition.field/operator/value + targetStepOrder`) unchanged — the adapter pattern lives entirely in `actions.ts`, so the component code stays clean
- `targetStepKey` is optional on `TransitionCondition` — undefined for new rows until user selects from dropdown, then both `targetStepKey` and `targetStepOrder` are updated together
- `saveTransitions` resolves key with priority: explicit `targetStepKey` > `steps.find` by order > `String(order)` fallback — safe for edge cases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- VPS project path was `/root/EngDB/BKOAgent/frontend` (not `/opt/bko-agent/frontend` as stated in plan verify commands) — resolved by checking VPS directory structure; rsync used to sync files, then built with `npm run build` directly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Transition save/load round-trip is now correct end-to-end — no backend 422 errors on save
- Admin steps designer fully functional: steps reorder, skillKey/llmModel config, isHumanRequired toggle, transitions per step with correct DTO mapping
- Ready for Phase 7 (Reporting Dashboard)

---
*Phase: 06-human-review-pipeline*
*Completed: 2026-03-18*
