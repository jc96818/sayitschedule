<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRulesStore } from '@/stores/rules'
import { VoiceInput, VoiceHintsModal, Modal, Alert, Badge, Button, Toggle, RuleAnalysisModal, SearchBox } from '@/components/ui'
import type { Rule, ParsedRuleItem } from '@/types'
import type { SuggestedRuleForCreate } from '@/components/ui/RuleAnalysisModal.vue'

const rulesStore = useRulesStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

// Rule analysis modal state
const showAnalysisModal = ref(false)

// Add/Edit rule modal
const showAddModal = ref(false)
const editingRule = ref<ParsedRuleItem | null>(null)
const editingExistingRule = ref<Rule | null>(null)
const newRule = ref<Partial<Rule>>({
  category: 'scheduling',
  description: '',
  ruleLogic: {},
  isActive: true,
  priority: 50
})

// Voice confirmation state
const showVoiceConfirmation = ref(false)

// Category filter tabs
const selectedCategory = ref<string>('all')

// Status filter - defaults to 'active' to hide deactivated rules
const statusFilter = ref<'all' | 'active' | 'inactive'>('active')

// Search query
const searchQuery = ref('')

const categoryTabs = [
  { value: 'all', label: 'All Rules' },
  { value: 'gender_pairing', label: 'Gender Pairing' },
  { value: 'session', label: 'Session Rules' },
  { value: 'specific_pairing', label: 'Specific Pairings' },
  { value: 'availability', label: 'Availability' },
  { value: 'certification', label: 'Certification' }
]

// Computed: Check if we have multiple rules
const hasMultipleRules = computed(() => rulesStore.pendingRules.length > 1)

// Computed: Filtered rules by selected category, status, and search query
const filteredRules = computed(() => {
  let result = rulesStore.rules

  // Filter by status
  if (statusFilter.value === 'active') {
    result = result.filter(rule => rule.isActive)
  } else if (statusFilter.value === 'inactive') {
    result = result.filter(rule => !rule.isActive)
  }

  // Filter by category
  if (selectedCategory.value !== 'all') {
    result = result.filter(rule => rule.category === selectedCategory.value)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(rule => {
      // Search in description
      if (rule.description.toLowerCase().includes(query)) return true
      // Search in category label
      const categoryLabel = getCategoryLabel(rule.category).toLowerCase()
      if (categoryLabel.includes(query)) return true
      return false
    })
  }

  return result
})

const categoryLabels: Record<string, string> = {
  gender_pairing: 'Gender Pairing',
  session: 'Session',
  availability: 'Availability',
  specific_pairing: 'Specific Pairing',
  certification: 'Certification',
  scheduling: 'Scheduling',
  custom: 'Custom'
}

function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category.replace(/_/g, ' ')
}

function getCategoryBadgeVariant(category: string): 'primary' | 'success' | 'warning' | 'danger' | 'secondary' {
  const variants: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'secondary'> = {
    gender_pairing: 'primary',
    session: 'success',
    availability: 'danger',
    specific_pairing: 'warning',
    certification: 'primary'
  }
  return variants[category] || 'primary'
}

