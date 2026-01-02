import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRulesStore } from '../rules'
import { rulesService, voiceService } from '@/services/api'
import type { Rule, RuleCategory, ParsedMultiRuleResponse, RuleAnalysisResult } from '@/types'

// Mock the API services
vi.mock('@/services/api', () => ({
  rulesService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    analyze: vi.fn()
  },
  voiceService: {
    parseRule: vi.fn()
  }
}))

describe('Rules Store', () => {
  const mockRule: Rule = {
    id: 'rule-1',
    organizationId: 'org-1',
    category: 'gender_pairing' as RuleCategory,
    description: 'Female patients must be paired with female therapists',
    ruleLogic: { patientGender: 'female', requiredTherapistGender: 'female' },
    priority: 5,
    isActive: true,
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }

  const mockRule2: Rule = {
    id: 'rule-2',
    organizationId: 'org-1',
    category: 'session' as RuleCategory,
    description: 'Sessions must be at least 30 minutes apart',
    ruleLogic: { minGapMinutes: 30 },
    priority: 3,
    isActive: false,
    createdBy: 'user-1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty rules array', () => {
      const store = useRulesStore()
      expect(store.rules).toEqual([])
    })

    it('should have loading false initially', () => {
      const store = useRulesStore()
      expect(store.loading).toBe(false)
    })

    it('should have error null initially', () => {
      const store = useRulesStore()
      expect(store.error).toBeNull()
    })

    it('should have totalCount 0 initially', () => {
      const store = useRulesStore()
      expect(store.totalCount).toBe(0)
    })

    it('should have empty pending rules initially', () => {
      const store = useRulesStore()
      expect(store.pendingRules).toEqual([])
    })

    it('should have parsing false initially', () => {
      const store = useRulesStore()
      expect(store.parsing).toBe(false)
    })
  })

  describe('fetchRules', () => {
    it('should fetch rules from API and update state', async () => {
      vi.mocked(rulesService.list).mockResolvedValue({
        data: [mockRule, mockRule2],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRulesStore()
      await store.fetchRules()

      expect(rulesService.list).toHaveBeenCalled()
      expect(store.rules).toHaveLength(2)
      expect(store.totalCount).toBe(2)
    })

    it('should set loading during fetch', async () => {
      vi.mocked(rulesService.list).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: [mockRule],
                  total: 1,
                  page: 1,
                  limit: 50,
                  totalPages: 1
                }),
              100
            )
          )
      )

      const store = useRulesStore()
      const fetchPromise = store.fetchRules()

      expect(store.loading).toBe(true)
      await fetchPromise
      expect(store.loading).toBe(false)
    })

    it('should set error when fetch fails', async () => {
      vi.mocked(rulesService.list).mockRejectedValue(new Error('Network error'))

      const store = useRulesStore()

      await expect(store.fetchRules()).rejects.toThrow('Network error')
      expect(store.error).toBe('Network error')
    })
  })

  describe('createRule', () => {
    it('should create a rule via API and add to state', async () => {
      vi.mocked(rulesService.create).mockResolvedValue({
        data: mockRule
      })

      const store = useRulesStore()
      const result = await store.createRule({
        category: 'gender_pairing',
        description: 'Female patients must be paired with female therapists',
        ruleLogic: { patientGender: 'female', requiredTherapistGender: 'female' },
        priority: 5
      })

      expect(rulesService.create).toHaveBeenCalled()
      expect(result).toEqual(mockRule)
      expect(store.rules).toHaveLength(1)
      expect(store.rules[0].id).toBe(mockRule.id)
      expect(store.totalCount).toBe(1)
    })

    it('should set error when create fails', async () => {
      vi.mocked(rulesService.create).mockRejectedValue(new Error('Create failed'))

      const store = useRulesStore()

      await expect(store.createRule({ description: 'Test' })).rejects.toThrow('Create failed')
      expect(store.error).toBe('Create failed')
    })
  })

  describe('updateRule', () => {
    it('should update a rule via API and update state', async () => {
      const updatedRule = { ...mockRule, description: 'Updated description' }
      vi.mocked(rulesService.update).mockResolvedValue({
        data: updatedRule
      })

      const store = useRulesStore()
      store.rules = [mockRule]

      const result = await store.updateRule(mockRule.id, { description: 'Updated description' })

      expect(rulesService.update).toHaveBeenCalledWith(mockRule.id, { description: 'Updated description' })
      expect(result.description).toBe('Updated description')
      expect(store.rules[0].description).toBe('Updated description')
    })

    it('should set error when update fails', async () => {
      vi.mocked(rulesService.update).mockRejectedValue(new Error('Update failed'))

      const store = useRulesStore()
      store.rules = [mockRule]

      await expect(store.updateRule(mockRule.id, { description: 'New' })).rejects.toThrow('Update failed')
      expect(store.error).toBe('Update failed')
    })
  })

  describe('deleteRule', () => {
    it('should delete a rule via API and remove from state', async () => {
      vi.mocked(rulesService.delete).mockResolvedValue(undefined)

      const store = useRulesStore()
      store.rules = [mockRule, mockRule2]
      store.totalCount = 2

      await store.deleteRule(mockRule.id)

      expect(rulesService.delete).toHaveBeenCalledWith(mockRule.id)
      expect(store.rules).toHaveLength(1)
      expect(store.rules[0].id).toBe(mockRule2.id)
      expect(store.totalCount).toBe(1)
    })

    it('should set error when delete fails', async () => {
      vi.mocked(rulesService.delete).mockRejectedValue(new Error('Delete failed'))

      const store = useRulesStore()
      store.rules = [mockRule]

      await expect(store.deleteRule(mockRule.id)).rejects.toThrow('Delete failed')
      expect(store.error).toBe('Delete failed')
    })
  })

  describe('toggleRule', () => {
    it('should toggle rule active status', async () => {
      const toggledRule = { ...mockRule, isActive: false }
      vi.mocked(rulesService.update).mockResolvedValue({
        data: toggledRule
      })

      const store = useRulesStore()
      store.rules = [mockRule]

      await store.toggleRule(mockRule.id)

      expect(rulesService.update).toHaveBeenCalledWith(mockRule.id, { isActive: false })
    })

    it('should toggle inactive rule to active', async () => {
      const toggledRule = { ...mockRule2, isActive: true }
      vi.mocked(rulesService.update).mockResolvedValue({
        data: toggledRule
      })

      const store = useRulesStore()
      store.rules = [mockRule2]

      await store.toggleRule(mockRule2.id)

      expect(rulesService.update).toHaveBeenCalledWith(mockRule2.id, { isActive: true })
    })
  })

  describe('computed properties', () => {
    describe('activeRules', () => {
      it('should return only active rules', () => {
        const store = useRulesStore()
        store.rules = [mockRule, mockRule2]

        expect(store.activeRules).toHaveLength(1)
        expect(store.activeRules[0].id).toBe(mockRule.id)
      })
    })

    describe('inactiveRules', () => {
      it('should return only inactive rules', () => {
        const store = useRulesStore()
        store.rules = [mockRule, mockRule2]

        expect(store.inactiveRules).toHaveLength(1)
        expect(store.inactiveRules[0].id).toBe(mockRule2.id)
      })
    })

    describe('rulesByCategory', () => {
      it('should group rules by category', () => {
        const store = useRulesStore()
        store.rules = [mockRule, mockRule2]

        const grouped = store.rulesByCategory

        expect(grouped['gender_pairing']).toHaveLength(1)
        expect(grouped['session']).toHaveLength(1)
        expect(grouped['gender_pairing'][0].id).toBe(mockRule.id)
        expect(grouped['session'][0].id).toBe(mockRule2.id)
      })
    })
  })

  describe('voice parsing - multi-rule support', () => {
    describe('parseVoiceCommand', () => {
      it('should parse voice command and populate pending rules', async () => {
        const mockParsedResponse: ParsedMultiRuleResponse = {
          commandType: 'create_rules',
          rules: [
            {
              category: 'gender_pairing',
              description: 'Male therapists for male patients',
              priority: 5,
              ruleLogic: { patientGender: 'male', requiredTherapistGender: 'male' },
              confidence: 0.9,
              warnings: []
            },
            {
              category: 'session',
              description: 'No sessions after 5pm',
              priority: 3,
              ruleLogic: { maxEndTime: '17:00' },
              confidence: 0.85,
              warnings: []
            }
          ],
          overallConfidence: 0.85,
          originalTranscript: 'Create rules for male therapists and no late sessions',
          globalWarnings: []
        }

        vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

        const store = useRulesStore()
        await store.parseVoiceCommand('Create rules for male therapists and no late sessions')

        expect(voiceService.parseRule).toHaveBeenCalledWith(
          'Create rules for male therapists and no late sessions'
        )
        expect(store.pendingRules).toHaveLength(2)
        expect(store.pendingRules[0].category).toBe('gender_pairing')
        expect(store.pendingRules[1].category).toBe('session')
        expect(store.originalTranscript).toBe('Create rules for male therapists and no late sessions')
      })

      it('should set parsing state during parse', async () => {
        vi.mocked(voiceService.parseRule).mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    data: {
                      commandType: 'create_rules',
                      rules: [{ category: 'session', description: 'Test', confidence: 0.9, warnings: [] }],
                      overallConfidence: 0.9,
                      originalTranscript: 'Test',
                      globalWarnings: []
                    }
                  }),
                100
              )
            )
        )

        const store = useRulesStore()
        const parsePromise = store.parseVoiceCommand('Test command')

        expect(store.parsing).toBe(true)
        await parsePromise
        expect(store.parsing).toBe(false)
      })

      it('should handle invalid command type', async () => {
        vi.mocked(voiceService.parseRule).mockResolvedValue({
          data: {
            commandType: 'unknown' as 'create_rules',
            rules: [],
            overallConfidence: 0,
            originalTranscript: 'Unknown',
            globalWarnings: []
          }
        })

        const store = useRulesStore()

        await expect(store.parseVoiceCommand('Unknown command')).rejects.toThrow()
        expect(store.error).toContain('Could not understand')
      })

      it('should add warning for low confidence rules', async () => {
        vi.mocked(voiceService.parseRule).mockResolvedValue({
          data: {
            commandType: 'create_rules',
            rules: [
              { category: 'session', description: 'Test', confidence: 0.3, warnings: [] }
            ],
            overallConfidence: 0.3,
            originalTranscript: 'Unclear command',
            globalWarnings: []
          }
        })

        const store = useRulesStore()
        await store.parseVoiceCommand('Unclear command')

        expect(store.globalWarnings.some(w => w.includes('low confidence'))).toBe(true)
      })
    })

    describe('pending rules management', () => {
      beforeEach(async () => {
        vi.mocked(voiceService.parseRule).mockResolvedValue({
          data: {
            commandType: 'create_rules',
            rules: [
              { category: 'gender_pairing', description: 'Rule 1', confidence: 0.9, warnings: [] },
              { category: 'session', description: 'Rule 2', confidence: 0.85, warnings: [] }
            ],
            overallConfidence: 0.85,
            originalTranscript: 'Test',
            globalWarnings: []
          }
        })
      })

      it('should confirm a single rule', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        const ruleId = store.pendingRules[0].id
        store.confirmRule(ruleId)

        expect(store.pendingRules[0].status).toBe('confirmed')
        expect(store.pendingRules[1].status).toBe('pending')
      })

      it('should reject a single rule', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        const ruleId = store.pendingRules[0].id
        store.rejectRule(ruleId)

        expect(store.pendingRules[0].status).toBe('rejected')
      })

      it('should start editing a rule', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        const ruleId = store.pendingRules[0].id
        store.startEditingRule(ruleId)

        expect(store.pendingRules[0].status).toBe('editing')
      })

      it('should update a pending rule', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        const ruleId = store.pendingRules[0].id
        store.updatePendingRule(ruleId, { description: 'Updated description' })

        expect(store.pendingRules[0].description).toBe('Updated description')
        expect(store.pendingRules[0].status).toBe('confirmed')
      })

      it('should confirm all pending rules', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        store.confirmAllPendingRules()

        expect(store.pendingRules.every(r => r.status === 'confirmed')).toBe(true)
      })

      it('should reject all pending rules', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        store.rejectAllPendingRules()

        expect(store.pendingRules.every(r => r.status === 'rejected')).toBe(true)
      })

      it('should clear pending rules', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        store.clearPendingRules()

        expect(store.pendingRules).toHaveLength(0)
        expect(store.originalTranscript).toBe('')
        expect(store.globalWarnings).toHaveLength(0)
      })
    })

    describe('computed pending rule properties', () => {
      beforeEach(async () => {
        vi.mocked(voiceService.parseRule).mockResolvedValue({
          data: {
            commandType: 'create_rules',
            rules: [
              { category: 'gender_pairing', description: 'Rule 1', confidence: 0.9, warnings: [] },
              { category: 'session', description: 'Rule 2', confidence: 0.7, warnings: [] }
            ],
            overallConfidence: 0.7,
            originalTranscript: 'Test',
            globalWarnings: []
          }
        })
      })

      it('should count pending rules', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        expect(store.pendingCount).toBe(2)

        store.confirmRule(store.pendingRules[0].id)
        expect(store.pendingCount).toBe(1)
      })

      it('should count confirmed rules', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        expect(store.confirmedCount).toBe(0)

        store.confirmRule(store.pendingRules[0].id)
        expect(store.confirmedCount).toBe(1)
      })

      it('should check if any pending exists', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        expect(store.hasAnyPending).toBe(true)

        store.confirmAllPendingRules()
        expect(store.hasAnyPending).toBe(false)
      })

      it('should check if all confirmed or rejected', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        expect(store.allConfirmedOrRejected).toBe(false)

        store.confirmRule(store.pendingRules[0].id)
        store.rejectRule(store.pendingRules[1].id)

        expect(store.allConfirmedOrRejected).toBe(true)
      })

      it('should calculate overall confidence as minimum', async () => {
        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        // Minimum of 0.9 and 0.7
        expect(store.overallConfidence).toBe(0.7)
      })
    })

    describe('createConfirmedRules', () => {
      it('should create all confirmed rules via API', async () => {
        vi.mocked(voiceService.parseRule).mockResolvedValue({
          data: {
            commandType: 'create_rules',
            rules: [
              { category: 'gender_pairing', description: 'Rule 1', confidence: 0.9, warnings: [] },
              { category: 'session', description: 'Rule 2', confidence: 0.85, warnings: [] }
            ],
            overallConfidence: 0.85,
            originalTranscript: 'Test',
            globalWarnings: []
          }
        })

        vi.mocked(rulesService.create).mockResolvedValue({
          data: mockRule
        })

        const store = useRulesStore()
        await store.parseVoiceCommand('Test')

        // Confirm first rule only
        store.confirmRule(store.pendingRules[0].id)
        store.rejectRule(store.pendingRules[1].id)

        const result = await store.createConfirmedRules()

        // Should only create 1 rule (the confirmed one)
        expect(rulesService.create).toHaveBeenCalledTimes(1)
        expect(result).toHaveLength(1)
        expect(store.pendingRules).toHaveLength(0) // Should be cleared
      })

      it('should return empty array when no confirmed rules', async () => {
        const store = useRulesStore()
        const result = await store.createConfirmedRules()

        expect(result).toEqual([])
        expect(rulesService.create).not.toHaveBeenCalled()
      })
    })
  })

  describe('rule analysis', () => {
    const mockAnalysisResult: RuleAnalysisResult = {
      conflicts: [
        {
          ruleIds: ['rule-1', 'rule-2'],
          description: 'Rule 1 conflicts with Rule 2',
          severity: 'high',
          suggestion: 'Disable one of the rules'
        }
      ],
      duplicates: [
        {
          ruleIds: ['rule-3', 'rule-4'],
          description: 'These rules are similar',
          recommendation: 'Consider merging'
        }
      ],
      enhancements: [
        {
          relatedRuleIds: ['rule-1'],
          suggestion: 'Add certification requirement',
          rationale: 'Improves scheduling',
          priority: 'medium',
          suggestedRules: []
        }
      ],
      summary: {
        totalRulesAnalyzed: 4,
        conflictsFound: 1,
        duplicatesFound: 1,
        enhancementsSuggested: 1
      }
    }

    describe('analyzeRules', () => {
      it('should analyze rules and return result', async () => {
        vi.mocked(rulesService.analyze).mockResolvedValue({
          data: mockAnalysisResult
        })

        const store = useRulesStore()
        const result = await store.analyzeRules()

        expect(rulesService.analyze).toHaveBeenCalled()
        expect(result).toEqual(mockAnalysisResult)
        expect(store.analysisResult).toEqual(mockAnalysisResult)
      })

      it('should set analyzing state during analysis', async () => {
        vi.mocked(rulesService.analyze).mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ data: mockAnalysisResult }), 100)
            )
        )

        const store = useRulesStore()
        const analyzePromise = store.analyzeRules()

        expect(store.analyzing).toBe(true)
        await analyzePromise
        expect(store.analyzing).toBe(false)
      })

      it('should set error when analysis fails', async () => {
        vi.mocked(rulesService.analyze).mockRejectedValue(new Error('Analysis failed'))

        const store = useRulesStore()

        await expect(store.analyzeRules()).rejects.toThrow('Analysis failed')
        expect(store.error).toBe('Analysis failed')
      })
    })

    describe('clearAnalysisResult', () => {
      it('should clear analysis result', async () => {
        vi.mocked(rulesService.analyze).mockResolvedValue({
          data: mockAnalysisResult
        })

        const store = useRulesStore()
        await store.analyzeRules()

        store.clearAnalysisResult()

        expect(store.analysisResult).toBeNull()
      })
    })

    describe('deactivateRuleFromAnalysis', () => {
      it('should deactivate rule and update analysis findings', async () => {
        vi.mocked(rulesService.analyze).mockResolvedValue({
          data: mockAnalysisResult
        })
        vi.mocked(rulesService.update).mockResolvedValue({
          data: { ...mockRule, isActive: false }
        })

        const store = useRulesStore()
        store.rules = [mockRule]
        await store.analyzeRules()

        await store.deactivateRuleFromAnalysis('rule-1')

        expect(rulesService.update).toHaveBeenCalledWith('rule-1', { isActive: false })
        // Conflicts containing rule-1 should be filtered out
        expect(store.analysisResult?.conflicts).toHaveLength(0)
        expect(store.analysisResult?.summary.conflictsFound).toBe(0)
      })
    })

    describe('dismissEnhancement', () => {
      it('should remove enhancement at specified index', async () => {
        vi.mocked(rulesService.analyze).mockResolvedValue({
          data: mockAnalysisResult
        })

        const store = useRulesStore()
        await store.analyzeRules()

        store.dismissEnhancement(0)

        expect(store.analysisResult?.enhancements).toHaveLength(0)
        expect(store.analysisResult?.summary.enhancementsSuggested).toBe(0)
      })
    })
  })

  describe('backward compatibility', () => {
    it('pendingRule should return first rule when only one exists', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({
        data: {
          commandType: 'create_rules',
          rules: [{ category: 'session', description: 'Single rule', confidence: 0.9, warnings: [] }],
          overallConfidence: 0.9,
          originalTranscript: 'Test',
          globalWarnings: []
        }
      })

      const store = useRulesStore()
      await store.parseVoiceCommand('Test')

      expect(store.pendingRule).not.toBeNull()
      expect(store.pendingRule?.description).toBe('Single rule')
    })

    it('pendingRule should return null when multiple rules exist', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({
        data: {
          commandType: 'create_rules',
          rules: [
            { category: 'session', description: 'Rule 1', confidence: 0.9, warnings: [] },
            { category: 'session', description: 'Rule 2', confidence: 0.9, warnings: [] }
          ],
          overallConfidence: 0.9,
          originalTranscript: 'Test',
          globalWarnings: []
        }
      })

      const store = useRulesStore()
      await store.parseVoiceCommand('Test')

      expect(store.pendingRule).toBeNull()
    })

    it('parseConfidence should equal overallConfidence', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({
        data: {
          commandType: 'create_rules',
          rules: [
            { category: 'session', description: 'Rule 1', confidence: 0.9, warnings: [] },
            { category: 'session', description: 'Rule 2', confidence: 0.7, warnings: [] }
          ],
          overallConfidence: 0.7,
          originalTranscript: 'Test',
          globalWarnings: []
        }
      })

      const store = useRulesStore()
      await store.parseVoiceCommand('Test')

      expect(store.parseConfidence).toBe(store.overallConfidence)
      expect(store.parseConfidence).toBe(0.7)
    })
  })
})
