<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRulesStore } from '@/stores/rules'
import { VoiceInput, VoiceHintsModal, Modal, Alert, Badge, Button, Toggle } from '@/components/ui'
import type { Rule } from '@/types'

const rulesStore = useRulesStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

// Add rule modal
const showAddModal = ref(false)
const newRule = ref<Partial<Rule>>({
  category: 'scheduling',
  description: '',
  isActive: true,
  priority: 50
})

// Voice confirmation
const showVoiceConfirmation = ref(false)
const voiceTranscript = ref('')

const categoryLabels: Record<string, string> = {
  gender_pairing: 'Gender Pairing',
  session: 'Session',
  availability: 'Availability',
  specific_pairing: 'Specific Pairing',
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
    specific_pairing: 'secondary'
  }
  return variants[category] || 'primary'
}

async function handleVoiceResult(transcript: string) {
  voiceTranscript.value = transcript
  try {
    await rulesStore.parseVoiceCommand(transcript)
    showVoiceConfirmation.value = true
  } catch (error) {
    console.error('Failed to parse voice command:', error)
  }
}

async function confirmVoiceRule() {
  try {
    await rulesStore.confirmPendingRule()
    showVoiceConfirmation.value = false
  } catch (error) {
    console.error('Failed to create rule:', error)
  }
}

function cancelVoiceConfirmation() {
  rulesStore.clearPendingRule()
  showVoiceConfirmation.value = false
  voiceTranscript.value = ''
}

function editVoiceParsed() {
  if (rulesStore.pendingRule) {
    newRule.value = { ...rulesStore.pendingRule }
    showAddModal.value = true
    cancelVoiceConfirmation()
  }
}

async function handleAddRule() {
  try {
    await rulesStore.createRule(newRule.value)
    showAddModal.value = false
    resetForm()
  } catch (error) {
    console.error('Failed to create rule:', error)
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
        title="Add Rule by Voice"
        description="Click the microphone and speak your scheduling rule naturally."
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

      <!-- Voice Confirmation Card -->
      <div v-if="showVoiceConfirmation && rulesStore.pendingRule" class="confirmation-card">
        <h4>AI Interpretation</h4>
        <div class="transcription-box mb-2">
          <div class="label">You said:</div>
          <div>"{{ voiceTranscript }}"</div>
        </div>
        <div class="interpreted-rule">
          <strong>New Scheduling Rule:</strong>
          <p style="margin-top: 8px;">{{ rulesStore.pendingRule.description }}</p>
          <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
            Category: {{ getCategoryLabel(rulesStore.pendingRule.category || 'custom') }}
            <span v-if="rulesStore.parseConfidence" style="margin-left: 16px;">
              Confidence: {{ Math.round(rulesStore.parseConfidence * 100) }}%
            </span>
          </div>
        </div>
        <div class="confirmation-actions">
          <Button variant="success" @click="confirmVoiceRule" :loading="rulesStore.loading">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Add Rule
          </Button>
          <Button variant="outline" @click="editVoiceParsed">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Details
          </Button>
          <Button variant="ghost" class="text-danger" @click="cancelVoiceConfirmation">Cancel</Button>
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

    <!-- Add Rule Modal -->
    <Modal v-model="showAddModal" title="Add Scheduling Rule" size="md">
      <form @submit.prevent="handleAddRule">
        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" v-model="newRule.category" class="form-control">
            <option value="gender_pairing">Gender Pairing</option>
            <option value="session">Session</option>
            <option value="availability">Availability</option>
            <option value="specific_pairing">Specific Pairing</option>
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

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input v-model="newRule.isActive" type="checkbox" />
            <span>Rule is active</span>
          </label>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showAddModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="rulesStore.loading">
            Add Rule
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

.rule-actions {
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

.confirmation-card h4 {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.interpreted-rule {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
}

.interpreted-rule p {
  margin: 0;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
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
</style>
