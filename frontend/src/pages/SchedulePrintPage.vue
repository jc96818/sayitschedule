<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSchedulesStore } from '@/stores/schedules'
import { useStaffStore } from '@/stores/staff'
import { useAuthStore } from '@/stores/auth'
import { getFederalHoliday } from '@/utils/holidays'
import type { Session } from '@/types'

const route = useRoute()
const schedulesStore = useSchedulesStore()
const staffStore = useStaffStore()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')

const schedule = computed(() => schedulesStore.currentSchedule)
const organization = computed(() => authStore.organization)

// Calculate week dates from schedule
const weekStart = computed(() => {
  if (!schedule.value?.weekStartDate) return new Date()
  return new Date(schedule.value.weekStartDate)
})

const weekEnd = computed(() => {
  const end = new Date(weekStart.value)
  end.setDate(end.getDate() + 4)
  return end
})

const weekDays = computed(() => {
  const days = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart.value)
    date.setDate(date.getDate() + i)
    const holidayName = getFederalHoliday(date)
    days.push({
      name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i],
      shortName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
      date: date,
      dateStr: formatShortDate(date),
      isHoliday: holidayName !== null,
      holidayName: holidayName
    })
  }
  return days
})

const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']

// Stats
const stats = computed(() => {
  if (!schedule.value?.sessions) {
    return { totalSessions: 0, therapistsScheduled: 0, patientsCovered: 0 }
  }
  const sessions = schedule.value.sessions
  const uniqueTherapists = new Set(sessions.map(s => s.therapistId || s.staffId))
  const uniquePatients = new Set(sessions.map(s => s.patientId))
  return {
    totalSessions: sessions.length,
    therapistsScheduled: uniqueTherapists.size,
    patientsCovered: uniquePatients.size
  }
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function parseTimeSlot(timeSlot: string): string {
  const match = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return ''
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === 'PM' && hours !== 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${minutes}`
}

function formatSessionDate(dateStr: string): string {
  return dateStr.split('T')[0]
}

function formatWeekDayDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getSessionsForTimeSlot(dayIndex: number, timeSlot: string): Session[] {
  if (!schedule.value?.sessions) return []

  const targetDate = formatWeekDayDate(weekDays.value[dayIndex].date)
  const targetTime = parseTimeSlot(timeSlot)

  return schedule.value.sessions.filter((session) => {
    const sessionDate = formatSessionDate(session.date)
    const sessionTime = session.startTime?.slice(0, 5)
    return sessionDate === targetDate && sessionTime === targetTime
  })
}


function handlePrint() {
  window.print()
}

function handleClose() {
  window.close()
}

onMounted(async () => {
  try {
    const id = route.params.id as string
    if (id) {
      await schedulesStore.fetchScheduleById(id)
      await staffStore.fetchStaff()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load schedule'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="print-page">
    <!-- Print Controls (hidden when printing) -->
    <div class="print-controls no-print">
      <button class="btn-print" @click="handlePrint">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print Schedule
      </button>
      <button class="btn-close" @click="handleClose">Close</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Loading schedule...</div>

    <!-- Error -->
    <div v-else-if="error" class="error">{{ error }}</div>

    <!-- Print Content -->
    <div v-else-if="schedule" class="print-content">
      <!-- Header -->
      <header class="print-header">
        <div class="header-left">
          <h1 class="org-name">{{ organization?.name || 'Schedule' }}</h1>
          <div class="schedule-title">
            Weekly Schedule: {{ formatDate(weekStart) }} - {{ formatDate(weekEnd) }}
          </div>
        </div>
        <div class="header-right">
          <span class="status-badge" :class="schedule.status">
            {{ schedule.status === 'published' ? 'Published' : 'Draft' }}
          </span>
          <div v-if="schedule.version > 1" class="version">v{{ schedule.version }}</div>
        </div>
      </header>

      <!-- Schedule Grid -->
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="time-col">Time</th>
            <th
              v-for="day in weekDays"
              :key="day.name"
              class="day-col"
              :class="{ holiday: day.isHoliday }"
            >
              <div class="day-name">{{ day.shortName }}</div>
              <div class="day-date">{{ day.dateStr }}</div>
              <div v-if="day.isHoliday" class="holiday-name">{{ day.holidayName }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="timeSlot in timeSlots" :key="timeSlot">
            <td class="time-cell">{{ timeSlot }}</td>
            <td
              v-for="(day, dayIndex) in weekDays"
              :key="`${timeSlot}-${day.name}`"
              class="session-cell"
              :class="{ 'holiday-cell': day.isHoliday }"
            >
              <div
                v-for="session in getSessionsForTimeSlot(dayIndex, timeSlot)"
                :key="session.id"
                class="session"
              >
                <div class="therapist-name">{{ session.therapistName || 'Unknown' }}</div>
                <div class="patient-name">{{ session.patientName || 'Unknown' }}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Footer -->
      <footer class="print-footer">
        <div class="stats">
          <span>Sessions: {{ stats.totalSessions }}</span>
          <span class="divider">|</span>
          <span>Therapists: {{ stats.therapistsScheduled }}</span>
          <span class="divider">|</span>
          <span>Patients: {{ stats.patientsCovered }}</span>
        </div>
        <div class="generated">
          Generated {{ new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
        </div>
      </footer>
    </div>
  </div>
</template>

<style>
/* Print Page Styles - Optimized for one landscape page */
@page {
  size: landscape;
  margin: 0.4in;
}

.print-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11px;
  color: #1e293b;
  background: white;
  min-height: 100vh;
  padding: 20px;
}

/* Print controls - hidden when printing */
.print-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.btn-print {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-print:hover {
  background: #1d4ed8;
}

.btn-close {
  padding: 10px 20px;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-close:hover {
  background: #f8fafc;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  color: #64748b;
}

.error {
  color: #ef4444;
}

/* Print content */
.print-content {
  max-width: 100%;
}

/* Header */
.print-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #2563eb;
}

.org-name {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.schedule-title {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.published {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.status-badge.draft {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
}

.version {
  font-size: 10px;
  color: #94a3b8;
}

/* Schedule Table */
.schedule-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.schedule-table th,
.schedule-table td {
  border: 1px solid #e2e8f0;
  padding: 4px;
  vertical-align: top;
}

.schedule-table th {
  background: #f8fafc;
  font-weight: 600;
  text-align: center;
}

.time-col {
  width: 60px;
}

.day-col {
  width: calc((100% - 60px) / 5);
}

.day-col.holiday {
  background: #fef2f2;
}

.day-name {
  font-size: 11px;
  font-weight: 700;
}

.day-date {
  font-size: 9px;
  color: #64748b;
}

.holiday-name {
  font-size: 8px;
  color: #dc2626;
  font-style: italic;
}

.time-cell {
  text-align: center;
  font-weight: 500;
  font-size: 10px;
  color: #64748b;
  background: #f8fafc;
}

.session-cell {
  min-height: 45px;
  padding: 2px !important;
}

.session-cell.holiday-cell {
  background: #fefafa;
}

/* Session cards - minimal ink design */
.session {
  padding: 3px 5px;
  margin-bottom: 2px;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
  background: #fafafa;
}

.therapist-name {
  font-weight: 600;
  font-size: 9px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.patient-name {
  font-size: 8px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.print-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  font-size: 9px;
  color: #64748b;
}

.stats {
  display: flex;
  gap: 4px;
}

.divider {
  color: #cbd5e1;
}

.generated {
  font-style: italic;
}

/* Print-specific styles */
@media print {
  .no-print {
    display: none !important;
  }

  .print-page {
    padding: 0;
    min-height: auto;
  }

  .print-content {
    page-break-inside: avoid;
  }

  .schedule-table {
    page-break-inside: avoid;
  }
}

/* Screen preview adjustments */
@media screen {
  .print-content {
    max-width: 1100px;
    margin: 0 auto;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 20px;
    border-radius: 8px;
    background: white;
  }
}
</style>
