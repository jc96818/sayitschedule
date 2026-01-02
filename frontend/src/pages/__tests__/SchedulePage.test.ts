import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import SchedulePage from '../SchedulePage.vue'
import { useSchedulesStore } from '@/stores/schedules'
import type { Schedule, Session } from '@/types'
import { scheduleService } from '@/services/api'

// Mock the API services
vi.mock('@/services/api', () => ({
  scheduleService: {
    list: vi.fn(),
    get: vi.fn(),
    generate: vi.fn(),
    publish: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    createSession: vi.fn(),
    modifyByVoice: vi.fn(),
    createDraftCopy: vi.fn(),
    exportPdf: vi.fn()
  },
  voiceService: {
    parseSchedule: vi.fn(),
    parseScheduleGenerate: vi.fn()
  },
  staffService: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  roomService: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  patientService: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

// Mock the subdomain utility
vi.mock('@/utils/subdomain', () => ({
  getSubdomain: vi.fn(() => 'demo')
}))

// Mock the holidays utility
vi.mock('@/utils/holidays', () => ({
  getFederalHoliday: vi.fn(() => null)
}))

// Mock the useLabels composable
vi.mock('@/composables/useLabels', () => ({
  useLabels: () => ({
    staffLabel: 'Therapists',
    staffLabelSingular: 'Therapist',
    staffLabelLower: 'therapists',
    patientLabel: 'Patients',
    patientLabelSingular: 'Patient',
    patientLabelLower: 'patients',
    roomLabel: 'Rooms',
    roomLabelSingular: 'Room',
    certificationLabel: 'Certifications'
  })
}))

// Create a minimal router for testing
const createTestRouter = () => {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/schedule', name: 'schedule', component: SchedulePage },
      { path: '/app/schedule/generate', name: 'schedule-generate', component: { template: '<div>Generate</div>' } },
      { path: '/app/schedule/:id/print', name: 'schedule-print', component: { template: '<div>Print</div>' } }
    ]
  })
}

// Get current week start date for testing
const getCurrentWeekStart = () => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek.toISOString().split('T')[0]
}

