import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateSessionEntities } from '../sessionValidation.js'

// Mock the repositories
vi.mock('../../repositories/staff.js', () => ({
  staffRepository: {
    findById: vi.fn()
  }
}))

vi.mock('../../repositories/patients.js', () => ({
  patientRepository: {
    findById: vi.fn()
  }
}))

vi.mock('../../repositories/rooms.js', () => ({
  roomRepository: {
    findById: vi.fn()
  }
}))

import { staffRepository } from '../../repositories/staff.js'
import { patientRepository } from '../../repositories/patients.js'
import { roomRepository } from '../../repositories/rooms.js'

describe('Session Validation Service', () => {
  const orgA = 'org-a-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateSessionEntities', () => {
    describe('Valid entities (same organization)', () => {
      it('returns valid when staff belongs to organization', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue({
          id: 'staff-1',
          organizationId: orgA,
          name: 'John Doe'
        } as never)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-1'
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(staffRepository.findById).toHaveBeenCalledWith('staff-1', orgA)
      })

      it('returns valid when patient belongs to organization', async () => {
        vi.mocked(patientRepository.findById).mockResolvedValue({
          id: 'patient-1',
          organizationId: orgA,
          name: 'Jane Doe'
        } as never)

        const result = await validateSessionEntities(orgA, {
          patientId: 'patient-1'
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(patientRepository.findById).toHaveBeenCalledWith('patient-1', orgA)
      })

      it('returns valid when room belongs to organization', async () => {
        vi.mocked(roomRepository.findById).mockResolvedValue({
          id: 'room-1',
          organizationId: orgA,
          name: 'Room A'
        } as never)

        const result = await validateSessionEntities(orgA, {
          roomId: 'room-1'
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(roomRepository.findById).toHaveBeenCalledWith('room-1', orgA)
      })

      it('returns valid when all entities belong to organization', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue({ id: 'staff-1' } as never)
        vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as never)
        vi.mocked(roomRepository.findById).mockResolvedValue({ id: 'room-1' } as never)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-1',
          patientId: 'patient-1',
          roomId: 'room-1'
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('Cross-tenant attack prevention', () => {
      it('rejects staff from different organization', async () => {
        // Staff belongs to orgB, but we're validating against orgA
        vi.mocked(staffRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-from-org-b'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Staff member not found or does not belong to this organization')
      })

      it('rejects patient from different organization', async () => {
        vi.mocked(patientRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          patientId: 'patient-from-org-b'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Patient not found or does not belong to this organization')
      })

      it('rejects room from different organization', async () => {
        vi.mocked(roomRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          roomId: 'room-from-org-b'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Room not found or does not belong to this organization')
      })

      it('rejects multiple cross-tenant entities', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue(null)
        vi.mocked(patientRepository.findById).mockResolvedValue(null)
        vi.mocked(roomRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-from-org-b',
          patientId: 'patient-from-org-b',
          roomId: 'room-from-org-b'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toHaveLength(3)
        expect(result.errors).toContain('Staff member not found or does not belong to this organization')
        expect(result.errors).toContain('Patient not found or does not belong to this organization')
        expect(result.errors).toContain('Room not found or does not belong to this organization')
      })
    })

    describe('Non-existent entities', () => {
      it('rejects non-existent staff', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          staffId: 'non-existent-staff'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Staff member not found or does not belong to this organization')
      })

      it('rejects non-existent patient', async () => {
        vi.mocked(patientRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          patientId: 'non-existent-patient'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Patient not found or does not belong to this organization')
      })

      it('rejects non-existent room', async () => {
        vi.mocked(roomRepository.findById).mockResolvedValue(null)

        const result = await validateSessionEntities(orgA, {
          roomId: 'non-existent-room'
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Room not found or does not belong to this organization')
      })
    })

    describe('Optional fields', () => {
      it('skips validation when staffId is not provided', async () => {
        const result = await validateSessionEntities(orgA, {
          staffId: undefined
        })

        expect(result.valid).toBe(true)
        expect(staffRepository.findById).not.toHaveBeenCalled()
      })

      it('skips validation when patientId is not provided', async () => {
        const result = await validateSessionEntities(orgA, {
          patientId: undefined
        })

        expect(result.valid).toBe(true)
        expect(patientRepository.findById).not.toHaveBeenCalled()
      })

      it('skips validation when roomId is null (no room assignment)', async () => {
        const result = await validateSessionEntities(orgA, {
          roomId: null
        })

        expect(result.valid).toBe(true)
        expect(roomRepository.findById).not.toHaveBeenCalled()
      })

      it('skips validation when roomId is undefined', async () => {
        const result = await validateSessionEntities(orgA, {
          roomId: undefined
        })

        expect(result.valid).toBe(true)
        expect(roomRepository.findById).not.toHaveBeenCalled()
      })

      it('returns valid when no entities are provided', async () => {
        const result = await validateSessionEntities(orgA, {})

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(staffRepository.findById).not.toHaveBeenCalled()
        expect(patientRepository.findById).not.toHaveBeenCalled()
        expect(roomRepository.findById).not.toHaveBeenCalled()
      })
    })

    describe('Partial validation (update scenarios)', () => {
      it('validates only provided staff when updating just staffId', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue({ id: 'staff-1' } as never)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-1'
          // patientId and roomId not provided (not being updated)
        })

        expect(result.valid).toBe(true)
        expect(staffRepository.findById).toHaveBeenCalledWith('staff-1', orgA)
        expect(patientRepository.findById).not.toHaveBeenCalled()
        expect(roomRepository.findById).not.toHaveBeenCalled()
      })

      it('validates only provided patient when updating just patientId', async () => {
        vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as never)

        const result = await validateSessionEntities(orgA, {
          patientId: 'patient-1'
        })

        expect(result.valid).toBe(true)
        expect(patientRepository.findById).toHaveBeenCalledWith('patient-1', orgA)
        expect(staffRepository.findById).not.toHaveBeenCalled()
        expect(roomRepository.findById).not.toHaveBeenCalled()
      })

      it('validates staff and room when updating both', async () => {
        vi.mocked(staffRepository.findById).mockResolvedValue({ id: 'staff-1' } as never)
        vi.mocked(roomRepository.findById).mockResolvedValue({ id: 'room-1' } as never)

        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-1',
          roomId: 'room-1'
        })

        expect(result.valid).toBe(true)
        expect(staffRepository.findById).toHaveBeenCalled()
        expect(roomRepository.findById).toHaveBeenCalled()
        expect(patientRepository.findById).not.toHaveBeenCalled()
      })
    })

    describe('Parallel validation', () => {
      it('validates all entities in parallel', async () => {
        const staffPromise = new Promise(resolve => setTimeout(() => resolve({ id: 'staff-1' }), 10))
        const patientPromise = new Promise(resolve => setTimeout(() => resolve({ id: 'patient-1' }), 10))
        const roomPromise = new Promise(resolve => setTimeout(() => resolve({ id: 'room-1' }), 10))

        vi.mocked(staffRepository.findById).mockReturnValue(staffPromise as never)
        vi.mocked(patientRepository.findById).mockReturnValue(patientPromise as never)
        vi.mocked(roomRepository.findById).mockReturnValue(roomPromise as never)

        const startTime = Date.now()
        const result = await validateSessionEntities(orgA, {
          staffId: 'staff-1',
          patientId: 'patient-1',
          roomId: 'room-1'
        })
        const duration = Date.now() - startTime

        expect(result.valid).toBe(true)
        // If parallel, should take ~10ms. If sequential, would take ~30ms
        expect(duration).toBeLessThan(25)
      })
    })
  })
})
