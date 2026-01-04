import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Schedule, Session } from '@/types'
import { scheduleService, voiceService } from '@/services/api'
import type { ScheduleModification, VoiceModifyResult, CopyModifications } from '@/services/api'

export const useSchedulesStore = defineStore('schedules', () => {
  const schedules = ref<Schedule[]>([])
  const currentSchedule = ref<(Schedule & { sessions: Session[] }) | null>(null)
  const loading = ref(false)
  const generating = ref(false)
  const publishing = ref(false)
  const creatingDraft = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Voice modification state
  const pendingModification = ref<ScheduleModification | null>(null)
  const modificationResult = ref<VoiceModifyResult | null>(null)
  const parseConfidence = ref(0)
  const parsing = ref(false)
  const modifying = ref(false)

  // Copy modification state - stores results from schedule copy with validation
  const copyModifications = ref<CopyModifications | null>(null)

  const publishedSchedules = computed(() =>
    schedules.value.filter((s) => s.status === 'published')
  )

  const draftSchedules = computed(() =>
    schedules.value.filter((s) => s.status === 'draft')
  )

  const currentWeekSchedule = computed(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    return schedules.value.find((s) => {
      const scheduleDate = new Date(s.weekStartDate)
      return scheduleDate.getTime() === startOfWeek.getTime()
    })
  })

  async function fetchSchedules(params?: { status?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleService.list(params)
      schedules.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch schedules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchScheduleById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleService.get(id)
      currentSchedule.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch schedule'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function checkExistingSchedule(weekStartDate: string) {
    try {
      const response = await scheduleService.getByWeek(weekStartDate)
      return response.data
    } catch {
      // Error means no schedule exists
      return null
    }
  }

  async function generateSchedule(weekStartDate: string) {
    generating.value = true
    error.value = null
    try {
      const response = await scheduleService.generate(weekStartDate)
      currentSchedule.value = response.data
      schedules.value.push(response.data)
      totalCount.value++
      // Return full response including meta for stats and warnings
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate schedule'
      throw e
    } finally {
      generating.value = false
    }
  }

  async function publishSchedule(id: string) {
    publishing.value = true
    error.value = null
    try {
      const response = await scheduleService.publish(id)
      const index = schedules.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        schedules.value[index] = response.data
      }
      if (currentSchedule.value?.id === id) {
        currentSchedule.value = { ...currentSchedule.value, ...response.data }
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to publish schedule'
      throw e
    } finally {
      publishing.value = false
    }
  }

  async function updateSession(scheduleId: string, sessionId: string, data: Partial<Session>) {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleService.updateSession(scheduleId, sessionId, data)
      if (currentSchedule.value?.id === scheduleId) {
        const sessionIndex = currentSchedule.value.sessions.findIndex(
          (s) => s.id === sessionId
        )
        if (sessionIndex !== -1) {
          // Preserve joined name fields from original session since API doesn't return them
          const originalSession = currentSchedule.value.sessions[sessionIndex]
          currentSchedule.value.sessions[sessionIndex] = {
            ...response.data,
            therapistName: response.data.therapistName || originalSession.therapistName,
            patientName: response.data.patientName || originalSession.patientName,
            roomName: response.data.roomName || originalSession.roomName
          }
        }
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update session'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function exportToPdf(id: string) {
    try {
      const blob = await scheduleService.exportPdf(id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Use week start date for filename instead of GUID
      const schedule = currentSchedule.value?.id === id
        ? currentSchedule.value
        : schedules.value.find(s => s.id === id)
      const weekDate = schedule?.weekStartDate?.split('T')[0] || id
      link.download = `schedule-${weekDate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to export PDF'
      throw e
    }
  }

  function clearCurrent() {
    currentSchedule.value = null
  }

  // Voice modification methods
  async function parseVoiceModification(transcript: string) {
    parsing.value = true
    error.value = null
    try {
      const response = await voiceService.parseSchedule(transcript)
      const parsed = response.data

      const validCommandTypes = ['modify_session', 'cancel_session', 'schedule_session']
      if (validCommandTypes.includes(parsed.commandType) && parsed.confidence >= 0.5) {
        const data = parsed.data as Record<string, unknown>

        // Determine the action based on command type and data
        let action: ScheduleModification['action'] = 'move'
        if (parsed.commandType === 'schedule_session') {
          action = 'create'
        } else if (parsed.commandType === 'cancel_session') {
          action = 'cancel'
        } else if (data.action) {
          // Use the action from parsed data (supports create, move, cancel, swap)
          action = data.action as ScheduleModification['action']
        }

        pendingModification.value = {
          action,
          therapistName: data.therapistName as string | undefined,
          patientName: data.patientName as string | undefined,
          currentDate: data.currentDate as string | undefined,
          currentDayOfWeek: data.currentDayOfWeek as string | undefined,
          currentStartTime: data.currentStartTime as string | undefined,
          newDate: data.newDate as string | undefined,
          newDayOfWeek: data.newDayOfWeek as string | undefined,
          newStartTime: data.newStartTime as string | undefined,
          newEndTime: data.newEndTime as string | undefined,
          newTherapistName: data.newTherapistName as string | undefined,
          newRoomName: data.newRoomName as string | undefined,
          newPatientName: data.newPatientName as string | undefined,
          newDurationMinutes: data.newDurationMinutes as number | undefined,
          swapTherapistName: data.swapTherapistName as string | undefined,
          swapPatientName: data.swapPatientName as string | undefined,
          swapDayOfWeek: data.swapDayOfWeek as string | undefined,
          swapStartTime: data.swapStartTime as string | undefined,
          notes: data.notes as string | undefined
        }
        parseConfidence.value = parsed.confidence
      } else {
        error.value = 'Could not understand the command. Try something like "Move John\'s 9 AM to 2 PM" or "Add a session for Sarah on Tuesday at 10 AM"'
        throw new Error(error.value)
      }
      return parsed
    } catch (e) {
      if (!error.value) {
        error.value = e instanceof Error ? e.message : 'Failed to parse voice command'
      }
      throw e
    } finally {
      parsing.value = false
    }
  }

  async function applyVoiceModification() {
    if (!currentSchedule.value || !pendingModification.value) {
      throw new Error('No schedule or modification to apply')
    }

    modifying.value = true
    error.value = null
    try {
      const response = await scheduleService.modifyByVoice(
        currentSchedule.value.id,
        pendingModification.value
      )
      modificationResult.value = response.data

      // Update local sessions based on the action
      if (response.data.action === 'cancelled') {
        // Remove the cancelled session from local state
        currentSchedule.value.sessions = currentSchedule.value.sessions.filter(
          (s) => s.id !== response.data.session.id
        )
      } else if (response.data.action === 'moved') {
        // Update the moved session in local state
        const sessionIndex = currentSchedule.value.sessions.findIndex(
          (s) => s.id === response.data.session.id
        )
        if (sessionIndex !== -1) {
          // Preserve joined name fields from original session since API doesn't return them
          const originalSession = currentSchedule.value.sessions[sessionIndex]
          currentSchedule.value.sessions[sessionIndex] = {
            ...response.data.session,
            therapistName: response.data.session.therapistName || originalSession.therapistName,
            patientName: response.data.session.patientName || originalSession.patientName,
            roomName: response.data.session.roomName || originalSession.roomName
          }
        }
      } else if (response.data.action === 'created') {
        // Add the new session to local state
        currentSchedule.value.sessions.push(response.data.session)
      } else if (response.data.action === 'reassigned_therapist' || response.data.action === 'reassigned_room' || response.data.action === 'reassigned_patient') {
        // Update the reassigned session in local state
        const sessionIndex = currentSchedule.value.sessions.findIndex(
          (s) => s.id === response.data.session.id
        )
        if (sessionIndex !== -1) {
          // For reassignments, update with new values from response
          // The response includes the new therapist/room/patient name
          currentSchedule.value.sessions[sessionIndex] = {
            ...response.data.session,
            therapistName: response.data.session.therapistName,
            patientName: response.data.session.patientName,
            roomName: response.data.session.roomName
          }
        }
      } else if (response.data.action === 'swapped') {
        // Update both swapped sessions in local state
        const session1Index = currentSchedule.value.sessions.findIndex(
          (s) => s.id === response.data.session.id
        )
        if (session1Index !== -1) {
          currentSchedule.value.sessions[session1Index] = {
            ...response.data.session,
            therapistName: response.data.session.therapistName,
            patientName: response.data.session.patientName,
            roomName: response.data.session.roomName
          }
        }
        // Update second session if present
        if (response.data.session2) {
          const session2Index = currentSchedule.value.sessions.findIndex(
            (s) => s.id === response.data.session2!.id
          )
          if (session2Index !== -1) {
            currentSchedule.value.sessions[session2Index] = {
              ...response.data.session2,
              therapistName: response.data.session2.therapistName,
              patientName: response.data.session2.patientName,
              roomName: response.data.session2.roomName
            }
          }
        }
      } else if (response.data.action === 'duration_changed') {
        // Update the session with new duration in local state
        const sessionIndex = currentSchedule.value.sessions.findIndex(
          (s) => s.id === response.data.session.id
        )
        if (sessionIndex !== -1) {
          currentSchedule.value.sessions[sessionIndex] = {
            ...response.data.session,
            therapistName: response.data.session.therapistName,
            patientName: response.data.session.patientName,
            roomName: response.data.session.roomName
          }
        }
      }

      clearPendingModification()
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to apply modification'
      throw e
    } finally {
      modifying.value = false
    }
  }

  async function deleteSession(sessionId: string) {
    if (!currentSchedule.value) {
      throw new Error('No current schedule')
    }

    loading.value = true
    error.value = null
    try {
      await scheduleService.deleteSession(currentSchedule.value.id, sessionId)
      currentSchedule.value.sessions = currentSchedule.value.sessions.filter(
        (s) => s.id !== sessionId
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete session'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createSession(session: {
    staffId: string
    patientId: string
    roomId?: string
    date: string
    startTime: string
    endTime: string
    notes?: string
  }) {
    if (!currentSchedule.value) {
      throw new Error('No current schedule')
    }

    loading.value = true
    error.value = null
    try {
      const response = await scheduleService.createSession(currentSchedule.value.id, session)
      // Add the new session to the local state
      currentSchedule.value.sessions.push(response.data)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create session'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearPendingModification() {
    pendingModification.value = null
    parseConfidence.value = 0
    modificationResult.value = null
  }

  async function createDraftCopy(id: string) {
    creatingDraft.value = true
    error.value = null
    copyModifications.value = null
    try {
      const response = await scheduleService.createDraftCopy(id)
      // Add the new draft to schedules list
      schedules.value.unshift(response.data)
      totalCount.value++
      // Set as current schedule so UI navigates to it
      currentSchedule.value = response.data
      // Store modification results if any
      if (response.meta?.modifications) {
        copyModifications.value = response.meta.modifications
      }
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create draft copy'
      throw e
    } finally {
      creatingDraft.value = false
    }
  }

  function clearCopyModifications() {
    copyModifications.value = null
  }

  return {
    schedules,
    currentSchedule,
    loading,
    generating,
    publishing,
    creatingDraft,
    error,
    totalCount,
    publishedSchedules,
    draftSchedules,
    currentWeekSchedule,
    // Voice modification state
    pendingModification,
    modificationResult,
    parseConfidence,
    parsing,
    modifying,
    // Copy modification state
    copyModifications,
    // Methods
    fetchSchedules,
    fetchScheduleById,
    checkExistingSchedule,
    generateSchedule,
    publishSchedule,
    createDraftCopy,
    updateSession,
    deleteSession,
    createSession,
    exportToPdf,
    clearCurrent,
    // Voice modification methods
    parseVoiceModification,
    applyVoiceModification,
    clearPendingModification,
    clearCopyModifications
  }
})
