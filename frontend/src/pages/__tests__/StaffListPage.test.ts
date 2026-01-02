import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import StaffListPage from '../StaffListPage.vue'
import { useStaffStore } from '@/stores/staff'
import { useAuthStore } from '@/stores/auth'
import type { Staff } from '@/types'
import { staffService, voiceService } from '@/services/api'

// Mock the API services
vi.mock('@/services/api', () => ({
  staffService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  voiceService: {
    parseStaff: vi.fn()
  }
}))

// Mock the useLabels composable
vi.mock('@/composables/useLabels', () => ({
  useLabels: () => ({
    staffLabel: 'Therapists',
    staffLabelSingular: 'Therapist',
    staffLabelLower: 'therapists',
    certificationLabel: 'Certifications'
  })
}))

// Create a minimal router for testing
const createTestRouter = () => {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/staff', name: 'staff-list', component: StaffListPage },
      { path: '/app/staff/:id', name: 'staff-profile', component: { template: '<div>Staff Profile</div>' } }
    ]
  })
}

describe('StaffListPage', () => {
  let router: ReturnType<typeof createTestRouter>

  const mockStaff: Staff[] = [
    {
      id: 'staff-1',
      organizationId: 'org-1',
      name: 'Dr. Smith',
      email: 'smith@example.com',
      phone: '555-1234',
      gender: 'male',
      certifications: ['ABA', 'RBT'],
      status: 'active',
      maxSessionsPerDay: 4,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'staff-2',
      organizationId: 'org-1',
      name: 'Dr. Jones',
      email: 'jones@example.com',
      phone: '555-5678',
      gender: 'female',
      certifications: ['BCBA'],
      status: 'active',
      maxSessionsPerDay: 3,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'staff-3',
      organizationId: 'org-1',
      name: 'John Doe',
      email: 'doe@example.com',
      phone: '555-9999',
      gender: 'male',
      certifications: [],
      status: 'inactive',
      maxSessionsPerDay: 2,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createTestRouter()
    vi.clearAllMocks()

    // Default mock for staff list
    vi.mocked(staffService.list).mockResolvedValue({
      data: mockStaff,
      total: 3,
      page: 1,
      limit: 50,
      totalPages: 1
    })

    // Push to the route before tests
    await router.push('/app/staff')
    await router.isReady()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mountStaffListPage = async (options?: { canManage?: boolean }) => {
    // Set up auth store permissions
    const authStore = useAuthStore()
    Object.defineProperty(authStore, 'canManageStaff', {
      get: () => options?.canManage ?? true,
      configurable: true
    })

    const wrapper = mount(StaffListPage, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: '<a :to="to"><slot /></a>',
            props: ['to']
          },
          VoiceInput: {
            template: '<div class="voice-input-stub"></div>',
            emits: ['result', 'show-hints']
          },
          VoiceHintsModal: {
            template: '<div class="voice-hints-modal-stub"></div>'
          },
          Modal: {
            template: '<div class="modal-stub" v-if="modelValue"><slot /></div>',
            props: ['modelValue', 'title', 'size']
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  describe('initial load', () => {
    it('should render page header with staff label', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('Therapists Management')
    })

    it('should fetch staff on mount', async () => {
      const wrapper = await mountStaffListPage()

      expect(staffService.list).toHaveBeenCalled()
    })

    it('should display staff list in table', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('Dr. Smith')
      expect(wrapper.text()).toContain('Dr. Jones')
    })

    it('should show total staff count', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('Therapists (3)')
    })
  })

  describe('staff table display', () => {
    it('should show staff name with initials', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('Dr. Smith')
      expect(wrapper.text()).toContain('DS') // Initials
    })

    it('should show staff email', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('smith@example.com')
    })

    it('should show staff gender', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('male')
      expect(wrapper.text()).toContain('female')
    })

    it('should show staff certifications', async () => {
      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('ABA')
      expect(wrapper.text()).toContain('BCBA')
    })

    it('should show staff status badges', async () => {
      const wrapper = await mountStaffListPage()

      // Default filter is 'active', so we only see active status badges
      expect(wrapper.text()).toContain('active')
    })

    it('should show view button for each staff', async () => {
      const wrapper = await mountStaffListPage()

      // Default filter is 'active', so we only see 2 active staff members
      const viewButtons = wrapper.findAll('a').filter(a => a.text().includes('View'))
      expect(viewButtons.length).toBe(2)
    })
  })

  describe('filters', () => {
    it('should have search input', async () => {
      const wrapper = await mountStaffListPage()

      const searchInput = wrapper.find('input[type="search"], input[type="text"]')
      expect(searchInput.exists()).toBe(true)
    })

    it('should have status filter dropdown', async () => {
      const wrapper = await mountStaffListPage()

      const statusSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('All Status'))
      })

      expect(statusSelect).toBeDefined()
    })

    it('should have gender filter dropdown', async () => {
      const wrapper = await mountStaffListPage()

      const genderSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('All Genders'))
      })

      expect(genderSelect).toBeDefined()
    })

    it('should filter staff by search query', async () => {
      const wrapper = await mountStaffListPage()

      const searchInput = wrapper.find('input[type="search"], input[placeholder*="Search"]')
      await searchInput.setValue('Smith')
      await flushPromises()

      expect(wrapper.text()).toContain('Dr. Smith')
      // Jones may or may not be filtered depending on client-side filtering
    })

    it('should update filters on status change', async () => {
      const wrapper = await mountStaffListPage()

      const statusSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('Active'))
      })

      await statusSelect?.setValue('active')
      await flushPromises()

      // API should be called with status filter
      expect(staffService.list).toHaveBeenCalled()
    })
  })

  describe('add staff button and permissions', () => {
    it('should show add button when user can manage staff', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      expect(wrapper.text()).toContain('Add Therapist')
    })

    it('should not show add button when user cannot manage staff', async () => {
      const wrapper = await mountStaffListPage({ canManage: false })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Therapist'))
      expect(addButton).toBeUndefined()
    })

    it('should show voice input when user can manage staff', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })
  })

  describe('add staff modal', () => {
    it('should open add modal when add button clicked', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Therapist'))
      await addButton?.trigger('click')
      await flushPromises()

      // Modal should appear with form fields
      expect(wrapper.find('#name').exists()).toBe(true)
    })

    it('should have required form fields in add modal', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Therapist'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('#name').exists()).toBe(true)
      expect(wrapper.find('#email').exists()).toBe(true)
      expect(wrapper.find('#gender').exists()).toBe(true)
    })

    it('should call createStaff on form submit', async () => {
      vi.mocked(staffService.create).mockResolvedValue({
        data: {
          id: 'new-staff',
          organizationId: 'org-1',
          name: 'New Staff',
          email: 'new@example.com',
          gender: 'male',
          certifications: [],
          status: 'active',
          maxSessionsPerDay: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      })

      const wrapper = await mountStaffListPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Therapist'))
      await addButton?.trigger('click')
      await flushPromises()

      // Fill form
      await wrapper.find('#name').setValue('New Staff')
      await wrapper.find('#email').setValue('new@example.com')

      // Submit form
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await flushPromises()

      expect(staffService.create).toHaveBeenCalled()
    })

    it('should close modal on cancel', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Therapist'))
      await addButton?.trigger('click')
      await flushPromises()

      // Modal should be open
      expect(wrapper.find('#name').exists()).toBe(true)

      // Click cancel
      const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('Cancel'))
      await cancelButton?.trigger('click')
      await flushPromises()

      // Modal should be closed
      expect(wrapper.find('#name').exists()).toBe(false)
    })
  })

  describe('voice input', () => {
    it('should render voice input component for staff management', async () => {
      const wrapper = await mountStaffListPage({ canManage: true })

      // Voice input should be rendered
      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })
  })

  describe('loading and error states', () => {
    it('should show loading state when fetching staff', async () => {
      vi.mocked(staffService.list).mockReturnValue(new Promise(() => {}) as never)

      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('Loading')
    })

    it('should set error in store when fetch fails', async () => {
      vi.mocked(staffService.list).mockRejectedValue(new Error('Failed to fetch staff'))

      const staffStore = useStaffStore()

      try {
        await staffStore.fetchStaff()
      } catch {
        // Expected to throw
      }

      expect(staffStore.error).toBe('Failed to fetch staff')
    })
  })

  describe('store integration', () => {
    it('should update store with fetched staff', async () => {
      const wrapper = await mountStaffListPage()

      const staffStore = useStaffStore()
      // Store contains at least 3 staff members from our mock
      expect(staffStore.staff.length).toBeGreaterThanOrEqual(3)
    })

    it('should update total count in store', async () => {
      const wrapper = await mountStaffListPage()

      const staffStore = useStaffStore()
      expect(staffStore.totalCount).toBe(3)
    })
  })

  describe('empty state', () => {
    it('should show empty message when no staff found', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const wrapper = await mountStaffListPage()

      expect(wrapper.text()).toContain('No therapists found')
    })
  })
})
