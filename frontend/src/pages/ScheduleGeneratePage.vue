<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSchedulesStore } from '@/stores/schedules'
import { useStaffStore } from '@/stores/staff'
import { usePatientsStore } from '@/stores/patients'
import { useRulesStore } from '@/stores/rules'
import { Button, Alert, Badge, StatCard } from '@/components/ui'
import { useLabels } from '@/composables/useLabels'

const router = useRouter()
const { staffLabel, patientLabel, patientLabelSingular, staffLabelSingular } = useLabels()
const schedulesStore = useSchedulesStore()
const staffStore = useStaffStore()
const patientsStore = usePatientsStore()
const rulesStore = useRulesStore()

const selectedWeek = ref('')
const step = ref<'configure' | 'generating' | 'preview' | 'published'>('configure')
const generationProgress = ref(0)
const generationStatus = ref('')
const generationWarnings = ref<string[]>([])
const generationStats = ref<{ totalSessions: number; patientsScheduled: number; therapistsUsed: number } | null>(null)
const generationError = ref('')

// Calendar preview
const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']

// Parse a date string as a local date to avoid timezone shifts
// YYYY-MM-DD strings are interpreted as UTC by default, causing off-by-one day errors
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

const previewWeekDays = computed(() => {
  if (!selectedWeek.value) return []
  const days = []
  const startDate = parseLocalDate(selectedWeek.value)
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    // Format isoDate using local date components to avoid timezone shifts
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    days.push({
      name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i],
      date: date,
      dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isoDate: isoDate
    })
  }
  return days
})

function getSessionsForSlot(dayIsoDate: string, timeSlot: string) {
  const sessions = schedulesStore.currentSchedule?.sessions || []
  // Convert time slot to 24h format for matching
  const timeMap: Record<string, string> = {
    '9:00 AM': '09:00',
    '10:00 AM': '10:00',
    '11:00 AM': '11:00',
    '1:00 PM': '13:00',
    '2:00 PM': '14:00',
    '3:00 PM': '15:00'
  }
  const targetTime = timeMap[timeSlot]

  return sessions.filter(session => {
    const sessionDate = session.date?.split('T')[0]
    const sessionTime = session.startTime?.substring(0, 5)
    return sessionDate === dayIsoDate && sessionTime === targetTime
  })
}

function getTherapistColor(session: { therapistId?: string; staffId?: string }): 'blue' | 'green' {
  const therapistId = session.therapistId || session.staffId
  return (therapistId?.charCodeAt(0) ?? 0) % 2 === 0 ? 'blue' : 'green'
}

// Get next Sunday as default
const defaultWeekStart = computed(() => {
  const today = new Date()
  const dayOfWeek = today.getDay()
  // If today is Sunday (0), use today; otherwise calculate days until next Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const nextSunday = new Date(today)
  nextSunday.setDate(today.getDate() + daysUntilSunday)
  return nextSunday.toISOString().split('T')[0]
})

