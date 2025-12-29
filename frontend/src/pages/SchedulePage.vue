<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSchedulesStore } from '@/stores/schedules'
import { useStaffStore } from '@/stores/staff'
import { useRoomsStore } from '@/stores/rooms'
import { Button, Badge, Alert, StatCard, VoiceInput, VoiceHintsModal } from '@/components/ui'
import { voiceService } from '@/services/api'
import { getFederalHoliday } from '@/utils/holidays'
import type { Session } from '@/types'

const schedulesStore = useSchedulesStore()
const staffStore = useStaffStore()
const roomsStore = useRoomsStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)
const voiceGenerateHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

// Voice modification state
const showVoiceConfirmation = ref(false)
const voiceTranscript = ref('')
const voiceError = ref('')

// Voice generation state
const showGenerateConfirmation = ref(false)
const generateTranscript = ref('')
const generateError = ref('')
const parseGenerating = ref(false)
const parsedWeekDate = ref('')
const parsedWeekReference = ref('')
const parseGenerateConfidence = ref(0)

const viewMode = ref<'calendar' | 'therapist' | 'patient' | 'room'>('calendar')
const selectedTherapist = ref('')
const selectedRoom = ref('')

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
    const holidayName = getFederalHoliday(date)
    days.push({
      name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i],
      date: date,
      dateStr: formatShortDate(date),
      isHoliday: holidayName !== null,
      holidayName: holidayName
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

// Parse time slot string to comparable format (e.g., "9:00 AM" -> "09:00")
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

// Format session date for comparison (YYYY-MM-DD)
function formatSessionDate(dateStr: string): string {
  return dateStr.split('T')[0]
}

// Format weekday date for comparison (YYYY-MM-DD)
function formatWeekDayDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getSessionsForTimeSlot(dayIndex: number, timeSlot: string): Session[] {
  if (!currentSchedule.value?.sessions) return []

  const targetDate = formatWeekDayDate(weekDays.value[dayIndex].date)
  const targetTime = parseTimeSlot(timeSlot)

  // Filter sessions to apply therapist and room filters if set
  let sessions = currentSchedule.value.sessions

  if (selectedTherapist.value) {
    sessions = sessions.filter(
      (s) => (s.therapistId || s.staffId) === selectedTherapist.value
    )
  }

  if (selectedRoom.value) {
    sessions = sessions.filter((s) => s.roomId === selectedRoom.value)
  }

  return sessions.filter((session) => {
    const sessionDate = formatSessionDate(session.date)
    const sessionTime = session.startTime?.slice(0, 5) // Get HH:MM from start time
    return sessionDate === targetDate && sessionTime === targetTime
  })
}

function getTherapistColor(session: Session): 'blue' | 'green' {
  // Check therapist gender from staff store
  const therapistId = session.therapistId || session.staffId
  const therapist = staffStore.staff.find((s) => s.id === therapistId)
  if (therapist?.gender === 'female') return 'green'
  return 'blue' // Default to blue for male or unknown
}

// Group sessions by therapist for "By Therapist" view
const sessionsByTherapist = computed(() => {
  if (!currentSchedule.value?.sessions) return []

  const grouped = new Map<string, { therapistId: string; therapistName: string; sessions: Session[] }>()

  for (const session of currentSchedule.value.sessions) {
    const therapistId = session.therapistId || session.staffId || 'unknown'
    const therapistName = session.therapistName || therapistId.slice(0, 8)

    if (!grouped.has(therapistId)) {
      grouped.set(therapistId, { therapistId, therapistName, sessions: [] })
    }
    grouped.get(therapistId)!.sessions.push(session)
  }

  // Sort sessions by date and time within each therapist
  for (const group of grouped.values()) {
    group.sessions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.therapistName.localeCompare(b.therapistName)
  )
})

// Group sessions by patient for "By Patient" view
const sessionsByPatient = computed(() => {
  if (!currentSchedule.value?.sessions) return []

  const grouped = new Map<string, { patientId: string; patientName: string; sessions: Session[] }>()

  for (const session of currentSchedule.value.sessions) {
    const patientId = session.patientId || 'unknown'
    const patientName = session.patientName || patientId.slice(0, 8)

    if (!grouped.has(patientId)) {
      grouped.set(patientId, { patientId, patientName, sessions: [] })
    }
    grouped.get(patientId)!.sessions.push(session)
  }

  // Sort sessions by date and time within each patient
  for (const group of grouped.values()) {
    group.sessions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.patientName.localeCompare(b.patientName)
  )
})

// Group sessions by room for "By Room" view
const sessionsByRoom = computed(() => {
  if (!currentSchedule.value?.sessions) return []

  const grouped = new Map<string, { roomId: string; roomName: string; sessions: Session[] }>()

  for (const session of currentSchedule.value.sessions) {
    const roomId = session.roomId || 'unassigned'
    const roomName = session.roomName || (roomId === 'unassigned' ? 'Unassigned' : roomId.slice(0, 8))

    if (!grouped.has(roomId)) {
      grouped.set(roomId, { roomId, roomName, sessions: [] })
    }
    grouped.get(roomId)!.sessions.push(session)
  }

  // Sort sessions by date and time within each room
  for (const group of grouped.values()) {
    group.sessions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }

  // Sort rooms alphabetically, but keep "Unassigned" at the end
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.roomId === 'unassigned') return 1
    if (b.roomId === 'unassigned') return -1
    return a.roomName.localeCompare(b.roomName)
  })
})

