import { describe, it, expect } from 'vitest'
import {
  buildRepairPrompt,
  validateRepairResponse,
  type RepairRequest,
  type RepairResponse,
} from '../scheduleRepair.js'

function makeBaseRequest(): RepairRequest {
  return {
    meta: {
      requestId: 'req-1',
      mode: 'template',
      iteration: 1,
      maxPatchOps: 10
    },
    slots: [
      { slotId: 'T001', day: 'D1', start: '09:00', end: '10:00' },
      { slotId: 'T002', day: 'D1', start: '10:00', end: '11:00' }
    ],
    schedule: {
      sessions: [
        { sid: 'A001', therapistId: 'S001', patientId: 'P001', sessionSpecId: 'X001', slotId: 'T001' }
      ]
    },
    violations: [
      { vid: 'V001', type: 'rule_violation', severity: 'high', message: 'Example violation', relatedSessionIds: ['A001'] }
    ],
    rules: [
      { ruleId: 'RUL1', kind: 'hard', logic: { type: 'example' } }
    ],
    searchSpace: {
      movableSessions: [
        { sid: 'A001', allowedSlotIds: ['T001', 'T002'] }
      ],
      addableRequirements: [
        {
          requirementId: 'REQ1',
          patientId: 'P002',
          sessionSpecId: 'X002',
          countMissing: 1,
          allowedTherapistIds: ['S001'],
          allowedSlotIds: ['T002'],
          allowedRoomIds: ['R001']
        }
      ]
    },
    objective: {
      primary: 'fix_blockers',
      scoringHints: {
        preferFewerMoves: true,
        avoidMovingLocked: true,
        keepExistingAssignmentsWhenPossible: true
      }
    }
  }
}

describe('scheduleRepair', () => {
  describe('buildRepairPrompt', () => {
    it('includes request JSON in the user prompt', () => {
      const request = makeBaseRequest()
      const prompt = buildRepairPrompt(request)

      expect(prompt.systemPrompt).toContain('schedule repair assistant')
      expect(prompt.userPrompt).toContain('"requestId":"req-1"')
      expect(prompt.userPrompt).toContain('"sessions":[{"sid":"A001"')
    })
  })

  describe('validateRepairResponse', () => {
    it('accepts a valid move within allowedSlotIds', () => {
      const request = makeBaseRequest()
      const response: RepairResponse = {
        patch: [
          { op: 'move', sid: 'A001', toSlotId: 'T002', because: 'Fixes conflict' }
        ]
      }

      const result = validateRepairResponse(request, response)
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects moving to a slot outside allowedSlotIds', () => {
      const request = makeBaseRequest()
      const response: RepairResponse = {
        patch: [
          { op: 'move', sid: 'A001', toSlotId: 'T999', because: 'Try something' }
        ]
      }

      const result = validateRepairResponse(request, response)
      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('unknown')
    })

    it('rejects patches that modify the same session multiple times', () => {
      const request = makeBaseRequest()
      const response: RepairResponse = {
        patch: [
          { op: 'move', sid: 'A001', toSlotId: 'T002', because: 'First move' },
          { op: 'delete', sid: 'A001', because: 'Second edit' }
        ]
      }

      const result = validateRepairResponse(request, response)
      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('modified multiple times')
    })

    it('accepts a valid add within addableRequirements constraints', () => {
      const request = makeBaseRequest()
      const response: RepairResponse = {
        patch: [
          {
            op: 'add',
            requirementId: 'REQ1',
            therapistId: 'S001',
            patientId: 'P002',
            sessionSpecId: 'X002',
            slotId: 'T002',
            roomId: 'R001',
            because: 'Fill missing requirement'
          }
        ]
      }

      const result = validateRepairResponse(request, response)
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects add with mismatched patientId', () => {
      const request = makeBaseRequest()
      const response: RepairResponse = {
        patch: [
          {
            op: 'add',
            requirementId: 'REQ1',
            therapistId: 'S001',
            patientId: 'P999',
            sessionSpecId: 'X002',
            slotId: 'T002',
            because: 'Wrong patient'
          }
        ]
      }

      const result = validateRepairResponse(request, response)
      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('patientId mismatch')
    })
  })
})

