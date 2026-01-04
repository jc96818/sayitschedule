<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { scheduleService } from '@/services/api'
import type { ScheduleSummary, ScheduleStatus } from '@/types'

const props = defineProps<{
  modelValue: Date
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date): void
}>()

// Popover state
const isOpen = ref(false)
const popoverRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

// Calendar state
const viewingMonth = ref(new Date(props.modelValue))
const scheduleSummaries = ref<ScheduleSummary[]>([])
const loading = ref(false)

// Close popover when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (
    popoverRef.value &&
    !popoverRef.value.contains(event.target as Node) &&
    triggerRef.value &&
    !triggerRef.value.contains(event.target as Node)
  ) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Format month/year for header
const monthYearDisplay = computed(() => {
  return viewingMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Get the start of the week (Sunday) for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get all weeks to display in the calendar (6 rows to ensure full month coverage)
const calendarWeeks = computed(() => {
  const weeks: Array<{
    weekStart: Date
    days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }>
    scheduleStatus: ScheduleStatus | null
    sessionCount: number
  }> = []

  const year = viewingMonth.value.getFullYear()
  const month = viewingMonth.value.getMonth()

  // First day of the month
  const firstOfMonth = new Date(year, month, 1)
  // Start from the Sunday of the week containing the first of the month
  const calendarStart = getWeekStart(firstOfMonth)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate 6 weeks
  for (let week = 0; week < 6; week++) {
    const weekStart = new Date(calendarStart)
    weekStart.setDate(calendarStart.getDate() + week * 7)

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = []

    for (let day = 0; day < 7; day++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + day)
      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime()
      })
    }

    // Find schedule status for this week
    const weekStartStr = formatDateForApi(weekStart)
    const summary = scheduleSummaries.value.find(s => {
      const summaryWeekStart = s.weekStartDate.split('T')[0]
      return summaryWeekStart === weekStartStr
    })

    weeks.push({
      weekStart,
      days,
      scheduleStatus: summary?.status || null,
      sessionCount: summary?.sessionCount || 0
    })
  }

  return weeks
})

// Check if a week is the currently selected week
function isSelectedWeek(weekStart: Date): boolean {
  const selectedWeekStart = getWeekStart(props.modelValue)
  return weekStart.getTime() === selectedWeekStart.getTime()
}

// Check if a week contains today
function isCurrentWeek(weekStart: Date): boolean {
  const todayWeekStart = getWeekStart(new Date())
  return weekStart.getTime() === todayWeekStart.getTime()
}

// Format date for API calls (YYYY-MM-DD)
function formatDateForApi(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format selected week range for display
const selectedWeekRange = computed(() => {
  const start = getWeekStart(props.modelValue)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', formatOptions)
  const endStr = end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })

  return `${startStr} - ${endStr}`
})

// Load schedule summaries for visible months
async function loadScheduleSummaries() {
  loading.value = true
  try {
    // Get range: 1 month before to 2 months after the viewing month
    const startDate = new Date(viewingMonth.value.getFullYear(), viewingMonth.value.getMonth() - 1, 1)
    const endDate = new Date(viewingMonth.value.getFullYear(), viewingMonth.value.getMonth() + 3, 0)

    const response = await scheduleService.getSummaries(
      formatDateForApi(startDate),
      formatDateForApi(endDate)
    )
    scheduleSummaries.value = response.data
  } catch (error) {
    console.error('Failed to load schedule summaries:', error)
  } finally {
    loading.value = false
  }
}

// Navigation
function prevMonth() {
  viewingMonth.value = new Date(viewingMonth.value.getFullYear(), viewingMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  viewingMonth.value = new Date(viewingMonth.value.getFullYear(), viewingMonth.value.getMonth() + 1, 1)
}

function goToToday() {
  const today = new Date()
  viewingMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selectWeek(getWeekStart(today))
}

// Select a week
function selectWeek(weekStart: Date) {
  emit('update:modelValue', weekStart)
  isOpen.value = false
}

// Toggle popover
function togglePopover() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // Sync viewing month to selected date
    viewingMonth.value = new Date(props.modelValue.getFullYear(), props.modelValue.getMonth(), 1)
    loadScheduleSummaries()
  }
}

// Watch for month changes to reload summaries
watch(viewingMonth, () => {
  if (isOpen.value) {
    loadScheduleSummaries()
  }
})
</script>

