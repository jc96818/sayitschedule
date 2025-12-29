import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RuleCategory } from '@prisma/client'

// Mock repositories before importing the module
vi.mock('../../repositories/staff.js', () => ({
  staffRepository: {
    findByOrganization: vi.fn(),
    create: vi.fn()
  }
}))

vi.mock('../../repositories/patients.js', () => ({
  patientRepository: {
    findByOrganization: vi.fn(),
    create: vi.fn()
  }
}))

vi.mock('../../repositories/rooms.js', () => ({
  roomRepository: {
    findByOrganization: vi.fn(),
    create: vi.fn()
  }
}))

vi.mock('../../repositories/rules.js', () => ({
  ruleRepository: {
    findActiveByOrganization: vi.fn(),
    create: vi.fn()
  }
}))

import { staffRepository } from '../../repositories/staff.js'
import { patientRepository } from '../../repositories/patients.js'
import { roomRepository } from '../../repositories/rooms.js'
import { ruleRepository } from '../../repositories/rules.js'
import {
  exportData,
  parseImportFile,
  previewImport,
  executeImport
} from '../dataExporter.js'

describe('dataExporter', () => {
  const organizationId = 'test-org-id'
  const userId = 'test-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportData', () => {
    it('exports staff as JSON', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
          gender: 'male',
          certifications: ['CPR', 'First Aid'],
          hireDate: new Date('2024-01-15'),
          defaultHours: { monday: { start: '09:00', end: '17:00' } },
          status: 'active'
        }
      ]

      vi.mocked(staffRepository.findByOrganization).mockResolvedValue(mockStaff as any)

      const result = await exportData(organizationId, 'staff', 'json')

      expect(result.contentType).toBe('application/json')
      expect(result.filename).toMatch(/^staff-\d{4}-\d{2}-\d{2}\.json$/)

      const parsed = JSON.parse(result.data.toString())
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('John Doe')
      expect(parsed[0].certifications).toEqual(['CPR', 'First Aid'])
    })

    it('exports staff as CSV', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: null,
          gender: 'male',
          certifications: ['CPR'],
          hireDate: null,
          defaultHours: null,
          status: 'active'
        }
      ]

      vi.mocked(staffRepository.findByOrganization).mockResolvedValue(mockStaff as any)

      const result = await exportData(organizationId, 'staff', 'csv')

      expect(result.contentType).toBe('text/csv')
      expect(result.filename).toMatch(/^staff-\d{4}-\d{2}-\d{2}\.csv$/)

      const lines = result.data.toString().split('\n')
      expect(lines[0]).toBe('id,name,email,phone,gender,certifications,hireDate,defaultHours,status')
      expect(lines[1]).toContain('John Doe')
      expect(lines[1]).toContain('john@example.com')
    })

    it('exports patients as JSON', async () => {
      const mockPatients = [
        {
          id: 'patient-1',
          name: 'Jane Smith',
          identifier: 'P001',
          gender: 'female',
          sessionFrequency: 3,
          preferredTimes: ['morning'],
          requiredCertifications: ['ABA'],
          preferredRoomId: null,
          requiredRoomCapabilities: [],
          notes: 'Test notes',
          status: 'active'
        }
      ]

      vi.mocked(patientRepository.findByOrganization).mockResolvedValue(mockPatients as any)

      const result = await exportData(organizationId, 'patients', 'json')

      const parsed = JSON.parse(result.data.toString())
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Jane Smith')
      expect(parsed[0].sessionFrequency).toBe(3)
    })

    it('exports rooms as JSON', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          name: 'Room 101',
          capabilities: ['wheelchair_accessible'],
          description: 'Main therapy room',
          status: 'active'
        }
      ]

      vi.mocked(roomRepository.findByOrganization).mockResolvedValue(mockRooms as any)

      const result = await exportData(organizationId, 'rooms', 'json')

      const parsed = JSON.parse(result.data.toString())
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Room 101')
      expect(parsed[0].capabilities).toEqual(['wheelchair_accessible'])
    })

    it('exports rules as JSON', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          category: RuleCategory.gender_pairing,
          description: 'Male therapists with male patients',
          priority: 10,
          isActive: true,
          ruleLogic: { therapistGender: 'male' }
        }
      ]

      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue(mockRules as any)

      const result = await exportData(organizationId, 'rules', 'json')

      const parsed = JSON.parse(result.data.toString())
      expect(parsed).toHaveLength(1)
      expect(parsed[0].category).toBe('gender_pairing')
      expect(parsed[0].priority).toBe(10)
    })

    it('handles CSV escaping correctly', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          name: 'John "Johnny" Doe',
          email: 'john,doe@example.com',
          phone: null,
          gender: 'male',
          certifications: [],
          hireDate: null,
          defaultHours: null,
          status: 'active'
        }
      ]

      vi.mocked(staffRepository.findByOrganization).mockResolvedValue(mockStaff as any)

      const result = await exportData(organizationId, 'staff', 'csv')
      const content = result.data.toString()

      // Values with quotes or commas should be properly escaped
      expect(content).toContain('"John ""Johnny"" Doe"')
      expect(content).toContain('"john,doe@example.com"')
    })
  })

  describe('parseImportFile', () => {
    it('parses JSON file correctly', () => {
      const jsonContent = JSON.stringify([
        { name: 'Test Staff', gender: 'male', email: 'test@example.com' }
      ])
      const buffer = Buffer.from(jsonContent)

      const result = parseImportFile(buffer, 'staff', 'json')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Staff')
      expect(result[0].gender).toBe('male')
    })

    it('parses CSV file correctly', () => {
      const csvContent = 'id,name,email,phone,gender,certifications,hireDate,defaultHours,status\n' +
        'staff-1,John Doe,john@example.com,,male,"[""CPR""]",,{},active'
      const buffer = Buffer.from(csvContent)

      const result = parseImportFile(buffer, 'staff', 'csv')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
      expect(result[0].gender).toBe('male')
      expect(result[0].certifications).toEqual(['CPR'])
    })

    it('handles quoted CSV values with commas', () => {
      const csvContent = 'id,name,email,phone,gender,certifications,hireDate,defaultHours,status\n' +
        'staff-1,"Doe, John",john@example.com,,male,[],,,active'
      const buffer = Buffer.from(csvContent)

      const result = parseImportFile(buffer, 'staff', 'csv')

      expect(result[0].name).toBe('Doe, John')
    })

    it('converts boolean strings to booleans', () => {
      const csvContent = 'id,category,description,priority,isActive,ruleLogic\n' +
        'rule-1,session,Test rule,5,true,{}'
      const buffer = Buffer.from(csvContent)

      const result = parseImportFile(buffer, 'rules', 'csv')

      expect(result[0].isActive).toBe(true)
    })

    it('converts number strings to numbers for priority', () => {
      const csvContent = 'id,category,description,priority,isActive,ruleLogic\n' +
        'rule-1,session,Test rule,5,true,{}'
      const buffer = Buffer.from(csvContent)

      const result = parseImportFile(buffer, 'rules', 'csv')

      expect(result[0].priority).toBe(5)
    })
  })

  describe('previewImport', () => {
    it('detects duplicates for staff by name and email', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([
        { id: 'existing-1', name: 'John Doe', email: 'john@example.com' }
      ] as any)

      const records = [
        { name: 'John Doe', email: 'john@example.com', gender: 'male' },
        { name: 'Jane Doe', email: 'jane@example.com', gender: 'female' }
      ]

      const result = await previewImport(organizationId, records, 'staff')

      expect(result.total).toBe(2)
      expect(result.toCreate).toBe(1)
      expect(result.toSkip).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('detects duplicates for patients by name and identifier', async () => {
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue([
        { id: 'existing-1', name: 'Jane Smith', identifier: 'P001' }
      ] as any)

      const records = [
        { name: 'Jane Smith', identifier: 'P001', gender: 'female' },
        { name: 'Jane Smith', identifier: 'P002', gender: 'female' }
      ]

      const result = await previewImport(organizationId, records, 'patients')

      expect(result.toCreate).toBe(1)
      expect(result.toSkip).toBe(1)
    })

    it('detects duplicates for rooms by name', async () => {
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue([
        { id: 'existing-1', name: 'Room 101' }
      ] as any)

      const records = [
        { name: 'Room 101' },
        { name: 'Room 102' }
      ]

      const result = await previewImport(organizationId, records, 'rooms')

      expect(result.toCreate).toBe(1)
      expect(result.toSkip).toBe(1)
    })

    it('detects duplicates for rules by category and description', async () => {
      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue([
        { id: 'existing-1', category: 'session', description: 'Max 2 sessions per day' }
      ] as any)

      const records = [
        { category: 'session', description: 'Max 2 sessions per day' },
        { category: 'session', description: 'Max 3 sessions per day' }
      ]

      const result = await previewImport(organizationId, records, 'rules')

      expect(result.toCreate).toBe(1)
      expect(result.toSkip).toBe(1)
    })

    it('returns validation errors for missing required fields', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])

      const records = [
        { name: 'John Doe' }, // missing gender
        { gender: 'male' } // missing name
      ]

      const result = await previewImport(organizationId, records, 'staff')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('gender'))).toBe(true)
      expect(result.errors.some(e => e.includes('name'))).toBe(true)
    })

    it('returns validation errors for invalid enum values', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])

      const records = [
        { name: 'John Doe', gender: 'invalid_gender' }
      ]

      const result = await previewImport(organizationId, records, 'staff')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Invalid gender')
    })

    it('returns preview records limited to first 5', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])

      const records = Array.from({ length: 10 }, (_, i) => ({
        name: `Staff ${i}`,
        gender: 'male'
      }))

      const result = await previewImport(organizationId, records, 'staff')

      expect(result.records.length).toBeLessThanOrEqual(5)
    })
  })

  describe('executeImport', () => {
    it('creates new staff records and skips duplicates', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([
        { id: 'existing-1', name: 'John Doe', email: 'john@example.com' }
      ] as any)
      vi.mocked(staffRepository.create).mockResolvedValue({ id: 'new-1' } as any)

      const records = [
        { name: 'John Doe', email: 'john@example.com', gender: 'male' },
        { name: 'Jane Doe', email: 'jane@example.com', gender: 'female' }
      ]

      const result = await executeImport(organizationId, records, 'staff', userId)

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(1)
      expect(staffRepository.create).toHaveBeenCalledTimes(1)
      expect(staffRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          name: 'Jane Doe',
          gender: 'female'
        })
      )
    })

    it('creates new patient records', async () => {
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(patientRepository.create).mockResolvedValue({ id: 'new-1' } as any)

      const records = [
        { name: 'Jane Smith', gender: 'female', sessionFrequency: 3 }
      ]

      const result = await executeImport(organizationId, records, 'patients', userId)

      expect(result.created).toBe(1)
      expect(patientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          name: 'Jane Smith',
          sessionFrequency: 3
        })
      )
    })

    it('creates new room records', async () => {
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(roomRepository.create).mockResolvedValue({ id: 'new-1' } as any)

      const records = [
        { name: 'Room 101', capabilities: ['wheelchair_accessible'] }
      ]

      const result = await executeImport(organizationId, records, 'rooms', userId)

      expect(result.created).toBe(1)
      expect(roomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          name: 'Room 101',
          capabilities: ['wheelchair_accessible']
        })
      )
    })

    it('creates new rule records with userId', async () => {
      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue([])
      vi.mocked(ruleRepository.create).mockResolvedValue({ id: 'new-1' } as any)

      const records = [
        { category: 'session', description: 'Max 2 sessions', priority: 5, ruleLogic: {} }
      ]

      const result = await executeImport(organizationId, records, 'rules', userId)

      expect(result.created).toBe(1)
      expect(ruleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          createdById: userId,
          category: 'session',
          description: 'Max 2 sessions'
        })
      )
    })

    it('reports errors when record creation fails', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(staffRepository.create).mockRejectedValue(new Error('Database error'))

      const records = [
        { name: 'John Doe', gender: 'male' }
      ]

      const result = await executeImport(organizationId, records, 'staff', userId)

      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to create staff')
      expect(result.errors[0]).toContain('Database error')
    })

    it('prevents duplicates within the same import batch', async () => {
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(staffRepository.create).mockResolvedValue({ id: 'new-1' } as any)

      const records = [
        { name: 'John Doe', email: 'john@example.com', gender: 'male' },
        { name: 'John Doe', email: 'john@example.com', gender: 'male' } // duplicate in batch
      ]

      const result = await executeImport(organizationId, records, 'staff', userId)

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(1)
      expect(staffRepository.create).toHaveBeenCalledTimes(1)
    })
  })
})
