import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StaffAvailability, AvailabilityStatus } from '@/types'
import { availabilityService } from '@/services/api'

export const useAvailabilityStore = defineStore('availability', () => {
  // State for a specific staff member's availability
  const availability = ref<StaffAvailability[]>([])

  // State for organization-wide pending requests (admin view)
  const pendingRequests = ref<StaffAvailability[]>([])
  const pendingTotal = ref(0)
  const pendingCount = ref(0)

  // Loading and error states
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Current staff ID being viewed
  const currentStaffId = ref<string | null>(null)

  // Computed: pending requests for current month
  const currentMonthPending = computed(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    return availability.value.filter(a => {
      const date = new Date(a.date)
      return a.status === 'pending' && date >= startOfMonth && date <= endOfMonth
    })
  })

  // Computed: approved unavailability for current staff
  const approvedUnavailability = computed(() => {
    return availability.value.filter(a => a.status === 'approved' && !a.available)
  })

  // Computed: whether there are more pending requests to load
  const hasMore = computed(() => {
    return pendingRequests.value.length < pendingTotal.value
  })

  /**
   * Fetch availability for a specific staff member
   */
  async function fetchByStaffId(
    staffId: string,
    options?: { startDate?: string; endDate?: string; status?: AvailabilityStatus }
  ) {
    loading.value = true
    error.value = null
    currentStaffId.value = staffId
    try {
      const response = await availabilityService.listByStaff(staffId, options)
      availability.value = response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch availability'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch pending requests for admin review
   */
  async function fetchPending(params?: { page?: number; limit?: number }) {
    loading.value = true
    error.value = null
    try {
      const response = await availabilityService.listPending(params)
      pendingRequests.value = response.data
      pendingTotal.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch pending requests'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch count of pending requests
   */
  async function fetchPendingCount() {
    try {
      const response = await availabilityService.countPending()
      pendingCount.value = response.data.pendingCount
    } catch (e) {
      console.error('Failed to fetch pending count:', e)
    }
  }

  /**
   * Create a new time-off request
   */
  async function createRequest(
    staffId: string,
    data: {
      date: string
      available: boolean
      startTime?: string
      endTime?: string
      reason?: string
    }
  ) {
    loading.value = true
    error.value = null
    try {
      const response = await availabilityService.create(staffId, data)
      // Add to local state if viewing the same staff member
      if (currentStaffId.value === staffId) {
        availability.value.push(response.data)
      }
      // Update pending count
      if (response.data.status === 'pending') {
        pendingCount.value++
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create time-off request'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing availability record
   */
  async function updateRequest(
    staffId: string,
    id: string,
    data: Partial<{
      date: string
      available: boolean
      startTime: string | null
      endTime: string | null
      reason: string | null
    }>
  ) {
    loading.value = true
    error.value = null
    try {
      const response = await availabilityService.update(staffId, id, data)
      // Update in local state
      const index = availability.value.findIndex(a => a.id === id)
      if (index !== -1) {
        availability.value[index] = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update request'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete an availability record
   */
  async function deleteRequest(staffId: string, id: string) {
    loading.value = true
    error.value = null
    try {
      const record = availability.value.find(a => a.id === id)
      await availabilityService.delete(staffId, id)
      // Remove from local state
      availability.value = availability.value.filter(a => a.id !== id)
      pendingRequests.value = pendingRequests.value.filter(a => a.id !== id)
      // Update pending count
      if (record?.status === 'pending') {
        pendingCount.value = Math.max(0, pendingCount.value - 1)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete request'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Approve a pending request (admin only)
   */
  async function approveRequest(staffId: string, id: string, notes?: string) {
    loading.value = true
    error.value = null
    try {
      const response = await availabilityService.approve(staffId, id, notes)
      // Update in local state
      const index = availability.value.findIndex(a => a.id === id)
      if (index !== -1) {
        availability.value[index] = response.data
      }
      // Remove from pending requests
      pendingRequests.value = pendingRequests.value.filter(a => a.id !== id)
      pendingCount.value = Math.max(0, pendingCount.value - 1)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to approve request'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Reject a pending request (admin only)
   */
  async function rejectRequest(staffId: string, id: string, notes?: string) {
    loading.value = true
    error.value = null
    try {
      const response = await availabilityService.reject(staffId, id, notes)
      // Update in local state
      const index = availability.value.findIndex(a => a.id === id)
      if (index !== -1) {
        availability.value[index] = response.data
      }
      // Remove from pending requests
      pendingRequests.value = pendingRequests.value.filter(a => a.id !== id)
      pendingCount.value = Math.max(0, pendingCount.value - 1)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reject request'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear all state
   */
  function clear() {
    availability.value = []
    pendingRequests.value = []
    pendingTotal.value = 0
    currentStaffId.value = null
    error.value = null
  }

  return {
    // State
    availability,
    pendingRequests,
    pendingTotal,
    pendingCount,
    loading,
    error,
    currentStaffId,

    // Computed
    currentMonthPending,
    approvedUnavailability,
    hasMore,

    // Actions
    fetchByStaffId,
    fetchPending,
    fetchPendingCount,
    createRequest,
    updateRequest,
    deleteRequest,
    approveRequest,
    rejectRequest,
    clear,

    // Aliases for convenience (shorter names)
    create: createRequest,
    update: updateRequest,
    delete: deleteRequest,
    approve: approveRequest,
    reject: rejectRequest
  }
})