function getCategoryIconClass(category: string): string {
  const classes: Record<string, string> = {
    gender_pairing: 'icon-primary',
    session: 'icon-success',
    availability: 'icon-danger',
    specific_pairing: 'icon-warning',
    certification: 'icon-primary'
  }
  return classes[category] || 'icon-primary'
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

// Detect if voice command is a search request
function detectSearchIntent(transcript: string): string | null {
  const lowerTranscript = transcript.toLowerCase().trim()

  // Patterns that indicate a search intent
  const searchPatterns = [
    /^(?:find|search|show|look for|get|display)\s+(?:all\s+)?(?:rules?\s+)?(?:for|about|with|containing|mentioning|related to|that mention)\s+(.+)$/i,
    /^(?:find|search|show|look for|get|display)\s+(?:all\s+)?(.+?)\s+rules?$/i,
    /^(?:what|which)\s+rules?\s+(?:are\s+)?(?:for|about|mention|contain|have|include)\s+(.+)$/i,
    /^rules?\s+(?:for|about|mentioning|containing|with)\s+(.+)$/i,
    /^(?:search|find)\s+(.+)$/i,
  ]

  for (const pattern of searchPatterns) {
    const match = lowerTranscript.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return null
}

async function handleVoiceResult(transcript: string) {
  // First check if this is a search command
  const searchTerm = detectSearchIntent(transcript)
  if (searchTerm) {
    searchQuery.value = searchTerm
    // Reset other filters to show all matching rules
    selectedCategory.value = 'all'
    statusFilter.value = 'active'
    return
  }

  // Otherwise, treat as a rule creation command
  try {
    await rulesStore.parseVoiceCommand(transcript)
    if (rulesStore.pendingRules.length > 0) {
      showVoiceConfirmation.value = true
    }
  } catch (error) {
    console.error('Failed to parse voice command:', error)
  }
}

// Confirm a single rule
function handleConfirmRule(ruleId: string) {
  rulesStore.confirmRule(ruleId)
}

// Reject a single rule
function handleRejectRule(ruleId: string) {
  rulesStore.rejectRule(ruleId)
}

// Start editing a single rule
function handleEditRule(rule: ParsedRuleItem) {
  editingRule.value = { ...rule }
  newRule.value = {
    category: rule.category,
    description: rule.description,
    priority: rule.priority,
    isActive: true
  }
  rulesStore.startEditingRule(rule.id)
  showAddModal.value = true
}

// Save edited rule
function handleSaveEditedRule() {
  if (editingRule.value) {
    rulesStore.updatePendingRule(editingRule.value.id, {
      category: newRule.value.category,
      description: newRule.value.description || '',
      priority: newRule.value.priority || 5
    })
    editingRule.value = null
    showAddModal.value = false
    resetForm()
  }
}

// Confirm all and create
async function handleConfirmAll() {
  rulesStore.confirmAllPendingRules()
  try {
    await rulesStore.createConfirmedRules()
    showVoiceConfirmation.value = false
  } catch (error) {
    console.error('Failed to create rules:', error)
  }
}

// Create confirmed rules
async function handleCreateConfirmed() {
  try {
    await rulesStore.createConfirmedRules()
    showVoiceConfirmation.value = false
  } catch (error) {
    console.error('Failed to create rules:', error)
  }
}

// Cancel all voice confirmation
function cancelVoiceConfirmation() {
  rulesStore.clearPendingRules()
  showVoiceConfirmation.value = false
  editingRule.value = null
}

// Handle modal close
function handleModalClose() {
  if (editingRule.value) {
    // If editing a pending rule and canceling, revert to pending status
    const index = rulesStore.pendingRules.findIndex((r) => r.id === editingRule.value?.id)
    if (index !== -1) {
      rulesStore.pendingRules[index].status = 'pending'
    }
  }
  editingRule.value = null
  editingExistingRule.value = null
  showAddModal.value = false
  resetForm()
}

async function handleAddRule() {
  if (editingRule.value) {
    // Saving a pending voice-parsed rule
    handleSaveEditedRule()
  } else if (editingExistingRule.value) {
    // Updating an existing saved rule
    try {
      await rulesStore.updateRule(editingExistingRule.value.id, newRule.value)
      showAddModal.value = false
      editingExistingRule.value = null
      resetForm()
    } catch (error) {
      console.error('Failed to update rule:', error)
    }
  } else {
    // Creating a new rule manually
    try {
      await rulesStore.createRule(newRule.value)
      showAddModal.value = false
      resetForm()
    } catch (error) {
      console.error('Failed to create rule:', error)
    }
  }
}

// Edit an existing saved rule
function handleEditExistingRule(rule: Rule) {
  editingExistingRule.value = rule
  newRule.value = {
    category: rule.category,
    description: rule.description,
    priority: rule.priority,
    isActive: rule.isActive
  }
  showAddModal.value = true
}

async function handleToggleRule(rule: Rule) {
  try {
    await rulesStore.toggleRule(rule.id)
  } catch (error) {
    console.error('Failed to toggle rule:', error)
  }
}

async function handleDeleteRule(id: string) {
  if (confirm('Are you sure you want to delete this rule?')) {
    try {
      await rulesStore.deleteRule(id)
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }
}

function resetForm() {
  newRule.value = {
    category: 'scheduling',
    description: '',
    ruleLogic: {},
    isActive: true,
    priority: 50
  }
}

// Handle create rule from AI analysis suggested rule
async function handleCreateRuleFromAnalysis(suggestedRule: SuggestedRuleForCreate) {
  try {
    // Create the rule directly from the AI suggestion
    await rulesStore.createRule({
      category: suggestedRule.category as Rule['category'],
      description: suggestedRule.description,
      ruleLogic: {},
      priority: suggestedRule.priority || 50,
      isActive: true
    })
    // Keep the analysis modal open so user can add more rules
  } catch (error) {
    console.error('Failed to create rule:', error)
  }
}

onMounted(() => {
  rulesStore.fetchRules()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Scheduling Rules</h2>
        <p>Manage rules that govern schedule generation</p>
      </div>
      <div class="header-actions">
        <Button variant="outline" @click="showAnalysisModal = true" :disabled="rulesStore.rules.length === 0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Analyze Rules
        </Button>
        <Button variant="primary" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </Button>
      </div>
    </header>

    <!-- Rule Analysis Modal -->
    <RuleAnalysisModal v-model="showAnalysisModal" @create-rule="handleCreateRuleFromAnalysis" />

    <div class="page-content">
      <!-- Voice Hints Modal -->
      <VoiceHintsModal ref="voiceHintsModal" page-type="rules" />

      <!-- Voice Interface -->
      <VoiceInput
        title="Add Rules"
        description="Say it or type it—add scheduling rules (multiple at once)."
        :show-hints-link="true"
        @result="handleVoiceResult"
        @show-hints="voiceHintsModal?.openModal()"
      />

      <!-- Voice Loading State -->
      <div v-if="rulesStore.parsing" class="card mb-3">
        <div class="card-body text-center">
          <p class="text-muted">Processing command...</p>
        </div>
      </div>

      <!-- Multi-Rule Voice Confirmation Card -->
      <div v-if="showVoiceConfirmation && rulesStore.pendingRules.length > 0" class="confirmation-card">
        <div class="confirmation-header">
          <h4>AI Interpretation</h4>
          <div v-if="hasMultipleRules" class="rule-count-badge">
            <Badge variant="primary">
              {{ rulesStore.pendingRules.length }} rules detected
            </Badge>
          </div>
        </div>

        <!-- Transcript Box -->
        <div class="transcription-box mb-3">
          <div class="label">Your command:</div>
          <div>"{{ rulesStore.originalTranscript }}"</div>
        </div>

        <!-- Global Warnings -->
        <Alert
          v-if="rulesStore.globalWarnings.length > 0"
          variant="warning"
          class="mb-3"
        >
          <ul class="warnings-list">
            <li v-for="warning in rulesStore.globalWarnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </Alert>

        <!-- Individual Rule Cards -->
        <div class="pending-rules-list">
          <div
            v-for="(rule, index) in rulesStore.pendingRules"
            :key="rule.id"
            class="pending-rule-card"
            :class="{
              'confirmed': rule.status === 'confirmed',
              'rejected': rule.status === 'rejected',
              'editing': rule.status === 'editing'
            }"
          >
            <div class="rule-header">
              <span class="rule-number">Rule {{ index + 1 }}</span>
              <Badge :variant="getCategoryBadgeVariant(rule.category)">
                {{ getCategoryLabel(rule.category) }}
              </Badge>
              <span class="confidence-indicator" :class="getConfidenceClass(rule.confidence)">
                {{ Math.round(rule.confidence * 100) }}% confident
              </span>
            </div>

            <div class="rule-description">
              {{ rule.description }}
            </div>

            <!-- Per-Rule Warnings -->
            <div v-if="rule.warnings.length > 0" class="rule-warnings">
              <span v-for="warning in rule.warnings" :key="warning" class="warning-text">
                {{ warning }}
              </span>
            </div>

            <!-- Status Indicator -->
            <div v-if="rule.status !== 'pending'" class="rule-status">
              <Badge v-if="rule.status === 'confirmed'" variant="success">Confirmed</Badge>
              <Badge v-else-if="rule.status === 'rejected'" variant="danger">Rejected</Badge>
              <Badge v-else-if="rule.status === 'editing'" variant="warning">Editing...</Badge>
            </div>

            <!-- Rule Actions -->
            <div v-if="rule.status === 'pending'" class="rule-actions">
              <Button
                variant="success"
                size="sm"
                @click="handleConfirmRule(rule.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Confirm
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="handleEditRule(rule)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-danger"
                @click="handleRejectRule(rule.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </Button>
            </div>
          </div>
        </div>

        <!-- Summary & Bulk Actions -->
        <div class="confirmation-summary">
          <div class="summary-stats">
            <span v-if="rulesStore.confirmedCount > 0" class="stat confirmed">
              {{ rulesStore.confirmedCount }} confirmed
            </span>
            <span v-if="rulesStore.pendingCount > 0" class="stat pending">
              {{ rulesStore.pendingCount }} pending review
            </span>
          </div>

          <div class="confirmation-actions">
            <!-- Quick actions for multiple rules -->
            <template v-if="hasMultipleRules && rulesStore.pendingCount > 0">
              <Button
                variant="outline"
                @click="rulesStore.confirmAllPendingRules()"
              >
                Confirm All Remaining
              </Button>
            </template>

            <!-- Create confirmed rules -->
            <Button
              v-if="rulesStore.confirmedCount > 0"
              variant="primary"
              :loading="rulesStore.loading"
              @click="handleCreateConfirmed"
            >
              Create {{ rulesStore.confirmedCount }} Rule{{ rulesStore.confirmedCount > 1 ? 's' : '' }}
            </Button>

            <!-- Single rule: Confirm All at once -->
            <Button
              v-if="!hasMultipleRules && rulesStore.pendingCount === 1"
              variant="success"
              :loading="rulesStore.loading"
              @click="handleConfirmAll"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Add Rule
            </Button>

            <Button
              variant="ghost"
              class="text-danger"
              @click="cancelVoiceConfirmation"
            >
              Cancel All
            </Button>
          </div>
        </div>
      </div>

      <!-- Error Alert -->
      <Alert v-if="rulesStore.error" variant="danger" class="mb-3" dismissible @dismiss="rulesStore.error = null">
        {{ rulesStore.error }}
      </Alert>

      <!-- Filters Row -->
      <div class="filters-row">
        <!-- Category Tabs -->
        <div class="tabs">
          <button
            v-for="tab in categoryTabs"
            :key="tab.value"
            class="tab"
            :class="{ active: selectedCategory === tab.value }"
            @click="selectedCategory = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Right side filters -->
        <div class="filters-right">
          <!-- Search Box -->
          <SearchBox
            v-model="searchQuery"
            placeholder="Search rules..."
          />

          <!-- Status Filter -->
          <select v-model="statusFilter" class="form-control status-filter">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Status</option>
          </select>
        </div>
      </div>

      <!-- Rules List -->
      <div class="card">
        <div class="card-header">
          <h3>{{ selectedCategory === 'all' ? 'All Rules' : categoryLabels[selectedCategory] || selectedCategory }} ({{ filteredRules.length }})</h3>
        </div>

        <div v-if="rulesStore.loading && rulesStore.rules.length === 0" class="card-body text-center">
          <p class="text-muted">Loading rules...</p>
        </div>

        <div v-else-if="rulesStore.rules.length === 0" class="card-body text-center">
          <p class="text-muted">No rules defined. Add your first rule using voice or the manual form.</p>
        </div>

        <div v-else-if="filteredRules.length === 0" class="card-body text-center">
          <p class="text-muted">No rules in this category.</p>
        </div>

        <div v-else class="card-body">
          <div
            v-for="rule in filteredRules"
            :key="rule.id"
            class="rule-item"
            :class="{ disabled: !rule.isActive }"
          >
            <div class="rule-icon" :class="getCategoryIconClass(rule.category)">
              <svg v-if="rule.category === 'gender_pairing'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <svg v-else-if="rule.category === 'session'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg v-else-if="rule.category === 'availability'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <svg v-else-if="rule.category === 'specific_pairing'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="rule-content">
              <p>{{ rule.description }}</p>
            </div>
            <Badge :variant="rule.isActive ? getCategoryBadgeVariant(rule.category) : 'secondary'">
              {{ rule.isActive ? getCategoryLabel(rule.category) : 'Disabled' }}
            </Badge>
            <div class="rule-actions">
              <Toggle
                :model-value="rule.isActive"
                @update:model-value="() => handleToggleRule(rule)"
              />
              <button class="btn btn-ghost btn-sm btn-icon" title="Edit rule" @click="handleEditExistingRule(rule)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon btn-icon-danger" title="Delete rule" @click="handleDeleteRule(rule.id)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Add/Edit Rule Modal -->
    <Modal
      v-model="showAddModal"
      :title="editingRule || editingExistingRule ? 'Edit Rule' : 'Add Scheduling Rule'"
      size="md"
      @close="handleModalClose"
    >
      <form @submit.prevent="handleAddRule">
        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" v-model="newRule.category" class="form-control">
            <option value="gender_pairing">Gender Pairing</option>
            <option value="session">Session</option>
            <option value="availability">Availability</option>
            <option value="specific_pairing">Specific Pairing</option>
            <option value="certification">Certification</option>
            <option value="scheduling">Scheduling</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div class="form-group">
          <label for="description">Rule Description</label>
          <textarea
            id="description"
            v-model="newRule.description"
            class="form-control"
            rows="3"
            placeholder="Describe the scheduling rule..."
            required
          ></textarea>
        </div>

        <div class="form-group">
          <label for="priority">Priority (1-100)</label>
          <input
            id="priority"
            v-model.number="newRule.priority"
            type="number"
            class="form-control"
            min="1"
            max="100"
          />
          <small class="text-muted">Higher priority rules are applied first</small>
        </div>

        <div v-if="!editingRule && !editingExistingRule" class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input v-model="newRule.isActive" type="checkbox" />
            <span>Rule is active</span>
          </label>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="handleModalClose">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="rulesStore.loading">
            {{ (editingRule || editingExistingRule) ? 'Save Changes' : 'Add Rule' }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.text-danger {
  color: var(--danger-color);
}

.filters-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.filters-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-filter {
  width: auto;
  min-width: 120px;
}

.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--radius-md);
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tab:hover {
  background-color: var(--background-color);
  color: var(--text-primary);
}

.tab.active {
  background-color: var(--primary-color);
  color: white;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  background-color: var(--card-background);
  transition: border-color 0.2s ease;
}

.rule-item:hover {
  border-color: var(--primary-color);
}

.rule-item.disabled {
  opacity: 0.6;
}

.rule-item.disabled:hover {
  border-color: var(--border-color);
}

.rule-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rule-icon.icon-primary {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.rule-icon.icon-success {
  background-color: var(--success-light);
  color: var(--success-color);
}

.rule-icon.icon-warning {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.rule-icon.icon-danger {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.rule-item.disabled .rule-icon {
  background-color: #f1f5f9;
  color: var(--text-muted);
}

.rule-content {
  flex: 1;
  min-width: 0;
}

.rule-content p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.rule-item > .rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  padding: 6px;
  color: var(--text-muted);
}

.btn-icon:hover {
  color: var(--text-primary);
}

.btn-icon-danger:hover {
  color: var(--danger-color);
}

.confirmation-card {
  background-color: var(--card-background);
  border: 2px solid var(--primary-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 20px;
}

.confirmation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.confirmation-header h4 {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.transcription-box {
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: left;
}

.transcription-box .label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 8px;
}

.warnings-list {
  margin: 0;
  padding-left: 20px;
}

.pending-rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.pending-rule-card {
  background-color: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  transition: all 0.2s ease;
}

.pending-rule-card.confirmed {
  border-color: var(--success-color);
  background-color: rgba(16, 185, 129, 0.05);
}

.pending-rule-card.rejected {
  opacity: 0.5;
  border-color: var(--danger-color);
}

.pending-rule-card.editing {
  border-color: var(--warning-color);
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.rule-number {
  font-weight: 600;
  color: var(--text-secondary);
}

.confidence-indicator {
  font-size: 12px;
  margin-left: auto;
}

.confidence-indicator.high {
  color: var(--success-color);
}

.confidence-indicator.medium {
  color: var(--warning-color);
}

.confidence-indicator.low {
  color: var(--danger-color);
}

.rule-description {
  font-size: 15px;
  margin-bottom: 8px;
}

.rule-warnings {
  font-size: 12px;
  color: var(--warning-color);
  margin-bottom: 8px;
}

.rule-status {
  margin-bottom: 8px;
}

.pending-rule-card > .rule-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.confirmation-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.summary-stats {
  display: flex;
  gap: 16px;
}

.summary-stats .stat {
  font-size: 13px;
}

.summary-stats .stat.confirmed {
  color: var(--success-color);
}

.summary-stats .stat.pending {
  color: var(--text-muted);
}

.confirmation-actions {
  display: flex;
  gap: 12px;
}
</style>
