import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePatientsStore } from '../patients'
import { patientService } from '@/services/api'
import type { Patient } from '@/types'

// Mock the API service
vi.mock('@/services/api', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

describe('usePatientsStore', () => {
  const mockPatient: Patient = {
    id: 'patient-1',
    organizationId: 'org-1',
    name: 'John Doe',
    identifier: 'P-001',
    gender: 'male',
    sessionFrequency: 3,
    preferredTimes: ['morning', 'afternoon'],
    requiredCertifications: ['CBT'],
    preferredRoomId: 'room-1',
    requiredRoomCapabilities: ['sensory'],
    notes: 'Prefers quiet environment',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z'
  }

  const mockPatient2: Patient = {
    ...mockPatient,
    id: 'patient-2',
    name: 'Jane Smith',
    identifier: 'P-002',
    gender: 'female'
  }

  const mockInactivePatient: Patient = {
    ...mockPatient,
    id: 'patient-3',
    name: 'Inactive Patient',
    status: 'inactive'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty patients array', () => {
      const store = usePatientsStore()
      expect(store.patients).toEqual([])
    })

    it('should have null currentPatient', () => {
      const store = usePatientsStore()
      expect(store.currentPatient).toBeNull()
    })

    it('should have loading set to false', () => {
      const store = usePatientsStore()
      expect(store.loading).toBe(false)
    })

    it('should have no error', () => {
      const store = usePatientsStore()
      expect(store.error).toBeNull()
    })

    it('should have totalCount of 0', () => {
      const store = usePatientsStore()
      expect(store.totalCount).toBe(0)
    })
  })

  describe('fetchPatients', () => {
    it('should fetch and store patients list', async () => {
      vi.mocked(patientService.list).mockResolvedValue({
        data: [mockPatient, mockPatient2],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = usePatientsStore()
      await store.fetchPatients()

      expect(patientService.list).toHaveBeenCalled()
      expect(store.patients).toHaveLength(2)
      expect(store.totalCount).toBe(2)
      expect(store.loading).toBe(false)
    })

    it('should pass search params to service', async () => {
      vi.mocked(patientService.list).mockResolvedValue({
        data: [mockPatient],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = usePatientsStore()
      await store.fetchPatients({ search: 'John' })

      expect(patientService.list).toHaveBeenCalledWith({ search: 'John' })
    })

    it('should pass status filter to service', async () => {
      vi.mocked(patientService.list).mockResolvedValue({
        data: [mockPatient],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = usePatientsStore()
      await store.fetchPatients({ status: 'active' })

      expect(patientService.list).toHaveBeenCalledWith({ status: 'active' })
    })

    it('should pass combined params to service', async () => {
      vi.mocked(patientService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const store = usePatientsStore()
      await store.fetchPatients({ search: 'Doe', status: 'inactive' })

      expect(patientService.list).toHaveBeenCalledWith({ search: 'Doe', status: 'inactive' })
    })

    it('should set error on failure', async () => {
      vi.mocked(patientService.list).mockRejectedValue(new Error('Network error'))

      const store = usePatientsStore()
      await expect(store.fetchPatients()).rejects.toThrow('Network error')

      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(patientService.list).mockReturnValue(promise as never)

      const store = usePatientsStore()
      const fetchPromise = store.fetchPatients()

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
      vi.mocked(patientService.list).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const store = usePatientsStore()
      store.error = 'Previous error'

      await store.fetchPatients()

      expect(store.error).toBeNull()
    })
  })

  describe('fetchPatientById', () => {
    it('should fetch and set current patient', async () => {
      vi.mocked(patientService.get).mockResolvedValue({ data: mockPatient })

      const store = usePatientsStore()
      const result = await store.fetchPatientById('patient-1')

      expect(patientService.get).toHaveBeenCalledWith('patient-1')
      expect(store.currentPatient).toEqual(mockPatient)
      expect(result).toEqual(mockPatient)
    })

    it('should set error on failure', async () => {
      vi.mocked(patientService.get).mockRejectedValue(new Error('Patient not found'))

      const store = usePatientsStore()
      await expect(store.fetchPatientById('invalid-id')).rejects.toThrow('Patient not found')

      expect(store.error).toBe('Patient not found')
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(patientService.get).mockReturnValue(promise as never)

      const store = usePatientsStore()
      const fetchPromise = store.fetchPatientById('patient-1')

      expect(store.loading).toBe(true)

      resolvePromise!({ data: mockPatient })
      await fetchPromise

      expect(store.loading).toBe(false)
    })
  })

  describe('createPatient', () => {
    it('should create and add new patient to list', async () => {
      vi.mocked(patientService.create).mockResolvedValue({ data: mockPatient })

      const store = usePatientsStore()
      const newPatientData = {
        name: 'John Doe',
        gender: 'male' as const,
        sessionFrequency: 3,
        requiredCertifications: ['CBT']
      }

      const result = await store.createPatient(newPatientData)

      expect(patientService.create).toHaveBeenCalledWith(newPatientData)
      expect(store.patients).toContainEqual(mockPatient)
      expect(store.totalCount).toBe(1)
      expect(result).toEqual(mockPatient)
    })

    it('should set error on failure', async () => {
      vi.mocked(patientService.create).mockRejectedValue(new Error('Validation error'))

      const store = usePatientsStore()
      await expect(store.createPatient({ name: '' })).rejects.toThrow('Validation error')

      expect(store.error).toBe('Validation error')
    })

    it('should increment totalCount on success', async () => {
      vi.mocked(patientService.create).mockResolvedValue({ data: mockPatient })

      const store = usePatientsStore()
      store.totalCount = 10

      await store.createPatient({ name: 'New Patient' })

      expect(store.totalCount).toBe(11)
    })

    it('should handle patient with all fields', async () => {
      vi.mocked(patientService.create).mockResolvedValue({ data: mockPatient })

      const store = usePatientsStore()
      const fullPatientData = {
        name: 'John Doe',
        identifier: 'P-001',
        gender: 'male' as const,
        sessionFrequency: 3,
        preferredTimes: ['morning'],
        requiredCertifications: ['CBT', 'Trauma'],
        preferredRoomId: 'room-1',
        requiredRoomCapabilities: ['sensory'],
        notes: 'Test notes'
      }

      await store.createPatient(fullPatientData)

      expect(patientService.create).toHaveBeenCalledWith(fullPatientData)
    })
  })

  describe('updatePatient', () => {
    it('should update patient in list', async () => {
      const updatedPatient = { ...mockPatient, name: 'John Doe Jr.' }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient })

      const store = usePatientsStore()
      store.patients = [mockPatient, mockPatient2]

      const result = await store.updatePatient('patient-1', { name: 'John Doe Jr.' })

      expect(patientService.update).toHaveBeenCalledWith('patient-1', { name: 'John Doe Jr.' })
      expect(store.patients[0].name).toBe('John Doe Jr.')
      expect(result).toEqual(updatedPatient)
    })

    it('should update currentPatient if it matches', async () => {
      const updatedPatient = { ...mockPatient, notes: 'Updated notes' }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient })

      const store = usePatientsStore()
      store.currentPatient = mockPatient

      await store.updatePatient('patient-1', { notes: 'Updated notes' })

      expect(store.currentPatient?.notes).toBe('Updated notes')
    })

    it('should not update currentPatient if ID does not match', async () => {
      const updatedPatient2 = { ...mockPatient2, notes: 'Updated notes' }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient2 })

      const store = usePatientsStore()
      store.currentPatient = mockPatient

      await store.updatePatient('patient-2', { notes: 'Updated notes' })

      expect(store.currentPatient?.notes).toBe('Prefers quiet environment') // Original notes
    })

    it('should handle updating patient not in list', async () => {
      const updatedPatient = { ...mockPatient, name: 'Updated' }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient })

      const store = usePatientsStore()
      store.patients = [mockPatient2] // Different patient

      await store.updatePatient('patient-1', { name: 'Updated' })

      // List should remain unchanged
      expect(store.patients).toHaveLength(1)
      expect(store.patients[0].id).toBe('patient-2')
    })

    it('should update session frequency', async () => {
      const updatedPatient = { ...mockPatient, sessionFrequency: 5 }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient })

      const store = usePatientsStore()
      store.patients = [mockPatient]

      await store.updatePatient('patient-1', { sessionFrequency: 5 })

      expect(store.patients[0].sessionFrequency).toBe(5)
    })

    it('should update required certifications', async () => {
      const updatedPatient = { ...mockPatient, requiredCertifications: ['CBT', 'ABA'] }
      vi.mocked(patientService.update).mockResolvedValue({ data: updatedPatient })

      const store = usePatientsStore()
      store.patients = [mockPatient]

      await store.updatePatient('patient-1', { requiredCertifications: ['CBT', 'ABA'] })

      expect(store.patients[0].requiredCertifications).toEqual(['CBT', 'ABA'])
    })

    it('should set error on failure', async () => {
      vi.mocked(patientService.update).mockRejectedValue(new Error('Update failed'))

      const store = usePatientsStore()
      await expect(store.updatePatient('patient-1', { name: 'Test' })).rejects.toThrow('Update failed')

      expect(store.error).toBe('Update failed')
    })
  })

  describe('deletePatient', () => {
    it('should remove patient from list', async () => {
      vi.mocked(patientService.delete).mockResolvedValue(undefined)

      const store = usePatientsStore()
      store.patients = [mockPatient, mockPatient2]
      store.totalCount = 2

      await store.deletePatient('patient-1')

      expect(patientService.delete).toHaveBeenCalledWith('patient-1')
      expect(store.patients).toHaveLength(1)
      expect(store.patients[0].id).toBe('patient-2')
      expect(store.totalCount).toBe(1)
    })

    it('should clear currentPatient if it matches deleted ID', async () => {
      vi.mocked(patientService.delete).mockResolvedValue(undefined)

      const store = usePatientsStore()
      store.currentPatient = mockPatient

      await store.deletePatient('patient-1')

      expect(store.currentPatient).toBeNull()
    })

    it('should not clear currentPatient if ID does not match', async () => {
      vi.mocked(patientService.delete).mockResolvedValue(undefined)

      const store = usePatientsStore()
      store.patients = [mockPatient, mockPatient2]
      store.currentPatient = mockPatient

      await store.deletePatient('patient-2')

      expect(store.currentPatient).toEqual(mockPatient)
    })

    it('should set error on failure', async () => {
      vi.mocked(patientService.delete).mockRejectedValue(new Error('Delete failed'))

      const store = usePatientsStore()
      store.patients = [mockPatient]

      await expect(store.deletePatient('patient-1')).rejects.toThrow('Delete failed')

      expect(store.error).toBe('Delete failed')
      // Patient should not be removed on failure
      expect(store.patients).toHaveLength(1)
    })

    it('should decrement totalCount on success', async () => {
      vi.mocked(patientService.delete).mockResolvedValue(undefined)

      const store = usePatientsStore()
      store.patients = [mockPatient]
      store.totalCount = 15

      await store.deletePatient('patient-1')

      expect(store.totalCount).toBe(14)
    })
  })

  describe('clearCurrent', () => {
    it('should clear currentPatient', () => {
      const store = usePatientsStore()
      store.currentPatient = mockPatient

      store.clearCurrent()

      expect(store.currentPatient).toBeNull()
    })

    it('should be safe to call when currentPatient is already null', () => {
      const store = usePatientsStore()
      store.currentPatient = null

      expect(() => store.clearCurrent()).not.toThrow()
      expect(store.currentPatient).toBeNull()
    })
  })
})
