<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { portalBookingService } from '@/services/api'
import type { PortalAvailabilitySlot, PortalBookingHold, PortalBookingSettings } from '@/types'

const router = useRouter()
const portalStore = usePortalAuthStore()

// State
const step = ref<'select' | 'confirm' | 'success'>('select')
const settings = ref<PortalBookingSettings | null>(null)
const therapists = ref<Array<{ id: string; name: string }>>([])
const availability = ref<PortalAvailabilitySlot[]>([])
const selectedTherapist = ref<string>('')
const selectedDate = ref('')
const selectedSlot = ref<PortalAvailabilitySlot | null>(null)
const currentHold = ref<PortalBookingHold | null>(null)
const notes = ref('')

// Loading states
const loadingSettings = ref(true)
const loadingTherapists = ref(false)
const loadingAvailability = ref(false)
const creatingHold = ref(false)
const booking = ref(false)

// Error
const error = ref<string | null>(null)

// Hold countdown
const holdExpiresIn = ref(0)
let holdTimer: ReturnType<typeof setInterval> | null = null

// Computed
const branding = computed(() => portalStore.branding)
const staffLabelSingular = computed(() => branding.value?.staffLabelSingular || 'Therapist')
const staffLabelSingularLower = computed(() => staffLabelSingular.value.toLowerCase())
const roomLabelSingular = computed(() => branding.value?.roomLabelSingular || 'Location')

const dateMin = computed(() => {
  if (!settings.value) return ''
  return settings.value.earliestBookingDate
})

const dateMax = computed(() => {
  if (!settings.value) return ''
  return settings.value.latestBookingDate
})

const groupedAvailability = computed(() => {
  // Group slots by date
  const groups: Record<string, PortalAvailabilitySlot[]> = {}
  for (const slot of availability.value) {
    if (!groups[slot.date]) {
      groups[slot.date] = []
    }
    groups[slot.date].push(slot)
  }
  return groups
})

const selectedDateSlots = computed(() => {
  if (!selectedDate.value) return []
  return groupedAvailability.value[selectedDate.value] || []
})

// Format functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

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

function formatHoldTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Load booking settings
async function loadSettings() {
  try {
    loadingSettings.value = true
    error.value = null
    const response = await portalBookingService.getSettings()
    settings.value = response.data

    if (!response.data.selfBookingEnabled) {
      error.value = 'Self-booking is not enabled for this organization.'
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to load booking settings'
  } finally {
    loadingSettings.value = false
  }
}

// Load therapists
async function loadTherapists() {
  try {
    loadingTherapists.value = true
    const response = await portalBookingService.getTherapists()
    therapists.value = response.data
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to load therapists'
  } finally {
    loadingTherapists.value = false
  }
}

// Load availability
async function loadAvailability() {
  if (!selectedDate.value) return

  // Calculate date range (1 week from selected date)
  const startDate = new Date(selectedDate.value)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const params: { dateFrom: string; dateTo: string; staffId?: string } = {
    dateFrom: selectedDate.value,
    dateTo: endDate.toISOString().split('T')[0]
  }

  if (selectedTherapist.value) {
    params.staffId = selectedTherapist.value
  }

  try {
    loadingAvailability.value = true
    error.value = null
    const response = await portalBookingService.getAvailability(params)
    availability.value = response.data
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to load availability'
  } finally {
    loadingAvailability.value = false
  }
}

// Select a slot and create hold
async function selectSlot(slot: PortalAvailabilitySlot) {
  selectedSlot.value = slot

  try {
    creatingHold.value = true
    error.value = null

    const response = await portalBookingService.createHold({
      staffId: slot.staffId,
      roomId: slot.roomId || undefined,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime
    })

    currentHold.value = response.data
    step.value = 'confirm'

    // Start hold countdown
    startHoldCountdown()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to reserve time slot'
    selectedSlot.value = null
  } finally {
    creatingHold.value = false
  }
}

// Start countdown timer for hold
function startHoldCountdown() {
  if (!currentHold.value) return

  const expiresAt = new Date(currentHold.value.expiresAt).getTime()
  const updateCountdown = () => {
    const now = Date.now()
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
    holdExpiresIn.value = remaining

    if (remaining <= 0) {
      // Hold expired
      handleHoldExpired()
    }
  }

  updateCountdown()
  holdTimer = setInterval(updateCountdown, 1000)
}

function stopHoldCountdown() {
  if (holdTimer) {
    clearInterval(holdTimer)
    holdTimer = null
  }
}

function handleHoldExpired() {
  stopHoldCountdown()
  currentHold.value = null
  selectedSlot.value = null
  step.value = 'select'
  error.value = 'Your reservation expired. Please select a new time slot.'
}

// Cancel hold and go back
async function cancelHold() {
  if (currentHold.value) {
    try {
      await portalBookingService.releaseHold(currentHold.value.id)
    } catch {
      // Ignore errors when releasing hold
    }
  }

  stopHoldCountdown()
  currentHold.value = null
  selectedSlot.value = null
  step.value = 'select'
}

// Confirm booking
async function confirmBooking() {
  if (!currentHold.value) return

  try {
    booking.value = true
    error.value = null

    await portalBookingService.book(currentHold.value.id, notes.value || undefined)

    stopHoldCountdown()
    step.value = 'success'
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Failed to complete booking'
  } finally {
    booking.value = false
  }
}

function goToDashboard() {
  router.push({ name: 'portal-dashboard' })
}

// Watch for date/therapist changes to reload availability
watch([selectedDate, selectedTherapist], () => {
  if (selectedDate.value) {
    loadAvailability()
  }
})

onMounted(async () => {
  await loadSettings()
  if (settings.value?.selfBookingEnabled) {
    await loadTherapists()
    // Set initial date to earliest booking date
    if (settings.value.earliestBookingDate) {
      selectedDate.value = settings.value.earliestBookingDate
    }
  }
})

// Cleanup on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  stopHoldCountdown()
})
</script>

