import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Organization, LoginRequest, LoginResponse } from '@/types'
import { authService, mfaAuthService } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const organization = ref<Organization | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  // MFA state
  const mfaRequired = ref(false)
  const mfaToken = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isAdminAssistant = computed(() => user.value?.role === 'admin_assistant')
  const isStaff = computed(() => user.value?.role === 'staff')
  const canManageUsers = computed(() => isSuperAdmin.value || isAdmin.value)
  const canManageSchedules = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )
  // Staff, patients, rooms, and rules management - admin and assistant can manage
  const canManageStaff = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )
  const canManagePatients = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )
  const canManageRooms = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )
  const canManageRules = computed(() =>
    isSuperAdmin.value || isAdmin.value || isAdminAssistant.value
  )

  async function login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await authService.login(credentials)

    if (response.requiresMfa && response.mfaToken) {
      // MFA required - store the token and return
      mfaRequired.value = true
      mfaToken.value = response.mfaToken
      return response
    }

    // No MFA - complete login
    completeLogin(response)
    return response
  }

  async function verifyMfa(code: string): Promise<LoginResponse> {
    if (!mfaToken.value) {
      throw new Error('No MFA token available')
    }

    const response = await mfaAuthService.verifyMfa(mfaToken.value, code)
    completeLogin(response)
    clearMfaState()
    return response
  }

  function completeLogin(response: LoginResponse) {
    if (response.token && response.user) {
      token.value = response.token
      user.value = response.user
      organization.value = response.organization || null
      localStorage.setItem('token', response.token)
    }
  }

  function clearMfaState() {
    mfaRequired.value = false
    mfaToken.value = null
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

  function setAuthState(authToken: string, authUser: User, authOrg: Organization | null) {
    token.value = authToken
    user.value = authUser
    organization.value = authOrg
    localStorage.setItem('token', authToken)
  }

  return {
    user,
    organization,
    token,
    mfaRequired,
    mfaToken,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isAdminAssistant,
    isStaff,
    canManageUsers,
    canManageSchedules,
    canManageStaff,
    canManagePatients,
    canManageRooms,
    canManageRules,
    login,
    verifyMfa,
    clearMfaState,
    logout,
    fetchCurrentUser,
    setOrganizationContext,
    setAuthState
  }
})
