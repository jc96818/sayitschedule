<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRulesStore } from '@/stores/rules'
import Modal from './Modal.vue'
import Badge from './Badge.vue'
import Button from './Button.vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

export interface SuggestedRuleForCreate {
  category: string
  description: string
  priority?: number
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'createRule': [rule: SuggestedRuleForCreate]
}>()

const rulesStore = useRulesStore()

// Track expanded sections
const expandedSections = ref<Set<string>>(new Set(['conflicts', 'duplicates', 'enhancements']))

// Track which actions are in progress
const processingRuleId = ref<string | null>(null)

function toggleSection(section: string) {
  if (expandedSections.value.has(section)) {
    expandedSections.value.delete(section)
  } else {
    expandedSections.value.add(section)
  }
}

// Start analysis when modal opens
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && !rulesStore.analysisResult && !rulesStore.analyzing) {
    try {
      await rulesStore.analyzeRules()
    } catch (error) {
      console.error('Failed to analyze rules:', error)
    }
  }
})

function closeModal() {
  emit('update:modelValue', false)
  // Clear result when closing so next open triggers fresh analysis
  rulesStore.clearAnalysisResult()
}

// Find rule description by ID
function getRuleDescription(ruleId: string): string {
  const rule = rulesStore.rules.find(r => r.id === ruleId)
  return rule?.description || `Rule ${ruleId.slice(0, 8)}...`
}

// Get short rule description for button labels
function getShortRuleDescription(ruleId: string): string {
  const desc = getRuleDescription(ruleId)
  if (desc.length > 30) {
    return desc.slice(0, 27) + '...'
  }
  return desc
}

function getSeverityVariant(severity: string): 'danger' | 'warning' | 'primary' {
  switch (severity) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'primary'
  }
}

function getPriorityVariant(priority: string): 'danger' | 'warning' | 'primary' {
  switch (priority) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'primary'
  }
}

const hasResults = computed(() => {
  if (!rulesStore.analysisResult) return false
  const { conflicts, duplicates, enhancements } = rulesStore.analysisResult
  return conflicts.length > 0 || duplicates.length > 0 || enhancements.length > 0
})

const hasNoIssues = computed(() => {
  return rulesStore.analysisResult && !hasResults.value
})

// Action handlers
async function handleDeactivateRule(ruleId: string) {
  processingRuleId.value = ruleId
  try {
    await rulesStore.deactivateRuleFromAnalysis(ruleId)
  } catch (error) {
    console.error('Failed to deactivate rule:', error)
  } finally {
    processingRuleId.value = null
  }
}

// Keep one rule and deactivate all others in the duplicate group
async function handleKeepOnlyRule(keepRuleId: string, allRuleIds: string[]) {
  processingRuleId.value = keepRuleId
  try {
    // Deactivate all rules except the one to keep
    const rulesToDeactivate = allRuleIds.filter(id => id !== keepRuleId)
    for (const ruleId of rulesToDeactivate) {
      await rulesStore.deactivateRuleFromAnalysis(ruleId)
    }
  } catch (error) {
    console.error('Failed to resolve duplicate:', error)
  } finally {
    processingRuleId.value = null
  }
}

function handleCreateSuggestedRule(rule: SuggestedRuleForCreate, enhancementIndex: number) {
  // Emit event to parent to create the suggested rule
  emit('createRule', rule)
  // Remove this enhancement from the list since user is acting on it
  rulesStore.dismissEnhancement(enhancementIndex)
}

