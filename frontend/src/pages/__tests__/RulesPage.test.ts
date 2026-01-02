import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import RulesPage from '../RulesPage.vue'
import { useRulesStore } from '@/stores/rules'
import { useAuthStore } from '@/stores/auth'
import type { Rule, ParsedMultiRuleResponse } from '@/types'
import { rulesService, voiceService } from '@/services/api'

// Mock the API services
vi.mock('@/services/api', () => ({
  rulesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    analyze: vi.fn()
  },
  voiceService: {
    parseRule: vi.fn()
  }
}))

describe('RulesPage', () => {
  const mockRules: Rule[] = [
    {
      id: 'rule-1',
      organizationId: 'org-1',
      category: 'gender_pairing',
      description: 'Male therapists for male patients only',
      ruleLogic: {},
      priority: 50,
      isActive: true,
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'rule-2',
      organizationId: 'org-1',
      category: 'session',
      description: 'No sessions after 5pm',
      ruleLogic: {},
      priority: 40,
      isActive: true,
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'rule-3',
      organizationId: 'org-1',
      category: 'availability',
      description: 'Dr Smith not available on Fridays',
      ruleLogic: {},
      priority: 30,
      isActive: false,
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'rule-4',
      organizationId: 'org-1',
      category: 'specific_pairing',
      description: 'John always with Dr. Johnson',
      ruleLogic: {},
      priority: 60,
      isActive: true,
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'rule-5',
      organizationId: 'org-1',
      category: 'certification',
      description: 'ABA certification required for autism patients',
      ruleLogic: {},
      priority: 70,
      isActive: true,
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Default mock for rules list
    vi.mocked(rulesService.list).mockResolvedValue({
      data: mockRules,
      total: 5,
      page: 1,
      limit: 50,
      totalPages: 1
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mountRulesPage = async (options?: { canManage?: boolean }) => {
    // Set up auth store permissions
    const authStore = useAuthStore()
    Object.defineProperty(authStore, 'canManageRules', {
      get: () => options?.canManage ?? true,
      configurable: true
    })

    const wrapper = mount(RulesPage, {
      global: {
        stubs: {
          VoiceInput: {
            template: '<div class="voice-input-stub"></div>',
            emits: ['result', 'show-hints']
          },
          VoiceHintsModal: {
            template: '<div class="voice-hints-modal-stub"></div>'
          },
          Modal: {
            template: '<div class="modal-stub" v-if="modelValue"><slot /></div>',
            props: ['modelValue', 'title', 'size'],
            emits: ['close']
          },
          Alert: {
            template: '<div class="alert-stub" :class="variant"><slot /></div>',
            props: ['variant', 'dismissible'],
            emits: ['dismiss']
          },
          Badge: {
            template: '<span class="badge-stub" :class="variant"><slot /></span>',
            props: ['variant']
          },
          Button: {
            template: '<button :type="type || \'button\'" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
            props: ['variant', 'type', 'disabled', 'loading', 'size'],
            emits: ['click']
          },
          Toggle: {
            template: '<input type="checkbox" class="toggle-stub" :checked="modelValue" @change="$emit(\'update:modelValue\', !modelValue)" />',
            props: ['modelValue'],
            emits: ['update:modelValue']
          },
          RuleAnalysisModal: {
            template: '<div class="rule-analysis-modal-stub" v-if="modelValue"></div>',
            props: ['modelValue'],
            emits: ['create-rule']
          },
          SearchBox: {
            template: '<input type="text" class="search-box-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'placeholder'],
            emits: ['update:modelValue']
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  describe('initial load', () => {
    it('should render page header', async () => {
      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('Scheduling Rules')
      expect(wrapper.text()).toContain('Manage rules that govern schedule generation')
    })

    it('should fetch rules on mount', async () => {
      await mountRulesPage()

      expect(rulesService.list).toHaveBeenCalled()
    })

    it('should display rules list', async () => {
      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('Male therapists for male patients only')
      expect(wrapper.text()).toContain('No sessions after 5pm')
    })

    it('should show rule count in card header', async () => {
      const wrapper = await mountRulesPage()

      // Default status filter is 'active', so we see 4 active rules
      expect(wrapper.text()).toMatch(/All Rules \(4\)/)
    })
  })

  describe('rules display', () => {
    it('should show category badges for rules', async () => {
      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('Gender Pairing')
      expect(wrapper.text()).toContain('Session')
    })

    it('should show rule descriptions', async () => {
      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('Male therapists for male patients only')
      expect(wrapper.text()).toContain('No sessions after 5pm')
      expect(wrapper.text()).toContain('John always with Dr. Johnson')
    })

    it('should show Disabled badge for inactive rules when viewing all', async () => {
      const wrapper = await mountRulesPage()

      // Change status filter to 'all'
      const statusSelect = wrapper.find('select.status-filter')
      await statusSelect.setValue('all')
      await flushPromises()

      expect(wrapper.text()).toContain('Disabled')
    })

    it('should apply disabled styling to inactive rules', async () => {
      const wrapper = await mountRulesPage()

      // Change to show all rules
      const statusSelect = wrapper.find('select.status-filter')
      await statusSelect.setValue('all')
      await flushPromises()

      const ruleItems = wrapper.findAll('.rule-item')
      const disabledItem = ruleItems.find(item => item.classes('disabled'))
      expect(disabledItem).toBeDefined()
    })
  })

  describe('category tabs', () => {
    it('should render all category tabs', async () => {
      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('All Rules')
      expect(wrapper.text()).toContain('Gender Pairing')
      expect(wrapper.text()).toContain('Session Rules')
      expect(wrapper.text()).toContain('Specific Pairings')
      expect(wrapper.text()).toContain('Availability')
      expect(wrapper.text()).toContain('Certification')
    })

    it('should have All Rules tab active by default', async () => {
      const wrapper = await mountRulesPage()

      const activeTab = wrapper.find('.tab.active')
      expect(activeTab.text()).toContain('All Rules')
    })

    it('should filter rules by category when tab clicked', async () => {
      const wrapper = await mountRulesPage()

      // Click on Session Rules tab
      const sessionTab = wrapper.findAll('.tab').find(tab => tab.text().includes('Session Rules'))
      await sessionTab?.trigger('click')
      await flushPromises()

      // Should only show session rules
      expect(wrapper.text()).toContain('No sessions after 5pm')
      expect(wrapper.text()).not.toContain('Male therapists for male patients only')
    })

    it('should update card header when category changes', async () => {
      const wrapper = await mountRulesPage()

      // Click on Gender Pairing tab
      const genderTab = wrapper.findAll('.tab').find(tab => tab.text().includes('Gender Pairing'))
      await genderTab?.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toMatch(/Gender Pairing \(1\)/)
    })
  })

  describe('status filter', () => {
    it('should have status filter dropdown', async () => {
      const wrapper = await mountRulesPage()

      const statusSelect = wrapper.find('select.status-filter')
      expect(statusSelect.exists()).toBe(true)
    })

    it('should default to Active filter', async () => {
      const wrapper = await mountRulesPage()

      const statusSelect = wrapper.find('select.status-filter')
      expect((statusSelect.element as HTMLSelectElement).value).toBe('active')
    })

    it('should show only active rules by default', async () => {
      const wrapper = await mountRulesPage()

      // rule-3 is inactive, should not be visible
      expect(wrapper.text()).not.toContain('Dr Smith not available on Fridays')
    })

    it('should show inactive rules when filter changed', async () => {
      const wrapper = await mountRulesPage()

      const statusSelect = wrapper.find('select.status-filter')
      await statusSelect.setValue('inactive')
      await flushPromises()

      expect(wrapper.text()).toContain('Dr Smith not available on Fridays')
      expect(wrapper.text()).not.toContain('Male therapists for male patients only')
    })

    it('should show all rules when filter set to all', async () => {
      const wrapper = await mountRulesPage()

      const statusSelect = wrapper.find('select.status-filter')
      await statusSelect.setValue('all')
      await flushPromises()

      expect(wrapper.text()).toContain('Male therapists for male patients only')
      expect(wrapper.text()).toContain('Dr Smith not available on Fridays')
    })
  })

  describe('search', () => {
    it('should have search input', async () => {
      const wrapper = await mountRulesPage()

      const searchInput = wrapper.find('.search-box-stub')
      expect(searchInput.exists()).toBe(true)
    })

    it('should filter rules by search query', async () => {
      const wrapper = await mountRulesPage()

      const searchInput = wrapper.find('.search-box-stub')
      await searchInput.setValue('male')
      await flushPromises()

      expect(wrapper.text()).toContain('Male therapists for male patients only')
      expect(wrapper.text()).not.toContain('No sessions after 5pm')
    })

    it('should search in category labels', async () => {
      const wrapper = await mountRulesPage()

      const searchInput = wrapper.find('.search-box-stub')
      await searchInput.setValue('session')
      await flushPromises()

      expect(wrapper.text()).toContain('No sessions after 5pm')
    })
  })

  describe('add rule button and permissions', () => {
    it('should show Add Rule button when user can manage rules', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      expect(wrapper.text()).toContain('Add Rule')
    })

    it('should not show Add Rule button when user cannot manage rules', async () => {
      const wrapper = await mountRulesPage({ canManage: false })

      expect(wrapper.text()).not.toContain('Add Rule')
    })

    it('should show Analyze Rules button when user can manage rules', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      expect(wrapper.text()).toContain('Analyze Rules')
    })

    it('should show voice input when user can manage rules', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      expect(wrapper.find('.voice-input-stub').exists()).toBe(true)
    })

    it('should not show voice input when user cannot manage rules', async () => {
      const wrapper = await mountRulesPage({ canManage: false })

      expect(wrapper.find('.voice-input-stub').exists()).toBe(false)
    })
  })

  describe('add rule modal', () => {
    it('should open add modal when Add Rule button clicked', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('.modal-stub').exists()).toBe(true)
      expect(wrapper.find('#category').exists()).toBe(true)
    })

    it('should have category dropdown in add modal', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      const categorySelect = wrapper.find('#category')
      expect(categorySelect.exists()).toBe(true)

      const options = categorySelect.findAll('option')
      expect(options.length).toBeGreaterThanOrEqual(6) // At least 6 categories
    })

    it('should have description textarea in add modal', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('#description').exists()).toBe(true)
    })

    it('should have priority input in add modal', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('#priority').exists()).toBe(true)
    })

    it('should call createRule on form submit', async () => {
      vi.mocked(rulesService.create).mockResolvedValue({
        data: {
          id: 'new-rule',
          organizationId: 'org-1',
          category: 'session',
          description: 'New test rule',
          ruleLogic: {},
          priority: 50,
          isActive: true,
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      })

      const wrapper = await mountRulesPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      // Fill form
      await wrapper.find('#description').setValue('New test rule')
      await wrapper.find('#category').setValue('session')

      // Submit form
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await flushPromises()

      expect(rulesService.create).toHaveBeenCalled()
    })

    it('should close modal on cancel', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      // Open modal
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('Add Rule'))
      await addButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('.modal-stub').exists()).toBe(true)

      // Click cancel
      const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('Cancel'))
      await cancelButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('.modal-stub').exists()).toBe(false)
    })
  })

  describe('edit rule', () => {
    it('should show edit button for each rule when user can manage', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const editButtons = wrapper.findAll('button[title="Edit rule"]')
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('should not show edit button when user cannot manage', async () => {
      const wrapper = await mountRulesPage({ canManage: false })

      const editButtons = wrapper.findAll('button[title="Edit rule"]')
      expect(editButtons.length).toBe(0)
    })

    it('should open edit modal when edit button clicked', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      // Click edit on first rule
      const editButton = wrapper.find('button[title="Edit rule"]')
      await editButton.trigger('click')
      await flushPromises()

      expect(wrapper.find('.modal-stub').exists()).toBe(true)
      // Should have the rule's description pre-filled
      const descriptionInput = wrapper.find('#description')
      expect((descriptionInput.element as HTMLTextAreaElement).value).toBe('Male therapists for male patients only')
    })
  })

  describe('delete rule', () => {
    it('should show delete button for each rule when user can manage', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const deleteButtons = wrapper.findAll('button[title="Delete rule"]')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('should not show delete button when user cannot manage', async () => {
      const wrapper = await mountRulesPage({ canManage: false })

      const deleteButtons = wrapper.findAll('button[title="Delete rule"]')
      expect(deleteButtons.length).toBe(0)
    })

    it('should call deleteRule when delete confirmed', async () => {
      vi.mocked(rulesService.delete).mockResolvedValue(undefined)
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const wrapper = await mountRulesPage({ canManage: true })

      // Click delete on first rule
      const deleteButton = wrapper.find('button[title="Delete rule"]')
      await deleteButton.trigger('click')
      await flushPromises()

      expect(rulesService.delete).toHaveBeenCalledWith('rule-1')
    })

    it('should not delete when confirmation cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      const wrapper = await mountRulesPage({ canManage: true })

      // Click delete on first rule
      const deleteButton = wrapper.find('button[title="Delete rule"]')
      await deleteButton.trigger('click')
      await flushPromises()

      expect(rulesService.delete).not.toHaveBeenCalled()
    })
  })

  describe('toggle rule', () => {
    it('should show toggle for each rule when user can manage', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const toggles = wrapper.findAll('.toggle-stub')
      expect(toggles.length).toBeGreaterThan(0)
    })

    it('should not show toggle when user cannot manage', async () => {
      const wrapper = await mountRulesPage({ canManage: false })

      const toggles = wrapper.findAll('.toggle-stub')
      expect(toggles.length).toBe(0)
    })

    it('should call updateRule when toggle clicked', async () => {
      vi.mocked(rulesService.update).mockResolvedValue({
        data: { ...mockRules[0], isActive: false }
      })

      const wrapper = await mountRulesPage({ canManage: true })

      // Click toggle on first rule
      const toggle = wrapper.find('.toggle-stub')
      await toggle.trigger('change')
      await flushPromises()

      expect(rulesService.update).toHaveBeenCalledWith('rule-1', { isActive: false })
    })
  })

  describe('voice input confirmation', () => {
    const mockParsedResponse: ParsedMultiRuleResponse = {
      commandType: 'create_rules',
      rules: [
        {
          category: 'gender_pairing',
          description: 'Female therapists for female patients',
          priority: 5,
          ruleLogic: {},
          confidence: 0.9,
          warnings: []
        }
      ],
      originalTranscript: 'Female therapists for female patients',
      globalWarnings: []
    }

    it('should show confirmation card after voice input parsed', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      // Simulate voice result
      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      // Trigger the component to show confirmation
      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.find('.confirmation-card').exists()).toBe(true)
    })

    it('should show original transcript in confirmation', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('Female therapists for female patients')
    })

    it('should show pending rule description', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.find('.pending-rule-card').exists()).toBe(true)
    })

    it('should show confidence indicator', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('90% confident')
    })

    it('should have confirm, edit, and reject buttons for pending rule', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      const pendingCard = wrapper.find('.pending-rule-card')
      expect(pendingCard.text()).toContain('Confirm')
      expect(pendingCard.text()).toContain('Edit')
      expect(pendingCard.text()).toContain('Reject')
    })

    it('should have Cancel All button in confirmation', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockParsedResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('Cancel All')
    })
  })

  describe('multi-rule voice confirmation', () => {
    const mockMultiRuleResponse: ParsedMultiRuleResponse = {
      commandType: 'create_rules',
      rules: [
        {
          category: 'gender_pairing',
          description: 'Female therapists for female patients',
          priority: 5,
          ruleLogic: {},
          confidence: 0.9,
          warnings: []
        },
        {
          category: 'session',
          description: 'No sessions before 9am',
          priority: 3,
          ruleLogic: {},
          confidence: 0.85,
          warnings: []
        }
      ],
      originalTranscript: 'Female therapists for female patients and no sessions before 9am',
      globalWarnings: []
    }

    it('should show rule count badge for multiple rules', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockMultiRuleResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients and no sessions before 9am')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('2 rules detected')
    })

    it('should show multiple pending rule cards', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockMultiRuleResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients and no sessions before 9am')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      const pendingCards = wrapper.findAll('.pending-rule-card')
      expect(pendingCards.length).toBe(2)
    })

    it('should show rule numbers for multiple rules', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockMultiRuleResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients and no sessions before 9am')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('Rule 1')
      expect(wrapper.text()).toContain('Rule 2')
    })

    it('should show Confirm All Remaining button for multiple rules', async () => {
      vi.mocked(voiceService.parseRule).mockResolvedValue({ data: mockMultiRuleResponse })

      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      await rulesStore.parseVoiceCommand('Female therapists for female patients and no sessions before 9am')
      await nextTick()

      const component = wrapper.vm as any
      component.showVoiceConfirmation = true
      await nextTick()

      expect(wrapper.text()).toContain('Confirm All Remaining')
    })
  })

  describe('loading and error states', () => {
    it('should show loading state when fetching rules', async () => {
      vi.mocked(rulesService.list).mockReturnValue(new Promise(() => {}) as never)

      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('Loading rules...')
    })

    it('should show error alert when error occurs', async () => {
      const wrapper = await mountRulesPage()

      const rulesStore = useRulesStore()
      rulesStore.error = 'Failed to load rules'
      await nextTick()

      expect(wrapper.find('.alert-stub').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed to load rules')
    })

    it('should show processing message when parsing voice', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const rulesStore = useRulesStore()
      rulesStore.parsing = true
      await nextTick()

      expect(wrapper.text()).toContain('Processing command...')
    })
  })

  describe('empty state', () => {
    it('should show empty message when no rules exist', async () => {
      vi.mocked(rulesService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const wrapper = await mountRulesPage()

      expect(wrapper.text()).toContain('No rules defined')
    })

    it('should show category empty message when no rules in category', async () => {
      const wrapper = await mountRulesPage()

      // Click on Availability tab (no active availability rules)
      const availabilityTab = wrapper.findAll('.tab').find(tab => tab.text().includes('Availability'))
      await availabilityTab?.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('No rules in this category')
    })
  })

  describe('rule analysis modal', () => {
    it('should have Analyze Rules button', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      expect(wrapper.text()).toContain('Analyze Rules')
    })

    it('should disable Analyze Rules button when no rules exist', async () => {
      vi.mocked(rulesService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const wrapper = await mountRulesPage({ canManage: true })

      const analyzeButton = wrapper.findAll('button').find(btn => btn.text().includes('Analyze Rules'))
      expect(analyzeButton?.attributes('disabled')).toBeDefined()
    })

    it('should open analysis modal when Analyze Rules clicked', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const analyzeButton = wrapper.findAll('button').find(btn => btn.text().includes('Analyze Rules'))
      await analyzeButton?.trigger('click')
      await flushPromises()

      expect(wrapper.find('.rule-analysis-modal-stub').exists()).toBe(true)
    })
  })

  describe('voice search detection', () => {
    it('should populate search when voice command is a search request', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      // Manually trigger handleVoiceResult with search command
      const component = wrapper.vm as any
      await component.handleVoiceResult('find rules for male patients')
      await nextTick()

      const searchInput = wrapper.find('.search-box-stub')
      expect((searchInput.element as HTMLInputElement).value).toBe('male patients')
    })

    it('should detect search patterns like "show rules about"', async () => {
      const wrapper = await mountRulesPage({ canManage: true })

      const component = wrapper.vm as any
      await component.handleVoiceResult('show rules about sessions')
      await nextTick()

      const searchInput = wrapper.find('.search-box-stub')
      expect((searchInput.element as HTMLInputElement).value).toBe('sessions')
    })
  })

  describe('store integration', () => {
    it('should update store with fetched rules', async () => {
      await mountRulesPage()

      const rulesStore = useRulesStore()
      // Store should have at least the 5 mock rules we provided
      expect(rulesStore.rules.length).toBeGreaterThanOrEqual(5)
    })

    it('should update total count in store', async () => {
      await mountRulesPage()

      const rulesStore = useRulesStore()
      expect(rulesStore.totalCount).toBe(5)
    })
  })
})
