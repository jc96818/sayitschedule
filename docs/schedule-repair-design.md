# Schedule Generation: Deterministic Draft + LLM Repair (Design)

This document proposes a scalable schedule-generation architecture where the backend generates a **deterministic draft schedule** and an LLM proposes **small, bounded patch operations** to resolve remaining complex rules, tradeoffs, and edge cases.

This is designed to:
- Scale to double-digit (and larger) staff/patient counts.
- Keep model context small and stable.
- Avoid “full-week regenerate” prompts that degrade quickly with size.
- Support provider/task routing (e.g. Nova for rule/entity work, OpenAI/Azure models for repair if allowed).

Related docs:
- `docs/HIPAA_AI_plan.md` (ruleLogic + ID mapping + PHI guardrails)
- `docs/SECURITY_MULTITENANCY_REVIEW.md` (prompt minimization)

---

## Summary

### Key idea
1) Do as much as possible **algorithmically** (hard constraints, feasibility).
2) Ask an LLM to propose **patches**, not a full schedule.
3) Validate patches deterministically; iterate a small number of times.

### Why patches?
Full schedule generation forces the model to keep a lot of state in its head (all staff, patients, slots, constraints). Patch mode gives the model a constrained “choice set” so it can focus on high-order decisions instead of bookkeeping.

---

## Non-goals

- Replacing deterministic validation with LLM judgment.
- Letting the LLM choose arbitrary times/people outside a backend-defined search space.
- Relying on unstructured text output from the LLM.

---

## Terminology

- **Resolved rule**: a rule whose entity references have been bound to concrete entity IDs (not names) and is safe to apply deterministically.
- **Legacy rule**: a rule whose meaning exists only in a free-text description and may contain names; it must be migrated or flagged for review.
- **Violation**: a deterministic finding produced by backend validation (constraint breach, missing requirement, etc).
- **Patch operation**: a small edit to the schedule (move, swap, add, delete) expressed in JSON.
- **Search space**: the backend-defined set of allowed moves; it keeps the LLM bounded and token-light.

---

## Architecture overview

### A) Rule lifecycle evaluation (always-on)

Triggers:
- Rule created/updated/deactivated
- Staff/patient created/updated/deactivated
- Rooms changed (capabilities / availability), if rooms are used in constraints

Outputs persisted on each rule:
- `resolutionStatus`: `resolved | needs_review | invalid | legacy`
- `issues[]`: ambiguity, missing entity, inactive entity, etc.
- Optional “binding basis” information (what mention/alias was resolved, confidence, and the candidate set)
- `lastEvaluatedAt`

Behavior:
- Only `resolved` rules are eligible for schedule generation.
- `needs_review` rules should block schedule generation or produce explicit warnings (configurable).

Provider suggestion:
- Use Nova for “rule checks” (small prompts: one rule + entity list subset).
- Avoid using a large-model call for every staff/patient change; do deterministic ambiguity checks first.

### B) Schedule generation (draft + repair loop)

1. **Deterministic draft**
   - Hard constraints (must-haves): no overlaps, availability hours, certifications, room capabilities, durations, session counts.
   - Output: draft schedule + deterministic `violations[]`.

2. **LLM repair**
   - Input: draft schedule (IDs only), `violations[]`, relevant rules subset, and a backend-computed `searchSpace`.
   - Output: JSON patch list.

3. **Apply + validate**
   - Apply patch ops.
   - Re-run deterministic validation.
   - Stop if no improvement, patch invalid, or iteration cap reached.

---

## PHI / “P001” note (operational)

Mapping internal IDs to `P001`/`S001` reduces token usage and direct identifiers, but it is best treated as **pseudonymization**, not automatic de-identification:
- Real appointment dates/times are often still identifying under HIPAA “Safe Harbor” (dates except year are identifiers).
- Even if a provider cannot map `P001 → person`, the system can; the dataset remains linkable.

Recommended modes:
- **Template mode**: send `D1..D5` + `T001..TN` slots (no real dates/times) for de-identified/synthetic workflows.
- **Real mode**: include real dates/times only when you are treating the prompt as PHI under a HIPAA-eligible provider/contract.

---

## Data contract: Repair Request (model input)

Design principle: do not send full entity lists. Send only sessions involved, violations, a small rules subset, and a bounded search space.

### RepairRequest shape

