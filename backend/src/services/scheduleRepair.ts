import * as novaProvider from './novaProvider.js'
import * as openaiProvider from './openaiProvider.js'

export type RepairProvider = 'nova' | 'openai'

export type RepairMode = 'template' | 'real'

export interface SlotDef {
  slotId: string
  day: string
  start: string
  end: string
}

export interface RepairSession {
  sid: string
  therapistId: string
  patientId: string
  sessionSpecId: string
  roomId?: string | null
  slotId: string
}

export type ViolationSeverity = 'blocker' | 'high' | 'medium' | 'low'

export type ViolationType =
  | 'unscheduled_required_session'
  | 'rule_violation'
  | 'soft_rule_missed'
  | 'overbooked_staff'
  | 'overbooked_room'
  | 'unmet_preference'

export interface RepairViolation {
  vid: string
  type: ViolationType
  severity: ViolationSeverity
  message: string
  relatedSessionIds?: string[]
  relatedRuleIds?: string[]
  relatedEntities?: string[]
}

export interface RepairRule {
  ruleId: string
  kind: 'hard' | 'soft' | 'complex'
  logic: Record<string, unknown>
  summary?: string
  priority?: number
}

export interface MovableSessionConstraint {
  sid: string
  allowedSlotIds: string[]
  allowedTherapistIds?: string[]
  allowedRoomIds?: string[]
  lock?: boolean
}

export interface AddableRequirementConstraint {
  requirementId: string
  patientId: string
  sessionSpecId: string
  countMissing: number
  allowedTherapistIds: string[]
  allowedSlotIds: string[]
  allowedRoomIds?: string[]
}

export interface RepairRequest {
  meta: {
    requestId: string
    mode: RepairMode
    timezone?: string
    iteration: number
    maxPatchOps: number
  }
  slots: SlotDef[]
  schedule: {
    sessions: RepairSession[]
  }
  violations: RepairViolation[]
  rules: RepairRule[]
  searchSpace: {
    movableSessions: MovableSessionConstraint[]
    addableRequirements?: AddableRequirementConstraint[]
  }
  objective: {
    primary: 'fix_blockers' | 'maximize_fulfillment'
    scoringHints?: {
      preferFewerMoves?: boolean
      avoidMovingLocked?: boolean
      keepExistingAssignmentsWhenPossible?: boolean
    }
  }
}

export type PatchOp =
  | {
      op: 'move'
      sid: string
      toSlotId: string
      toTherapistId?: string
      toRoomId?: string | null
      because: string
      fixes?: string[]
    }
  | {
      op: 'swap'
      sidA: string
      sidB: string
      because: string
      fixes?: string[]
    }
  | {
      op: 'delete'
      sid: string
      because: string
      fixes?: string[]
    }
  | {
      op: 'add'
      requirementId: string
      therapistId: string
      patientId: string
      sessionSpecId: string
      slotId: string
      roomId?: string | null
      because: string
      fixes?: string[]
    }

export interface RepairResponse {
  patch: PatchOp[]
  expectedImpact?: {
    violationsResolved?: string[]
    violationsIntroducedRisk?: string[]
  }
  notes?: string[]
}

export interface RepairPrompt {
  systemPrompt: string
  userPrompt: string
}

export interface ValidateRepairResult {
  ok: boolean
  errors: string[]
}

export function buildRepairSystemPrompt(): string {
  return `You are a schedule repair assistant.

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
- Do not add commentary outside JSON.`
}

export function buildRepairUserPrompt(request: RepairRequest): string {
  return `Repair this schedule by proposing a patch to reduce violations.

Return JSON only. Here is the repair request:

${JSON.stringify(request)}`
}

