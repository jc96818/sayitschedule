<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Session, SessionStatus, CancellationReason } from '@/types'
import { useLabels } from '@/composables/useLabels'
import Button from './Button.vue'
import SessionStatusBadge from './SessionStatusBadge.vue'
import Alert from './Alert.vue'

interface Props {
  modelValue: boolean
  session: Session | null
  scheduleStatus: 'draft' | 'published'
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update-session': [sessionId: string, data: Partial<Session>]
  'delete-session': [sessionId: string]
}>()

const { staffLabelSingular, patientLabelSingular, roomLabelSingular } = useLabels()

// Edit mode state
const isEditing = ref(false)
const editForm = ref({
  date: '',
  startTime: '',
  endTime: '',
  notes: ''
})

// Cancel mode state
const isCancelling = ref(false)
const cancelForm = ref({
  reason: 'other' as CancellationReason,
  notes: ''
})

const cancellationReasons: { value: CancellationReason; label: string }[] = [
  { value: 'patient_request', label: 'Patient Request' },
  { value: 'caregiver_request', label: 'Caregiver Request' },
  { value: 'therapist_unavailable', label: 'Therapist Unavailable' },
  { value: 'weather', label: 'Weather' },
  { value: 'illness', label: 'Illness' },
  { value: 'scheduling_conflict', label: 'Scheduling Conflict' },
  { value: 'other', label: 'Other' }
]

// Computed
const canEdit = computed(() => props.scheduleStatus === 'draft')
const sessionStatus = computed(() => props.session?.status || 'scheduled')

// Watch for session changes to reset edit state
watch(() => props.session, (newSession) => {
  if (newSession) {
    resetEditForm()
  }
  isEditing.value = false
  isCancelling.value = false
}, { immediate: true })

// Methods
function close() {
  emit('update:modelValue', false)
  isEditing.value = false
  isCancelling.value = false
}

function resetEditForm() {
  if (props.session) {
    editForm.value = {
      date: props.session.date.split('T')[0],
      startTime: props.session.startTime?.slice(0, 5) || '',
      endTime: props.session.endTime?.slice(0, 5) || '',
      notes: props.session.notes || ''
    }
  }
}

function startEditing() {
  resetEditForm()
  isEditing.value = true
  isCancelling.value = false
}

function cancelEditing() {
  isEditing.value = false
  resetEditForm()
}

function startCancelling() {
  isCancelling.value = true
  isEditing.value = false
  cancelForm.value = {
    reason: 'other',
    notes: ''
  }
}

function cancelCancelling() {
  isCancelling.value = false
}

function handleSave() {
  if (!props.session) return

  emit('update-session', props.session.id, {
    date: editForm.value.date,
    startTime: editForm.value.startTime,
    endTime: editForm.value.endTime,
    notes: editForm.value.notes || null
  })
  isEditing.value = false
}

function handleCancel() {
  if (!props.session) return

  emit('update-session', props.session.id, {
    status: 'cancelled' as SessionStatus,
    cancellationReason: cancelForm.value.reason,
    cancellationNotes: cancelForm.value.notes || null
  })
  isCancelling.value = false
}

