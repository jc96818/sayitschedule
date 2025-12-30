<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Modal, Button, Alert } from '@/components/ui'
import { useAvailabilityStore } from '@/stores/availability'
import { useAuthStore } from '@/stores/auth'
import type { StaffAvailability } from '@/types'

const props = defineProps<{
  modelValue: boolean
  staffId: string
  date?: Date
  availability?: StaffAvailability | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const availabilityStore = useAvailabilityStore()
const authStore = useAuthStore()

// Form state
const isFullDay = ref(true)
const startTime = ref('09:00')
const endTime = ref('17:00')
const reason = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

// Computed
const isEditing = computed(() => !!props.availability)
const modalTitle = computed(() => isEditing.value ? 'Edit Time Off Request' : 'Request Time Off')

const formattedDate = computed(() => {
  const d = props.availability ? new Date(props.availability.date) : props.date
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'admin' || role === 'admin_assistant' || role === 'super_admin'
})

const canDelete = computed(() => {
  if (!props.availability) return false
  // Admins can delete any, staff can only delete their own pending
  if (isAdmin.value) return true
  return props.availability.status === 'pending'
})

const isPending = computed(() => props.availability?.status === 'pending')
const isApproved = computed(() => props.availability?.status === 'approved')
const isRejected = computed(() => props.availability?.status === 'rejected')

// Reset form when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    error.value = null
    if (props.availability) {
      // Editing existing
      isFullDay.value = !props.availability.startTime || !props.availability.endTime
      startTime.value = props.availability.startTime || '09:00'
      endTime.value = props.availability.endTime || '17:00'
      reason.value = props.availability.reason || ''
    } else {
      // New request
      isFullDay.value = true
      startTime.value = '09:00'
      endTime.value = '17:00'
      reason.value = ''
    }
  }
})

// Time validation
const timeError = computed(() => {
  if (isFullDay.value) return null
  if (!startTime.value || !endTime.value) return 'Please enter both start and end times'
  if (startTime.value >= endTime.value) return 'End time must be after start time'
  return null
})

async function handleSubmit() {
  if (timeError.value) {
    error.value = timeError.value
    return
  }

  saving.value = true
  error.value = null

  try {
    const dateStr = props.availability
      ? new Date(props.availability.date).toISOString().split('T')[0]
      : props.date!.toISOString().split('T')[0]

    if (isEditing.value && props.availability) {
      // Update uses null for optional fields
      await availabilityStore.update(props.staffId, props.availability.id, {
        date: dateStr,
        available: false,
        startTime: isFullDay.value ? null : startTime.value,
        endTime: isFullDay.value ? null : endTime.value,
        reason: reason.value || null
      })
    } else {
      // Create uses undefined for optional fields
      await availabilityStore.create(props.staffId, {
        date: dateStr,
        available: false,
        startTime: isFullDay.value ? undefined : startTime.value,
        endTime: isFullDay.value ? undefined : endTime.value,
        reason: reason.value || undefined
      })
    }

    emit('saved')
    emit('update:modelValue', false)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to save request'
    error.value = errorMessage
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.availability || !confirm('Are you sure you want to delete this time off request?')) {
    return
  }

  saving.value = true
  error.value = null

  try {
    await availabilityStore.delete(props.staffId, props.availability.id)
    emit('saved')
    emit('update:modelValue', false)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete request'
    error.value = errorMessage
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Modal :model-value="modelValue" :title="modalTitle" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <Alert v-if="error" variant="danger" class="mb-3" dismissible @dismiss="error = null">
      {{ error }}
    </Alert>

    <!-- Status Badge for existing requests -->
    <div v-if="availability" class="status-badge-container">
      <span
        class="status-badge"
        :class="{
          'status-pending': isPending,
          'status-approved': isApproved,
          'status-rejected': isRejected
        }"
      >
        {{ availability.status }}
      </span>
      <span v-if="availability.reviewerNotes" class="reviewer-notes">
        Note: {{ availability.reviewerNotes }}
      </span>
    </div>

    <form @submit.prevent="handleSubmit">
      <!-- Date display -->
      <div class="form-group">
        <label>Date</label>
        <div class="date-display">{{ formattedDate }}</div>
      </div>

      <!-- Full day toggle -->
      <div class="form-group">
        <label class="checkbox-label">
          <input v-model="isFullDay" type="checkbox" />
          <span>Full day off</span>
        </label>
      </div>

      <!-- Time range (if not full day) -->
      <div v-if="!isFullDay" class="form-group time-range">
        <div class="time-input">
          <label for="startTime">From</label>
          <input
            id="startTime"
            v-model="startTime"
            type="time"
            class="form-control"
            required
          />
        </div>
        <div class="time-input">
          <label for="endTime">To</label>
          <input
            id="endTime"
            v-model="endTime"
            type="time"
            class="form-control"
            required
          />
        </div>
      </div>
      <p v-if="!isFullDay" class="time-hint">
        Specify the hours you will be unavailable
      </p>

      <!-- Reason -->
      <div class="form-group">
        <label for="reason">Reason (optional)</label>
        <textarea
          id="reason"
          v-model="reason"
          class="form-control"
          rows="3"
          placeholder="e.g., Doctor's appointment, vacation, personal day"
        ></textarea>
      </div>

      <!-- Info for non-admin users -->
      <div v-if="!isAdmin && !isEditing" class="info-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Your request will be submitted for approval by an administrator.</span>
      </div>
    </form>

    <template #footer>
      <Button
        v-if="canDelete"
        variant="danger"
        :loading="saving"
        @click="handleDelete"
      >
        Delete
      </Button>
      <div class="footer-spacer"></div>
      <Button variant="outline" @click="close">Cancel</Button>
      <Button
        variant="primary"
        :loading="saving"
        :disabled="!!timeError"
        @click="handleSubmit"
      >
        {{ isEditing ? 'Save Changes' : 'Submit Request' }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.status-badge-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--background-color, #f9fafb);
  border-radius: var(--radius-md, 8px);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  width: fit-content;
}

.status-pending {
  background: #fef08a;
  color: #854d0e;
}

.status-approved {
  background: #dcfce7;
  color: #166534;
}

.status-rejected {
  background: #fecaca;
  color: #991b1b;
}

.reviewer-notes {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  font-style: italic;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  margin-bottom: 6px;
}

.date-display {
  padding: 12px;
  background: var(--background-color, #f9fafb);
  border-radius: var(--radius-md, 8px);
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.time-range {
  display: flex;
  gap: 16px;
}

.time-input {
  flex: 1;
}

.time-input label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.time-hint {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  margin-top: -8px;
  margin-bottom: 16px;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--card-background, #fff);
  color: var(--text-primary, #111827);
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  color: #1e40af;
}

.info-box svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.footer-spacer {
  flex: 1;
}

.mb-3 {
  margin-bottom: 12px;
}
</style>
