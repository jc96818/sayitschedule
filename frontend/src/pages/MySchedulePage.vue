<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSchedulesStore } from '@/stores/schedules'
import { useAvailabilityStore } from '@/stores/availability'
import { staffService } from '@/services/api'
import { Alert, Badge } from '@/components/ui'
import { AvailabilityCalendar, TimeOffRequestModal } from '@/components/availability'
import { useLabels } from '@/composables/useLabels'
import type { Staff, StaffAvailability, Session } from '@/types'

const { staffLabelSingular } = useLabels()
const scheduleStore = useSchedulesStore()
const availabilityStore = useAvailabilityStore()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const myStaffProfile = ref<Staff | null>(null)
const showTimeOffModal = ref(false)
const selectedDate = ref<Date | undefined>(undefined)
const selectedAvailability = ref<StaffAvailability | null>(null)
const activeTab = ref<'schedule' | 'availability'>('schedule')

// Computed
const currentSchedule = computed(() => scheduleStore.currentSchedule)
const mySessions = computed(() => {
  if (!currentSchedule.value?.sessions || !myStaffProfile.value) return []
  return currentSchedule.value.sessions
    .filter((s: Session) => s.therapistId === myStaffProfile.value?.id)
    .sort((a: Session, b: Session) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.startTime.localeCompare(b.startTime)
    })
})

const sessionsByDay = computed(() => {
  const days: Record<string, Session[]> = {}
  mySessions.value.forEach(session => {
    if (!days[session.date]) {
      days[session.date] = []
    }
    days[session.date].push(session)
  })
  return days
})

const weekStartDate = computed(() => {
  if (!currentSchedule.value?.weekStartDate) return null
  return new Date(currentSchedule.value.weekStartDate)
})

const defaultHours = computed(() => myStaffProfile.value?.defaultHours)

const dayLabels: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday'
}

// Format functions
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
}

function formatTimeRange(start: string, end: string): string {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }
  return `${formatTime(start)} - ${formatTime(end)}`
}

function formatDefaultTimeRange(hours: { start: string; end: string } | null): string {
  if (!hours) return 'Off'
  return `${hours.start} - ${hours.end}`
}

// Handlers
function handleAddRequest(date: Date) {
  selectedDate.value = date
  selectedAvailability.value = null
  showTimeOffModal.value = true
}

function handleEditRequest(availability: StaffAvailability) {
  selectedDate.value = undefined
  selectedAvailability.value = availability
  showTimeOffModal.value = true
}

async function handleAvailabilitySaved() {
  if (myStaffProfile.value) {
    await availabilityStore.fetchByStaffId(myStaffProfile.value.id)
  }
}