function handleDelete() {
  if (!props.session) return

  if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
    emit('delete-session', props.session.id)
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(time?: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return ''
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const minutes = (endH * 60 + endM) - (startH * 60 + startM)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue && session" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal session-detail-modal">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-content">
              <h3>Session Details</h3>
              <SessionStatusBadge v-if="sessionStatus" :status="sessionStatus" size="sm" />
            </div>
            <button class="modal-close" @click="close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <Alert v-if="error" variant="danger" class="mb-4">
              {{ error }}
            </Alert>

            <!-- View Mode -->
            <template v-if="!isEditing && !isCancelling">
              <div class="detail-grid">
                <!-- Patient -->
                <div class="detail-item">
                  <div class="detail-label">{{ patientLabelSingular }}</div>
                  <div class="detail-value">
                    <div class="avatar patient">
                      {{ (session.patientName || 'P').charAt(0).toUpperCase() }}
                    </div>
                    <span>{{ session.patientName || session.patientId?.slice(0, 8) }}</span>
                  </div>
                </div>

                <!-- Therapist -->
                <div class="detail-item">
                  <div class="detail-label">{{ staffLabelSingular }}</div>
                  <div class="detail-value">
                    <div class="avatar therapist">
                      {{ (session.therapistName || 'T').charAt(0).toUpperCase() }}
                    </div>
                    <span>{{ session.therapistName || (session.therapistId || session.staffId)?.slice(0, 8) }}</span>
                  </div>
                </div>

                <!-- Date -->
                <div class="detail-item">
                  <div class="detail-label">Date</div>
                  <div class="detail-value icon-value">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="detail-icon">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{{ formatDate(session.date) }}</span>
                  </div>
                </div>

                <!-- Time -->
                <div class="detail-item">
                  <div class="detail-label">Time</div>
                  <div class="detail-value icon-value">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="detail-icon">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{{ formatTime(session.startTime) }} - {{ formatTime(session.endTime) }}</span>
                    <span class="duration-badge">{{ formatDuration(session.startTime, session.endTime) }}</span>
                  </div>
                </div>

                <!-- Room -->
                <div class="detail-item">
                  <div class="detail-label">{{ roomLabelSingular }}</div>
                  <div class="detail-value icon-value">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="detail-icon">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{{ session.roomName || 'Not assigned' }}</span>
                  </div>
                </div>

                <!-- Notes -->
                <div v-if="session.notes" class="detail-item full-width">
                  <div class="detail-label">Notes</div>
                  <div class="detail-value notes">
                    {{ session.notes }}
                  </div>
                </div>

                <!-- Cancellation Info -->
                <template v-if="session.status === 'cancelled' || session.status === 'late_cancel'">
                  <div class="detail-item full-width cancellation-info">
                    <div class="detail-label">Cancellation Details</div>
                    <div class="cancellation-details">
                      <div v-if="session.cancellationReason" class="cancellation-row">
                        <span class="cancellation-label">Reason:</span>
                        <span>{{ session.cancellationReason.replace(/_/g, ' ') }}</span>
                      </div>
                      <div v-if="session.cancellationNotes" class="cancellation-row">
                        <span class="cancellation-label">Notes:</span>
                        <span>{{ session.cancellationNotes }}</span>
                      </div>
                      <div v-if="session.cancelledAt" class="cancellation-row">
                        <span class="cancellation-label">Cancelled:</span>
                        <span>{{ new Date(session.cancelledAt).toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>

            <!-- Edit Mode -->
            <template v-else-if="isEditing">
              <form @submit.prevent="handleSave" class="edit-form">
                <div class="form-group">
                  <label for="edit-date">Date</label>
                  <input
                    id="edit-date"
                    v-model="editForm.date"
                    type="date"
                    required
                    class="form-control"
                  />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-start">Start Time</label>
                    <input
                      id="edit-start"
                      v-model="editForm.startTime"
                      type="time"
                      required
                      class="form-control"
                    />
                  </div>
                  <div class="form-group">
                    <label for="edit-end">End Time</label>
                    <input
                      id="edit-end"
                      v-model="editForm.endTime"
                      type="time"
                      required
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="edit-notes">Notes</label>
                  <textarea
                    id="edit-notes"
                    v-model="editForm.notes"
                    class="form-control"
                    rows="3"
                    placeholder="Optional notes about this session"
                  ></textarea>
                </div>
              </form>
            </template>

            <!-- Cancel Mode -->
            <template v-else-if="isCancelling">
              <div class="cancel-warning">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="warning-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <strong>Cancel this session?</strong>
                  <p>This will mark the session as cancelled. Please provide a reason.</p>
                </div>
              </div>

              <form @submit.prevent="handleCancel" class="cancel-form">
                <div class="form-group">
                  <label for="cancel-reason">Cancellation Reason</label>
                  <select
                    id="cancel-reason"
                    v-model="cancelForm.reason"
                    required
                    class="form-control"
                  >
                    <option v-for="reason in cancellationReasons" :key="reason.value" :value="reason.value">
                      {{ reason.label }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="cancel-notes">Additional Notes</label>
                  <textarea
                    id="cancel-notes"
                    v-model="cancelForm.notes"
                    class="form-control"
                    rows="2"
                    placeholder="Optional additional details"
                  ></textarea>
                </div>
              </form>
            </template>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <template v-if="!isEditing && !isCancelling">
              <!-- View Mode Actions -->
              <div class="footer-left">
                <Button
                  v-if="canEdit && sessionStatus !== 'cancelled' && sessionStatus !== 'late_cancel'"
                  variant="ghost"
                  class="delete-btn"
                  @click="handleDelete"
                  :disabled="loading"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              </div>
              <div class="footer-right">
                <Button
                  v-if="canEdit && sessionStatus !== 'cancelled' && sessionStatus !== 'late_cancel'"
                  variant="outline"
                  @click="startCancelling"
                  :disabled="loading"
                >
                  Cancel Session
                </Button>
                <Button
                  v-if="canEdit"
                  variant="primary"
                  @click="startEditing"
                  :disabled="loading"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Button>
                <Button v-if="!canEdit" variant="ghost" @click="close">
                  Close
                </Button>
              </div>
            </template>

            <template v-else-if="isEditing">
              <!-- Edit Mode Actions -->
              <Button variant="ghost" @click="cancelEditing" :disabled="loading">
                Cancel
              </Button>
              <Button variant="primary" @click="handleSave" :loading="loading">
                Save Changes
              </Button>
            </template>

            <template v-else-if="isCancelling">
              <!-- Cancel Mode Actions -->
              <Button variant="ghost" @click="cancelCancelling" :disabled="loading">
                Go Back
              </Button>
              <Button variant="danger" @click="handleCancel" :loading="loading">
                Cancel Session
              </Button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal {
  background-color: var(--card-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

.session-detail-modal {
  max-width: 520px;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.modal-close:hover {
  background-color: var(--background-color);
  color: var(--text-primary);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-left {
  flex: 1;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.delete-btn {
  color: var(--danger-color);
}

.delete-btn:hover {
  background-color: var(--danger-light);
}

/* Detail Grid */
.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 15px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-value.icon-value {
  gap: 8px;
}

.detail-value.notes {
  background-color: var(--background-color);
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.5;
}

.detail-icon {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.avatar.patient {
  background-color: var(--warning-light, #fef3c7);
  color: var(--warning-color, #d97706);
}

.avatar.therapist {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.duration-badge {
  font-size: 12px;
  padding: 2px 8px;
  background-color: var(--background-color);
  border-radius: 9999px;
  color: var(--text-secondary);
}

/* Cancellation Info */
.cancellation-info {
  background-color: var(--danger-light);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-top: 8px;
}

.cancellation-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cancellation-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.cancellation-label {
  color: var(--text-muted);
  min-width: 80px;
}

/* Edit Form */
.edit-form,
.cancel-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-control {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background-color: var(--card-background);
  color: var(--text-primary);
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* Cancel Warning */
.cancel-warning {
  display: flex;
  gap: 12px;
  padding: 16px;
  background-color: var(--warning-light, #fef3c7);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}

.cancel-warning .warning-icon {
  width: 24px;
  height: 24px;
  color: var(--warning-color, #d97706);
  flex-shrink: 0;
}

.cancel-warning strong {
  display: block;
  margin-bottom: 4px;
}

.cancel-warning p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.mb-4 {
  margin-bottom: 16px;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95);
}
</style>
