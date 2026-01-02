import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginPage from '../LoginPage.vue'
import { useAuthStore } from '@/stores/auth'
import type { LoginResponse } from '@/types'

// Mock the subdomain utility
vi.mock('@/utils/subdomain', () => ({
  getPostLoginRedirectUrl: vi.fn(() => null)
}))

// Create a minimal router for testing
const createTestRouter = () => {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginPage },
      { path: '/app', component: { template: '<div>App</div>' } },
      { path: '/super-admin', component: { template: '<div>Super Admin</div>' } },
      { path: '/forgot-password', component: { template: '<div>Forgot Password</div>' } }
    ]
  })
}

describe('LoginPage', () => {
  let router: ReturnType<typeof createTestRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createTestRouter()
    vi.clearAllMocks()
    await router.push('/login')
    await router.isReady()
  })

  const mountLoginPage = async () => {
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to']
          }
        }
      }
    })
    await router.isReady()
    return wrapper
  }

  describe('initial render', () => {
    it('should render login form by default', async () => {
      const wrapper = await mountLoginPage()

      expect(wrapper.find('h1').text()).toBe('Say It Schedule')
      expect(wrapper.find('input#email').exists()).toBe(true)
      expect(wrapper.find('input#password').exists()).toBe(true)
      expect(wrapper.find('button[type="submit"]').text()).toBe('Sign In')
    })

    it('should have empty form fields initially', async () => {
      const wrapper = await mountLoginPage()

      const emailInput = wrapper.find('input#email')
      const passwordInput = wrapper.find('input#password')

      expect((emailInput.element as HTMLInputElement).value).toBe('')
      expect((passwordInput.element as HTMLInputElement).value).toBe('')
    })

    it('should show remember me checkbox', async () => {
      const wrapper = await mountLoginPage()
      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    })

    it('should show forgot password link', async () => {
      const wrapper = await mountLoginPage()
      expect(wrapper.text()).toContain('Forgot password?')
    })
  })

  describe('form submission - successful login without MFA', () => {
    it('should call authStore.login with credentials', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      const mockResponse: LoginResponse = {
        token: 'jwt-token',
        user: {
          id: 'user-1',
          organizationId: null,
          email: 'superadmin@sayitschedule.com',
          name: 'Super Admin',
          role: 'super_admin',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
          status: 'active'
        },
        organization: null
      }
      vi.spyOn(authStore, 'login').mockResolvedValue(mockResponse)

      await wrapper.find('input#email').setValue('superadmin@sayitschedule.com')
      await wrapper.find('input#password').setValue('sayitadmin2025')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(authStore.login).toHaveBeenCalledWith({
        email: 'superadmin@sayitschedule.com',
        password: 'sayitadmin2025'
      })
    })

    it('should redirect superadmin to /super-admin after login', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      // Set up the store to return super_admin role
      authStore.user = {
        id: 'user-1',
        organizationId: null,
        email: 'superadmin@sayitschedule.com',
        name: 'Super Admin',
        role: 'super_admin',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: null,
        status: 'active'
      }
      authStore.token = 'jwt-token'

      vi.spyOn(authStore, 'login').mockResolvedValue({
        token: 'jwt-token',
        user: authStore.user,
        organization: null
      })

      const pushSpy = vi.spyOn(router, 'push')

      await wrapper.find('input#email').setValue('superadmin@sayitschedule.com')
      await wrapper.find('input#password').setValue('sayitadmin2025')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(pushSpy).toHaveBeenCalledWith('/super-admin')
    })

    it('should redirect regular admin to /app after login', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-2',
        organizationId: 'org-1',
        email: 'admin@demo.sayitschedule.com',
        name: 'Demo Admin',
        role: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: null,
        status: 'active'
      }
      authStore.token = 'jwt-token'

      vi.spyOn(authStore, 'login').mockResolvedValue({
        token: 'jwt-token',
        user: authStore.user,
        organization: {
          id: 'org-1',
          name: 'Demo Org',
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
      })

      const pushSpy = vi.spyOn(router, 'push')

      await wrapper.find('input#email').setValue('admin@demo.sayitschedule.com')
      await wrapper.find('input#password').setValue('sayitadmin2025')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(pushSpy).toHaveBeenCalledWith('/app')
    })

    it('should show loading state during login', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      // Create a promise that doesn't resolve immediately
      let resolveLogin: (value: LoginResponse) => void
      const loginPromise = new Promise<LoginResponse>((resolve) => {
        resolveLogin = resolve
      })
      vi.spyOn(authStore, 'login').mockReturnValue(loginPromise)

      await wrapper.find('input#email').setValue('superadmin@sayitschedule.com')
      await wrapper.find('input#password').setValue('sayitadmin2025')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('button[type="submit"]').text()).toBe('Signing in...')
      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

      // Resolve and check button returns to normal
      resolveLogin!({
        token: 'token',
        user: {
          id: 'user-1',
          organizationId: null,
          email: 'superadmin@sayitschedule.com',
          name: 'Super Admin',
          role: 'super_admin',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
          status: 'active'
        },
        organization: null
      })
      await flushPromises()

      expect(wrapper.find('button[type="submit"]').text()).toBe('Sign In')
    })
  })

  describe('form submission - login errors', () => {
    it('should display error message on invalid credentials', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      vi.spyOn(authStore, 'login').mockRejectedValue(new Error('Invalid credentials'))

      await wrapper.find('input#email').setValue('wrong@email.com')
      await wrapper.find('input#password').setValue('wrongpassword')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.alert-danger').exists()).toBe(true)
      expect(wrapper.find('.alert-danger').text()).toBe('Invalid email or password')
    })

    it('should clear error when form is resubmitted', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      // First submission - error
      vi.spyOn(authStore, 'login').mockRejectedValueOnce(new Error('Invalid credentials'))

      await wrapper.find('input#email').setValue('wrong@email.com')
      await wrapper.find('input#password').setValue('wrongpassword')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.alert-danger').exists()).toBe(true)

      // Second submission - success (error should clear during submission)
      vi.spyOn(authStore, 'login').mockResolvedValueOnce({
        token: 'token',
        user: {
          id: 'user-1',
          organizationId: null,
          email: 'superadmin@sayitschedule.com',
          name: 'Super Admin',
          role: 'super_admin',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
          status: 'active'
        },
        organization: null
      })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.alert-danger').exists()).toBe(false)
    })
  })

  describe('MFA flow', () => {
    it('should show MFA form when MFA is required', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      // Mock login to return MFA required AND set store state when called
      vi.spyOn(authStore, 'login').mockImplementation(async () => {
        // Simulate what the real login does when MFA is required
        authStore.mfaRequired = true
        authStore.mfaToken = 'mfa-token-123'
        return {
          requiresMfa: true,
          mfaToken: 'mfa-token-123'
        }
      })

      // Fill in the form BEFORE MFA state is set
      await wrapper.find('input#email').setValue('superadmin@sayitschedule.com')
      await wrapper.find('input#password').setValue('sayitadmin2025')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Force re-render after store update
      await wrapper.vm.$nextTick()

      expect(wrapper.find('h2').text()).toBe('Two-Factor Authentication')
      expect(wrapper.find('input#mfaCode').exists()).toBe(true)
    })

    it('should call verifyMfa with entered code', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      // Set up MFA required state
      authStore.mfaRequired = true
      authStore.mfaToken = 'mfa-token-123'
      authStore.token = null
      authStore.user = null

      await wrapper.vm.$nextTick()

      vi.spyOn(authStore, 'verifyMfa').mockResolvedValue({
        token: 'jwt-token-after-mfa',
        user: {
          id: 'user-1',
          organizationId: null,
          email: 'superadmin@sayitschedule.com',
          name: 'Super Admin',
          role: 'super_admin',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
          status: 'active'
        },
        organization: null
      })

      // Set the user after successful MFA
      authStore.user = {
        id: 'user-1',
        organizationId: null,
        email: 'superadmin@sayitschedule.com',
        name: 'Super Admin',
        role: 'super_admin',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: null,
        status: 'active'
      }
      authStore.token = 'jwt-token-after-mfa'

      await wrapper.find('input#mfaCode').setValue('123456')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(authStore.verifyMfa).toHaveBeenCalledWith('123456')
    })

    it('should show error on invalid MFA code', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      authStore.mfaRequired = true
      authStore.mfaToken = 'mfa-token-123'

      await wrapper.vm.$nextTick()

      const mfaError = { response: { data: { error: 'Invalid verification code' } } }
      vi.spyOn(authStore, 'verifyMfa').mockRejectedValue(mfaError)

      await wrapper.find('input#mfaCode').setValue('000000')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.alert-danger').text()).toBe('Invalid verification code')
    })

    it('should clear MFA code after error', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      authStore.mfaRequired = true
      authStore.mfaToken = 'mfa-token-123'

      await wrapper.vm.$nextTick()

      vi.spyOn(authStore, 'verifyMfa').mockRejectedValue({ response: { data: { error: 'Invalid' } } })

      await wrapper.find('input#mfaCode').setValue('000000')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect((wrapper.find('input#mfaCode').element as HTMLInputElement).value).toBe('')
    })

    it('should allow canceling MFA and return to login form', async () => {
      const wrapper = await mountLoginPage()
      const authStore = useAuthStore()

      authStore.mfaRequired = true
      authStore.mfaToken = 'mfa-token-123'

      await wrapper.vm.$nextTick()

      expect(wrapper.find('h2').text()).toBe('Two-Factor Authentication')

      // Click "Back to Login" button
      await wrapper.find('button.btn-ghost').trigger('click')
      await flushPromises()

      expect(authStore.mfaRequired).toBe(false)
      expect(wrapper.find('h1').text()).toBe('Say It Schedule')
    })
  })

  describe('form validation', () => {
    it('should require email field', async () => {
      const wrapper = await mountLoginPage()
      const emailInput = wrapper.find('input#email')
      expect(emailInput.attributes('required')).toBeDefined()
    })

    it('should require password field', async () => {
      const wrapper = await mountLoginPage()
      const passwordInput = wrapper.find('input#password')
      expect(passwordInput.attributes('required')).toBeDefined()
    })

    it('should have email type on email input', async () => {
      const wrapper = await mountLoginPage()
      const emailInput = wrapper.find('input#email')
      expect(emailInput.attributes('type')).toBe('email')
    })

    it('should have password type on password input', async () => {
      const wrapper = await mountLoginPage()
      const passwordInput = wrapper.find('input#password')
      expect(passwordInput.attributes('type')).toBe('password')
    })
  })
})