const weekDateRange = computed(() => {
  if (!selectedWeek.value) return ''
  const start = parseLocalDate(selectedWeek.value)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${formatDate(start)} - ${formatDate(end)}`
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function handleGenerate() {
  if (!selectedWeek.value) return

  step.value = 'generating'
  generationProgress.value = 0
  generationStatus.value = 'Initializing AI scheduler...'
  generationError.value = ''
  generationWarnings.value = []
  generationStats.value = null

  // Show progress animation while waiting for AI
  const progressInterval = setInterval(() => {
    if (generationProgress.value < 90) {
      generationProgress.value += Math.random() * 10

      // Update status messages based on progress
      if (generationProgress.value < 20) {
        generationStatus.value = 'Loading staff and patient data...'
      } else if (generationProgress.value < 40) {
        generationStatus.value = 'Analyzing scheduling rules...'
      } else if (generationProgress.value < 60) {
        generationStatus.value = 'AI is optimizing assignments...'
      } else if (generationProgress.value < 80) {
        generationStatus.value = 'Validating constraints...'
      } else {
        generationStatus.value = 'Finalizing schedule...'
      }
    }
  }, 500)

  try {
    const result = await schedulesStore.generateSchedule(selectedWeek.value)

    clearInterval(progressInterval)
    generationProgress.value = 100
    generationStatus.value = 'Complete!'

    // Store generation metadata if available
    if (result?.meta) {
      generationWarnings.value = result.meta.warnings || []
      generationStats.value = result.meta.stats || null
    }

    await new Promise(resolve => setTimeout(resolve, 300))
    step.value = 'preview'
  } catch (error: unknown) {
    clearInterval(progressInterval)
    step.value = 'configure'

    if (error instanceof Error) {
      generationError.value = error.message
    } else {
      generationError.value = 'Failed to generate schedule. Please try again.'
    }
    console.error('Failed to generate schedule:', error)
  }
}

async function handlePublish() {
  if (!schedulesStore.currentSchedule) return

  try {
    await schedulesStore.publishSchedule(schedulesStore.currentSchedule.id)
    step.value = 'published'
  } catch (error) {
    console.error('Failed to publish schedule:', error)
  }
}

function handleViewSchedule() {
  router.push('/app/schedule')
}

function handleStartOver() {
  step.value = 'configure'
  selectedWeek.value = ''
  schedulesStore.clearCurrent()
}

onMounted(() => {
  // Load data for summary cards
  staffStore.fetchStaff()
  patientsStore.fetchPatients()
  rulesStore.fetchRules()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Generate Schedule</h2>
        <p>Create a new AI-powered schedule</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/app/schedule" class="btn btn-outline">
          Cancel
        </RouterLink>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="schedulesStore.error || generationError" variant="danger" class="mb-3" dismissible>
        {{ schedulesStore.error || generationError }}
      </Alert>

      <!-- Step 1: Configure -->
      <div v-if="step === 'configure'" class="card">
        <div class="card-header">
          <h3>Schedule Configuration</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label for="week">Select Week Start Date</label>
            <input
              id="week"
              v-model="selectedWeek"
              type="date"
              class="form-control"
              :min="defaultWeekStart"
              style="max-width: 300px;"
            />
            <small v-if="weekDateRange" class="text-muted">
              Week: {{ weekDateRange }}
            </small>
          </div>

          <!-- Summary Cards -->
          <div class="summary-grid mt-3">
            <div class="summary-card">
              <div class="summary-icon blue">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div class="summary-value">{{ staffStore.totalCount || '...' }}</div>
                <div class="summary-label">Active {{ staffLabel }}</div>
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-icon green">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <div class="summary-value">{{ patientsStore.totalCount || '...' }}</div>
                <div class="summary-label">Active {{ patientLabel }}</div>
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-icon yellow">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <div class="summary-value">{{ rulesStore.activeRules.length || '...' }}</div>
                <div class="summary-label">Active Rules</div>
              </div>
            </div>
          </div>

          <div style="margin-top: 24px;">
            <Button
              variant="primary"
              size="lg"
              :disabled="!selectedWeek"
              @click="handleGenerate"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Schedule
            </Button>
          </div>
        </div>
      </div>

      <!-- Step 2: Generating -->
      <div v-if="step === 'generating'" class="card">
        <div class="card-body text-center" style="padding: 48px;">
          <div class="generation-spinner"></div>
          <h3 style="margin: 24px 0 8px;">Generating Schedule</h3>
          <p class="text-muted" style="margin-bottom: 24px;">{{ generationStatus }}</p>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: `${generationProgress}%` }"></div>
          </div>
          <p class="text-sm text-muted" style="margin-top: 8px;">{{ Math.round(generationProgress) }}%</p>
        </div>
      </div>

      <!-- Step 3: Preview -->
      <div v-if="step === 'preview'">
        <Alert variant="success" class="mb-3">
          Schedule generated successfully! Review the schedule below and publish when ready.
        </Alert>

        <!-- Warnings from AI generation -->
        <Alert v-if="generationWarnings.length > 0" variant="warning" class="mb-3">
          <strong>Scheduling Notes:</strong>
          <ul style="margin: 8px 0 0 16px; padding: 0;">
            <li v-for="(warning, index) in generationWarnings" :key="index">
              {{ warning }}
            </li>
          </ul>
        </Alert>

        <div class="card">
          <div class="card-header">
            <h3>Schedule Preview</h3>
            <Badge variant="warning">Draft</Badge>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">Week: {{ weekDateRange }}</p>

            <!-- Summary Stats -->
            <div class="stats-grid mb-3">
              <StatCard
                :value="generationStats?.totalSessions || schedulesStore.currentSchedule?.sessions?.length || 0"
                label="Total Sessions"
                icon="calendar"
                color="blue"
              />
              <StatCard
                :value="generationStats?.patientsScheduled || 0"
                :label="`${patientLabel} Scheduled`"
                icon="patients"
                color="green"
              />
              <StatCard
                :value="generationStats?.therapistsUsed || 0"
                :label="`${staffLabel} Assigned`"
                icon="staff"
                color="yellow"
              />
            </div>

            <!-- Calendar Grid Preview -->
            <div class="calendar-preview">
              <div class="calendar-grid">
                <!-- Header Row -->
                <div class="calendar-header-cell">Time</div>
                <div
                  v-for="day in previewWeekDays"
                  :key="day.name"
                  class="calendar-header-cell"
                >
                  <div>{{ day.name }}</div>
                  <div class="text-sm text-muted">{{ day.dateStr }}</div>
                </div>

                <!-- Time Slot Rows -->
                <template v-for="timeSlot in timeSlots" :key="timeSlot">
                  <div class="calendar-time">{{ timeSlot }}</div>
                  <div
                    v-for="day in previewWeekDays"
                    :key="`${timeSlot}-${day.name}`"
                    class="calendar-cell"
                  >
                    <div
                      v-for="session in getSessionsForSlot(day.isoDate, timeSlot)"
                      :key="session.id"
                      :class="['calendar-event', getTherapistColor(session)]"
                    >
                      <div class="therapist">{{ session.therapistName || staffLabelSingular }}</div>
                      <div class="patient">{{ session.patientName || patientLabelSingular }}</div>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Legend -->
              <div class="calendar-legend">
                <div class="legend-item">
                  <div class="legend-box blue"></div>
                  <span class="text-sm">Male {{ staffLabelSingular }}</span>
                </div>
                <div class="legend-item">
                  <div class="legend-box green"></div>
                  <span class="text-sm">Female {{ staffLabelSingular }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <Button variant="outline" @click="handleStartOver">
                Start Over
              </Button>
              <Button
                variant="success"
                :loading="schedulesStore.publishing"
                @click="handlePublish"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Publish Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: Published -->
      <div v-if="step === 'published'" class="card">
        <div class="card-body text-center" style="padding: 48px;">
          <div class="success-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 style="margin: 24px 0 8px;">Schedule Published!</h3>
          <p class="text-muted" style="margin-bottom: 24px;">
            The schedule for {{ weekDateRange }} is now live.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <Button variant="outline" @click="handleStartOver">
              Generate Another
            </Button>
            <Button variant="primary" @click="handleViewSchedule">
              View Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-icon.blue {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.summary-icon.green {
  background-color: var(--success-light);
  color: var(--success-color);
}

.summary-icon.yellow {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
}

.summary-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.generation-spinner {
  width: 64px;
  height: 64px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-bar-container {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background-color: var(--border-color);
  border-radius: 4px;
  margin: 0 auto;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--primary-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--success-light);
  color: var(--success-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Calendar Preview Styles */
.calendar-preview {
  margin-top: 24px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.calendar-header-cell {
  padding: 12px 8px;
  text-align: center;
  background-color: var(--background-color);
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 13px;
}

.calendar-time {
  padding: 8px;
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  background-color: var(--background-color);
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.calendar-cell {
  min-height: 60px;
  padding: 4px;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--card-background);
}

.calendar-cell:last-child {
  border-right: none;
}

.calendar-event {
  padding: 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  margin-bottom: 2px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calendar-event .patient {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calendar-legend {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
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

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .calendar-grid {
    grid-template-columns: 60px repeat(5, 1fr);
    font-size: 10px;
  }

  .calendar-header-cell {
    padding: 8px 4px;
    font-size: 11px;
  }

  .calendar-time {
    font-size: 10px;
    padding: 6px;
  }

  .calendar-cell {
    min-height: 50px;
    padding: 2px;
  }

  .calendar-event {
    padding: 4px;
    font-size: 10px;
  }
}
</style>
