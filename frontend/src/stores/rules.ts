import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Rule } from '@/types'
import { rulesService } from '@/services/api'

export const useRulesStore = defineStore('rules', () => {
  const rules = ref<Rule[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Parsed voice result state
  const pendingRule = ref<Partial<Rule> | null>(null)
  const parseConfidence = ref(0)
  const parsing = ref(false)

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

  async function parseVoiceCommand(transcript: string) {
    parsing.value = true
    error.value = null
    try {
      const response = await rulesService.parseVoice(transcript)
      pendingRule.value = response.data.rule
      parseConfidence.value = response.data.confidence
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to parse voice command'
      throw e
    } finally {
      parsing.value = false
    }
  }

  async function confirmPendingRule() {
    if (!pendingRule.value) return null
    const result = await createRule(pendingRule.value)
    clearPendingRule()
    return result
  }

  function clearPendingRule() {
    pendingRule.value = null
    parseConfidence.value = 0
  }

  return {
    rules,
    loading,
    error,
    totalCount,
    pendingRule,
    parseConfidence,
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
    confirmPendingRule,
    clearPendingRule
  }
})
