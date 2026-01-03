export type RuleReviewStatus = 'ok' | 'needs_review'

export type RuleReviewEntityType = 'staff' | 'patient'

export interface RuleReviewCandidate {
  entityType: RuleReviewEntityType
  id: string
  name: string
}

export type RuleReviewIssue =
  | {
      type: 'ambiguous_entity_reference'
      mention: string
      candidates: RuleReviewCandidate[]
      detail: string
    }
  | {
      type: 'duplicate_full_name'
      mention: string
      candidates: RuleReviewCandidate[]
      detail: string
    }

export interface RuleReviewResult {
  ruleId: string
  status: RuleReviewStatus
  issues: RuleReviewIssue[]
}

export interface ReviewableRule {
  id: string
  description: string
  ruleLogic: Record<string, unknown>
}

export interface ReviewEntity {
  id: string
  name: string
}

export interface RuleReviewContext {
  staff: ReviewEntity[]
  patients: ReviewEntity[]
}

export class RuleReviewRequiredError extends Error {
  public readonly results: RuleReviewResult[]

  constructor(results: RuleReviewResult[]) {
    super('Rules require review before schedule generation')
    this.name = 'RuleReviewRequiredError'
    this.results = results
  }
}

function normalize(text: string): string {
  return text.toLowerCase().trim()
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWholePhrase(haystackLower: string, phraseLower: string): boolean {
  if (!phraseLower) return false
  const pattern = new RegExp(`\\b${escapeRegex(phraseLower)}\\b`, 'i')
  return pattern.test(haystackLower)
}

function extractFirstName(fullName: string): string | null {
  const parts = normalize(fullName).split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[0] : null
}

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth <= 0) return
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth - 1)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out, depth - 1)
  }
}

function buildCandidateIndexes(context: RuleReviewContext): {
  firstNameToCandidates: Map<string, RuleReviewCandidate[]>
  fullNameToCandidates: Map<string, RuleReviewCandidate[]>
} {
  const firstNameToCandidates = new Map<string, RuleReviewCandidate[]>()
  const fullNameToCandidates = new Map<string, RuleReviewCandidate[]>()

  const add = (entityType: RuleReviewEntityType, entity: ReviewEntity) => {
    const fullName = normalize(entity.name)
    const candidate: RuleReviewCandidate = { entityType, id: entity.id, name: entity.name }

    const fullBucket = fullNameToCandidates.get(fullName) || []
    fullBucket.push(candidate)
    fullNameToCandidates.set(fullName, fullBucket)

    const firstName = extractFirstName(entity.name)
    if (firstName) {
      const firstBucket = firstNameToCandidates.get(firstName) || []
      firstBucket.push(candidate)
      firstNameToCandidates.set(firstName, firstBucket)
    }
  }

  for (const s of context.staff) add('staff', s)
  for (const p of context.patients) add('patient', p)

  return { firstNameToCandidates, fullNameToCandidates }
}

export function evaluateRuleForReview(rule: ReviewableRule, context: RuleReviewContext): RuleReviewResult {
  const issues: RuleReviewIssue[] = []

  const ruleLogic =
    rule.ruleLogic && typeof rule.ruleLogic === 'object' && !Array.isArray(rule.ruleLogic)
      ? rule.ruleLogic
      : {}

  const stringsToScan: string[] = [rule.description]
  collectStrings(ruleLogic, stringsToScan, 4)

  const haystackLower = normalize(stringsToScan.join(' '))

  const { firstNameToCandidates, fullNameToCandidates } = buildCandidateIndexes(context)

  const resolvedFirstNames = new Set<string>()
  const boundMentions = new Set<string>()

  const bindingsValue = (ruleLogic as { entityBindings?: unknown }).entityBindings
  if (Array.isArray(bindingsValue)) {
    for (const binding of bindingsValue as Array<Record<string, unknown>>) {
      const mention = typeof binding.mention === 'string' ? normalize(binding.mention) : null
      const entityType = binding.entityType === 'staff' || binding.entityType === 'patient' ? binding.entityType : null
      const entityId = typeof binding.entityId === 'string' ? binding.entityId : null

      if (!mention || !entityType || !entityId) continue

      const exists =
        entityType === 'staff'
          ? context.staff.some(s => s.id === entityId)
          : context.patients.some(p => p.id === entityId)

      if (!exists) continue

      boundMentions.add(mention)
      const firstToken = mention.split(/\s+/).filter(Boolean)[0]
      if (firstToken) resolvedFirstNames.add(firstToken)
    }
  }

  // Record unambiguous full-name mentions so we don't also flag their first-name tokens.
  for (const [fullName, candidates] of fullNameToCandidates.entries()) {
    if (candidates.length !== 1) continue
    if (!containsWholePhrase(haystackLower, fullName)) continue
    const firstName = extractFirstName(candidates[0].name)
    if (firstName) resolvedFirstNames.add(firstName)
  }

  // 1) Duplicate full-name collisions: if the exact full name is mentioned, ensure it identifies a single entity.
  for (const [fullName, candidates] of fullNameToCandidates.entries()) {
    if (candidates.length <= 1) continue
    if (boundMentions.has(fullName)) continue
    if (!containsWholePhrase(haystackLower, fullName)) continue
    issues.push({
      type: 'duplicate_full_name',
      mention: fullName,
      candidates,
      detail: `The name "${fullName}" matches multiple entities.`
    })
  }

  // 2) Ambiguous first-name references: if a first name is mentioned and maps to multiple entities, flag it.
  const tokens = haystackLower.split(/[^a-z0-9]+/).filter(Boolean)
  const uniqueTokens = Array.from(new Set(tokens))
  for (const token of uniqueTokens) {
    if (resolvedFirstNames.has(token)) continue
    if (boundMentions.has(token)) continue
    const candidates = firstNameToCandidates.get(token)
    if (!candidates || candidates.length <= 1) continue
    issues.push({
      type: 'ambiguous_entity_reference',
      mention: token,
      candidates,
      detail: `The mention "${token}" matches multiple entities.`
    })
  }

  const status: RuleReviewStatus = issues.length > 0 ? 'needs_review' : 'ok'
  return { ruleId: rule.id, status, issues }
}

export function evaluateRulesForReview(rules: ReviewableRule[], context: RuleReviewContext): RuleReviewResult[] {
  return rules.map(rule => evaluateRuleForReview(rule, context))
}
