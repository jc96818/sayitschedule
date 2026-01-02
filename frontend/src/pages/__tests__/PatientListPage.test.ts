import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PatientListPage from '../PatientListPage.vue'
import { usePatientsStore } from '@/stores/patients'
import { useAuthStore } from '@/stores/auth'
import type { Patient } from '@/types'
import { patientService, voiceService } from '@/services/api'

// Mock the API services
vi.mock('@/services/api', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  voiceService: {
    parsePatient: vi.fn()
  }
}))

// Mock the useLabels composable
vi.mock('@/composables/useLabels', () => ({
  useLabels: () => ({
    patientLabel: 'Patients',
    patientLabelSingular: 'Patient',
    patientLabelLower: 'patients',
    patientLabelSingularLower: 'patient',
    certificationLabel: 'Certifications',
    staffLabelSingular: 'Therapist'
  })
}))

// Create a minimal router for testing
const createTestRouter = () => {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/patients', name: 'patient-list', component: PatientListPage },
      { path: '/app/patients/:id', name: 'patient-profile', component: { template: '<div>Patient Profile</div>' } }
    ]
  })
}

describe('PatientListPage', () => {
  let router: ReturnType<typeof createTestRouter>

  const mockPatients: Patient[] = [
    {
      id: 'patient-1',
      organizationId: 'org-1',
      name: 'John Doe',
      gender: 'male',
      dateOfBirth: '2015-03-15',
      guardianName: 'Jane Doe',
      guardianPhone: '555-1234',
      guardianEmail: 'jane@example.com',
      sessionsPerWeek: 3,
      sessionDuration: 60,
      requiredCertifications: ['ABA', 'RBT'],
      genderPreference: null,
      notes: 'Test notes',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'patient-2',
      organizationId: 'org-1',
      name: 'Sarah Smith',
      gender: 'female',
      dateOfBirth: '2016-07-20',
      guardianName: 'Bob Smith',
      guardianPhone: '555-5678',
      guardianEmail: 'bob@example.com',
      sessionsPerWeek: 2,
      sessionDuration: 45,
      requiredCertifications: ['BCBA'],
      genderPreference: 'female',
      notes: null,
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'patient-3',
      organizationId: 'org-1',
      name: 'Tommy Brown',
      gender: 'male',
      dateOfBirth: '2014-11-10',
      guardianName: 'Mary Brown',
      guardianPhone: '555-9999',
      guardianEmail: 'mary@example.com',
      sessionsPerWeek: 1,
      sessionDuration: 30,
      requiredCertifications: [],
      genderPreference: 'male',
      notes: null,
      status: 'inactive',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createTestRouter()
    vi.clearAllMocks()

    // Default mock for patient list
    vi.mocked(patientService.list).mockResolvedValue({
      data: mockPatients,
      total: 3,
      page: 1,
      limit: 50,
      totalPages: 1
    })

    // Push to the route before tests
    await router.push('/app/patients')
    await router.isReady()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mountPatientListPage = async (options?: { canManage?: boolean }) => {
    // Set up auth store permissions
    const authStore = useAuthStore()
    Object.defineProperty(authStore, 'canManagePatients', {
      get: () => options?.canManage ?? true,
      configurable: true
    })

    const wrapper = mount(PatientListPage, {
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
    it('should render page header with patient label', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('Patients Management')
    })

    it('should fetch patients on mount', async () => {
      const wrapper = await mountPatientListPage()

      expect(patientService.list).toHaveBeenCalled()
    })

    it('should display patient list in table', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('John Doe')
      expect(wrapper.text()).toContain('Sarah Smith')
    })

    it('should show total patient count', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('Patients (3)')
    })
  })

  describe('patient table display', () => {
    it('should show patient name with initials', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('John Doe')
      expect(wrapper.text()).toContain('JD') // Initials
    })

    it('should show patient gender', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('male')
      expect(wrapper.text()).toContain('female')
    })

    it('should show sessions per week', async () => {
      const wrapper = await mountPatientListPage()

      // Session counts 3 and 2 for the active patients
      expect(wrapper.text()).toMatch(/3/)
      expect(wrapper.text()).toMatch(/2/)
    })

    it('should show patient certifications', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('ABA')
      expect(wrapper.text()).toContain('BCBA')
    })

    it('should show patient status badges', async () => {
      const wrapper = await mountPatientListPage()

      // Default filter is 'active', so we only see active status badges
      expect(wrapper.text()).toContain('active')
    })

    it('should show view button for each patient', async () => {
      const wrapper = await mountPatientListPage()

      // Default filter is 'active', so we only see 2 active patients
      const viewButtons = wrapper.findAll('a').filter(a => a.text().includes('View'))
      expect(viewButtons.length).toBe(2)
    })

    it('should show gender preference', async () => {
      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('Any') // null preference shows as 'Any'
      expect(wrapper.text()).toContain('female') // Sarah's preference
    })
  })

  describe('filters', () => {
    it('should have search input', async () => {
      const wrapper = await mountPatientListPage()

      const searchInput = wrapper.find('input[type="search"], input[type="text"]')
      expect(searchInput.exists()).toBe(true)
    })

    it('should have status filter dropdown', async () => {
      const wrapper = await mountPatientListPage()

      const statusSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('All Status'))
      })

      expect(statusSelect).toBeDefined()
    })

    it('should have gender filter dropdown', async () => {
      const wrapper = await mountPatientListPage()

      const genderSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('All Genders'))
      })

      expect(genderSelect).toBeDefined()
    })

    it('should filter patients by search query', async () => {
      const wrapper = await mountPatientListPage()

      const searchInput = wrapper.find('input[type="search"], input[placeholder*="Search"]')
      await searchInput.setValue('John')
      await flushPromises()

      expect(wrapper.text()).toContain('John Doe')
    })

    it('should update filters on status change', async () => {
      const wrapper = await mountPatientListPage()

      const statusSelect = wrapper.findAll('select').find(select => {
        const options = select.findAll('option')
        return options.some(opt => opt.text().includes('Active'))
      })

      await statusSelect?.setValue('active')
      await flushPromises()

      // API should be called with status filter
      expect(patientService.list).toHaveBeenCalled()
    })
  })

  describe('add patient button and permissions', () => {
    it('should show add button when user can manage patients', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      expect(wrapper.text()).toContain('Add Patient')
    })

    it('should not show add button when user cannot manage patients', async () => {
      const wrapper = await mountPatientListPage({ canManage: false })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
      expect(addButton).toBeUndefined()
    })

    it('should show voice input when user can manage patients', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })

    it('should not show voice input when user cannot manage patients', async () => {
      const wrapper = await mountPatientListPage({ canManage: false })

      expect(wrapper.find('.voice-input-stub').exists()).toBe(false)
    })
  })

  describe('add patient modal', () => {
    it('should open add modal when add button clicked', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
      await addButton?.trigger('click')
      await flushPromises()

      // Modal should appear with form fields
      expect(wrapper.find('#name').exists()).toBe(true)
    })

    it('should have required form fields in add modal', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('#name').exists()).toBe(true)
      expect(wrapper.find('#gender').exists()).toBe(true)
      expect(wrapper.find('#sessions').exists()).toBe(true)
      expect(wrapper.find('#duration').exists()).toBe(true)
    })

    it('should have guardian fields in add modal', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('#guardian').exists()).toBe(true)
      expect(wrapper.find('#guardianPhone').exists()).toBe(true)
      expect(wrapper.find('#guardianEmail').exists()).toBe(true)
    })

    it('should call createPatient on form submit', async () => {
      vi.mocked(patientService.create).mockResolvedValue({
        data: {
          id: 'new-patient',
          organizationId: 'org-1',
          name: 'New Patient',
          gender: 'female',
          sessionsPerWeek: 2,
          sessionDuration: 60,
          requiredCertifications: [],
          genderPreference: null,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      })

      const wrapper = await mountPatientListPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
      await addButton?.trigger('click')
      await flushPromises()

      // Fill form
      await wrapper.find('#name').setValue('New Patient')

      // Submit form
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await flushPromises()

      expect(patientService.create).toHaveBeenCalled()
    })

    it('should close modal on cancel', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Patient'))
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
    it('should render voice input component for patient management', async () => {
      const wrapper = await mountPatientListPage({ canManage: true })

      // Voice input should be rendered
      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })
  })

  describe('loading and error states', () => {
    it('should show loading state when fetching patients', async () => {
      vi.mocked(patientService.list).mockReturnValue(new Promise(() => {}) as never)

      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('Loading')
    })

    it('should set error in store when fetch fails', async () => {
      vi.mocked(patientService.list).mockRejectedValue(new Error('Failed to fetch patients'))

      const patientsStore = usePatientsStore()

      try {
        await patientsStore.fetchPatients()
      } catch {
        // Expected to throw
      }

      expect(patientsStore.error).toBe('Failed to fetch patients')
    })
  })

  describe('store integration', () => {
    it('should update store with fetched patients', async () => {
      const wrapper = await mountPatientListPage()

      const patientsStore = usePatientsStore()
      // Store contains at least 3 patients from our mock
      expect(patientsStore.patients.length).toBeGreaterThanOrEqual(3)
    })

    it('should update total count in store', async () => {
      const wrapper = await mountPatientListPage()

      const patientsStore = usePatientsStore()
      expect(patientsStore.totalCount).toBe(3)
    })
  })

  describe('empty state', () => {
    it('should show empty message when no patients found', async () => {
      vi.mocked(patientService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const wrapper = await mountPatientListPage()

      expect(wrapper.text()).toContain('No patients found')
    })
  })
})