function handleDismissEnhancement(index: number) {
  rulesStore.dismissEnhancement(index)
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="AI Rule Analysis"
    size="lg"
    @update:model-value="closeModal"
  >
    <!-- Loading State -->
    <div v-if="rulesStore.analyzing" class="loading-state">
      <div class="loading-animation">
        <div class="pulse-ring"></div>
        <div class="pulse-ring delay-1"></div>
        <div class="pulse-ring delay-2"></div>
        <svg class="brain-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h3 class="loading-title">Analyzing Rules with AI</h3>
      <p class="loading-text">Checking for conflicts, duplicates, and potential improvements...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="rulesStore.error" class="error-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="error-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p class="error-text">{{ rulesStore.error }}</p>
      <Button variant="outline" @click="rulesStore.analyzeRules()">Try Again</Button>
    </div>

    <!-- No Issues Found -->
    <div v-else-if="hasNoIssues" class="success-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="success-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="success-title">No Issues Found</h3>
      <p class="success-text">
        Your {{ rulesStore.analysisResult?.summary.totalRulesAnalyzed }} rules look good!
        No conflicts, duplicates, or suggested improvements were identified.
      </p>
    </div>

    <!-- Results -->
    <div v-else-if="rulesStore.analysisResult" class="analysis-results">
      <!-- Summary Stats -->
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">{{ rulesStore.analysisResult.summary.totalRulesAnalyzed }}</span>
          <span class="stat-label">Rules Analyzed</span>
        </div>
        <div class="stat-item" :class="{ 'has-issues': rulesStore.analysisResult.summary.conflictsFound > 0 }">
          <span class="stat-value">{{ rulesStore.analysisResult.summary.conflictsFound }}</span>
          <span class="stat-label">Conflicts</span>
        </div>
        <div class="stat-item" :class="{ 'has-issues': rulesStore.analysisResult.summary.duplicatesFound > 0 }">
          <span class="stat-value">{{ rulesStore.analysisResult.summary.duplicatesFound }}</span>
          <span class="stat-label">Duplicates</span>
        </div>
        <div class="stat-item suggestions">
          <span class="stat-value">{{ rulesStore.analysisResult.summary.enhancementsSuggested }}</span>
          <span class="stat-label">Suggestions</span>
        </div>
      </div>

      <!-- Conflicts Section -->
      <div v-if="rulesStore.analysisResult.conflicts.length > 0" class="section">
        <button class="section-header" @click="toggleSection('conflicts')">
          <div class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="section-icon danger">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Conflicts ({{ rulesStore.analysisResult.conflicts.length }})</span>
          </div>
          <svg :class="['chevron', { expanded: expandedSections.has('conflicts') }]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="expandedSections.has('conflicts')" class="section-content">
          <div v-for="(conflict, index) in rulesStore.analysisResult.conflicts" :key="index" class="item-card">
            <div class="item-header">
              <Badge :variant="getSeverityVariant(conflict.severity)">
                {{ conflict.severity.toUpperCase() }}
              </Badge>
            </div>
            <p class="item-description">{{ conflict.description }}</p>
            <div class="affected-rules">
              <span class="affected-label">Affected rules:</span>
              <span v-for="ruleId in conflict.ruleIds" :key="ruleId" class="rule-chip">
                {{ getRuleDescription(ruleId) }}
              </span>
            </div>
            <div class="suggestion-box">
              <strong>Suggestion:</strong> {{ conflict.suggestion }}
            </div>
            <div class="item-actions">
              <span class="action-label">Resolve by deactivating:</span>
              <Button
                v-for="ruleId in conflict.ruleIds"
                :key="ruleId"
                variant="outline"
                size="sm"
                :loading="processingRuleId === ruleId"
                :disabled="processingRuleId !== null"
                @click="handleDeactivateRule(ruleId)"
              >
                {{ getShortRuleDescription(ruleId) }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Duplicates Section -->
      <div v-if="rulesStore.analysisResult.duplicates.length > 0" class="section">
        <button class="section-header" @click="toggleSection('duplicates')">
          <div class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="section-icon warning">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Duplicates ({{ rulesStore.analysisResult.duplicates.length }})</span>
          </div>
          <svg :class="['chevron', { expanded: expandedSections.has('duplicates') }]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="expandedSections.has('duplicates')" class="section-content">
          <div v-for="(duplicate, index) in rulesStore.analysisResult.duplicates" :key="index" class="item-card">
            <p class="item-description">{{ duplicate.description }}</p>
            <div class="suggestion-box">
              <strong>Recommendation:</strong> {{ duplicate.recommendation }}
            </div>
            <div class="duplicate-rules-list">
              <span class="duplicate-rules-label">Choose which rule to keep:</span>
              <div
                v-for="ruleId in duplicate.ruleIds"
                :key="ruleId"
                class="duplicate-rule-option"
              >
                <div class="duplicate-rule-text">
                  {{ getRuleDescription(ruleId) }}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  :loading="processingRuleId === ruleId"
                  :disabled="processingRuleId !== null"
                  @click="handleKeepOnlyRule(ruleId, duplicate.ruleIds)"
                >
                  Keep This
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Enhancements Section -->
      <div v-if="rulesStore.analysisResult.enhancements.length > 0" class="section">
        <button class="section-header" @click="toggleSection('enhancements')">
          <div class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="section-icon primary">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>Suggested Enhancements ({{ rulesStore.analysisResult.enhancements.length }})</span>
          </div>
          <svg :class="['chevron', { expanded: expandedSections.has('enhancements') }]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <TransitionGroup
          v-if="expandedSections.has('enhancements')"
          name="item-collapse"
          tag="div"
          class="section-content"
        >
          <div
            v-for="(enhancement, index) in rulesStore.analysisResult.enhancements"
            :key="enhancement.suggestion"
            class="item-card"
          >
            <div class="item-header">
              <Badge :variant="getPriorityVariant(enhancement.priority)">
                {{ enhancement.priority.toUpperCase() }} PRIORITY
              </Badge>
            </div>
            <p class="item-description">{{ enhancement.suggestion }}</p>
            <div v-if="enhancement.relatedRuleIds.length > 0" class="affected-rules">
              <span class="affected-label">Related rules:</span>
              <span v-for="ruleId in enhancement.relatedRuleIds" :key="ruleId" class="rule-chip">
                {{ getRuleDescription(ruleId) }}
              </span>
            </div>
            <div class="suggestion-box">
              <strong>Rationale:</strong> {{ enhancement.rationale }}
            </div>

            <!-- Suggested Rules from AI -->
            <div v-if="enhancement.suggestedRules && enhancement.suggestedRules.length > 0" class="suggested-rules">
              <span class="suggested-rules-label">Suggested rules to add:</span>
              <div v-for="(suggestedRule, ruleIndex) in enhancement.suggestedRules" :key="ruleIndex" class="suggested-rule-item">
                <div class="suggested-rule-content">
                  <Badge variant="secondary" class="suggested-rule-category">
                    {{ suggestedRule.category.replace(/_/g, ' ') }}
                  </Badge>
                  <span class="suggested-rule-description">{{ suggestedRule.description }}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  @click="handleCreateSuggestedRule(suggestedRule, index)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </Button>
              </div>
            </div>

            <div class="item-actions">
              <Button
                variant="ghost"
                size="sm"
                @click="handleDismissEnhancement(index)"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <template #footer>
      <Button variant="primary" @click="closeModal">
        {{ rulesStore.analyzing ? 'Cancel' : 'Done' }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.loading-animation {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 24px;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: 2px solid var(--primary-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse-ring 2s ease-out infinite;
  opacity: 0;
}

.pulse-ring.delay-1 {
  animation-delay: 0.5s;
}

.pulse-ring.delay-2 {
  animation-delay: 1s;
}

@keyframes pulse-ring {
  0% {
    width: 40%;
    height: 40%;
    opacity: 0.8;
  }
  100% {
    width: 100%;
    height: 100%;
    opacity: 0;
  }
}

.brain-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  color: var(--primary-color);
  animation: glow 1.5s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    filter: drop-shadow(0 0 4px var(--primary-color));
  }
  to {
    filter: drop-shadow(0 0 12px var(--primary-color));
  }
}

.loading-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: var(--danger-color);
  margin-bottom: 16px;
}

.error-text {
  font-size: 14px;
  color: var(--danger-color);
  margin-bottom: 16px;
}

/* Success State */
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  color: var(--success-color);
  margin-bottom: 16px;
}

