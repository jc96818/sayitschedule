# Plan: Structured Rule Logic with Entity IDs

## Problem Statement

1. **HIPAA Risk**: Patient/staff names are sent to external AI providers during schedule generation
2. **Unreliable Parsing**: Rules use natural language descriptions that AI must interpret at generation time
3. **No Entity Resolution**: Names mentioned in rules aren't resolved to IDs until too late
4. **Underutilized Schema**: `ruleLogic` JSON field exists but has no enforced structure

## Solution Overview

Restructure the rule system to:
1. Store structured `ruleLogic` with entity IDs (not names) at rule creation time
2. Use AWS Nova (HIPAA-eligible) for entity resolution when names are needed
3. Minimize PHI in schedule-generation prompts (and treat any patient-level scheduling as PHI unless formally de-identified)
4. Validate entity references when rules are created
5. Enable reliable chunked scheduling with specific pairings handled first

### AI Provider Strategy

| Task | Provider | Data Sent |
|------|----------|-----------|
| Voice parsing / Entity resolution | AWS Nova (HIPAA) | Names + org context |
| Rule analysis | AWS Nova (HIPAA) | Names for context |
| Schedule generation (production) | AWS Nova (HIPAA) | Minimal necessary fields; prefer short IDs; assume PHI |
| Schedule generation (synthetic / de-identified) | Any (Nova/OpenAI) | Only if inputs are formally de-identified (no names, no real dates/times, no free-text notes) |

### PHI Guardrails (Prompt Contract)

Important: “No names” and “short IDs” alone do **not** guarantee a prompt is non‑PHI. Patient-level scheduling data (even if tokenized) is typically still PHI unless you have a formal de-identification determination.

**Production rule**: If the prompt contains any patient-specific scheduling context, treat it as PHI and use a HIPAA-eligible provider under BAA (Nova).

If you later introduce a non‑BAA provider for schedule generation, enforce both:
1. **Mode gating**: only allowed for synthetic/test orgs or formally de‑identified datasets.
2. **Prompt firewall**: hard-block anything resembling PHI (see Testing Strategy).

### Short ID Mapping (for AI prompts)

Generate temporary short IDs at schedule generation time:
```typescript
// Map cuids to short IDs for cleaner prompts
const staffIdMap = new Map(staff.map((s, i) => [s.id, `S${String(i+1).padStart(3,'0')}`]))
// cmjx74dzw00077hsb86fkdm04 -> S001

// AI sees: "S001 must be paired with P005"
// Map back to cuids when processing AI response
```

Benefits:
- Reduces token usage in prompts
- Improves AI reasoning (shorter, cleaner references)
- No database changes required
- cuids remain the source of truth

---

## Phase 1: Type Definitions and Core Services

### 1.1 Create `/backend/src/types/ruleLogic.ts`

Define TypeScript types for each rule category:

```typescript
// Discriminated unions for each category
type StructuredRuleLogic =
  | GenderPairingLogic
  | SessionLogic
  | AvailabilityLogic
  | SpecificPairingLogic
  | CertificationLogic

// Example: specific_pairing
interface SpecificPairingForceLogic {
  type: 'force_pair'
  staffId: string      // UUID, not name
  patientId: string    // UUID, not name
  priority: 'required' | 'preferred'
}

interface SpecificPairingPreventLogic {
  type: 'prevent_pair'
  staffId: string
  patientId: string
  reason?: string
}
```

Full type definitions for all categories in implementation.

### 1.2 Create `/backend/src/services/entityResolver.ts`

Resolve entity names to IDs within an organization:

```typescript
async function resolveStaffByName(orgId: string, name: string): Promise<{ id: string; name: string } | null>
async function resolvePatientByName(orgId: string, name: string): Promise<{ id: string; name: string } | null>
async function resolveEntitiesInRuleLogic(orgId: string, parsedRule: ParsedRuleData): Promise<ResolvedRule>
```

Uses fuzzy matching (leverage existing `sessionLookup.ts` patterns).

Add disambiguation behavior:
- Return top N candidates with confidence scores
- Require explicit selection when confidence is below a threshold or multiple close matches exist
- Never auto-bind to an entity when ambiguous

### 1.3 Create `/backend/src/services/ruleValidator.ts`

Validate rules before saving:

```typescript
async function validateRule(orgId: string, category: string, ruleLogic: StructuredRuleLogic): Promise<ValidationResult>
async function detectConflicts(orgId: string, newRule: Rule, existingRules: Rule[]): Promise<Conflict[]>
```

Checks:
- Entity IDs exist and are active
- No conflicting force/prevent pairings
- Staff has required certs for specific_pairing

---

## Phase 2: Database Schema Update

### 2.1 Add Migration for `migrationStatus` field

```sql
ALTER TABLE rules ADD COLUMN migration_status VARCHAR(20) DEFAULT 'legacy';
```

Values: `'legacy'` (old rules) | `'structured'` (new format)

Implementation detail (Prisma): prefer a `migrationStatus` field mapped to the DB column, e.g. `migrationStatus String @default("legacy") @map("migration_status")`.

---

## Phase 3: Update Rule Creation Flow

### 3.1 Modify `/backend/src/routes/rules.ts`

Update `POST /api/rules`:

1. Validate `ruleLogic` structure against schema
2. Verify entity IDs exist via `entityResolver`
3. Detect conflicts with existing rules
4. Set `migrationStatus = 'structured'`
5. Return warnings for conflicts

Add new endpoints:
- `POST /api/rules/validate` - Pre-validate without saving
- `POST /api/rules/resolve-entities` - Autocomplete for UI

### 3.2 Modify `/backend/src/services/voiceParser.ts`

Update rule parsing to:
1. Extract entity names from transcript (uses Nova - HIPAA safe)
2. Call `entityResolver` to convert names → IDs (uses Nova with org entity list)
3. Return structured `ruleLogic` with cuids
4. Keep `description` for human-readable UI display

**Entity Resolution Prompt** (sent to Nova only):
```
Given this rule: "Lisa should always work with Emily"
And these staff: [{id: "cmj...", name: "Lisa Chen"}, ...]
And these patients: [{id: "cmj...", name: "Emily Johnson"}, ...]

Return: {staffId: "cmj...", patientId: "cmj...", type: "force_pair"}
```

---

## Phase 4: Update Schedule Generation (HIPAA Fix)

### 4.1 Create `/backend/src/services/ruleFormatter.ts`

New function to format rules for AI without names:

```typescript
function formatRulesForScheduleGeneration(rules: Rule[]): string {
  // Returns:
  // MUST: Staff abc123 assigned to Patient def456
  // NEVER: Staff ghi789 cannot see Patient jkl012
  // PREFER: Female patients with female staff
}
```

### 4.2 Modify `/backend/src/services/novaProvider.ts` and `openaiProvider.ts`

Update `formatStaffForPrompt` and `formatPatientsForPrompt`:

**Before**: Sends full names (PHI/PII risk)
```
- ID: cmjx74dzw00077hsb86fkdm04
  Name: Lisa Chen        <- PII sent to AI
  Gender: female
```

**After**: Prefer short IDs and strict minimization (reduces exposure)
```
- ID: S001
  Gender: female
  Certifications: [BCBA, Autism Specialist]
```

Create ID mapping at start of generation, use for prompt, reverse-map AI response.

Update system prompt to reference entities by short ID only.

Also require a structured response format (JSON) rather than free text, so we don’t reintroduce “unreliable parsing” on the output path.
Example (AI response shape):
```json
{
  "assignments": [
    { "staffId": "S001", "patientId": "P005", "slotId": "T012" }
  ]
}
```

### 4.3 Modify `/backend/src/services/scheduler.ts`

- Use new `formatRulesForScheduleGeneration()`
- Handle both legacy and structured rules (backwards compat)
- Pre-process specific pairings for chunked scheduling

---

## Phase 5: Migration for Existing Rules

### 5.1 Create `/backend/src/db/migrations/migrate-rule-logic.ts`

Script to convert legacy rules:
1. Parse `description` to extract entity names
2. Resolve names to IDs using `entityResolver`
3. Build structured `ruleLogic`
4. Set `migrationStatus = 'structured'`
5. Flag unresolvable rules for manual review

---

## Files to Modify/Create

| File | Action | Priority |
|------|--------|----------|
| `backend/src/types/ruleLogic.ts` | CREATE | P0 |
| `backend/src/services/entityResolver.ts` | CREATE | P0 |
| `backend/src/services/ruleValidator.ts` | CREATE | P0 |
| `backend/src/services/ruleFormatter.ts` | CREATE | P0 |
| `backend/prisma/schema.prisma` | MODIFY - add migrationStatus | P0 |
| `backend/src/routes/rules.ts` | MODIFY - validation, new endpoints | P1 |
| `backend/src/services/voiceParser.ts` | MODIFY - entity resolution | P1 |
| `backend/src/services/novaProvider.ts` | MODIFY - prompt minimization | P1 |
| `backend/src/services/openaiProvider.ts` | MODIFY - prompt minimization + mode gating | P1 |
| `backend/src/services/scheduler.ts` | MODIFY - use new formatter | P1 |
| `backend/src/db/migrations/migrate-rule-logic.ts` | CREATE | P2 |

---

## Testing Strategy

1. **Unit tests** for entityResolver, ruleValidator, ruleFormatter
2. **Integration tests** for rule creation with validation
3. **PHI verification**:
   - Snapshot tests of generated prompts per provider/mode
   - Assert prompts contain no names
   - Assert prompts contain no obvious identifiers (emails/phones/addresses/DOB) and no raw free-text notes
   - If non‑BAA schedule generation is enabled, assert the “de‑identified mode” contract is enforced (no patient-level scheduling in production)
4. **Migration tests**: Verify legacy rule conversion

---

## Rollout Plan

1. **Feature flag**: `USE_STRUCTURED_RULES=true` for new rules
2. **Backwards compat**: Support both legacy and structured rules
3. **Migration**: Run for all orgs, flag failures for review
4. **Cutover**: Remove legacy support after migration complete

---

## Key Design Decisions

1. **IDs in ruleLogic, names in description**: Human-readable display preserved
2. **Validation at creation time**: Fail fast if entities don't exist
3. **Fuzzy matching for voice**: Use existing sessionLookup patterns with disambiguation + confidence thresholds
4. **Gradual migration**: Legacy rules continue to work during transition