See `backend/src/services/scheduleRepair.ts` for the authoritative TypeScript types.

High-level fields:
- `meta`: request id, iteration, mode, max ops.
- `slots`: the canonical slot definitions for `slotId`.
- `schedule.sessions`: list of sessions with short IDs and `slotId`.
- `violations`: deterministic findings with references to sessions/rules/entities.
- `rules`: resolved rule logic (IDs only) + optional short summaries.
- `searchSpace`: allowed moves per session and allowed “add” requirements.
- `objective`: repair objective and scoring hints.

---

## Data contract: Repair Response (model output)

The model returns patch operations only (JSON), never a full regenerated schedule.

Operations:
- `move`: move one session to an allowed slot (optionally change therapist/room if allowed).
- `swap`: swap two sessions.
- `add`: schedule one missing requirement in an allowed slot with allowed therapist/room.
- `delete`: remove a session (rare; typically only used if a session is invalid and cannot be repaired).

Validation rules (backend-enforced):
- Unknown IDs are rejected.
- Moves outside allowed `searchSpace` are rejected.
- The same session cannot be modified multiple times in one patch unless explicitly allowed (default: disallow).
- `maxPatchOps` hard cap.

---

## Prompt templates (recommended)

### System prompt (repair)

```
You are a schedule repair assistant.

You will receive a JSON object describing:
- The current schedule (sessions with IDs and slot IDs)
- Deterministic violations to fix
- Rules to respect (already resolved to IDs)
- A bounded search space that lists the only allowed changes

You must return ONLY valid JSON with this exact shape:
{
  "patch": [ ...operations... ],
  "expectedImpact": { "violationsResolved": [], "violationsIntroducedRisk": [] },
  "notes": []
}

CRITICAL:
- Use ONLY IDs and slotIds provided in the request.
- Choose ONLY from allowedSlotIds/allowedTherapistIds/allowedRoomIds in searchSpace.
- Prefer the smallest number of operations.
- Do not add commentary outside JSON.
```

### User prompt

Serialize the `RepairRequest` JSON.

---

## Provider routing plan

Current code uses `AI_PROVIDER` globally (`backend/src/services/aiProvider.ts`). For mixed-provider workflows:
- Create task-specific functions that call providers directly.
- Example policy:
  - Nova: `resolveRuleEntities`, `evaluateRules`, `detectAmbiguity`
  - OpenAI/Azure: `repairSchedule` (only if allowed by org policy/mode)

---

## Development plan (phased)

### Phase 0: Plumbing (no behavior change)
- Add schedule repair types/prompt builder/patch validator: `backend/src/services/scheduleRepair.ts`
- Add unit tests for prompt building and patch validation.

Acceptance:
- Repair prompts build deterministically.
- Invalid patches are rejected locally.

### Phase 1: Rule evaluation lifecycle
- Add persisted rule evaluation fields (schema/migration): `resolutionStatus`, `issues`, `lastEvaluatedAt`, optional `bindingBasis`.
- Implement deterministic ambiguity checks (duplicate names, collisions).
- Implement Nova-based resolution for ambiguous mentions (candidate list + confidence).
- Wire triggers on rule write and staff/patient write to re-evaluate impacted rules.

Acceptance:
- Adding a new staff member can flip an older rule to `needs_review` if it was bound from an ambiguous mention.
- Schedule generation blocks or warns when unresolved/needs_review rules exist.

### Phase 2: Deterministic draft generator
- Implement a fast greedy/backtracking scheduler that satisfies hard constraints.
- Output violations for unmet requirements.

Acceptance:
- Works at scale without LLM.
- Produces a draft + structured violations.

### Phase 3: LLM repair loop
- Build `RepairRequest` from draft + violations (bounded searchSpace).
- Call LLM to get patch ops.
- Apply patch ops, validate, iterate (max 2).

Acceptance:
- Patch ops reduce violations and do not introduce invalid sessions.
- Prompt size grows sublinearly with org size (bounded by “sessions involved” + candidate lists).

---

## Open questions

- What is the “block vs warn” threshold for `needs_review` rules in production?
- Which rules are “hard” vs “soft” (and how is that represented in `ruleLogic`)?
- How many repair iterations are acceptable latency-wise?
- Should we store repair traces (request/response) for audit/debug (with PHI precautions)?

