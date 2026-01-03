export interface EntityBinding {
  mention: string
  entityType: 'staff' | 'patient'
  entityId: string
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isEntityBindings(value: unknown): value is EntityBinding[] {
  if (!Array.isArray(value)) return false
  return value.every(v =>
    v &&
    typeof v === 'object' &&
    typeof (v as { mention?: unknown }).mention === 'string' &&
    typeof (v as { entityType?: unknown }).entityType === 'string' &&
    typeof (v as { entityId?: unknown }).entityId === 'string'
  )
}

export function getEntityBindings(ruleLogic: Record<string, unknown>): EntityBinding[] {
  const bindings = (ruleLogic as { entityBindings?: unknown }).entityBindings
  if (!isEntityBindings(bindings)) return []
  return bindings
}

export function applyEntityBindingsToText(text: string, bindings: EntityBinding[]): string {
  let out = text

  for (const binding of bindings) {
    const mention = binding.mention.trim()
    if (!mention) continue

    const replacement =
      binding.entityType === 'staff'
        ? `staffId=${binding.entityId}`
        : `patientId=${binding.entityId}`

    const pattern = new RegExp(`\\b${escapeRegex(mention)}\\b`, 'gi')
    out = out.replace(pattern, replacement)
  }

  return out
}

export function mergeEntityBindings(existing: EntityBinding[], updates: EntityBinding[]): EntityBinding[] {
  const next = [...existing]

  for (const update of updates) {
    const mentionLower = update.mention.trim().toLowerCase()
    if (!mentionLower) continue

    const index = next.findIndex(b => b.mention.trim().toLowerCase() === mentionLower)
    if (index >= 0) {
      next[index] = update
    } else {
      next.push(update)
    }
  }

  return next
}