export function buildRepairPrompt(request: RepairRequest): RepairPrompt {
  return {
    systemPrompt: buildRepairSystemPrompt(),
    userPrompt: buildRepairUserPrompt(request)
  }
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function validateRepairResponse(request: RepairRequest, response: RepairResponse): ValidateRepairResult {
  const errors: string[] = []

  if (!response || typeof response !== 'object') {
    return { ok: false, errors: ['Response must be an object'] }
  }

  if (!Array.isArray(response.patch)) {
    return { ok: false, errors: ['Response.patch must be an array'] }
  }

  if (response.patch.length > request.meta.maxPatchOps) {
    errors.push(`Patch exceeds maxPatchOps (${response.patch.length} > ${request.meta.maxPatchOps})`)
  }

  const sessionIds = new Set(request.schedule.sessions.map(s => s.sid))
  const requirementIds = new Set((request.searchSpace.addableRequirements || []).map(r => r.requirementId))

  const slotIds = new Set(request.slots.map(s => s.slotId))

  const movableBySid = new Map(request.searchSpace.movableSessions.map(m => [m.sid, m]))
  const addableByRequirement = new Map((request.searchSpace.addableRequirements || []).map(r => [r.requirementId, r]))

  const touchedSessions: string[] = []

  for (const [index, op] of response.patch.entries()) {
    if (!op || typeof op !== 'object' || !('op' in op)) {
      errors.push(`patch[${index}] must be an operation object with "op"`)
      continue
    }

    if (op.op === 'move') {
      if (!sessionIds.has(op.sid)) errors.push(`patch[${index}].sid is unknown: ${op.sid}`)
      touchedSessions.push(op.sid)

      if (!slotIds.has(op.toSlotId)) errors.push(`patch[${index}].toSlotId is unknown: ${op.toSlotId}`)

      const movable = movableBySid.get(op.sid)
      if (!movable) {
        errors.push(`patch[${index}] moves sid ${op.sid} but it is not in searchSpace.movableSessions`)
      } else {
        if (movable.lock) errors.push(`patch[${index}] moves locked sid ${op.sid}`)
        if (!movable.allowedSlotIds.includes(op.toSlotId)) {
          errors.push(`patch[${index}] moves sid ${op.sid} to disallowed slotId ${op.toSlotId}`)
        }
        if (op.toTherapistId && movable.allowedTherapistIds && !movable.allowedTherapistIds.includes(op.toTherapistId)) {
          errors.push(`patch[${index}] moves sid ${op.sid} to disallowed therapistId ${op.toTherapistId}`)
        }
        if (op.toRoomId !== undefined && movable.allowedRoomIds) {
          const roomId = op.toRoomId
          if (roomId !== null && !movable.allowedRoomIds.includes(roomId)) {
            errors.push(`patch[${index}] moves sid ${op.sid} to disallowed roomId ${roomId}`)
          }
        }
      }

      if (!op.because || typeof op.because !== 'string') errors.push(`patch[${index}].because must be a string`)
    } else if (op.op === 'swap') {
      if (!sessionIds.has(op.sidA)) errors.push(`patch[${index}].sidA is unknown: ${op.sidA}`)
      if (!sessionIds.has(op.sidB)) errors.push(`patch[${index}].sidB is unknown: ${op.sidB}`)
      touchedSessions.push(op.sidA, op.sidB)

      const movableA = movableBySid.get(op.sidA)
      const movableB = movableBySid.get(op.sidB)
      if (!movableA || !movableB) {
        errors.push(`patch[${index}] swap requires both sidA and sidB to be movable`)
      } else {
        if (movableA.lock) errors.push(`patch[${index}] swaps locked sidA ${op.sidA}`)
        if (movableB.lock) errors.push(`patch[${index}] swaps locked sidB ${op.sidB}`)
      }

      if (!op.because || typeof op.because !== 'string') errors.push(`patch[${index}].because must be a string`)
    } else if (op.op === 'delete') {
      if (!sessionIds.has(op.sid)) errors.push(`patch[${index}].sid is unknown: ${op.sid}`)
      touchedSessions.push(op.sid)

      if (!op.because || typeof op.because !== 'string') errors.push(`patch[${index}].because must be a string`)
    } else if (op.op === 'add') {
      if (!requirementIds.has(op.requirementId)) errors.push(`patch[${index}].requirementId is unknown: ${op.requirementId}`)

      if (!slotIds.has(op.slotId)) errors.push(`patch[${index}].slotId is unknown: ${op.slotId}`)

      const addable = addableByRequirement.get(op.requirementId)
      if (!addable) {
        errors.push(`patch[${index}] adds requirementId ${op.requirementId} but it is not in searchSpace.addableRequirements`)
      } else {
        if (op.patientId !== addable.patientId) {
          errors.push(`patch[${index}] add patientId mismatch (${op.patientId} != ${addable.patientId})`)
        }
        if (op.sessionSpecId !== addable.sessionSpecId) {
          errors.push(`patch[${index}] add sessionSpecId mismatch (${op.sessionSpecId} != ${addable.sessionSpecId})`)
        }
        if (!addable.allowedSlotIds.includes(op.slotId)) {
          errors.push(`patch[${index}] add uses disallowed slotId ${op.slotId}`)
        }
        if (!addable.allowedTherapistIds.includes(op.therapistId)) {
          errors.push(`patch[${index}] add uses disallowed therapistId ${op.therapistId}`)
        }
        if (op.roomId !== undefined && addable.allowedRoomIds) {
          const roomId = op.roomId
          if (roomId !== null && !addable.allowedRoomIds.includes(roomId)) {
            errors.push(`patch[${index}] add uses disallowed roomId ${roomId}`)
          }
        }
      }

      if (!op.because || typeof op.because !== 'string') errors.push(`patch[${index}].because must be a string`)
    } else {
      errors.push(`patch[${index}].op is unsupported: ${(op as { op: string }).op}`)
    }
  }

  const touchedCounts = touchedSessions.reduce((acc, sid) => acc.set(sid, (acc.get(sid) || 0) + 1), new Map<string, number>())
  const multiTouched = Array.from(touchedCounts.entries()).filter(([_, count]) => count > 1).map(([sid]) => sid)
  for (const sid of multiTouched) {
    errors.push(`Session ${sid} is modified multiple times in one patch`)
  }

  const uniqueTouched = unique(touchedSessions)
  for (const sid of uniqueTouched) {
    const movable = movableBySid.get(sid)
    if (movable?.lock && request.objective.scoringHints?.avoidMovingLocked !== false) {
      // Already covered for move/swap, but keep a guardrail in case we later add more ops.
      errors.push(`Locked session ${sid} should not be modified`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export interface RepairScheduleOptions {
  provider: RepairProvider
  request: RepairRequest
  maxTokens?: number
}

export async function repairScheduleWithAI(options: RepairScheduleOptions): Promise<RepairResponse> {
  const { provider, request, maxTokens = 4096 } = options
  const { systemPrompt, userPrompt } = buildRepairPrompt(request)

  const content =
    provider === 'openai'
      ? await openaiProvider.chatCompletion({ systemPrompt, userPrompt, maxTokens })
      : await novaProvider.chatCompletion({ systemPrompt, userPrompt, maxTokens })

  return JSON.parse(content) as RepairResponse
}

