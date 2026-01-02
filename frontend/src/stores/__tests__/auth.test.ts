import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'
import { authService, mfaAuthService } from '@/services/api'
import type { User, Organization, LoginResponse } from '@/types'

// Mock the API services
vi.mock('@/services/api', () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn()
  },
  mfaAuthService: {
    verifyMfa: vi.fn()
  }
}))

describe('useAuthStore', () => {
  const mockSuperAdminUser: User = {
    id: 'user-1',
    organizationId: null,
    email: 'superadmin@sayitschedule.com',
    name: 'Super Admin',
    role: 'super_admin',
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
    mfaEnabled: false,
    status: 'active'
  }

  const mockAdminUser: User = {
    id: 'user-2',
    organizationId: 'org-1',
    email: 'admin@demo.sayitschedule.com',
    name: 'Demo Admin',
    role: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
    mfaEnabled: false,
    status: 'active'
  }

  const mockOrganization: Organization = {
    id: 'org-1',
    name: 'Demo Organization',
    subdomain: 'demo',
    logoUrl: null,
    primaryColor: '#4F46E5',
    secondaryColor: '#818CF8',
    status: 'active',
    requiresHipaa: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    staffLabel: 'Therapists',
    staffLabelSingular: 'Therapist',
    patientLabel: 'Patients',
    patientLabelSingular: 'Patient',
    roomLabel: 'Rooms',
    roomLabelSingular: 'Room',
    certificationLabel: 'Certifications',
    equipmentLabel: 'Equipment',
    suggestedCertifications: [],
    suggestedRoomEquipment: []
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have null user and organization', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
      expect(store.organization).toBeNull()
    })

    it('should not be authenticated initially', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })

    it('should have MFA state initialized to false', () => {
      const store = useAuthStore()
      expect(store.mfaRequired).toBe(false)
      expect(store.mfaToken).toBeNull()
    })
  })

  describe('login', () => {
    it('should complete login successfully for superadmin without MFA', async () => {
      const mockResponse: LoginResponse = {
        token: 'jwt-token-123',
        user: mockSuperAdminUser,
        organization: null
      }
      vi.mocked(authService.login).mockResolvedValue(mockResponse)

      const store = useAuthStore()
      const result = await store.login({
        email: 'superadmin@sayitschedule.com',
        password: 'sayitadmin2025'
      })

      expect(authService.login).toHaveBeenCalledWith({
        email: 'superadmin@sayitschedule.com',
        password: 'sayitadmin2025'
      })
      expect(result).toEqual(mockResponse)
      expect(store.token).toBe('jwt-token-123')
      expect(store.user).toEqual(mockSuperAdminUser)
      expect(store.organization).toBeNull()
      expect(store.isAuthenticated).toBe(true)
      expect(store.isSuperAdmin).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'jwt-token-123')
    })

    it('should complete login successfully for admin with organization', async () => {
      const mockResponse: LoginResponse = {
        token: 'jwt-token-456',
        user: mockAdminUser,
        organization: mockOrganization
      }
      vi.mocked(authService.login).mockResolvedValue(mockResponse)

      const store = useAuthStore()
      const result = await store.login({
        email: 'admin@demo.sayitschedule.com',
        password: 'sayitadmin2025'
      })

      expect(result).toEqual(mockResponse)
      expect(store.token).toBe('jwt-token-456')
      expect(store.user).toEqual(mockAdminUser)
      expect(store.organization).toEqual(mockOrganization)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isAdmin).toBe(true)
      expect(store.isSuperAdmin).toBe(false)
    })

    it('should handle MFA required response', async () => {
      const mockResponse: LoginResponse = {
        requiresMfa: true,
        mfaToken: 'mfa-token-123'
      }
      vi.mocked(authService.login).mockResolvedValue(mockResponse)

      const store = useAuthStore()
      const result = await store.login({
        email: 'superadmin@sayitschedule.com',
        password: 'sayitadmin2025'
      })

      expect(result).toEqual(mockResponse)
      expect(store.mfaRequired).toBe(true)
      expect(store.mfaToken).toBe('mfa-token-123')
      // Should NOT set token/user yet - waiting for MFA verification
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('should throw error on invalid credentials', async () => {
      vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'))

      const store = useAuthStore()
      await expect(
        store.login({
          email: 'wrong@email.com',
          password: 'wrongpassword'
        })
      ).rejects.toThrow('Invalid credentials')

      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('verifyMfa', () => {
    it('should complete login after MFA verification', async () => {
      // First, simulate MFA required state
      const mfaRequiredResponse: LoginResponse = {
        requiresMfa: true,
        mfaToken: 'mfa-token-123'
      }
      vi.mocked(authService.login).mockResolvedValue(mfaRequiredResponse)

      const store = useAuthStore()
      await store.login({
        email: 'superadmin@sayitschedule.com',
        password: 'sayitadmin2025'
      })

      expect(store.mfaRequired).toBe(true)

      // Now verify MFA
      const mfaVerifyResponse: LoginResponse = {
        token: 'jwt-token-after-mfa',
        user: mockSuperAdminUser,
        organization: null
      }
      vi.mocked(mfaAuthService.verifyMfa).mockResolvedValue(mfaVerifyResponse)

      const result = await store.verifyMfa('123456')

      expect(mfaAuthService.verifyMfa).toHaveBeenCalledWith('mfa-token-123', '123456')
      expect(result).toEqual(mfaVerifyResponse)
      expect(store.token).toBe('jwt-token-after-mfa')
      expect(store.user).toEqual(mockSuperAdminUser)
      expect(store.isAuthenticated).toBe(true)
      expect(store.mfaRequired).toBe(false)
      expect(store.mfaToken).toBeNull()
    })

    it('should throw error if no MFA token available', async () => {
      const store = useAuthStore()
      await expect(store.verifyMfa('123456')).rejects.toThrow('No MFA token available')
    })

    it('should handle invalid MFA code', async () => {
      const store = useAuthStore()
      // Manually set MFA state
      store.mfaRequired = true
      store.mfaToken = 'mfa-token-123'

      vi.mocked(mfaAuthService.verifyMfa).mockRejectedValue(new Error('Invalid code'))

      await expect(store.verifyMfa('000000')).rejects.toThrow('Invalid code')
      // MFA state should remain
      expect(store.mfaRequired).toBe(true)
    })
  })

  describe('logout', () => {
    it('should clear all auth state', async () => {
      // Set up authenticated state
      const store = useAuthStore()
      store.token = 'jwt-token-123'
      store.user = mockSuperAdminUser
      store.organization = null

      await store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.organization).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('role-based computed properties', () => {
    it('should correctly identify super_admin role', () => {
      const store = useAuthStore()
      store.user = mockSuperAdminUser

      expect(store.isSuperAdmin).toBe(true)
      expect(store.isAdmin).toBe(false)
      expect(store.isAdminAssistant).toBe(false)
      expect(store.isStaff).toBe(false)
      expect(store.canManageUsers).toBe(true)
      expect(store.canManageSchedules).toBe(true)
    })

    it('should correctly identify admin role', () => {
      const store = useAuthStore()
      store.user = mockAdminUser

      expect(store.isSuperAdmin).toBe(false)
      expect(store.isAdmin).toBe(true)
      expect(store.isAdminAssistant).toBe(false)
      expect(store.isStaff).toBe(false)
      expect(store.canManageUsers).toBe(true)
      expect(store.canManageSchedules).toBe(true)
    })

    it('should correctly identify admin_assistant role', () => {
      const store = useAuthStore()
      store.user = { ...mockAdminUser, role: 'admin_assistant' }

      expect(store.isSuperAdmin).toBe(false)
      expect(store.isAdmin).toBe(false)
      expect(store.isAdminAssistant).toBe(true)
      expect(store.isStaff).toBe(false)
      expect(store.canManageUsers).toBe(false)
      expect(store.canManageSchedules).toBe(true)
    })

    it('should correctly identify staff role', () => {
      const store = useAuthStore()
      store.user = { ...mockAdminUser, role: 'staff' }

      expect(store.isSuperAdmin).toBe(false)
      expect(store.isAdmin).toBe(false)
      expect(store.isAdminAssistant).toBe(false)
      expect(store.isStaff).toBe(true)
      expect(store.canManageUsers).toBe(false)
      expect(store.canManageSchedules).toBe(false)
    })
  })

  describe('fetchCurrentUser', () => {
    it('should fetch and set user data', async () => {
      vi.mocked(authService.me).mockResolvedValue({
        user: mockSuperAdminUser,
        organization: null
      })

      const store = useAuthStore()
      store.token = 'jwt-token-123'

      await store.fetchCurrentUser()

      expect(authService.me).toHaveBeenCalled()
      expect(store.user).toEqual(mockSuperAdminUser)
      expect(store.organization).toBeNull()
    })

    it('should not fetch if no token', async () => {
      const store = useAuthStore()
      await store.fetchCurrentUser()
      expect(authService.me).not.toHaveBeenCalled()
    })

    it('should logout on fetch error', async () => {
      vi.mocked(authService.me).mockRejectedValue(new Error('Unauthorized'))

      const store = useAuthStore()
      store.token = 'expired-token'
      store.user = mockSuperAdminUser

      await store.fetchCurrentUser()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('setOrganizationContext', () => {
    it('should update organization context', () => {
      const store = useAuthStore()
      store.setOrganizationContext(mockOrganization)
      expect(store.organization).toEqual(mockOrganization)
    })
  })

  describe('setAuthState', () => {
    it('should set all auth state at once', () => {
      const store = useAuthStore()
      store.setAuthState('new-token', mockSuperAdminUser, null)

      expect(store.token).toBe('new-token')
      expect(store.user).toEqual(mockSuperAdminUser)
      expect(store.organization).toBeNull()
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token')
    })
  })

  describe('clearMfaState', () => {
    it('should clear MFA state', () => {
      const store = useAuthStore()
      store.mfaRequired = true
      store.mfaToken = 'mfa-token-123'

      store.clearMfaState()

      expect(store.mfaRequired).toBe(false)
      expect(store.mfaToken).toBeNull()
    })
  })
})
