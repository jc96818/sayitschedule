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
3. Send only short IDs to AI during schedule generation (any provider)
4. Validate entity references when rules are created
5. Enable reliable chunked scheduling with specific pairings handled first

### AI Provider Strategy

| Task | Provider | Data Sent |
|------|----------|-----------|
| Voice parsing / Entity resolution | AWS Nova (HIPAA) | Names + org context |
| Rule analysis | AWS Nova (HIPAA) | Names for context |
| Schedule generation | Any (Nova/OpenAI) | Short IDs only |

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

**Before**: Sends full names (PII risk)
```
- ID: cmjx74dzw00077hsb86fkdm04
  Name: Lisa Chen        <- PII sent to AI
  Gender: female
```

**After**: Sends only short IDs (HIPAA safe)
```
- ID: S001
  Gender: female
  Certifications: [BCBA, Autism Specialist]
```

Create ID mapping at start of generation, use for prompt, reverse-map AI response.

Update system prompt to reference entities by short ID only.

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
| `src/types/ruleLogic.ts` | CREATE | P0 |
| `src/services/entityResolver.ts` | CREATE | P0 |
| `src/services/ruleValidator.ts` | CREATE | P0 |
| `src/services/ruleFormatter.ts` | CREATE | P0 |
| `prisma/schema.prisma` | MODIFY - add migrationStatus | P0 |
| `src/routes/rules.ts` | MODIFY - validation, new endpoints | P1 |
| `src/services/voiceParser.ts` | MODIFY - entity resolution | P1 |
| `src/services/novaProvider.ts` | MODIFY - remove names from prompts | P1 |
| `src/services/openaiProvider.ts` | MODIFY - remove names from prompts | P1 |
| `src/services/scheduler.ts` | MODIFY - use new formatter | P1 |
| `src/db/migrations/migrate-rule-logic.ts` | CREATE | P2 |

---

## Testing Strategy

1. **Unit tests** for entityResolver, ruleValidator, ruleFormatter
2. **Integration tests** for rule creation with validation
3. **HIPAA verification**: Assert AI prompts contain no names
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
3. **Fuzzy matching for voice**: Use existing sessionLookup patterns
4. **Gradual migration**: Legacy rules continue to work during transition