<template>
  <div class="portal-booking">
    <h1>Book an Appointment</h1>

    <!-- Loading -->
    <div v-if="loadingSettings" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading booking options...</p>
    </div>

    <!-- Self-booking disabled -->
    <div v-else-if="!settings?.selfBookingEnabled" class="disabled-state">
      <div class="disabled-icon">🔒</div>
      <h2>Online Booking Unavailable</h2>
      <p>Online self-booking is not currently available. Please contact us to schedule an appointment.</p>
      <div v-if="branding?.contactPhone || branding?.contactEmail" class="contact-info">
        <a v-if="branding?.contactPhone" :href="`tel:${branding.contactPhone}`">
          📞 {{ branding.contactPhone }}
        </a>
        <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`">
          📧 {{ branding.contactEmail }}
        </a>
      </div>
    </div>

    <!-- Step 1: Select Time Slot -->
    <div v-else-if="step === 'select'" class="booking-step select-step">
      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Preferred {{ staffLabelSingular }} (Optional)</label>
          <select v-model="selectedTherapist" :disabled="loadingTherapists">
            <option value="">Any Available {{ staffLabelSingular }}</option>
            <option v-for="t in therapists" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Select Date</label>
          <input
            v-model="selectedDate"
            type="date"
            :min="dateMin"
            :max="dateMax"
          />
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="error-message">
        {{ error }}
        <button class="dismiss-btn" @click="error = null">×</button>
      </div>

      <!-- Loading Availability -->
      <div v-if="loadingAvailability" class="loading-inline">
        <div class="loading-spinner small"></div>
        <span>Loading available times...</span>
      </div>

      <!-- No Availability -->
      <div v-else-if="selectedDate && selectedDateSlots.length === 0" class="no-slots">
        <p>No available time slots on this date. Try selecting a different date or {{ staffLabelSingularLower }}.</p>
      </div>

      <!-- Available Slots -->
      <div v-else-if="selectedDateSlots.length > 0" class="slots-section">
        <h2>Available Times for {{ formatDate(selectedDate) }}</h2>
        <div class="slots-grid">
          <button
            v-for="slot in selectedDateSlots"
            :key="`${slot.date}-${slot.startTime}-${slot.staffId}`"
            class="slot-btn"
            :disabled="creatingHold"
            @click="selectSlot(slot)"
          >
            <span class="slot-time">{{ formatTime(slot.startTime) }}</span>
            <span class="slot-therapist">{{ slot.staffName }}</span>
            <span v-if="slot.roomName" class="slot-room">{{ slot.roomName }}</span>
          </button>
        </div>
      </div>

      <!-- Booking Policy -->
      <div v-if="settings" class="booking-policy">
        <h3>Booking Policy</h3>
        <ul>
          <li>Appointments must be booked at least {{ settings.leadTimeHours }} hours in advance</li>
          <li>You can book up to {{ settings.maxFutureDays }} days ahead</li>
          <li v-if="settings.requiresApproval">Bookings require staff approval</li>
        </ul>
      </div>
    </div>

    <!-- Step 2: Confirm Booking -->
    <div v-else-if="step === 'confirm'" class="booking-step confirm-step">
      <!-- Hold Timer -->
      <div class="hold-timer">
        <span class="timer-icon">⏱️</span>
        <span>Reserved for {{ formatHoldTime(holdExpiresIn) }}</span>
      </div>

      <div class="confirmation-card">
        <h2>Confirm Your Appointment</h2>

        <div class="appointment-details">
          <div class="detail-row">
            <span class="label">Date:</span>
            <span class="value">{{ formatDate(currentHold!.date) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Time:</span>
            <span class="value">{{ formatTime(currentHold!.startTime) }} - {{ formatTime(currentHold!.endTime) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ staffLabelSingular }}:</span>
            <span class="value">{{ currentHold!.staffName }}</span>
          </div>
          <div v-if="currentHold!.roomName" class="detail-row">
            <span class="label">{{ roomLabelSingular }}:</span>
            <span class="value">{{ currentHold!.roomName }}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="notes-section">
          <label for="notes">Notes (Optional)</label>
          <textarea
            id="notes"
            v-model="notes"
            placeholder="Any special requests or information for your appointment..."
            rows="3"
          ></textarea>
        </div>

        <!-- Approval Notice -->
        <div v-if="settings?.requiresApproval" class="approval-notice">
          <span class="notice-icon">ℹ️</span>
          <span>This booking requires staff approval. You'll be notified once confirmed.</span>
        </div>

        <!-- Error -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="confirm-actions">
          <button class="cancel-btn" :disabled="booking" @click="cancelHold">
            Go Back
          </button>
          <button class="confirm-btn" :disabled="booking" @click="confirmBooking">
            {{ booking ? 'Booking...' : 'Confirm Booking' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Step 3: Success -->
    <div v-else-if="step === 'success'" class="booking-step success-step">
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h2>Booking {{ settings?.requiresApproval ? 'Submitted' : 'Confirmed' }}!</h2>
        <p v-if="settings?.requiresApproval">
          Your appointment request has been submitted and is pending approval. You'll receive a notification once it's confirmed.
        </p>
        <p v-else>
          Your appointment has been confirmed. You'll receive a confirmation shortly.
        </p>
        <button class="dashboard-btn" @click="goToDashboard">
          View My Appointments
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-booking {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1.5rem;
}

/* Loading & Disabled States */
.loading-state,
.disabled-state {
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

.loading-spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.disabled-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.disabled-state h2 {
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.disabled-state p {
  color: var(--text-secondary, #64748b);
  margin: 0 0 1.5rem;
}

.contact-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.contact-info a {
  color: var(--primary-color, #2563eb);
  text-decoration: none;
}

/* Filters */
.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.filter-group {
  flex: 1;
}

.filter-group label {
  display: block;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.filter-group select,
.filter-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  font-size: 1rem;
}

/* Error */
.error-message {
  background: var(--danger-light, #fee2e2);
  color: var(--danger-color, #dc2626);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dismiss-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: inherit;
}

/* Loading Inline */
.loading-inline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
}

/* No Slots */
.no-slots {
  text-align: center;
  padding: 2rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
  color: var(--text-secondary, #64748b);
}

/* Slots Section */
.slots-section h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1rem;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.slot-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slot-btn:hover:not(:disabled) {
  border-color: var(--primary-color, #2563eb);
  background: var(--primary-light, #dbeafe);
}

.slot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot-time {
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  margin-bottom: 0.25rem;
}

.slot-therapist {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.slot-room {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
}

/* Booking Policy */
.booking-policy {
  margin-top: 2rem;
  padding: 1rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
}

.booking-policy h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.booking-policy ul {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.booking-policy li {
  margin: 0.25rem 0;
}

/* Confirm Step */
.hold-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef3c7;
  color: #d97706;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.confirmation-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.confirmation-card h2 {
  font-size: 1.25rem;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1.5rem;
}

.appointment-details {
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  width: 100px;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.detail-row .value {
  flex: 1;
  color: var(--text-primary, #1e293b);
  font-weight: 500;
}

.notes-section {
  margin-bottom: 1.5rem;
}

.notes-section label {
  display: block;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.notes-section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  resize: vertical;
  font-family: inherit;
}

.approval-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.confirm-actions {
  display: flex;
  gap: 1rem;
}

.cancel-btn {
  flex: 1;
  padding: 0.75rem;
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}

.confirm-btn {
  flex: 2;
  padding: 0.75rem;
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}

.confirm-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Success Step */
.success-card {
  text-align: center;
  background: white;
  border-radius: 0.75rem;
  padding: 3rem 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto 1.5rem;
}

.success-card h2 {
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.success-card p {
  color: var(--text-secondary, #64748b);
  margin: 0 0 1.5rem;
}

.dashboard-btn {
  padding: 0.75rem 2rem;
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 640px) {
  .filters {
    flex-direction: column;
  }

  .slots-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
