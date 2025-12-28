import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Rule, RuleCategory, ParsedRuleItem, ParsedMultiRuleResponse, RuleAnalysisResult } from '@/types'
import { rulesService, voiceService } from '@/services/api'

// Simple ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export const useRulesStore = defineStore('rules', () => {
  const rules = ref<Rule[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Multi-rule voice parsing state
  const pendingRules = ref<ParsedRuleItem[]>([])
  const originalTranscript = ref<string>('')
  const globalWarnings = ref<string[]>([])
  const parsing = ref(false)

  // Rule analysis state
  const analysisResult = ref<RuleAnalysisResult | null>(null)
  const analyzing = ref(false)

  // Computed properties for existing rules
  const activeRules = computed(() => rules.value.filter((r) => r.isActive))
  const inactiveRules = computed(() => rules.value.filter((r) => !r.isActive))

  const rulesByCategory = computed(() => {
    const grouped: Record<string, Rule[]> = {}
    for (const rule of rules.value) {
      if (!grouped[rule.category]) {
        grouped[rule.category] = []
      }
      grouped[rule.category].push(rule)
    }
    return grouped
  })

  // Computed properties for pending rules
  const pendingCount = computed(() => pendingRules.value.filter((r) => r.status === 'pending').length)
  const confirmedCount = computed(() => pendingRules.value.filter((r) => r.status === 'confirmed').length)
  const hasAnyPending = computed(() =>
    pendingRules.value.some((r) => r.status === 'pending' || r.status === 'editing')
  )
  const allConfirmedOrRejected = computed(
    () =>
      pendingRules.value.length > 0 &&
      pendingRules.value.every((r) => r.status === 'confirmed' || r.status === 'rejected')
  )
  const overallConfidence = computed(() => {
    if (pendingRules.value.length === 0) return 0
    return Math.min(...pendingRules.value.map((r) => r.confidence))
  })

  // DEPRECATED: Backward compatibility for single-rule usage
  const pendingRule = computed(() => (pendingRules.value.length === 1 ? pendingRules.value[0] : null))
  const parseConfidence = computed(() => overallConfidence.value)

  async function fetchRules() {
    loading.value = true
    error.value = null
    try {
      const response = await rulesService.list()
      rules.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createRule(data: Partial<Rule>) {
    loading.value = true
    error.value = null
    try {
      const response = await rulesService.create(data)
      rules.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create rule'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRule(id: string, data: Partial<Rule>) {
    loading.value = true
    error.value = null
    try {
      const response = await rulesService.update(id, data)
      const index = rules.value.findIndex((r) => r.id === id)
      if (index !== -1) {
        rules.value[index] = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update rule'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteRule(id: string) {
    loading.value = true
    error.value = null
    try {
      await rulesService.delete(id)
      rules.value = rules.value.filter((r) => r.id !== id)
      totalCount.value--
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete rule'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function toggleRule(id: string) {
    const rule = rules.value.find((r) => r.id === id)
    if (rule) {
      await updateRule(id, { isActive: !rule.isActive })
    }
  }

  // Parse voice command - now handles multiple rules
  async function parseVoiceCommand(transcript: string) {
    parsing.value = true
    error.value = null

    try {
      const response = await voiceService.parseRule(transcript)
      const parsed = response.data as ParsedMultiRuleResponse

      if (parsed.commandType === 'create_rules' && parsed.rules && parsed.rules.length > 0) {
        // Validate and normalize each rule
        const validCategories: RuleCategory[] = [
          'gender_pairing',
          'session',
          'availability',
          'specific_pairing',
          'certification'
        ]

        pendingRules.value = parsed.rules.map((rule) => ({
          id: generateId(),
          category: validCategories.includes(rule.category as RuleCategory)
            ? (rule.category as RuleCategory)
            : 'session',
          description: rule.description || '',
          priority: rule.priority || 5,
          ruleLogic: rule.ruleLogic || {},
          confidence: rule.confidence || 0.5,
          warnings: rule.warnings || [],
          status: 'pending' as const
        }))

        originalTranscript.value = parsed.originalTranscript
        globalWarnings.value = parsed.globalWarnings || []

        // Add warning for low-confidence rules
        const lowConfidenceRules = pendingRules.value.filter((r) => r.confidence < 0.5)
        if (lowConfidenceRules.length > 0) {
          globalWarnings.value.push(
            `${lowConfidenceRules.length} rule(s) had low confidence and may need review.`
          )
        }
      } else {
        error.value = 'Could not understand the rules. Please try again or use the form.'
        throw new Error(error.value)
      }

      return parsed
    } catch (e) {
      if (!error.value) {
        error.value = e instanceof Error ? e.message : 'Failed to parse voice command'
      }
      throw e
    } finally {
      parsing.value = false
    }
  }

  // Confirm a single pending rule
  function confirmRule(ruleId: string) {
    const index = pendingRules.value.findIndex((r) => r.id === ruleId)
    if (index !== -1) {
      pendingRules.value[index].status = 'confirmed'
    }
  }

  // Reject a single pending rule
  function rejectRule(ruleId: string) {
    const index = pendingRules.value.findIndex((r) => r.id === ruleId)
    if (index !== -1) {
      pendingRules.value[index].status = 'rejected'
    }
  }

  // Start editing a rule
  function startEditingRule(ruleId: string) {
    const index = pendingRules.value.findIndex((r) => r.id === ruleId)
    if (index !== -1) {
      pendingRules.value[index].status = 'editing'
    }
  }

  // Update a pending rule after editing
  function updatePendingRule(ruleId: string, updates: Partial<ParsedRuleItem>) {
    const index = pendingRules.value.findIndex((r) => r.id === ruleId)
    if (index !== -1) {
      pendingRules.value[index] = {
        ...pendingRules.value[index],
        ...updates,
        status: 'confirmed' // After editing, mark as confirmed
      }
    }
  }

  // Confirm all pending rules at once
  function confirmAllPendingRules() {
    pendingRules.value = pendingRules.value.map((r) => ({
      ...r,
      status: r.status === 'pending' ? ('confirmed' as const) : r.status
    }))
  }

  // Reject all pending rules at once
  function rejectAllPendingRules() {
    pendingRules.value = pendingRules.value.map((r) => ({
      ...r,
      status: 'rejected' as const
    }))
  }

  // Create all confirmed rules
  async function createConfirmedRules(): Promise<Rule[]> {
    const confirmedRulesList = pendingRules.value.filter((r) => r.status === 'confirmed')

    if (confirmedRulesList.length === 0) {
      return []
    }

    loading.value = true
    error.value = null
    const createdRules: Rule[] = []

    try {
      for (const rule of confirmedRulesList) {
        const ruleData: Partial<Rule> = {
          category: rule.category,
          description: rule.description,
          ruleLogic: rule.ruleLogic,
          isActive: true,
          priority: rule.priority
        }

        const response = await rulesService.create(ruleData)
        createdRules.push(response.data)
        rules.value.push(response.data)
        totalCount.value++
      }

      // Clear pending rules after successful creation
      clearPendingRules()

      return createdRules
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Clear all pending rules
  function clearPendingRules() {
    pendingRules.value = []
    originalTranscript.value = ''
    globalWarnings.value = []
  }

  // Analyze rules with AI
  async function analyzeRules(): Promise<RuleAnalysisResult> {
    analyzing.value = true
    error.value = null
    analysisResult.value = null

    try {
      const response = await rulesService.analyze()
      analysisResult.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to analyze rules'
      throw e
    } finally {
      analyzing.value = false
    }
  }

  // Clear analysis result
  function clearAnalysisResult() {
    analysisResult.value = null
  }

  // Deactivate a rule and remove related findings from analysis
  async function deactivateRuleFromAnalysis(ruleId: string): Promise<void> {
    // Deactivate the rule
    await updateRule(ruleId, { isActive: false })

    // Remove findings that reference this rule from the analysis result
    if (analysisResult.value) {
      analysisResult.value = {
        ...analysisResult.value,
        conflicts: analysisResult.value.conflicts.filter(
          c => !c.ruleIds.includes(ruleId)
        ),
        duplicates: analysisResult.value.duplicates.filter(
          d => !d.ruleIds.includes(ruleId)
        ),
        enhancements: analysisResult.value.enhancements.filter(
          e => !e.relatedRuleIds.includes(ruleId)
        ),
        summary: {
          ...analysisResult.value.summary,
          conflictsFound: analysisResult.value.conflicts.filter(
            c => !c.ruleIds.includes(ruleId)
          ).length,
          duplicatesFound: analysisResult.value.duplicates.filter(
            d => !d.ruleIds.includes(ruleId)
          ).length,
          enhancementsSuggested: analysisResult.value.enhancements.filter(
            e => !e.relatedRuleIds.includes(ruleId)
          ).length
        }
      }
    }
  }

  // Remove a specific finding from analysis (e.g., after user dismisses an enhancement)
  function dismissEnhancement(index: number): void {
    if (analysisResult.value) {
      const newEnhancements = [...analysisResult.value.enhancements]
      newEnhancements.splice(index, 1)
      analysisResult.value = {
        ...analysisResult.value,
        enhancements: newEnhancements,
        summary: {
          ...analysisResult.value.summary,
          enhancementsSuggested: newEnhancements.length
        }
      }
    }
  }

  // DEPRECATED: Backward compatibility wrappers
  async function confirmPendingRule() {
    if (pendingRules.value.length === 1) {
      confirmRule(pendingRules.value[0].id)
      const result = await createConfirmedRules()
      return result[0] || null
    }
    return null
  }

  function clearPendingRule() {
    clearPendingRules()
  }

  return {
    // Existing exports
    rules,
    loading,
    error,
    totalCount,
    parsing,
    activeRules,
    inactiveRules,
    rulesByCategory,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    parseVoiceCommand,

    // Multi-rule support
    pendingRules,
    originalTranscript,
    globalWarnings,
    pendingCount,
    confirmedCount,
    hasAnyPending,
    allConfirmedOrRejected,
    overallConfidence,
    confirmRule,
    rejectRule,
    startEditingRule,
    updatePendingRule,
    confirmAllPendingRules,
    rejectAllPendingRules,
    createConfirmedRules,
    clearPendingRules,

    // Rule analysis
    analysisResult,
    analyzing,
    analyzeRules,
    clearAnalysisResult,
    deactivateRuleFromAnalysis,
    dismissEnhancement,

    // DEPRECATED: Backward compatibility
    pendingRule,
    parseConfidence,
    confirmPendingRule,
    clearPendingRule
  }
})
