import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PortalUser, PortalBranding } from '@/types'
import { portalAuthService, portalBrandingService } from '@/services/api'

export const usePortalAuthStore = defineStore('portalAuth', () => {
  // State
  const user = ref<PortalUser | null>(null)
  const branding = ref<PortalBranding | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Auth request state (for OTP flow)
  const authChannel = ref<'email' | 'sms' | null>(null)
  const authIdentifier = ref<string | null>(null)
  const authRequestSent = ref(false)

  // Computed
  const isAuthenticated = computed(() => !!user.value)
  const canBook = computed(() => branding.value?.selfBookingEnabled ?? false)
  const canCancel = computed(() => branding.value?.portalAllowCancel ?? false)
  const canReschedule = computed(() => branding.value?.portalAllowReschedule ?? false)

  // Actions

  /**
   * Load portal branding (public, no auth required)
   */
  async function loadBranding(): Promise<void> {
    try {
      loading.value = true
      error.value = null
      const response = await portalBrandingService.getBranding()
      branding.value = response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      error.value = e.response?.data?.message || 'Failed to load portal configuration'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Request a login code/link
   */
  async function requestLogin(identifier: string, channel: 'email' | 'sms'): Promise<void> {
    try {
      loading.value = true
      error.value = null

      const result = await portalAuthService.requestLogin(identifier, channel)

      if (!result.success) {
        throw new Error(result.message)
      }

      // Store for the verify step
      authChannel.value = channel
      authIdentifier.value = identifier
      authRequestSent.value = true
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      error.value = e.response?.data?.message || e.message || 'Failed to send login code'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Verify login code/token
   */
  async function verifyToken(code: string): Promise<void> {
    try {
      loading.value = true
      error.value = null

      const result = await portalAuthService.verifyToken(code)

      user.value = result.user

      // Clear auth request state
      authChannel.value = null
      authIdentifier.value = null
      authRequestSent.value = false
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      error.value = e.response?.data?.message || e.message || 'Invalid or expired code'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch current user (validate session)
   */
  async function fetchCurrentUser(): Promise<void> {
    try {
      loading.value = true
      error.value = null
      const response = await portalAuthService.me()
      user.value = response.data
    } catch {
      // Invalid session - clear it
      logout()
    } finally {
      loading.value = false
    }
  }

  /**
   * Logout
   */
  async function logout(): Promise<void> {
    try {
      await portalAuthService.logout()
    } catch {
      // Ignore logout errors
    } finally {
      user.value = null
      authChannel.value = null
      authIdentifier.value = null
      authRequestSent.value = false
    }
  }

  /**
   * Reset auth request state (go back to login form)
   */
  function resetAuthRequest(): void {
    authChannel.value = null
    authIdentifier.value = null
    authRequestSent.value = false
    error.value = null
  }

  /**
   * Clear error
   */
  function clearError(): void {
    error.value = null
  }

  return {
    // State
    user,
    branding,
    loading,
    error,
    authChannel,
    authIdentifier,
    authRequestSent,

    // Computed
    isAuthenticated,
    canBook,
    canCancel,
    canReschedule,

    // Actions
    loadBranding,
    requestLogin,
    verifyToken,
    fetchCurrentUser,
    logout,
    resetAuthRequest,
    clearError
  }
})
