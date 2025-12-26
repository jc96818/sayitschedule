import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Staff } from '@/types'
import { staffService } from '@/services/api'

export const useStaffStore = defineStore('staff', () => {
  const staff = ref<Staff[]>([])
  const currentStaff = ref<Staff | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  async function fetchStaff(params?: { search?: string; status?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await staffService.list(params)
      staff.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch staff'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchStaffById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await staffService.get(id)
      currentStaff.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch staff member'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createStaff(data: Partial<Staff>) {
    loading.value = true
    error.value = null
    try {
      const response = await staffService.create(data)
      staff.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create staff member'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateStaff(id: string, data: Partial<Staff>) {
    loading.value = true
    error.value = null
    try {
      const response = await staffService.update(id, data)
      const index = staff.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        staff.value[index] = response.data
      }
      if (currentStaff.value?.id === id) {
        currentStaff.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update staff member'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteStaff(id: string) {
    loading.value = true
    error.value = null
    try {
      await staffService.delete(id)
      staff.value = staff.value.filter((s) => s.id !== id)
      totalCount.value--
      if (currentStaff.value?.id === id) {
        currentStaff.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete staff member'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearCurrent() {
    currentStaff.value = null
  }

  return {
    staff,
    currentStaff,
    loading,
    error,
    totalCount,
    fetchStaff,
    fetchStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    clearCurrent
  }
})
