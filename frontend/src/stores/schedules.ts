import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Schedule, Session } from '@/types'
import { scheduleService } from '@/services/api'

export const useSchedulesStore = defineStore('schedules', () => {
  const schedules = ref<Schedule[]>([])
  const currentSchedule = ref<(Schedule & { sessions: Session[] }) | null>(null)
  const loading = ref(false)
  const generating = ref(false)
  const publishing = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

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
    fetchSchedules,
    fetchScheduleById,
    generateSchedule,
    publishSchedule,
    updateSession,
    exportToPdf,
    clearCurrent
  }
})