// Load data
async function loadData() {
  loading.value = true
  error.value = null

  try {
    // Get linked staff profile
    const response = await staffService.getMyProfile()
    myStaffProfile.value = response.data

    // Load current published schedule
    await scheduleStore.fetchSchedules({ status: 'published' })
    if (scheduleStore.schedules.length > 0) {
      // Get the most recent published schedule
      const sortedSchedules = [...scheduleStore.schedules].sort((a, b) =>
        new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
      )
      const latestSchedule = sortedSchedules[0]
      await scheduleStore.fetchScheduleById(latestSchedule.id)
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('404') || e.message.includes('No staff profile')) {
        error.value = 'Your account is not linked to a staff profile. Please contact your administrator.'
      } else {
        error.value = e.message
      }
    } else {
      error.value = 'Failed to load your schedule'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>My Schedule</h2>
        <p class="header-subtitle">View your sessions and manage time off</p>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="error" variant="danger" class="mb-3">
        {{ error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading your schedule...</p>
        </div>
      </div>

      <!-- No Staff Profile -->
      <div v-else-if="!myStaffProfile" class="card">
        <div class="card-body text-center">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3>No {{ staffLabelSingular }} Profile Linked</h3>
            <p>Your account is not linked to a {{ staffLabelSingular.toLowerCase() }} profile. Please contact your administrator to set this up.</p>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Profile Summary Card -->
        <div class="card profile-summary-card">
          <div class="card-body">
            <div class="profile-summary">
              <div class="profile-avatar">
                {{ myStaffProfile.name.charAt(0).toUpperCase() }}
              </div>
              <div class="profile-info">
                <h3>{{ myStaffProfile.name }}</h3>
                <p v-if="myStaffProfile.email">{{ myStaffProfile.email }}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'schedule' }"
            @click="activeTab = 'schedule'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            My Sessions
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'availability' }"
            @click="activeTab = 'availability'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Availability & Time Off
          </button>
        </div>

        <!-- Schedule Tab -->
        <div v-if="activeTab === 'schedule'" class="tab-content">
          <!-- Current Week Schedule -->
          <div class="card">
            <div class="card-header">
              <h3>Current Week Schedule</h3>
              <p v-if="weekStartDate" class="card-header-subtitle">
                Week of {{ weekStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
              </p>
            </div>
            <div class="card-body">
              <div v-if="mySessions.length === 0" class="empty-state-small">
                <p>No sessions scheduled for this week.</p>
              </div>
              <div v-else class="sessions-list">
                <div v-for="(sessions, date) in sessionsByDay" :key="date" class="day-group">
                  <h4 class="day-header">{{ formatDate(date) }}</h4>
                  <div class="sessions-grid">
                    <div v-for="session in sessions" :key="session.id" class="session-card">
                      <div class="session-time">
                        {{ formatTimeRange(session.startTime, session.endTime) }}
                      </div>
                      <div class="session-details">
                        <span class="patient-name">{{ session.patientName }}</span>
                        <span v-if="session.roomName" class="room-name">{{ session.roomName }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Default Working Hours -->
          <div class="card">
            <div class="card-header">
              <h3>Default Working Hours</h3>
            </div>
            <div class="card-body">
              <div class="hours-grid">
                <div
                  v-for="(label, day) in dayLabels"
                  :key="day"
                  class="hours-item"
                >
                  <span class="day-label">{{ label }}</span>
                  <span class="time-range">
                    {{ formatDefaultTimeRange(defaultHours?.[day as keyof typeof defaultHours] || null) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Availability Tab -->
        <div v-if="activeTab === 'availability'" class="tab-content">
          <!-- Time Off Request Instructions -->
          <div class="card info-card">
            <div class="card-body">
              <div class="info-content">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4>Request Time Off</h4>
                  <p>Click on any future date in the calendar to request time off. Your request will be sent to your administrator for approval.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Availability Calendar -->
          <div class="card">
            <div class="card-header">
              <h3>Time Off & Availability Calendar</h3>
            </div>
            <div class="card-body">
              <AvailabilityCalendar
                :staff-id="myStaffProfile.id"
                @add-request="handleAddRequest"
                @edit-request="handleEditRequest"
              />
            </div>
          </div>

          <!-- Pending Requests Summary -->
          <div class="card">
            <div class="card-header">
              <h3>My Pending Requests</h3>
            </div>
            <div class="card-body">
              <div v-if="availabilityStore.availability.filter(a => a.status === 'pending').length === 0" class="empty-state-small">
                <p>No pending time-off requests.</p>
              </div>
              <div v-else class="pending-requests">
                <div
                  v-for="request in availabilityStore.availability.filter(a => a.status === 'pending')"
                  :key="request.id"
                  class="pending-request-item"
                  @click="handleEditRequest(request)"
                >
                  <div class="request-date">
                    {{ formatDate(request.date) }}
                  </div>
                  <div class="request-info">
                    <span v-if="request.reason" class="request-reason">{{ request.reason }}</span>
                    <span v-else class="request-reason text-muted">No reason provided</span>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Time Off Request Modal -->
    <TimeOffRequestModal
      v-if="myStaffProfile"
      v-model="showTimeOffModal"
      :staff-id="myStaffProfile.id"
      :date="selectedDate"
      :availability="selectedAvailability"
      @saved="handleAvailabilitySaved"
    />
  </div>
</template>

<style scoped>
.header {
  height: auto;
  min-height: var(--header-height);
  padding: 16px 24px;
}

.header-subtitle {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.profile-summary-card {
  margin-bottom: 24px;
}

.profile-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
}

.profile-info h3 {
  margin: 0 0 4px;
  font-size: 1.125rem;
}

.profile-info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.tabs-container {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 16px;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  background: var(--background-color);
  color: var(--text-primary);
}

.tab-button.active {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card-header-subtitle {
  margin: 4px 0 0;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-muted);
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state svg {
  margin-bottom: 16px;
  color: var(--text-muted);
}

.empty-state h3 {
  margin: 0 0 8px;
}

.empty-state p {
  margin: 0;
  max-width: 400px;
  margin-inline: auto;
}

.empty-state-small {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state-small p {
  margin: 0;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.day-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-header {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.session-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--background-color);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.session-time {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  white-space: nowrap;
}

.session-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.patient-name {
  font-weight: 500;
}

.room-name {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.hours-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.hours-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  text-align: center;
}

.day-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.time-range {
  font-weight: 500;
}

.info-card {
  background: var(--primary-light);
  border-color: var(--primary-color);
}

.info-content {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.info-content svg {
  flex-shrink: 0;
  color: var(--primary-color);
}

.info-content h4 {
  margin: 0 0 4px;
  font-size: 0.875rem;
}

.info-content p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pending-requests {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-request-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--background-color);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.pending-request-item:hover {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.request-date {
  font-weight: 500;
  white-space: nowrap;
}

.request-info {
  flex: 1;
}

.request-reason {
  font-size: 0.875rem;
}

.text-muted {
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .hours-grid {
    grid-template-columns: 1fr;
  }

  .tabs-container {
    flex-direction: column;
  }

  .tab-button {
    width: 100%;
    justify-content: center;
  }

  .sessions-grid {
    grid-template-columns: 1fr;
  }

  .profile-summary {
    flex-direction: column;
    text-align: center;
  }
}
</style>
