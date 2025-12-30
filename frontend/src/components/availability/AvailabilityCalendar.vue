<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAvailabilityStore } from '@/stores/availability'
import type { StaffAvailability } from '@/types'

const props = defineProps<{
  staffId: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'add-request': [date: Date]
  'edit-request': [availability: StaffAvailability]
}>()

const availabilityStore = useAvailabilityStore()

// Current month state
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

// Month name for display
const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

// Generate calendar days
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  // First day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDay = new Date(year, month, 1).getDay()
  // Number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Number of days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days: Array<{
    date: Date
    day: number
    isCurrentMonth: boolean
    isToday: boolean
    isWeekend: boolean
    availability: StaffAvailability | null
  }> = []

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const date = new Date(year, month - 1, day)
    days.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      availability: null
    })
  }

  // Current month days
  const today = new Date()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDateForComparison(date)
    const availability = availabilityStore.availability.find(
      a => formatDateForComparison(new Date(a.date)) === dateStr
    )

    days.push({
      date,
      day,
      isCurrentMonth: true,
      isToday:
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      availability: availability || null
    })
  }

  // Next month days (fill to 6 rows)
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day)
    days.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      availability: null
    })
  }

  return days
})

// Week day headers
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Format date for comparison (YYYY-MM-DD)
function formatDateForComparison(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Navigate to previous month
function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

// Navigate to next month
function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

// Navigate to today
function goToToday() {
  currentDate.value = new Date()
}

// Handle day click
function handleDayClick(day: typeof calendarDays.value[0]) {
  if (!day.isCurrentMonth || props.readonly) return

  // Don't allow selecting weekends or past dates
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (day.isWeekend || day.date < today) return

  if (day.availability) {
    emit('edit-request', day.availability)
  } else {
    emit('add-request', day.date)
  }
}

// Get status color for availability
function getStatusColor(availability: StaffAvailability): string {
  if (availability.status === 'pending') return 'bg-yellow-100 border-yellow-400'
  if (availability.status === 'rejected') return 'bg-red-100 border-red-400'
  if (!availability.available) return 'bg-gray-200 border-gray-400'
  return 'bg-blue-100 border-blue-400'
}

// Get status label
function getStatusLabel(availability: StaffAvailability): string {
  if (availability.status === 'pending') return 'Pending'
  if (availability.status === 'rejected') return 'Rejected'
  if (!availability.available) {
    if (availability.startTime && availability.endTime) {
      return `${availability.startTime}-${availability.endTime}`
    }
    return 'Off'
  }
  return 'Available'
}

// Fetch availability when staffId changes
watch(
  () => props.staffId,
  async (newStaffId) => {
    if (newStaffId) {
      const startDate = new Date(currentYear.value, currentMonth.value - 1, 1)
      const endDate = new Date(currentYear.value, currentMonth.value + 2, 0)
      await availabilityStore.fetchByStaffId(newStaffId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
    }
  },
  { immediate: true }
)

// Refresh when month changes
watch(currentDate, async () => {
  if (props.staffId) {
    const startDate = new Date(currentYear.value, currentMonth.value - 1, 1)
    const endDate = new Date(currentYear.value, currentMonth.value + 2, 0)
    await availabilityStore.fetchByStaffId(props.staffId, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    })
  }
})
</script>

<template>
  <div class="availability-calendar">
    <!-- Header -->
    <div class="calendar-header">
      <button type="button" class="nav-btn" @click="prevMonth">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="month-title">
        <h3>{{ monthName }}</h3>
        <button type="button" class="today-btn" @click="goToToday">Today</button>
      </div>
      <button type="button" class="nav-btn" @click="nextMonth">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- Week day headers -->
    <div class="weekday-headers">
      <div v-for="day in weekDays" :key="day" class="weekday-header">
        {{ day }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'weekend': day.isWeekend,
          'has-availability': day.availability,
          'clickable': day.isCurrentMonth && !readonly && !day.isWeekend
        }"
        @click="handleDayClick(day)"
      >
        <span class="day-number">{{ day.day }}</span>
        <div
          v-if="day.availability"
          class="availability-indicator"
          :class="getStatusColor(day.availability)"
        >
          {{ getStatusLabel(day.availability) }}
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="calendar-legend">
      <div class="legend-item">
        <span class="legend-dot pending"></span>
        <span>Pending</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot approved"></span>
        <span>Approved Time Off</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot rejected"></span>
        <span>Rejected</span>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="availabilityStore.loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style scoped>
.availability-calendar {
  position: relative;
  background: var(--card-background, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 1rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-btn:hover {
  background: var(--background-color, #f3f4f6);
}

.month-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.month-title h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.today-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.today-btn:hover {
  background: var(--background-color, #f3f4f6);
}

.weekday-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 0.5rem;
}

.weekday-header {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted, #6b7280);
  padding: 0.5rem 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day {
  aspect-ratio: 1;
  min-height: 60px;
  padding: 0.25rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--card-background, #fff);
}

.calendar-day.other-month {
  background: var(--background-color, #f9fafb);
  opacity: 0.5;
}

.calendar-day.today {
  border-color: var(--primary-color, #2563eb);
  border-width: 2px;
}

.calendar-day.weekend {
  background: var(--background-color, #f9fafb);
}

.calendar-day.clickable {
  cursor: pointer;
}

.calendar-day.clickable:hover {
  background: var(--background-color, #f3f4f6);
}

.day-number {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.other-month .day-number {
  color: var(--text-muted, #9ca3af);
}

.availability-indicator {
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
  border-radius: 4px;
  border: 1px solid;
  margin-top: auto;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-legend {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.pending {
  background: #fef08a;
  border: 1px solid #facc15;
}

.legend-dot.approved {
  background: #e5e7eb;
  border: 1px solid #9ca3af;
}

.legend-dot.rejected {
  background: #fecaca;
  border: 1px solid #f87171;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg, 12px);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #2563eb);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .calendar-day {
    min-height: 50px;
  }

  .availability-indicator {
    font-size: 0.5rem;
  }

  .calendar-legend {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