// Get unique therapists from current schedule for filter dropdown
const scheduleTherapists = computed(() => {
  if (!currentSchedule.value?.sessions) return []

  const therapists = new Map<string, string>()
  for (const session of currentSchedule.value.sessions) {
    const id = session.therapistId || session.staffId
    const name = session.therapistName
    if (id && !therapists.has(id)) {
      therapists.set(id, name || id.slice(0, 8))
    }
  }

  return Array.from(therapists.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Get unique rooms from current schedule for filter dropdown
const scheduleRooms = computed(() => {
  if (!currentSchedule.value?.sessions) return []

  const rooms = new Map<string, string>()
  for (const session of currentSchedule.value.sessions) {
    const id = session.roomId
    const name = session.roomName
    if (id && !rooms.has(id)) {
      rooms.set(id, name || id.slice(0, 8))
    }
  }

  return Array.from(rooms.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Format day of week from date string
function formatDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

async function handleExportPdf() {
  if (currentSchedule.value) {
    await schedulesStore.exportToPdf(currentSchedule.value.id)
  }
}

function handlePrint() {
  if (currentSchedule.value) {
    window.open(`/schedule/${currentSchedule.value.id}/print`, '_blank')
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

// Voice modification handlers
async function handleVoiceResult(transcript: string) {
  voiceTranscript.value = transcript
  voiceError.value = ''
  try {
    await schedulesStore.parseVoiceModification(transcript)
    showVoiceConfirmation.value = true
  } catch (error) {
    voiceError.value = error instanceof Error ? error.message : 'Failed to parse voice command'
  }
}

async function confirmModification() {
  try {
    await schedulesStore.applyVoiceModification()
    showVoiceConfirmation.value = false
    voiceTranscript.value = ''
  } catch (error) {
    voiceError.value = error instanceof Error ? error.message : 'Failed to apply modification'
  }
}

function cancelModification() {
  schedulesStore.clearPendingModification()
  showVoiceConfirmation.value = false
  voiceTranscript.value = ''
}

// Voice generation handlers
async function handleGenerateVoiceResult(transcript: string) {
  generateTranscript.value = transcript
  generateError.value = ''
  parseGenerating.value = true
  try {
    const response = await voiceService.parseScheduleGenerate(transcript)
    const parsed = response.data

    if (parsed.commandType === 'generate_schedule' && parsed.confidence >= 0.5) {
      const data = parsed.data as Record<string, unknown>
      parsedWeekDate.value = data.weekStartDate as string || ''
      parsedWeekReference.value = data.weekReference as string || ''
      parseGenerateConfidence.value = parsed.confidence
      showGenerateConfirmation.value = true
    } else {
      generateError.value = 'Could not understand the command. Try something like "Generate a schedule for next week"'
    }
  } catch (error) {
    generateError.value = error instanceof Error ? error.message : 'Failed to parse voice command'
  } finally {
    parseGenerating.value = false
  }
}

async function confirmGenerate() {
  if (!parsedWeekDate.value) {
    generateError.value = 'No week date parsed from command'
    return
  }

  try {
    await schedulesStore.generateSchedule(parsedWeekDate.value)
    showGenerateConfirmation.value = false
    generateTranscript.value = ''
    parsedWeekDate.value = ''
    parsedWeekReference.value = ''
    parseGenerateConfidence.value = 0
    // Navigate to the generated week
    const generatedDate = new Date(parsedWeekDate.value)
    const today = new Date()
    const currentMonday = new Date(today)
    currentMonday.setDate(today.getDate() - today.getDay() + 1)
    currentMonday.setHours(0, 0, 0, 0)
    const diffWeeks = Math.round((generatedDate.getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
    weekOffset.value = diffWeeks
  } catch (error) {
    generateError.value = error instanceof Error ? error.message : 'Failed to generate schedule'
  }
}

function cancelGenerate() {
  showGenerateConfirmation.value = false
  generateTranscript.value = ''
  parsedWeekDate.value = ''
  parsedWeekReference.value = ''
  parseGenerateConfidence.value = 0
}

function formatTime(time?: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function capitalizeFirst(str?: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function handleCreateDraftCopy() {
  if (!currentSchedule.value) return
  try {
    const response = await schedulesStore.createDraftCopy(currentSchedule.value.id)
    // The store sets currentSchedule to the new draft, so the UI will update automatically
    console.log('Created draft copy:', response.meta?.message)
  } catch (error) {
    console.error('Failed to create draft copy:', error)
  }
}

async function handlePublish() {
  if (!currentSchedule.value) return
  try {
    await schedulesStore.publishSchedule(currentSchedule.value.id)
  } catch (error) {
    console.error('Failed to publish schedule:', error)
  }
}

onMounted(() => {
  loadSchedule()
  staffStore.fetchStaff() // Load staff for therapist filter and gender lookup
  roomsStore.fetchRooms() // Load rooms for room display
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-left">
        <div class="header-title">
          <h2>Weekly Schedule</h2>
          <p>
            {{ weekDateRange }}
            <Badge v-if="currentSchedule" :variant="currentSchedule.status === 'published' ? 'success' : 'warning'" style="margin-left: 8px;">
              {{ currentSchedule.status === 'published' ? 'Published' : 'Draft' }}
            </Badge>
          </p>
        </div>
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
      </div>
      <div class="header-actions">
        <Button variant="outline" :disabled="!currentSchedule" @click="handlePrint">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </Button>
        <Button variant="outline" :disabled="!currentSchedule" @click="handleExportPdf">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </Button>
        <Button
          v-if="currentSchedule?.status === 'published'"
          variant="outline"
          :loading="schedulesStore.creatingDraft"
          @click="handleCreateDraftCopy"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Draft Copy
        </Button>
        <Button
          v-if="currentSchedule?.status === 'draft'"
          variant="primary"
          :loading="schedulesStore.publishing"
          @click="handlePublish"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Publish Schedule
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
      <template v-else-if="!currentSchedule">
        <!-- Voice Generation Hints Modal -->
        <VoiceHintsModal ref="voiceGenerateHintsModal" page-type="schedule_generate" />

        <!-- Voice Generation Interface -->
        <VoiceInput
          title="Generate Schedule"
          description="Speak or type a week (e.g. “next week” or a date)."
          :show-hints-link="true"
          @result="handleGenerateVoiceResult"
          @show-hints="voiceGenerateHintsModal?.openModal()"
        />

        <!-- Voice Parsing Loading State -->
        <div v-if="parseGenerating" class="card mb-3">
          <div class="card-body text-center">
            <p class="text-muted">Processing command...</p>
          </div>
        </div>

        <!-- Voice Generate Error -->
        <Alert v-if="generateError" variant="warning" class="mb-3" dismissible @dismiss="generateError = ''">
          {{ generateError }}
        </Alert>

        <!-- Voice Generation Confirmation -->
        <div v-if="showGenerateConfirmation && parsedWeekDate" class="confirmation-card">
          <h4>Confirm Schedule Generation</h4>
          <div class="transcription-box mb-2">
            <div class="label">Your command:</div>
            <div>"{{ generateTranscript }}"</div>
          </div>
          <div class="modification-preview">
            <strong>Generate Schedule:</strong>
            <div class="modification-details">
              <div class="detail-row">
                <span class="detail-label">Week:</span>
                <span>{{ parsedWeekReference || parsedWeekDate }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span>{{ formatDate(new Date(parsedWeekDate)) }}</span>
              </div>
            </div>
            <div v-if="parseGenerateConfidence" class="confidence-indicator">
              Confidence: {{ Math.round(parseGenerateConfidence * 100) }}%
            </div>
          </div>
          <div class="confirmation-actions">
            <Button variant="success" @click="confirmGenerate" :loading="schedulesStore.generating">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Generate Schedule
            </Button>
            <Button variant="ghost" class="text-danger" @click="cancelGenerate">Cancel</Button>
          </div>
        </div>

        <div class="card">
          <div class="card-body text-center" style="padding: 48px;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48" style="margin: 0 auto 16px; color: var(--text-muted);">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 style="margin-bottom: 8px;">No Schedule for This Week</h3>
            <p class="text-muted" style="margin-bottom: 24px;">Generate a new schedule using voice or the button below.</p>
            <RouterLink to="/schedule/generate" class="btn btn-primary">
              Generate Schedule
            </RouterLink>
          </div>
        </div>
      </template>

      <!-- Schedule View -->
      <template v-else>
        <!-- Voice Hints Modal -->
        <VoiceHintsModal ref="voiceHintsModal" page-type="schedule" />

        <!-- Voice Interface (only show for draft schedules) -->
        <VoiceInput
          v-if="currentSchedule.status === 'draft'"
          title="Edit Schedule"
          description="Speak or type changes (move, cancel, reschedule)."
          :show-hints-link="true"
          @result="handleVoiceResult"
          @show-hints="voiceHintsModal?.openModal()"
        />

        <!-- Voice Loading State -->
        <div v-if="schedulesStore.parsing" class="card mb-3">
          <div class="card-body text-center">
            <p class="text-muted">Processing command...</p>
          </div>
        </div>

        <!-- Voice Error -->
        <Alert v-if="voiceError" variant="warning" class="mb-3" dismissible @dismiss="voiceError = ''">
          {{ voiceError }}
        </Alert>

        <!-- Voice Modification Confirmation -->
        <div v-if="showVoiceConfirmation && schedulesStore.pendingModification" class="confirmation-card">
          <h4>Confirm Schedule Change</h4>
          <div class="transcription-box mb-2">
            <div class="label">Your command:</div>
            <div>"{{ voiceTranscript }}"</div>
          </div>
          <div class="modification-preview">
            <!-- Move action -->
            <template v-if="schedulesStore.pendingModification.action === 'move'">
              <strong>Move Session:</strong>
              <div class="modification-details">
                <div class="detail-row">
                  <span class="detail-label">Who:</span>
                  <span>{{ schedulesStore.pendingModification.therapistName || schedulesStore.pendingModification.patientName || 'Session' }}</span>
                </div>
                <div v-if="schedulesStore.pendingModification.currentDayOfWeek || schedulesStore.pendingModification.currentStartTime" class="detail-row">
                  <span class="detail-label">From:</span>
                  <span>
                    {{ capitalizeFirst(schedulesStore.pendingModification.currentDayOfWeek) }}
                    {{ formatTime(schedulesStore.pendingModification.currentStartTime) }}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">To:</span>
                  <span>
                    {{ schedulesStore.pendingModification.newDayOfWeek ? capitalizeFirst(schedulesStore.pendingModification.newDayOfWeek) : '' }}
                    {{ formatTime(schedulesStore.pendingModification.newStartTime) }}
                  </span>
                </div>
              </div>
            </template>
            <!-- Cancel action -->
            <template v-else-if="schedulesStore.pendingModification.action === 'cancel'">
              <strong>Cancel Session:</strong>
              <div class="modification-details">
                <div class="detail-row">
                  <span class="detail-label">Who:</span>
                  <span>{{ schedulesStore.pendingModification.therapistName || schedulesStore.pendingModification.patientName || 'Session' }}</span>
                </div>
                <div v-if="schedulesStore.pendingModification.currentDayOfWeek || schedulesStore.pendingModification.currentStartTime" class="detail-row">
                  <span class="detail-label">When:</span>
                  <span>
                    {{ capitalizeFirst(schedulesStore.pendingModification.currentDayOfWeek) }}
                    {{ formatTime(schedulesStore.pendingModification.currentStartTime) }}
                  </span>
                </div>
              </div>
            </template>
            <div v-if="schedulesStore.parseConfidence" class="confidence-indicator">
              Confidence: {{ Math.round(schedulesStore.parseConfidence * 100) }}%
            </div>
          </div>
          <div class="confirmation-actions">
            <Button variant="success" @click="confirmModification" :loading="schedulesStore.modifying">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Apply Change
            </Button>
            <Button variant="ghost" class="text-danger" @click="cancelModification">Cancel</Button>
          </div>
        </div>

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
              <button
                :class="['view-tab', { active: viewMode === 'room' }]"
                @click="viewMode = 'room'"
              >
                By Room
              </button>
            </div>
            <div v-if="viewMode === 'calendar'" class="filter-dropdowns">
              <select v-model="selectedTherapist" class="form-control" style="width: auto;">
                <option value="">All Therapists</option>
                <option v-for="therapist in scheduleTherapists" :key="therapist.id" :value="therapist.id">
                  {{ therapist.name }}
                </option>
              </select>
              <select v-model="selectedRoom" class="form-control" style="width: auto;">
                <option value="">All Rooms</option>
                <option v-for="room in scheduleRooms" :key="room.id" :value="room.id">
                  {{ room.name }}
                </option>
              </select>
            </div>
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

        <!-- Calendar Grid View -->
        <div v-if="viewMode === 'calendar'" class="card">
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
                    <div v-if="session.roomName" class="room">{{ session.roomName }}</div>
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

        <!-- By Therapist View -->
        <div v-else-if="viewMode === 'therapist'" class="therapist-view">
          <div v-if="sessionsByTherapist.length === 0" class="card">
            <div class="card-body text-center">
              <p class="text-muted">No sessions scheduled for this week.</p>
            </div>
          </div>
          <div v-else class="therapist-list">
            <div v-for="group in sessionsByTherapist" :key="group.therapistId" class="card therapist-card">
              <div class="card-header therapist-header">
                <div class="therapist-info">
                  <div class="therapist-avatar" :class="getTherapistColor({ therapistId: group.therapistId } as Session)">
                    {{ group.therapistName.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <h4>{{ group.therapistName }}</h4>
                    <span class="text-muted text-sm">{{ group.sessions.length }} session{{ group.sessions.length !== 1 ? 's' : '' }} this week</span>
                  </div>
                </div>
              </div>
              <div class="card-body" style="padding: 0;">
                <table class="session-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Patient</th>
                      <th>Room</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="session in group.sessions" :key="session.id">
                      <td>
                        <span class="day-badge">{{ formatDayOfWeek(session.date) }}</span>
                        <span class="text-muted text-sm">{{ formatShortDate(new Date(session.date)) }}</span>
                      </td>
                      <td>{{ formatTime(session.startTime) }}</td>
                      <td>{{ session.patientName || session.patientId?.slice(0, 8) }}</td>
                      <td>{{ session.roomName || '-' }}</td>
                      <td>
                        <Badge variant="secondary">Standard</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- By Patient View -->
        <div v-else-if="viewMode === 'patient'" class="patient-view">
          <div v-if="sessionsByPatient.length === 0" class="card">
            <div class="card-body text-center">
              <p class="text-muted">No sessions scheduled for this week.</p>
            </div>
          </div>
          <div v-else class="patient-list">
            <div v-for="group in sessionsByPatient" :key="group.patientId" class="card patient-card">
              <div class="card-header patient-header">
                <div class="patient-info">
                  <div class="patient-avatar">
                    {{ group.patientName.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <h4>{{ group.patientName }}</h4>
                    <span class="text-muted text-sm">{{ group.sessions.length }} session{{ group.sessions.length !== 1 ? 's' : '' }} this week</span>
                  </div>
                </div>
              </div>
              <div class="card-body" style="padding: 0;">
                <table class="session-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Therapist</th>
                      <th>Room</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="session in group.sessions" :key="session.id">
                      <td>
                        <span class="day-badge">{{ formatDayOfWeek(session.date) }}</span>
                        <span class="text-muted text-sm">{{ formatShortDate(new Date(session.date)) }}</span>
                      </td>
                      <td>{{ formatTime(session.startTime) }}</td>
                      <td>
                        <div class="therapist-cell">
                          <span :class="['therapist-dot', getTherapistColor(session)]"></span>
                          {{ session.therapistName || (session.therapistId || session.staffId)?.slice(0, 8) }}
                        </div>
                      </td>
                      <td>{{ session.roomName || '-' }}</td>
                      <td>
                        <Badge variant="secondary">Standard</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- By Room View -->
        <div v-else-if="viewMode === 'room'" class="room-view">
          <div v-if="sessionsByRoom.length === 0" class="card">
            <div class="card-body text-center">
              <p class="text-muted">No sessions scheduled for this week.</p>
            </div>
          </div>
          <div v-else class="room-list">
            <div v-for="group in sessionsByRoom" :key="group.roomId" class="card room-card">
              <div class="card-header room-header">
                <div class="room-info">
                  <div class="room-avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h4>{{ group.roomName }}</h4>
                    <span class="text-muted text-sm">{{ group.sessions.length }} session{{ group.sessions.length !== 1 ? 's' : '' }} this week</span>
                  </div>
                </div>
              </div>
              <div class="card-body" style="padding: 0;">
                <table class="session-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Therapist</th>
                      <th>Patient</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="session in group.sessions" :key="session.id">
                      <td>
                        <span class="day-badge">{{ formatDayOfWeek(session.date) }}</span>
                        <span class="text-muted text-sm">{{ formatShortDate(new Date(session.date)) }}</span>
                      </td>
                      <td>{{ formatTime(session.startTime) }}</td>
                      <td>
                        <div class="therapist-cell">
                          <span :class="['therapist-dot', getTherapistColor(session)]"></span>
                          {{ session.therapistName || (session.therapistId || session.staffId)?.slice(0, 8) }}
                        </div>
                      </td>
                      <td>{{ session.patientName || session.patientId?.slice(0, 8) }}</td>
                      <td>
                        <Badge variant="secondary">Standard</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-left .header-title {
  min-width: 280px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
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
  background-color: #fef2f2;
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

.calendar-event .room {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.filter-dropdowns {
  display: flex;
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

.legend-box.holiday {
  background: #fef2f2;
}

/* Voice Modification Styles */
.text-danger {
  color: var(--danger-color);
}

.confirmation-card {
  background-color: var(--card-background);
  border: 2px solid var(--primary-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 20px;
}

.confirmation-card h4 {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.transcription-box {
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: left;
}

.transcription-box .label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 8px;
}

.modification-preview {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
}

.modification-details {
  margin-top: 12px;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 14px;
  font-weight: 400;
}

.detail-label {
  color: var(--text-muted);
  min-width: 60px;
}

.confidence-indicator {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 400;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* By Therapist View Styles */
.therapist-list,
.patient-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.therapist-card,
.patient-card {
  overflow: hidden;
}

.therapist-header,
.patient-header {
  background-color: var(--background-color);
}

.therapist-info,
.patient-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.therapist-info h4,
.patient-info h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.therapist-avatar,
.patient-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.therapist-avatar.blue {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.therapist-avatar.green {
  background-color: var(--success-light);
  color: var(--success-color);
}

.patient-avatar {
  background-color: var(--warning-light, #fef3c7);
  color: var(--warning-color, #d97706);
}

.session-table {
  width: 100%;
  border-collapse: collapse;
}

.session-table th,
.session-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.session-table th {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  background-color: var(--background-color);
}

.session-table tr:last-child td {
  border-bottom: none;
}

.day-badge {
  display: inline-block;
  font-weight: 600;
  margin-right: 8px;
}

.therapist-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.therapist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.therapist-dot.blue {
  background-color: var(--primary-color);
}

.therapist-dot.green {
  background-color: var(--success-color);
}

/* By Room View Styles */
.room-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-card {
  overflow: hidden;
}

.room-header {
  background-color: var(--background-color);
}

.room-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-info h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.room-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-light);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
