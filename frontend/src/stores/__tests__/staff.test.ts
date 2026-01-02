import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStaffStore } from '../staff'
import { staffService } from '@/services/api'
import type { Staff } from '@/types'

// Mock the API service
vi.mock('@/services/api', () => ({
  staffService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

describe('useStaffStore', () => {
  const mockStaff: Staff = {
    id: 'staff-1',
    organizationId: 'org-1',
    userId: 'user-1',
    name: 'Dr. Jane Smith',
    gender: 'female',
    email: 'jane.smith@example.com',
    phone: '555-0100',
    certifications: ['CBT', 'Trauma'],
    defaultHours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' }
    },
    status: 'active',
    hireDate: '2023-01-15',
    createdAt: '2023-01-15T00:00:00Z'
  }

  const mockStaff2: Staff = {
    ...mockStaff,
    id: 'staff-2',
    name: 'Dr. John Doe',
    gender: 'male',
    email: 'john.doe@example.com'
  }

  const _mockInactiveStaff: Staff = {
    ...mockStaff,
    id: 'staff-3',
    name: 'Dr. Inactive',
    status: 'inactive'
  }
  void _mockInactiveStaff

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty staff array', () => {
      const store = useStaffStore()
      expect(store.staff).toEqual([])
    })

    it('should have null currentStaff', () => {
      const store = useStaffStore()
      expect(store.currentStaff).toBeNull()
    })

    it('should have loading set to false', () => {
      const store = useStaffStore()
      expect(store.loading).toBe(false)
    })

    it('should have no error', () => {
      const store = useStaffStore()
      expect(store.error).toBeNull()
    })

    it('should have totalCount of 0', () => {
      const store = useStaffStore()
      expect(store.totalCount).toBe(0)
    })
  })

  describe('fetchStaff', () => {
    it('should fetch and store staff list', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [mockStaff, mockStaff2],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useStaffStore()
      await store.fetchStaff()

      expect(staffService.list).toHaveBeenCalled()
      expect(store.staff).toHaveLength(2)
      expect(store.totalCount).toBe(2)
      expect(store.loading).toBe(false)
    })

    it('should pass search params to service', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [mockStaff],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useStaffStore()
      await store.fetchStaff({ search: 'Jane' })

      expect(staffService.list).toHaveBeenCalledWith({ search: 'Jane' })
    })

    it('should pass status filter to service', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [mockStaff],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useStaffStore()
      await store.fetchStaff({ status: 'active' })

      expect(staffService.list).toHaveBeenCalledWith({ status: 'active' })
    })

    it('should pass combined params to service', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const store = useStaffStore()
      await store.fetchStaff({ search: 'Dr', status: 'inactive' })

      expect(staffService.list).toHaveBeenCalledWith({ search: 'Dr', status: 'inactive' })
    })

    it('should set error on failure', async () => {
      vi.mocked(staffService.list).mockRejectedValue(new Error('Network error'))

      const store = useStaffStore()
      await expect(store.fetchStaff()).rejects.toThrow('Network error')

      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(staffService.list).mockReturnValue(promise as never)

      const store = useStaffStore()
      const fetchPromise = store.fetchStaff()

      expect(store.loading).toBe(true)

      resolvePromise!({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })
      await fetchPromise

      expect(store.loading).toBe(false)
    })

    it('should clear previous error on new fetch', async () => {
      vi.mocked(staffService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const store = useStaffStore()
      store.error = 'Previous error'

      await store.fetchStaff()

      expect(store.error).toBeNull()
    })
  })

  describe('fetchStaffById', () => {
    it('should fetch and set current staff', async () => {
      vi.mocked(staffService.get).mockResolvedValue({ data: mockStaff })

      const store = useStaffStore()
      const result = await store.fetchStaffById('staff-1')

      expect(staffService.get).toHaveBeenCalledWith('staff-1')
      expect(store.currentStaff).toEqual(mockStaff)
      expect(result).toEqual(mockStaff)
    })

    it('should set error on failure', async () => {
      vi.mocked(staffService.get).mockRejectedValue(new Error('Staff not found'))

      const store = useStaffStore()
      await expect(store.fetchStaffById('invalid-id')).rejects.toThrow('Staff not found')

      expect(store.error).toBe('Staff not found')
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(staffService.get).mockReturnValue(promise as never)

      const store = useStaffStore()
      const fetchPromise = store.fetchStaffById('staff-1')

      expect(store.loading).toBe(true)

      resolvePromise!({ data: mockStaff })
      await fetchPromise

      expect(store.loading).toBe(false)
    })
  })

  describe('createStaff', () => {
    it('should create and add new staff to list', async () => {
      vi.mocked(staffService.create).mockResolvedValue({ data: mockStaff })

      const store = useStaffStore()
      const newStaffData = {
        name: 'Dr. Jane Smith',
        gender: 'female' as const,
        email: 'jane.smith@example.com',
        certifications: ['CBT', 'Trauma']
      }

      const result = await store.createStaff(newStaffData)

      expect(staffService.create).toHaveBeenCalledWith(newStaffData)
      expect(store.staff).toContainEqual(mockStaff)
      expect(store.totalCount).toBe(1)
      expect(result).toEqual(mockStaff)
    })

    it('should set error on failure', async () => {
      vi.mocked(staffService.create).mockRejectedValue(new Error('Validation error'))

      const store = useStaffStore()
      await expect(store.createStaff({ name: '' })).rejects.toThrow('Validation error')

      expect(store.error).toBe('Validation error')
    })

    it('should increment totalCount on success', async () => {
      vi.mocked(staffService.create).mockResolvedValue({ data: mockStaff })

      const store = useStaffStore()
      store.totalCount = 5

      await store.createStaff({ name: 'New Staff' })

      expect(store.totalCount).toBe(6)
    })
  })

  describe('updateStaff', () => {
    it('should update staff in list', async () => {
      const updatedStaff = { ...mockStaff, name: 'Dr. Jane Smith-Jones' }
      vi.mocked(staffService.update).mockResolvedValue({ data: updatedStaff })

      const store = useStaffStore()
      store.staff = [mockStaff, mockStaff2]

      const result = await store.updateStaff('staff-1', { name: 'Dr. Jane Smith-Jones' })

      expect(staffService.update).toHaveBeenCalledWith('staff-1', { name: 'Dr. Jane Smith-Jones' })
      expect(store.staff[0].name).toBe('Dr. Jane Smith-Jones')
      expect(result).toEqual(updatedStaff)
    })

    it('should update currentStaff if it matches', async () => {
      const updatedStaff = { ...mockStaff, phone: '555-9999' }
      vi.mocked(staffService.update).mockResolvedValue({ data: updatedStaff })

      const store = useStaffStore()
      store.currentStaff = mockStaff

      await store.updateStaff('staff-1', { phone: '555-9999' })

      expect(store.currentStaff?.phone).toBe('555-9999')
    })

    it('should not update currentStaff if ID does not match', async () => {
      const updatedStaff2 = { ...mockStaff2, phone: '555-9999' }
      vi.mocked(staffService.update).mockResolvedValue({ data: updatedStaff2 })

      const store = useStaffStore()
      store.currentStaff = mockStaff

      await store.updateStaff('staff-2', { phone: '555-9999' })

      expect(store.currentStaff?.phone).toBe('555-0100') // Original phone
    })

    it('should handle updating staff not in list', async () => {
      const updatedStaff = { ...mockStaff, name: 'Updated' }
      vi.mocked(staffService.update).mockResolvedValue({ data: updatedStaff })

      const store = useStaffStore()
      store.staff = [mockStaff2] // Different staff

      await store.updateStaff('staff-1', { name: 'Updated' })

      // List should remain unchanged
      expect(store.staff).toHaveLength(1)
      expect(store.staff[0].id).toBe('staff-2')
    })

    it('should set error on failure', async () => {
      vi.mocked(staffService.update).mockRejectedValue(new Error('Update failed'))

      const store = useStaffStore()
      await expect(store.updateStaff('staff-1', { name: 'Test' })).rejects.toThrow('Update failed')

      expect(store.error).toBe('Update failed')
    })
  })

  describe('deleteStaff', () => {
    it('should remove staff from list', async () => {
      vi.mocked(staffService.delete).mockResolvedValue(undefined)

      const store = useStaffStore()
      store.staff = [mockStaff, mockStaff2]
      store.totalCount = 2

      await store.deleteStaff('staff-1')

      expect(staffService.delete).toHaveBeenCalledWith('staff-1')
      expect(store.staff).toHaveLength(1)
      expect(store.staff[0].id).toBe('staff-2')
      expect(store.totalCount).toBe(1)
    })

    it('should clear currentStaff if it matches deleted ID', async () => {
      vi.mocked(staffService.delete).mockResolvedValue(undefined)

      const store = useStaffStore()
      store.currentStaff = mockStaff

      await store.deleteStaff('staff-1')

      expect(store.currentStaff).toBeNull()
    })

    it('should not clear currentStaff if ID does not match', async () => {
      vi.mocked(staffService.delete).mockResolvedValue(undefined)

      const store = useStaffStore()
      store.staff = [mockStaff, mockStaff2]
      store.currentStaff = mockStaff

      await store.deleteStaff('staff-2')

      expect(store.currentStaff).toEqual(mockStaff)
    })

    it('should set error on failure', async () => {
      vi.mocked(staffService.delete).mockRejectedValue(new Error('Delete failed'))

      const store = useStaffStore()
      store.staff = [mockStaff]

      await expect(store.deleteStaff('staff-1')).rejects.toThrow('Delete failed')

      expect(store.error).toBe('Delete failed')
      // Staff should not be removed on failure
      expect(store.staff).toHaveLength(1)
    })

    it('should decrement totalCount on success', async () => {
      vi.mocked(staffService.delete).mockResolvedValue(undefined)

      const store = useStaffStore()
      store.staff = [mockStaff]
      store.totalCount = 10

      await store.deleteStaff('staff-1')

      expect(store.totalCount).toBe(9)
    })
  })

  describe('clearCurrent', () => {
    it('should clear currentStaff', () => {
      const store = useStaffStore()
      store.currentStaff = mockStaff

      store.clearCurrent()

      expect(store.currentStaff).toBeNull()
    })

    it('should be safe to call when currentStaff is already null', () => {
      const store = useStaffStore()
      store.currentStaff = null

      expect(() => store.clearCurrent()).not.toThrow()
      expect(store.currentStaff).toBeNull()
    })
  })
})
