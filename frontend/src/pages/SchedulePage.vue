<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSchedulesStore } from '@/stores/schedules'
import { Button, Badge, Alert, StatCard, Tabs } from '@/components/ui'
import type { Session } from '@/types'

const schedulesStore = useSchedulesStore()

const viewMode = ref<'calendar' | 'therapist' | 'patient'>('calendar')
const selectedTherapist = ref('')

// Navigation
const weekOffset = ref(0)

const currentWeekDate = computed(() => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (weekOffset.value * 7))
  return startOfWeek
})

const weekDateRange = computed(() => {
  const start = new Date(currentWeekDate.value)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return `${formatDate(start)} - ${formatDate(end)}`
})

const weekDays = computed(() => {
  const days = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(currentWeekDate.value)
    date.setDate(date.getDate() + i)
    days.push({
      name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i],
      date: date,
      dateStr: formatShortDate(date),
      isHoliday: false // TODO: Check against holidays
    })
  }
  return days
})

const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']

const currentSchedule = computed(() => schedulesStore.currentSchedule)

const stats = computed(() => {
  if (!currentSchedule.value) {
    return { totalSessions: 0, therapistsScheduled: 0, patientsCovered: 0, coverageRate: 0 }
  }
  const sessions = currentSchedule.value.sessions || []
  const uniqueTherapists = new Set(sessions.map(s => s.therapistId || s.staffId))
  const uniquePatients = new Set(sessions.map(s => s.patientId))
  return {
    totalSessions: sessions.length,
    therapistsScheduled: uniqueTherapists.size,
    patientsCovered: uniquePatients.size,
    coverageRate: 100 // TODO: Calculate based on patient needs
  }
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function prevWeek() {
  weekOffset.value--
  loadSchedule()
}

function nextWeek() {
  weekOffset.value++
  loadSchedule()
}

function getSessionsForTimeSlot(dayIndex: number, timeSlot: string): Session[] {
  if (!currentSchedule.value?.sessions) return []
  // Filter sessions by day and time
  // This is a simplified version - in production, match against actual start times
  return currentSchedule.value.sessions.filter((session, idx) => {
    // Mock filtering - in real implementation, check session.startTime
    return idx % 5 === dayIndex && idx % 6 === timeSlots.indexOf(timeSlot)
  }).slice(0, 3)
}

function getTherapistColor(session: Session): 'blue' | 'green' {
  // In real implementation, check therapist gender
  const therapistId = session.therapistId || session.staffId
  return therapistId?.charCodeAt(0) % 2 === 0 ? 'blue' : 'green'
}

async function handleExportPdf() {
  if (currentSchedule.value) {
    await schedulesStore.exportToPdf(currentSchedule.value.id)
  }
}

async function loadSchedule() {
  const weekStart = currentWeekDate.value.toISOString().split('T')[0]
  // Find schedule for this week
  await schedulesStore.fetchSchedules()
  const schedule = schedulesStore.schedules.find(s => {
    // Handle both date string formats (YYYY-MM-DD or full ISO timestamp)
    const scheduleDate = s.weekStartDate?.split('T')[0]
    return scheduleDate === weekStart
  })
  if (schedule) {
    await schedulesStore.fetchScheduleById(schedule.id)
  } else {
    schedulesStore.clearCurrent()
  }
}

onMounted(() => {
  loadSchedule()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Weekly Schedule</h2>
        <p>
          {{ weekDateRange }}
          <Badge v-if="currentSchedule" :variant="currentSchedule.status === 'published' ? 'success' : 'warning'" style="margin-left: 8px;">
            {{ currentSchedule.status === 'published' ? 'Published' : 'Draft' }}
          </Badge>
        </p>
      </div>
      <div class="header-actions">
        <div class="calendar-nav">
          <Button variant="outline" size="sm" @click="prevWeek">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </Button>
          <Button variant="outline" size="sm" @click="nextWeek">
            Next
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
        <Button variant="outline" :disabled="!currentSchedule" @click="handleExportPdf">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </Button>
        <RouterLink to="/schedule/generate" class="btn btn-primary">
          Generate New
        </RouterLink>
      </div>
    </header>

    <div class="page-content">
      <!-- Loading State -->
      <div v-if="schedulesStore.loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading schedule...</p>
        </div>
      </div>

      <!-- Error State -->
      <Alert v-else-if="schedulesStore.error" variant="danger" class="mb-3">
        {{ schedulesStore.error }}
      </Alert>

      <!-- No Schedule State -->
      <div v-else-if="!currentSchedule" class="card">
        <div class="card-body text-center" style="padding: 48px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48" style="margin: 0 auto 16px; color: var(--text-muted);">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 style="margin-bottom: 8px;">No Schedule for This Week</h3>
          <p class="text-muted" style="margin-bottom: 24px;">Generate a new schedule to get started.</p>
          <RouterLink to="/schedule/generate" class="btn btn-primary">
            Generate Schedule
          </RouterLink>
        </div>
      </div>

      <!-- Schedule View -->
      <template v-else>
        <!-- View Toggle & Filters -->
        <div class="card mb-3">
          <div class="card-body" style="display: flex; justify-content: space-between; align-items: center;">
            <div class="view-tabs">
              <button
                :class="['view-tab', { active: viewMode === 'calendar' }]"
                @click="viewMode = 'calendar'"
              >
                Calendar View
              </button>
              <button
                :class="['view-tab', { active: viewMode === 'therapist' }]"
                @click="viewMode = 'therapist'"
              >
                By Therapist
              </button>
              <button
                :class="['view-tab', { active: viewMode === 'patient' }]"
                @click="viewMode = 'patient'"
              >
                By Patient
              </button>
            </div>
            <select v-model="selectedTherapist" class="form-control" style="width: auto;">
              <option value="">All Therapists</option>
              <!-- TODO: Populate from staff list -->
            </select>
          </div>
        </div>

        <!-- Schedule Summary Stats -->
        <div class="stats-grid mb-3">
          <StatCard
            :value="stats.totalSessions"
            label="Total Sessions"
            icon="calendar"
            color="green"
          />
          <StatCard
            :value="stats.therapistsScheduled"
            label="Therapists Scheduled"
            icon="users"
            color="blue"
          />
          <StatCard
            :value="stats.patientsCovered"
            label="Patients Covered"
            icon="patients"
            color="green"
          />
          <StatCard
            :value="`${stats.coverageRate}%`"
            label="Coverage Rate"
            icon="check"
            color="green"
          />
        </div>

        <!-- Calendar Grid -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div class="calendar-grid">
              <!-- Header Row -->
              <div class="calendar-header-cell">Time</div>
              <div
                v-for="day in weekDays"
                :key="day.name"
                class="calendar-header-cell"
                :class="{ 'holiday': day.isHoliday }"
              >
                <div>{{ day.name }}</div>
                <div class="text-sm text-muted">{{ day.dateStr }}</div>
              </div>

              <!-- Time Slot Rows -->
              <template v-for="timeSlot in timeSlots" :key="timeSlot">
                <div class="calendar-time">{{ timeSlot }}</div>
                <div
                  v-for="(day, dayIndex) in weekDays"
                  :key="`${timeSlot}-${day.name}`"
                  class="calendar-cell"
                  :class="{ 'holiday-cell': day.isHoliday }"
                >
                  <div
                    v-for="session in getSessionsForTimeSlot(dayIndex, timeSlot)"
                    :key="session.id"
                    :class="['calendar-event', getTherapistColor(session)]"
                  >
                    <div class="therapist">{{ session.therapistName || (session.therapistId || session.staffId)?.slice(0, 8) }}</div>
                    <div class="patient">{{ session.patientName || session.patientId?.slice(0, 8) }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="card-footer">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; gap: 24px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="legend-box blue"></div>
                  <span class="text-sm">Male Therapist</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="legend-box green"></div>
                  <span class="text-sm">Female Therapist</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="legend-box holiday"></div>
                  <span class="text-sm">Holiday</span>
                </div>
              </div>
              <div v-if="currentSchedule.publishedAt" class="text-sm text-muted">
                Published on {{ new Date(currentSchedule.publishedAt).toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.view-tabs {
  display: flex;
  border-bottom: none;
}

.view-tab {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.view-tab:hover {
  color: var(--text-primary);
}

.view-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(5, 1fr);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.calendar-header-cell {
  padding: 16px;
  text-align: center;
  background-color: var(--background-color);
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 14px;
}

.calendar-header-cell.holiday {
  background-color: var(--danger-light);
}

.calendar-time {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  background-color: var(--background-color);
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.calendar-cell {
  min-height: 80px;
  padding: 4px;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--card-background);
}

.calendar-cell:last-child {
  border-right: none;
}

.calendar-cell.holiday-cell {
  background-color: #fef2f2;
}

.calendar-event {
  padding: 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  margin-bottom: 4px;
  cursor: pointer;
}

.calendar-event.blue {
  background-color: var(--primary-light);
  border-left: 3px solid var(--primary-color);
}

.calendar-event.green {
  background-color: var(--success-light);
  border-left: 3px solid var(--success-color);
}

.calendar-event .therapist {
  font-weight: 500;
  color: var(--text-primary);
}

.calendar-event .patient {
  color: var(--text-secondary);
}

.legend-box {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.legend-box.blue {
  background: var(--primary-light);
  border-left: 3px solid var(--primary-color);
}

.legend-box.green {
  background: var(--success-light);
  border-left: 3px solid var(--success-color);
}

.legend-box.holiday {
  background: #fef2f2;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
