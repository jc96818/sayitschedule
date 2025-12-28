import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types'
import { superAdminUsersService } from '@/services/api'

export const useSuperAdminUsersStore = defineStore('superAdminUsers', () => {
  const users = ref<User[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  async function fetchUsers(params?: { search?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await superAdminUsersService.list(params)
      users.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch super admin users'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createUser(userData: { email: string; password: string; name: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await superAdminUsersService.create(userData)
      users.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create super admin user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateUser(id: string, userData: { email?: string; name?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await superAdminUsersService.update(id, userData)
      const index = users.value.findIndex((u) => u.id === id)
      if (index !== -1) {
        users.value[index] = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update super admin user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteUser(id: string) {
    loading.value = true
    error.value = null
    try {
      await superAdminUsersService.delete(id)
      users.value = users.value.filter((u) => u.id !== id)
      totalCount.value--
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete super admin user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resetPassword(id: string, newPassword: string) {
    loading.value = true
    error.value = null
    try {
      await superAdminUsersService.resetPassword(id, newPassword)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reset password'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    users,
    loading,
    error,
    totalCount,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword
  }
})