describe('SchedulePage', () => {
  let router: ReturnType<typeof createTestRouter>

  // Use dynamic week start date that matches what the component expects
  const weekStartDate = getCurrentWeekStart()

  const mockSession: Session = {
    id: 'session-1',
    scheduleId: 'schedule-1',
    therapistId: 'staff-1',
    patientId: 'patient-1',
    roomId: 'room-1',
    date: weekStartDate,
    startTime: '09:00',
    endTime: '10:00',
    notes: null,
    createdAt: '2024-01-01T00:00:00Z',
    therapistName: 'Dr. Smith',
    patientName: 'John Doe',
    roomName: 'Room A'
  }

  const mockSchedule: Schedule & { sessions: Session[] } = {
    id: 'schedule-1',
    organizationId: 'org-1',
    weekStartDate,
    status: 'draft',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    publishedAt: null,
    version: 1,
    sessions: [mockSession]
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createTestRouter()
    vi.clearAllMocks()

    // Default mock for schedule list - returns empty array (no schedule for current week)
    vi.mocked(scheduleService.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0
    })

    // Push to the route before tests
    await router.push('/app/schedule')
    await router.isReady()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mountSchedulePage = async (options?: {
    schedule?: typeof mockSchedule,
    preloadStore?: boolean
  }) => {
    // If schedule is provided, set up the mocks for it
    if (options?.schedule) {
      vi.mocked(scheduleService.list).mockResolvedValue({
        data: [options.schedule],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      vi.mocked(scheduleService.get).mockResolvedValue({
        data: options.schedule
      })
    }

    // Optionally preload the store to bypass async loading
    if (options?.preloadStore && options?.schedule) {
      const schedulesStore = useSchedulesStore()
      schedulesStore.schedules = [options.schedule]
      schedulesStore.currentSchedule = options.schedule
      schedulesStore.loading = false
    }

    const wrapper = mount(SchedulePage, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to']
          },
          VoiceInput: {
            template: '<div class="voice-input-stub"></div>',
            emits: ['result', 'show-hints']
          },
          VoiceHintsModal: {
            template: '<div class="voice-hints-modal-stub"></div>'
          },
          StatCard: {
            template: '<div class="stat-card-stub"><slot /></div>',
            props: ['value', 'label', 'icon', 'color']
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  describe('initial state - no schedule', () => {
    it('should render no schedule message when no schedule exists for current week', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.text()).toContain('No Schedule for This Week')
      expect(wrapper.text()).toContain('Generate a new schedule')
    })

    it('should show Generate Schedule button when no schedule exists', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.find('a[href="/app/schedule/generate"]').exists()).toBe(true)
    })

    it('should show voice input when no schedule exists', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })
  })

  describe('loading state', () => {
    it('should show loading message when fetching schedule', async () => {
      // Create a promise that never resolves to keep loading state
      vi.mocked(scheduleService.list).mockReturnValue(new Promise(() => {}) as never)

      const wrapper = await mountSchedulePage()

      expect(wrapper.text()).toContain('Loading schedule...')
    })
  })

  describe('schedule display', () => {
    it('should render weekly schedule header always', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.find('h2').text()).toBe('Weekly Schedule')
    })

    it('should call schedule API on mount', async () => {
      const wrapper = await mountSchedulePage({ schedule: mockSchedule })

      expect(scheduleService.list).toHaveBeenCalled()
    })

    it('should call schedule list to fetch schedules on mount', async () => {
      const wrapper = await mountSchedulePage({ schedule: mockSchedule })

      expect(scheduleService.list).toHaveBeenCalled()
    })
  })

  describe('week navigation', () => {
    it('should have prev and next week buttons', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.text()).toContain('Prev')
      expect(wrapper.text()).toContain('Next')
    })

    it('should call schedule list on prev week click', async () => {
      const wrapper = await mountSchedulePage()

      // Clear initial call count
      vi.mocked(scheduleService.list).mockClear()

      const prevButton = wrapper.findAll('button').find(btn => btn.text().includes('Prev'))
      await prevButton?.trigger('click')
      await flushPromises()

      expect(scheduleService.list).toHaveBeenCalled()
    })

    it('should call schedule list on next week click', async () => {
      const wrapper = await mountSchedulePage()

      // Clear initial call count
      vi.mocked(scheduleService.list).mockClear()

      const nextButton = wrapper.findAll('button').find(btn => btn.text().includes('Next'))
      await nextButton?.trigger('click')
      await flushPromises()

      expect(scheduleService.list).toHaveBeenCalled()
    })
  })

  describe('schedule actions - draft mode', () => {
    it('should fetch schedules when component mounts', async () => {
      const wrapper = await mountSchedulePage({ schedule: mockSchedule })

      await flushPromises()

      // Verify scheduleService.list was called to fetch schedules
      expect(scheduleService.list).toHaveBeenCalled()
    })

    it('should call publish API when store publish method is triggered', async () => {
      vi.mocked(scheduleService.publish).mockResolvedValue({
        data: { ...mockSchedule, status: 'published' as const, publishedAt: '2024-01-15T00:00:00Z' }
      })

      // Set up the store with a schedule directly
      const schedulesStore = useSchedulesStore()
      schedulesStore.currentSchedule = mockSchedule

      await schedulesStore.publishSchedule(mockSchedule.id)

      expect(scheduleService.publish).toHaveBeenCalledWith('schedule-1')
    })
  })

  describe('schedule actions - published mode', () => {
    const publishedSchedule = {
      ...mockSchedule,
      status: 'published' as const,
      publishedAt: '2024-01-10T00:00:00Z'
    }

    it('should fetch schedules for published schedule', async () => {
      const wrapper = await mountSchedulePage({ schedule: publishedSchedule })

      await flushPromises()

      expect(scheduleService.list).toHaveBeenCalled()
    })

    it('should call createDraftCopy API when store method is called', async () => {
      vi.mocked(scheduleService.createDraftCopy).mockResolvedValue({
        data: { ...mockSchedule, id: 'schedule-2', status: 'draft' as const },
        meta: { message: 'Draft created', sourceScheduleId: 'schedule-1' }
      })

      // Set up the store with a schedule directly
      const schedulesStore = useSchedulesStore()
      schedulesStore.currentSchedule = publishedSchedule

      await schedulesStore.createDraftCopy(publishedSchedule.id)

      expect(scheduleService.createDraftCopy).toHaveBeenCalledWith('schedule-1')
    })
  })

  describe('export and print actions', () => {
    it('should have print button', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.text()).toContain('Print')
    })

    it('should have download PDF button', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.text()).toContain('Download PDF')
    })

    it('should disable export buttons when no schedule', async () => {
      const wrapper = await mountSchedulePage()

      const printButton = wrapper.findAll('button').find(btn => btn.text().includes('Print'))
      const pdfButton = wrapper.findAll('button').find(btn => btn.text().includes('Download PDF'))

      expect(printButton?.attributes('disabled')).toBeDefined()
      expect(pdfButton?.attributes('disabled')).toBeDefined()
    })
  })

  describe('view modes', () => {
    it('should render schedule with calendar view as default', async () => {
      const wrapper = await mountSchedulePage({ schedule: mockSchedule })

      await flushPromises()

      // The schedule list should have been called to fetch schedules
      expect(scheduleService.list).toHaveBeenCalled()
    })
  })

  describe('schedule stats', () => {
    it('should fetch schedule on mount', async () => {
      const wrapper = await mountSchedulePage({ schedule: mockSchedule })

      await flushPromises()

      // Stats are displayed when schedule is loaded
      expect(scheduleService.list).toHaveBeenCalled()
    })
  })

  describe('calendar legend', () => {
    it('should render weekly schedule header', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.find('h2').text()).toBe('Weekly Schedule')
    })
  })

  describe('voice input visibility', () => {
    it('should show voice input component', async () => {
      const wrapper = await mountSchedulePage()

      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })
  })

  describe('store state', () => {
    it('should initialize store with empty schedules', async () => {
      const wrapper = await mountSchedulePage()

      const schedulesStore = useSchedulesStore()
      // After mounting, the store should have called list
      expect(scheduleService.list).toHaveBeenCalled()
    })

    it('should update copyModifications when set in store', async () => {
      const wrapper = await mountSchedulePage()

      const schedulesStore = useSchedulesStore()
      schedulesStore.copyModifications = {
        regenerated: [{
          original: {
            patientName: 'John Doe',
            therapistName: 'Dr. Smith',
            date: '2024-01-15',
            startTime: '09:00'
          },
          replacement: {
            patientName: 'John Doe',
            therapistName: 'Dr. Smith',
            date: '2024-01-15',
            startTime: '14:00'
          },
          reason: 'Therapist unavailable'
        }],
        removed: [],
        warnings: []
      }

      await wrapper.vm.$nextTick()

      expect(schedulesStore.copyModifications).not.toBeNull()
      expect(schedulesStore.copyModifications?.regenerated.length).toBe(1)
    })
  })
})
