<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { portalAppointmentsService } from '@/services/api'
import type { PortalSession } from '@/types'

const router = useRouter()
const portalStore = usePortalAuthStore()

// State
const upcomingAppointments = ref<PortalSession[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const confirmingId = ref<string | null>(null)
const cancellingId = ref<string | null>(null)

// Computed
const user = computed(() => portalStore.user)
const branding = computed(() => portalStore.branding)
const canBook = computed(() => portalStore.canBook)
const canCancel = computed(() => portalStore.canCancel)
const roomLabelSingular = computed(() => branding.value?.roomLabelSingular || 'Location')

// Next appointment
const nextAppointment = computed(() => upcomingAppointments.value[0] || null)

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

// Days until appointment
function getDaysUntil(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  if (diffDays < 14) return 'Next week'
  return `In ${Math.floor(diffDays / 7)} weeks`
}

async function loadAppointments() {
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

async function confirmAppointment(sessionId: string) {
  try {
    confirmingId.value = sessionId
    await portalAppointmentsService.confirm(sessionId)
    // Reload appointments
    await loadAppointments()
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
    // Reload appointments
    await loadAppointments()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to cancel appointment'
  } finally {
    cancellingId.value = null
  }
}

function goToBooking() {
  router.push({ name: 'portal-booking' })
}

onMounted(() => {
  loadAppointments()
})
</script>

<template>
  <div class="portal-dashboard">
    <!-- Welcome Header -->
    <div class="welcome-section">
      <h1>Welcome back, {{ user?.name?.split(' ')[0] || 'there' }}!</h1>
      <p>Manage your appointments with {{ branding?.organizationName }}</p>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button v-if="canBook" class="action-btn primary" @click="goToBooking">
        <span class="action-icon">+</span>
        Book Appointment
      </button>
      <router-link :to="{ name: 'portal-appointments' }" class="action-btn secondary">
        <span class="action-icon">📅</span>
        View All Appointments
      </router-link>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading your appointments...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadAppointments">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="upcomingAppointments.length === 0" class="empty-state">
      <div class="empty-icon">📅</div>
      <h2>No Upcoming Appointments</h2>
      <p>You don't have any scheduled appointments.</p>
      <button v-if="canBook" class="book-btn" @click="goToBooking">
        Book Your First Appointment
      </button>
    </div>

    <!-- Appointments List -->
    <div v-else class="appointments-section">
      <!-- Next Appointment Highlight -->
      <div v-if="nextAppointment" class="next-appointment">
        <div class="next-header">
          <span class="next-label">Next Appointment</span>
          <span class="next-when">{{ getDaysUntil(nextAppointment.date) }}</span>
        </div>
        <div class="next-content">
          <div class="next-date">
            <span class="date-day">{{ formatDate(nextAppointment.date) }}</span>
            <span class="date-time">
              {{ formatTime(nextAppointment.startTime) }} - {{ formatTime(nextAppointment.endTime) }}
            </span>
          </div>
          <div class="next-details">
            <p><strong>With:</strong> {{ nextAppointment.therapistName }}</p>
            <p v-if="nextAppointment.roomName"><strong>{{ roomLabelSingular }}:</strong> {{ nextAppointment.roomName }}</p>
          </div>
          <div class="next-status">
            <span
              :class="['status-badge', getStatusInfo(nextAppointment.status).color]"
            >
              {{ getStatusInfo(nextAppointment.status).label }}
            </span>
          </div>
          <div class="next-actions">
            <button
              v-if="nextAppointment.canConfirm"
              class="confirm-btn"
              :disabled="confirmingId === nextAppointment.id"
              @click="confirmAppointment(nextAppointment.id)"
            >
              {{ confirmingId === nextAppointment.id ? 'Confirming...' : 'Confirm' }}
            </button>
            <button
              v-if="nextAppointment.canCancel && canCancel"
              class="cancel-btn"
              :disabled="cancellingId === nextAppointment.id"
              @click="cancelAppointment(nextAppointment.id)"
            >
              {{ cancellingId === nextAppointment.id ? 'Cancelling...' : 'Cancel' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Other Upcoming Appointments -->
      <div v-if="upcomingAppointments.length > 1" class="other-appointments">
        <h2>Other Upcoming Appointments</h2>
        <div class="appointments-list">
          <div
            v-for="appointment in upcomingAppointments.slice(1)"
            :key="appointment.id"
            class="appointment-card"
          >
            <div class="card-left">
              <div class="card-date">
                {{ formatDate(appointment.date) }}
              </div>
              <div class="card-time">
                {{ formatTime(appointment.startTime) }} - {{ formatTime(appointment.endTime) }}
              </div>
              <div class="card-therapist">
                With {{ appointment.therapistName }}
              </div>
            </div>
            <div class="card-right">
              <span
                :class="['status-badge', getStatusInfo(appointment.status).color]"
              >
                {{ getStatusInfo(appointment.status).label }}
              </span>
              <div class="card-actions">
                <button
                  v-if="appointment.canConfirm"
                  class="small-btn confirm"
                  :disabled="confirmingId === appointment.id"
                  @click="confirmAppointment(appointment.id)"
                >
                  {{ confirmingId === appointment.id ? '...' : 'Confirm' }}
                </button>
                <button
                  v-if="appointment.canCancel && canCancel"
                  class="small-btn cancel"
                  :disabled="cancellingId === appointment.id"
                  @click="cancelAppointment(appointment.id)"
                >
                  {{ cancellingId === appointment.id ? '...' : 'Cancel' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contact Section -->
    <div v-if="branding?.contactEmail || branding?.contactPhone" class="contact-section">
      <h3>Need to make changes?</h3>
      <p>Contact us directly:</p>
      <div class="contact-links">
        <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`">
          📧 {{ branding.contactEmail }}
        </a>
        <a v-if="branding?.contactPhone" :href="`tel:${branding.contactPhone}`">
          📞 {{ branding.contactPhone }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-dashboard {
  max-width: 800px;
  margin: 0 auto;
}

/* Welcome Section */
.welcome-section {
  margin-bottom: 2rem;
}

.welcome-section h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.welcome-section p {
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
}

.action-btn.primary:hover {
  background: var(--primary-hover, #1d4ed8);
}

.action-btn.secondary {
  background: white;
  color: var(--text-primary, #1e293b);
  border: 1px solid var(--border-color, #e2e8f0);
}

.action-btn.secondary:hover {
  background: var(--background-color, #f8fafc);
}

.action-icon {
  font-size: 1.125rem;
}

/* Loading & Error States */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 1rem;
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
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.empty-state p {
  color: var(--text-secondary, #64748b);
  margin: 0 0 1.5rem;
}

.book-btn {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}

/* Next Appointment */
.next-appointment {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.next-header {
  background: var(--primary-color, #2563eb);
  color: white;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.next-label {
  font-weight: 600;
}

.next-when {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
}

.next-content {
  padding: 1.5rem;
}

.next-date {
  margin-bottom: 1rem;
}

.date-day {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.date-time {
  color: var(--text-secondary, #64748b);
}

.next-details p {
  margin: 0.25rem 0;
  color: var(--text-secondary, #64748b);
}

.next-details strong {
  color: var(--text-primary, #1e293b);
}

.next-status {
  margin: 1rem 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
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

.next-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.confirm-btn,
.cancel-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-btn {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--primary-hover, #1d4ed8);
}

.cancel-btn {
  background: white;
  color: var(--danger-color, #dc2626);
  border: 1px solid var(--danger-color, #dc2626);
}

.cancel-btn:hover:not(:disabled) {
  background: var(--danger-light, #fee2e2);
}

.confirm-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Other Appointments */
.other-appointments h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1rem;
}

.appointments-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.appointment-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-date {
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.card-time,
.card-therapist {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.small-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.small-btn.confirm {
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
}

.small-btn.cancel {
  background: white;
  color: var(--danger-color, #dc2626);
  border: 1px solid var(--danger-color, #dc2626);
}

.small-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Contact Section */
.contact-section {
  margin-top: 3rem;
  padding: 1.5rem;
  background: var(--primary-light, #dbeafe);
  border-radius: 0.75rem;
  text-align: center;
}

.contact-section h3 {
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.25rem;
}

.contact-section p {
  color: var(--text-secondary, #64748b);
  margin: 0 0 1rem;
}

.contact-links {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.contact-links a {
  color: var(--primary-color, #2563eb);
  text-decoration: none;
  font-weight: 500;
}

.contact-links a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 640px) {
  .quick-actions {
    flex-direction: column;
  }

  .appointment-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .card-right {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .contact-links {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
