<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRulesStore } from '@/stores/rules'
import { VoiceInput, VoiceHintsModal, Modal, Alert, Badge, Button, Toggle } from '@/components/ui'
import type { Rule, ParsedRuleItem } from '@/types'

const rulesStore = useRulesStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

// Add/Edit rule modal
const showAddModal = ref(false)
const editingRule = ref<ParsedRuleItem | null>(null)
const newRule = ref<Partial<Rule>>({
  category: 'scheduling',
  description: '',
  isActive: true,
  priority: 50
})

// Voice confirmation state
const showVoiceConfirmation = ref(false)

// Computed: Check if we have multiple rules
const hasMultipleRules = computed(() => rulesStore.pendingRules.length > 1)

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
    availability: 'warning',
    specific_pairing: 'secondary',
    certification: 'primary'
  }
  return variants[category] || 'primary'
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

async function handleVoiceResult(transcript: string) {
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
  showAddModal.value = false
  resetForm()
}

async function handleAddRule() {
  if (editingRule.value) {
    handleSaveEditedRule()
  } else {
    try {
      await rulesStore.createRule(newRule.value)
      showAddModal.value = false
      resetForm()
    } catch (error) {
      console.error('Failed to create rule:', error)
    }
  }
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
    isActive: true,
    priority: 50
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
        <Button variant="primary" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Rule Manually
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Voice Hints Modal -->
      <VoiceHintsModal ref="voiceHintsModal" page-type="rules" />

      <!-- Voice Interface -->
      <VoiceInput
        title="Add Rules by Voice"
        description="Click the microphone and speak your scheduling rules. You can add multiple rules at once!"
        :show-hints-link="true"
        @result="handleVoiceResult"
        @show-hints="voiceHintsModal?.openModal()"
      />

      <!-- Voice Loading State -->
      <div v-if="rulesStore.parsing" class="card mb-3">
        <div class="card-body text-center">
          <p class="text-muted">Processing voice command...</p>
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
          <div class="label">You said:</div>
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

      <!-- Rules by Category -->
      <div class="card">
        <div class="card-header">
          <h3>Active Rules ({{ rulesStore.activeRules.length }})</h3>
        </div>

        <div v-if="rulesStore.loading && rulesStore.rules.length === 0" class="card-body text-center">
          <p class="text-muted">Loading rules...</p>
        </div>

        <div v-else-if="rulesStore.rules.length === 0" class="card-body text-center">
          <p class="text-muted">No rules defined. Add your first rule using voice or the manual form.</p>
        </div>

        <div v-else class="card-body">
          <div v-for="rule in rulesStore.rules" :key="rule.id" class="rule-item">
            <div class="rule-content">
              <Badge :variant="getCategoryBadgeVariant(rule.category)" style="margin-bottom: 4px;">
                {{ getCategoryLabel(rule.category) }}
              </Badge>
              <p>{{ rule.description }}</p>
            </div>
            <div class="rule-actions">
              <Toggle
                :model-value="rule.isActive"
                @update:model-value="() => handleToggleRule(rule)"
              />
              <button class="btn btn-ghost btn-sm btn-icon" title="Delete rule" @click="handleDeleteRule(rule.id)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
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
      :title="editingRule ? 'Edit Rule' : 'Add Scheduling Rule'"
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

        <div v-if="!editingRule" class="form-group">
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
            {{ editingRule ? 'Save Changes' : 'Add Rule' }}
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

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.rule-content p {
  margin: 0;
  font-size: 14px;
}

.rule-item > .rule-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-icon {
  padding: 6px;
  color: var(--text-muted);
}

.btn-icon:hover {
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
