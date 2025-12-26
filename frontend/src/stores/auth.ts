import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Organization, LoginRequest } from '@/types'
import { authService } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const organization = ref<Organization | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isAdminAssistant = computed(() => user.value?.role === 'admin_assistant')
  const isStaff = computed(() => user.value?.role === 'staff')
  const canManageUsers = computed(() => isSuperAdmin.value || isAdmin.value)
  const canManageSchedules = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )

  async function login(credentials: LoginRequest) {
    const response = await authService.login(credentials)
    token.value = response.token
    user.value = response.user
    organization.value = response.organization
    localStorage.setItem('token', response.token)
  }

  async function logout() {
    token.value = null
    user.value = null
    organization.value = null
    localStorage.removeItem('token')
  }

  async function fetchCurrentUser() {
    if (!token.value) return
    try {
      const response = await authService.me()
      user.value = response.user
      organization.value = response.organization
    } catch {
      logout()
    }
  }

  function setOrganizationContext(org: Organization) {
    organization.value = org
  }

  return {
    user,
    organization,
    token,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isAdminAssistant,
    isStaff,
    canManageUsers,
    canManageSchedules,
    login,
    logout,
    fetchCurrentUser,
    setOrganizationContext
  }
})