<template>
  <div class="week-calendar-picker">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      class="picker-trigger"
      @click="togglePopover"
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span class="trigger-text">{{ selectedWeekRange }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" class="chevron" :class="{ 'chevron-up': isOpen }">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Popover -->
    <Transition name="popover">
      <div v-if="isOpen" ref="popoverRef" class="picker-popover">
        <!-- Header -->
        <div class="popover-header">
          <button class="nav-btn" @click="prevMonth" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="month-year">{{ monthYearDisplay }}</span>
          <button class="nav-btn" @click="nextMonth" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Day names header -->
        <div class="day-names">
          <span v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day">{{ day }}</span>
          <span></span><!-- Empty cell for status column alignment -->
        </div>

        <!-- Calendar grid -->
        <div class="calendar-grid" :class="{ loading }">
          <button
            v-for="week in calendarWeeks"
            :key="week.weekStart.toISOString()"
            class="week-row"
            :class="{
              'selected': isSelectedWeek(week.weekStart),
              'current-week': isCurrentWeek(week.weekStart),
              'has-draft': week.scheduleStatus === 'draft',
              'has-published': week.scheduleStatus === 'published'
            }"
            @click="selectWeek(week.weekStart)"
            type="button"
          >
            <span
              v-for="day in week.days"
              :key="day.date.toISOString()"
              class="day-cell"
              :class="{
                'other-month': !day.isCurrentMonth,
                'today': day.isToday
              }"
            >
              {{ day.date.getDate() }}
            </span>
            <!-- Status indicator column (always present for grid alignment) -->
            <span class="status-cell">
              <span v-if="week.scheduleStatus" class="status-indicator" :class="week.scheduleStatus">
                <span class="status-dot"></span>
                <span class="status-label">{{ week.scheduleStatus === 'published' ? 'Published' : 'Draft' }}</span>
              </span>
            </span>
          </button>
        </div>

        <!-- Footer -->
        <div class="popover-footer">
          <button class="today-btn" @click="goToToday" type="button">
            Today
          </button>
          <div class="legend">
            <span class="legend-item">
              <span class="legend-dot draft"></span>
              Draft
            </span>
            <span class="legend-item">
              <span class="legend-dot published"></span>
              Published
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.week-calendar-picker {
  position: relative;
  display: inline-block;
}

.picker-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--card-background, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 6px);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #111827);
  cursor: pointer;
  transition: all 0.2s;
}

.picker-trigger:hover {
  border-color: var(--primary-color, #3b82f6);
  background: var(--background-color, #f9fafb);
}

.trigger-text {
  min-width: 160px;
  text-align: left;
}

.chevron {
  transition: transform 0.2s;
  color: var(--text-muted, #9ca3af);
}

.chevron-up {
  transform: rotate(180deg);
}

.picker-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  width: 360px;
  background: var(--card-background, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 8px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.month-year {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  transition: all 0.2s;
}

.nav-btn:hover {
  background: var(--background-color, #f3f4f6);
  color: var(--text-primary, #111827);
}

.day-names {
  display: grid;
  grid-template-columns: repeat(7, 32px) 70px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--background-color, #f9fafb);
}

.day-names span {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #9ca3af);
  text-transform: uppercase;
}

.calendar-grid {
  display: flex;
  flex-direction: column;
  padding: 8px;
  transition: opacity 0.2s;
}

.calendar-grid.loading {
  opacity: 0.5;
  pointer-events: none;
}

.week-row {
  display: grid !important;
  grid-template-columns: repeat(7, 32px) 70px !important;
  align-items: center;
  gap: 0;
  padding: 6px 4px;
  margin: 2px 0;
  border: 2px solid transparent;
  border-radius: var(--radius-md, 6px);
  background: none;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: center;
  font-family: inherit;
  font-size: inherit;
}

.week-row:hover {
  background: var(--background-color, #f3f4f6);
}

.week-row.selected {
  background: var(--primary-light, #eff6ff);
  border-color: var(--primary-color, #3b82f6);
}

.week-row.current-week {
  box-shadow: inset 0 0 0 1px var(--primary-color, #3b82f6);
}

.day-cell {
  display: block;
  font-size: 13px;
  color: var(--text-primary, #111827);
  padding: 4px 0;
  min-width: 0;
}

.day-cell.other-month {
  color: var(--text-muted, #9ca3af);
}

.status-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 4px;
}

.day-cell.today {
  font-weight: 700;
  color: var(--primary-color, #3b82f6);
  position: relative;
}

.day-cell.today::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: var(--primary-color, #3b82f6);
  border-radius: 50%;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.status-indicator.draft {
  background: #fef3c7;
  color: #92400e;
}

.status-indicator.published {
  background: #d1fae5;
  color: #065f46;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.draft .status-dot {
  background: #f59e0b;
}

.status-indicator.published .status-dot {
  background: #10b981;
}

.status-label {
  display: none;
}

@media (min-width: 400px) {
  .status-label {
    display: inline;
  }
}

.popover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background: var(--background-color, #f9fafb);
  border-radius: 0 0 var(--radius-lg, 8px) var(--radius-lg, 8px);
}

.today-btn {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--primary-color, #3b82f6);
  background: none;
  border: 1px solid var(--primary-color, #3b82f6);
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: all 0.2s;
}

.today-btn:hover {
  background: var(--primary-color, #3b82f6);
  color: white;
}

.legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted, #6b7280);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.draft {
  background: #f59e0b;
}

.legend-dot.published {
  background: #10b981;
}

/* Transitions */
.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
