import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/services/api'
import type { User, UserRole } from '@/types'

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Computed
  const adminUsers = computed(() =>
    users.value.filter(u => u.role === 'admin' || u.role === 'admin_assistant')
  )

  const staffUsers = computed(() =>
    users.value.filter(u => u.role === 'staff')
  )

  const usersByRole = computed(() => {
    const grouped: Record<UserRole, User[]> = {
      super_admin: [],
      admin: [],
      admin_assistant: [],
      staff: []
    }
    users.value.forEach(u => {
      if (grouped[u.role]) {
        grouped[u.role].push(u)
      }
    })
    return grouped
  })

  // Actions
  async function fetchUsers(params?: { role?: UserRole }) {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/users', { params })
      users.value = response.data.data || response.data
      totalCount.value = response.data.total || users.value.length
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to fetch users'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchUserById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await api.get(`/users/${id}`)
      currentUser.value = response.data.data || response.data
      return currentUser.value
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to fetch user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createUser(userData: Partial<User> & { password?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await api.post('/users', userData)
      const newUser = response.data.data || response.data
      users.value.push(newUser)
      totalCount.value++
      return newUser
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to create user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateUser(id: string, userData: Partial<User>) {
    loading.value = true
    error.value = null
    try {
      const response = await api.put(`/users/${id}`, userData)
      const updatedUser = response.data.data || response.data
      const index = users.value.findIndex(u => u.id === id)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      if (currentUser.value?.id === id) {
        currentUser.value = updatedUser
      }
      return updatedUser
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to update user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteUser(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/users/${id}`)
      users.value = users.value.filter(u => u.id !== id)
      totalCount.value--
      if (currentUser.value?.id === id) {
        currentUser.value = null
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to delete user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resetPassword(id: string, newPassword: string) {
    loading.value = true
    error.value = null
    try {
      await api.post(`/users/${id}/reset-password`, { password: newPassword })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      error.value = err.response?.data?.message || err.message || 'Failed to reset password'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearCurrent() {
    currentUser.value = null
  }

  return {
    // State
    users,
    currentUser,
    loading,
    error,
    totalCount,
    // Computed
    adminUsers,
    staffUsers,
    usersByRole,
    // Actions
    fetchUsers,
    fetchUserById,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    clearCurrent
  }
})
