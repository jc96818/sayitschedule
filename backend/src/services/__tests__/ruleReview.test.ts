import { describe, it, expect } from 'vitest'
import { evaluateRuleForReview } from '../ruleReview.js'

describe('ruleReview', () => {
  it('flags ambiguous first-name references', () => {
    const result = evaluateRuleForReview(
      { id: 'rule-1', description: 'Amy only works Mondays', ruleLogic: {} },
      {
        staff: [
          { id: 's1', name: 'Amy Smith' },
          { id: 's2', name: 'Amy Douglas' }
        ],
        patients: []
      }
    )

    expect(result.status).toBe('needs_review')
    expect(result.issues[0].type).toBe('ambiguous_entity_reference')
    expect(result.issues[0].mention).toBe('amy')
    expect(result.issues[0].candidates).toHaveLength(2)
  })

  it('does not flag a unique full-name reference', () => {
    const result = evaluateRuleForReview(
      { id: 'rule-1', description: 'Amy Smith only works Mondays', ruleLogic: {} },
      {
        staff: [
          { id: 's1', name: 'Amy Smith' },
          { id: 's2', name: 'Amy Douglas' }
        ],
        patients: []
      }
    )

    expect(result.status).toBe('ok')
    expect(result.issues).toHaveLength(0)
  })

  it('flags duplicate full-name collisions across entity types', () => {
    const result = evaluateRuleForReview(
      { id: 'rule-1', description: 'John Smith should be scheduled early', ruleLogic: {} },
      {
        staff: [{ id: 's1', name: 'John Smith' }],
        patients: [{ id: 'p1', name: 'John Smith' }]
      }
    )

    expect(result.status).toBe('needs_review')
    expect(result.issues.some(i => i.type === 'duplicate_full_name')).toBe(true)
  })

  it('does not flag ambiguous mention when entityBindings resolves it', () => {
    const result = evaluateRuleForReview(
      {
        id: 'rule-1',
        description: 'Amy only works Mondays',
        ruleLogic: {
          entityBindings: [{ mention: 'Amy', entityType: 'staff', entityId: 's1' }]
        }
      },
      {
        staff: [
          { id: 's1', name: 'Amy Smith' },
          { id: 's2', name: 'Amy Douglas' }
        ],
        patients: []
      }
    )

    expect(result.status).toBe('ok')
    expect(result.issues).toHaveLength(0)
  })
})
