<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { portalAppointmentsService } from '@/services/api'
import type { PortalSession } from '@/types'

const portalStore = usePortalAuthStore()

// State
const upcomingAppointments = ref<PortalSession[]>([])
const pastAppointments = ref<PortalSession[]>([])
const activeTab = ref<'upcoming' | 'past'>('upcoming')
const loading = ref(true)
const error = ref<string | null>(null)
const confirmingId = ref<string | null>(null)
const cancellingId = ref<string | null>(null)

// Pagination for past
const pastPage = ref(1)
const pastTotalPages = ref(1)
const pastLoading = ref(false)

// Computed
const branding = computed(() => portalStore.branding)
const canCancel = computed(() => portalStore.canCancel)
const staffLabelSingular = computed(() => branding.value?.staffLabelSingular || 'Therapist')
const roomLabelSingular = computed(() => branding.value?.roomLabelSingular || 'Location')
const displayedAppointments = computed(() => {
  return activeTab.value === 'upcoming' ? upcomingAppointments.value : pastAppointments.value
})

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format time for display
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Get status display info
function getStatusInfo(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending Approval', color: 'warning' },
    scheduled: { label: 'Scheduled', color: 'primary' },
    confirmed: { label: 'Confirmed', color: 'success' },
    checked_in: { label: 'Checked In', color: 'success' },
    in_progress: { label: 'In Progress', color: 'info' },
    completed: { label: 'Completed', color: 'success' },
    cancelled: { label: 'Cancelled', color: 'danger' },
    late_cancel: { label: 'Late Cancellation', color: 'danger' },
    no_show: { label: 'No Show', color: 'danger' }
  }
  return statusMap[status] || { label: status, color: 'secondary' }
}

async function loadUpcoming() {
  try {
    loading.value = true
    error.value = null
    const response = await portalAppointmentsService.getUpcoming()
    upcomingAppointments.value = response.data
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to load appointments'
  } finally {
    loading.value = false
  }
}

async function loadPast(page = 1) {
  try {
    pastLoading.value = true
    const response = await portalAppointmentsService.getPast({ page, limit: 10 })
    pastAppointments.value = response.data
    pastPage.value = response.page
    pastTotalPages.value = response.totalPages
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to load past appointments'
  } finally {
    pastLoading.value = false
  }
}

async function confirmAppointment(sessionId: string) {
  try {
    confirmingId.value = sessionId
    await portalAppointmentsService.confirm(sessionId)
    await loadUpcoming()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to confirm appointment'
  } finally {
    confirmingId.value = null
  }
}

async function cancelAppointment(sessionId: string) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return

  try {
    cancellingId.value = sessionId
    await portalAppointmentsService.cancel(sessionId)
    await loadUpcoming()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to cancel appointment'
  } finally {
    cancellingId.value = null
  }
}

function switchTab(tab: 'upcoming' | 'past') {
  activeTab.value = tab
  if (tab === 'past' && pastAppointments.value.length === 0) {
    loadPast()
  }
}

onMounted(() => {
  loadUpcoming()
})
</script>

<template>
  <div class="portal-appointments">
    <h1>My Appointments</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'upcoming' }]"
        @click="switchTab('upcoming')"
      >
        Upcoming
      </button>
      <button
        :class="['tab', { active: activeTab === 'past' }]"
        @click="switchTab('past')"
      >
        Past
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading || pastLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading appointments...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="activeTab === 'upcoming' ? loadUpcoming() : loadPast()">
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="displayedAppointments.length === 0" class="empty-state">
      <div class="empty-icon">📅</div>
      <h2>{{ activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments' }}</h2>
      <p>{{ activeTab === 'upcoming' ? "You don't have any scheduled appointments." : "You don't have any past appointments." }}</p>
    </div>

    <!-- Appointments List -->
    <div v-else class="appointments-list">
      <div
        v-for="appointment in displayedAppointments"
        :key="appointment.id"
        class="appointment-card"
      >
        <div class="card-main">
          <div class="card-date">
            <span class="date-text">{{ formatDate(appointment.date) }}</span>
            <span class="time-text">
              {{ formatTime(appointment.startTime) }} - {{ formatTime(appointment.endTime) }}
            </span>
          </div>
          <div class="card-details">
            <p><strong>{{ staffLabelSingular }}:</strong> {{ appointment.therapistName }}</p>
            <p v-if="appointment.roomName"><strong>{{ roomLabelSingular }}:</strong> {{ appointment.roomName }}</p>
            <p v-if="appointment.notes"><strong>Notes:</strong> {{ appointment.notes }}</p>
          </div>
        </div>
        <div class="card-side">
          <span
            :class="['status-badge', getStatusInfo(appointment.status).color]"
          >
            {{ getStatusInfo(appointment.status).label }}
          </span>
          <div v-if="activeTab === 'upcoming'" class="card-actions">
            <button
              v-if="appointment.canConfirm"
              class="action-btn confirm"
              :disabled="confirmingId === appointment.id"
              @click="confirmAppointment(appointment.id)"
            >
              {{ confirmingId === appointment.id ? 'Confirming...' : 'Confirm' }}
            </button>
            <button
              v-if="appointment.canCancel && canCancel"
              class="action-btn cancel"
              :disabled="cancellingId === appointment.id"
              @click="cancelAppointment(appointment.id)"
            >
              {{ cancellingId === appointment.id ? 'Cancelling...' : 'Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination for Past -->
    <div v-if="activeTab === 'past' && pastTotalPages > 1" class="pagination">
      <button
        :disabled="pastPage <= 1"
        @click="loadPast(pastPage - 1)"
      >
        Previous
      </button>
      <span>Page {{ pastPage }} of {{ pastTotalPages }}</span>
      <button
        :disabled="pastPage >= pastTotalPages"
        @click="loadPast(pastPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<style scoped>
.portal-appointments {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1.5rem;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary, #64748b);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab:hover {
  color: var(--primary-color, #2563eb);
}

.tab.active {
  color: var(--primary-color, #2563eb);
  border-bottom-color: var(--primary-color, #2563eb);
}

/* Loading & Empty States */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--primary-light, #dbeafe);
  border-top-color: var(--primary-color, #2563eb);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state p {
  color: var(--danger-color, #dc2626);
  margin-bottom: 1rem;
}

.retry-btn {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
}

.empty-state p {
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* Appointments List */
.appointments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.appointment-card {
  display: flex;
  justify-content: space-between;
  background: white;
  padding: 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-date {
  margin-bottom: 0.75rem;
}

.date-text {
  display: block;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.time-text {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.card-details p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.card-details strong {
  color: var(--text-primary, #1e293b);
}

.card-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.status-badge.primary {
  background: var(--primary-light, #dbeafe);
  color: var(--primary-color, #2563eb);
}

.status-badge.success {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.warning {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.info {
  background: #e0f2fe;
  color: #0284c7;
}

.status-badge.secondary {
  background: #f1f5f9;
  color: #64748b;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.confirm {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
}

.action-btn.confirm:hover:not(:disabled) {
  background: var(--primary-hover, #1d4ed8);
}

.action-btn.cancel {
  background: white;
  color: var(--danger-color, #dc2626);
  border: 1px solid var(--danger-color, #dc2626);
}

.action-btn.cancel:hover:not(:disabled) {
  background: var(--danger-light, #fee2e2);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 640px) {
  .appointment-card {
    flex-direction: column;
    gap: 1rem;
  }

  .card-side {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }
}
</style>
