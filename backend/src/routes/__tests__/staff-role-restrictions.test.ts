import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

/**
 * Tests to verify that staff users are properly restricted from management operations.
 * Staff users should only be able to:
 * - View schedules
 * - Manage their own availability/time-off
 * - Update personal account settings (password, MFA)
 *
 * They should NOT be able to:
 * - Create/update/delete staff members
 * - Create/update/delete patients
 * - Create/update/delete rooms
 * - Create/update/delete rules
 */

// Mock repositories BEFORE importing routes
vi.mock('../../repositories/staff.js', () => ({
  staffRepository: {
    findAll: vi.fn().mockResolvedValue({
      data: [{ id: 'staff-1', name: 'Test Staff' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1
    }),
    findById: vi.fn().mockResolvedValue({ id: 'staff-1', name: 'Test Staff', organizationId: 'org-1' }),
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'new-staff', name: 'New Staff', gender: 'female', organizationId: 'org-1' }),
    update: vi.fn().mockResolvedValue({ id: 'staff-1', name: 'Updated Staff', organizationId: 'org-1' }),
    delete: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../repositories/patients.js', () => ({
  patientRepository: {
    findAll: vi.fn().mockResolvedValue({
      data: [{ id: 'patient-1', name: 'Test Patient' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1
    }),
    findById: vi.fn().mockResolvedValue({ id: 'patient-1', name: 'Test Patient', organizationId: 'org-1' }),
    create: vi.fn().mockResolvedValue({ id: 'new-patient', name: 'New Patient', gender: 'female', organizationId: 'org-1' }),
    update: vi.fn().mockResolvedValue({ id: 'patient-1', name: 'Updated Patient', organizationId: 'org-1' }),
    delete: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../repositories/rooms.js', () => ({
  roomRepository: {
    findAll: vi.fn().mockResolvedValue({
      data: [{ id: 'room-1', name: 'Test Room' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1
    }),
    findById: vi.fn().mockResolvedValue({ id: 'room-1', name: 'Test Room', organizationId: 'org-1' }),
    create: vi.fn().mockResolvedValue({ id: 'new-room', name: 'New Room', capabilities: [], organizationId: 'org-1' }),
    update: vi.fn().mockResolvedValue({ id: 'room-1', name: 'Updated Room', organizationId: 'org-1' }),
    delete: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../repositories/rules.js', () => ({
  ruleRepository: {
    findAll: vi.fn().mockResolvedValue({
      data: [{ id: 'rule-1', description: 'Test Rule' }],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1
    }),
    findById: vi.fn().mockResolvedValue({ id: 'rule-1', description: 'Test Rule', organizationId: 'org-1', isActive: true }),
    create: vi.fn().mockResolvedValue({ id: 'new-rule', description: 'New Rule', category: 'scheduling', isActive: true, organizationId: 'org-1' }),
    update: vi.fn().mockResolvedValue({ id: 'rule-1', description: 'Updated Rule', organizationId: 'org-1' }),
    delete: vi.fn().mockResolvedValue(true),
    toggleActive: vi.fn().mockResolvedValue({ id: 'rule-1', isActive: false })
  }
}))

// Store mock for getAuthState - will be configured per-test
const mockGetAuthState = vi.fn()

vi.mock('../../repositories/users.js', () => ({
  userRepository: {
    getAuthState: mockGetAuthState
  }
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

vi.mock('../../services/aiProvider.js', () => ({
  analyzeRulesWithAI: vi.fn()
}))

// Import the mocked repositories to access them in tests
import { staffRepository } from '../../repositories/staff.js'
import { patientRepository } from '../../repositories/patients.js'
import { roomRepository } from '../../repositories/rooms.js'
import { ruleRepository } from '../../repositories/rules.js'

describe('Staff Role Restrictions', () => {
  let app: FastifyInstance
  let staffToken: string
  let adminToken: string
  let assistantToken: string

  const staffUser: JWTPayload = {
    userId: 'staff-user-1',
    email: 'staff@test.com',
    role: 'staff',
    organizationId: 'org-1'
  }

  const adminUser: JWTPayload = {
    userId: 'admin-user-1',
    email: 'admin@test.com',
    role: 'admin',
    organizationId: 'org-1'
  }

  const assistantUser: JWTPayload = {
    userId: 'assistant-user-1',
    email: 'assistant@test.com',
    role: 'admin_assistant',
    organizationId: 'org-1'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Configure auth state mock to return matching role/org for each user
    mockGetAuthState.mockImplementation((userId: string) => {
      if (userId === 'staff-user-1') {
        return Promise.resolve({ role: 'staff', organizationId: 'org-1', passwordChangedAt: null })
      }
      if (userId === 'admin-user-1') {
        return Promise.resolve({ role: 'admin', organizationId: 'org-1', passwordChangedAt: null })
      }
      if (userId === 'assistant-user-1') {
        return Promise.resolve({ role: 'admin_assistant', organizationId: 'org-1', passwordChangedAt: null })
      }
      if (userId === 'super_admin-user') {
        return Promise.resolve({ role: 'super_admin', organizationId: null, passwordChangedAt: null })
      }
      return Promise.resolve(null)
    })

    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(jwt, { secret: 'test-secret' })

    // Add context middleware that initializes ctx
    app.addHook('onRequest', async (request) => {
      request.ctx = { user: null, organizationId: null }
    })

    // Import and register routes
    const { staffRoutes } = await import('../staff.js')
    const { patientRoutes } = await import('../patients.js')
    const { roomRoutes } = await import('../rooms.js')
    const { ruleRoutes } = await import('../rules.js')

    await app.register(staffRoutes, { prefix: '/api/staff' })
    await app.register(patientRoutes, { prefix: '/api/patients' })
    await app.register(roomRoutes, { prefix: '/api/rooms' })
    await app.register(ruleRoutes, { prefix: '/api/rules' })

    // Generate tokens
    staffToken = app.jwt.sign(staffUser)
    adminToken = app.jwt.sign(adminUser)
    assistantToken = app.jwt.sign(assistantUser)
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  describe('Staff Management Routes', () => {
    describe('GET /api/staff - List Staff', () => {
      it('should allow staff user to read staff list', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/staff',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('POST /api/staff - Create Staff', () => {
      it('should return 403 for staff user attempting to create staff', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/staff',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'New Staff',
            gender: 'female',
            email: 'newstaff@test.com'
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(staffRepository.create).not.toHaveBeenCalled()
      })

      it('should allow admin to create staff', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/staff',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'New Staff',
            gender: 'female',
            email: 'newstaff@test.com'
          }
        })

        expect(response.statusCode).toBe(201)
        expect(staffRepository.create).toHaveBeenCalled()
      })

      it('should allow admin_assistant to create staff', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/staff',
          headers: { authorization: `Bearer ${assistantToken}` },
          payload: {
            name: 'New Staff',
            gender: 'female',
            email: 'newstaff@test.com'
          }
        })

        expect(response.statusCode).toBe(201)
        expect(staffRepository.create).toHaveBeenCalled()
      })
    })

    describe('PUT /api/staff/:id - Update Staff', () => {
      it('should return 403 for staff user attempting to update staff', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/staff/staff-1',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'Updated Staff Name'
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(staffRepository.update).not.toHaveBeenCalled()
      })
    })

    describe('DELETE /api/staff/:id - Delete Staff', () => {
      it('should return 403 for staff user attempting to delete staff', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/staff/staff-1',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(staffRepository.delete).not.toHaveBeenCalled()
      })
    })
  })

  describe('Patient Management Routes', () => {
    describe('GET /api/patients - List Patients', () => {
      it('should allow staff user to read patient list', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/patients',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('POST /api/patients - Create Patient', () => {
      it('should return 403 for staff user attempting to create patient', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/patients',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'New Patient',
            gender: 'female',
            sessionFrequency: 2
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(patientRepository.create).not.toHaveBeenCalled()
      })

      it('should allow admin to create patient', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/patients',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'New Patient',
            gender: 'female',
            sessionFrequency: 2
          }
        })

        expect(response.statusCode).toBe(201)
        expect(patientRepository.create).toHaveBeenCalled()
      })
    })

    describe('PUT /api/patients/:id - Update Patient', () => {
      it('should return 403 for staff user attempting to update patient', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/patients/patient-1',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'Updated Patient Name'
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(patientRepository.update).not.toHaveBeenCalled()
      })
    })

    describe('DELETE /api/patients/:id - Delete Patient', () => {
      it('should return 403 for staff user attempting to delete patient', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/patients/patient-1',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(patientRepository.delete).not.toHaveBeenCalled()
      })
    })
  })

  describe('Room Management Routes', () => {
    describe('GET /api/rooms - List Rooms', () => {
      it('should allow staff user to read room list', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/rooms',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('POST /api/rooms - Create Room', () => {
      it('should return 403 for staff user attempting to create room', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/rooms',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'New Room',
            capabilities: []
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(roomRepository.create).not.toHaveBeenCalled()
      })

      it('should allow admin to create room', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/rooms',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'New Room',
            capabilities: []
          }
        })

        expect(response.statusCode).toBe(201)
        expect(roomRepository.create).toHaveBeenCalled()
      })
    })

    describe('PUT /api/rooms/:id - Update Room', () => {
      it('should return 403 for staff user attempting to update room', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/rooms/room-1',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            name: 'Updated Room Name'
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(roomRepository.update).not.toHaveBeenCalled()
      })
    })

    describe('DELETE /api/rooms/:id - Delete Room', () => {
      it('should return 403 for staff user attempting to delete room', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/rooms/room-1',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(roomRepository.delete).not.toHaveBeenCalled()
      })
    })
  })

  describe('Rule Management Routes', () => {
    describe('GET /api/rules - List Rules', () => {
      it('should allow staff user to read rules list', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/rules',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('POST /api/rules - Create Rule', () => {
      it('should return 403 for staff user attempting to create rule', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/rules',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            category: 'session',
            description: 'New rule description',
            priority: 50,
            ruleLogic: {}
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(ruleRepository.create).not.toHaveBeenCalled()
      })

      it('should allow admin to create rule', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/rules',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            category: 'session',
            description: 'New rule description',
            priority: 50,
            ruleLogic: {}
          }
        })

        expect(response.statusCode).toBe(201)
        expect(ruleRepository.create).toHaveBeenCalled()
      })
    })

    describe('PUT /api/rules/:id - Update Rule', () => {
      it('should return 403 for staff user attempting to update rule', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/rules/rule-1',
          headers: { authorization: `Bearer ${staffToken}` },
          payload: {
            description: 'Updated rule description'
          }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(ruleRepository.update).not.toHaveBeenCalled()
      })
    })

    describe('DELETE /api/rules/:id - Delete Rule', () => {
      it('should return 403 for staff user attempting to delete rule', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/rules/rule-1',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(ruleRepository.delete).not.toHaveBeenCalled()
      })
    })

    describe('POST /api/rules/:id/toggle - Toggle Rule', () => {
      it('should return 403 for staff user attempting to toggle rule', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/rules/rule-1/toggle',
          headers: { authorization: `Bearer ${staffToken}` }
        })

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body).error).toBe('Forbidden')
        expect(ruleRepository.toggleActive).not.toHaveBeenCalled()
      })
    })
  })

})
