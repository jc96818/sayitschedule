import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Schedule, Session } from '@/types'
import { scheduleService, voiceService } from '@/services/api'
import type { ScheduleModification, VoiceModifyResult } from '@/services/api'

export const useSchedulesStore = defineStore('schedules', () => {
  const schedules = ref<Schedule[]>([])
  const currentSchedule = ref<(Schedule & { sessions: Session[] }) | null>(null)
  const loading = ref(false)
  const generating = ref(false)
  const publishing = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Voice modification state
  const pendingModification = ref<ScheduleModification | null>(null)
  const modificationResult = ref<VoiceModifyResult | null>(null)
  const parseConfidence = ref(0)
  const parsing = ref(false)
  const modifying = ref(false)

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
          currentSchedule.value.sessions[sessionIndex] = response.data
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
      link.download = `schedule-${id}.pdf`
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

      if (
        (parsed.commandType === 'modify_session' || parsed.commandType === 'cancel_session') &&
        parsed.confidence >= 0.5
      ) {
        const data = parsed.data as Record<string, unknown>
        pendingModification.value = {
          action: (data.action as ScheduleModification['action']) || 'move',
          therapistName: data.therapistName as string | undefined,
          patientName: data.patientName as string | undefined,
          currentDate: data.currentDate as string | undefined,
          currentDayOfWeek: data.currentDayOfWeek as string | undefined,
          currentStartTime: data.currentStartTime as string | undefined,
          newDate: data.newDate as string | undefined,
          newDayOfWeek: data.newDayOfWeek as string | undefined,
          newStartTime: data.newStartTime as string | undefined,
          newEndTime: data.newEndTime as string | undefined,
          notes: data.notes as string | undefined
        }
        parseConfidence.value = parsed.confidence
      } else {
        error.value = 'Could not understand the command. Try something like "Move John\'s 9 AM to 2 PM"'
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
          currentSchedule.value.sessions[sessionIndex] = response.data.session
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

  function clearPendingModification() {
    pendingModification.value = null
    parseConfidence.value = 0
    modificationResult.value = null
  }

  return {
    schedules,
    currentSchedule,
    loading,
    generating,
    publishing,
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
    // Methods
    fetchSchedules,
    fetchScheduleById,
    generateSchedule,
    publishSchedule,
    updateSession,
    deleteSession,
    exportToPdf,
    clearCurrent,
    // Voice modification methods
    parseVoiceModification,
    applyVoiceModification,
    clearPendingModification
  }
})