.success-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.success-text {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 400px;
}

/* Analysis Results */
.analysis-results {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Summary Stats */
.summary-stats {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--background-color);
  border-radius: var(--radius-md);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-item.has-issues .stat-value {
  color: var(--danger-color);
}

.stat-item.suggestions .stat-value {
  color: var(--primary-color);
}

/* Sections */
.section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--background-color);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.section-header:hover {
  background: var(--border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-icon {
  width: 20px;
  height: 20px;
}

.section-icon.danger {
  color: var(--danger-color);
}

.section-icon.warning {
  color: var(--warning-color);
}

.section-icon.primary {
  color: var(--primary-color);
}

.chevron {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.section-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Item Cards */
.item-card {
  padding: 16px;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.item-header {
  margin-bottom: 12px;
}

.item-description {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 12px;
  line-height: 1.5;
}

.affected-rules {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.affected-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.rule-chip {
  display: inline-block;
  padding: 4px 8px;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-box {
  padding: 12px;
  background: var(--background-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.suggestion-box strong {
  color: var(--text-primary);
}

/* Item Actions */
.item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.action-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: 4px;
}

/* Suggested Rules */
.suggested-rules {
  margin-top: 12px;
  padding: 12px;
  background: var(--primary-light);
  border-radius: var(--radius-md);
}

.suggested-rules-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.suggested-rule-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  background: var(--card-background);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.suggested-rule-item:last-child {
  margin-bottom: 0;
}

.suggested-rule-content {
  flex: 1;
  min-width: 0;
}

.suggested-rule-category {
  margin-bottom: 4px;
  text-transform: capitalize;
}

.suggested-rule-description {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

/* Duplicate Rules UI */
.duplicate-rules-list {
  margin-top: 12px;
  padding: 12px;
  background: var(--warning-light, #fef3c7);
  border-radius: var(--radius-md);
}

.duplicate-rules-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--warning-color, #d97706);
  margin-bottom: 10px;
}

.duplicate-rule-option {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: var(--card-background);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
}

.duplicate-rule-option:last-child {
  margin-bottom: 0;
}

.duplicate-rule-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

/* Collapse Animation for TransitionGroup */
.item-collapse-move,
.item-collapse-enter-active,
.item-collapse-leave-active {
  transition: all 0.3s ease;
}

.item-collapse-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.item-collapse-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.item-collapse-leave-active {
  position: absolute;
  width: calc(100% - 32px);
}
</style>
