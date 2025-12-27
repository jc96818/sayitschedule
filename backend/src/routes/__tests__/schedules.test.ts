import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildTestApp } from './testApp.js'
import type { FastifyInstance } from 'fastify'

// Default mock user for test assertions
const defaultMockUser = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin' as const,
  organizationId: 'test-org-id'
}

// Mock the auth middleware - must be before other imports
vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  requireRole: vi.fn(() => async () => {}),
  requireSuperAdmin: vi.fn(() => async () => {}),
  requireAdmin: vi.fn(() => async () => {}),
  requireAdminOrAssistant: vi.fn(() => async () => {})
}))

// Mock the repositories
vi.mock('../../repositories/schedules.js', () => ({
  scheduleRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithSessions: vi.fn(),
    create: vi.fn(),
    publish: vi.fn(),
    archive: vi.fn(),
    addSessions: vi.fn()
  },
  sessionRepository: {
    findBySchedule: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

vi.mock('../../services/scheduler.js', () => ({
  generateSchedule: vi.fn()
}))

vi.mock('../../services/sessionLookup.js', () => ({
  findMatchingSessions: vi.fn(),
  checkForConflicts: vi.fn(),
  calculateNewEndTime: vi.fn((start: string) => {
    const [hours, minutes] = start.split(':').map(Number)
    const newHours = (hours + 1) % 24
    return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }),
  getDateForDayOfWeek: vi.fn()
}))

// Import mocked modules
import { scheduleRepository, sessionRepository } from '../../repositories/schedules.js'
import { generateSchedule } from '../../services/scheduler.js'
import { findMatchingSessions, checkForConflicts } from '../../services/sessionLookup.js'

describe('Schedule Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /api/schedules', () => {
    it('returns list of schedules for organization', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          organizationId: 'test-org-id',
          weekStartDate: new Date('2025-01-06'),
          status: 'draft' as const,
          createdBy: 'test-user-id',
          createdAt: new Date(),
          publishedAt: null,
          version: 1
        },
        {
          id: 'schedule-2',
          organizationId: 'test-org-id',
          weekStartDate: new Date('2025-01-13'),
          status: 'published' as const,
          createdBy: 'test-user-id',
          createdAt: new Date(),
          publishedAt: new Date(),
          version: 1
        }
      ]

      vi.mocked(scheduleRepository.findAll).mockResolvedValue({
        data: mockSchedules,
        total: 2,
        totalPages: 1,
        page: 1,
        limit: 20
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data).toHaveLength(2)
      expect(scheduleRepository.findAll).toHaveBeenCalledWith(
        defaultMockUser.organizationId,
        { page: 1, limit: 20, status: undefined }
      )
    })

    it('returns 400 when organization context is missing', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: null })

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules'
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toBe('Organization context required')
    })
  })

  describe('GET /api/schedules/:id', () => {
    it('returns schedule with sessions', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        weekStartDate: new Date('2025-01-06'),
        status: 'draft'
      }
      const mockSessions = [
        { id: 'session-1', therapistId: 'staff-1', patientId: 'patient-1' }
      ]

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.findBySchedule).mockResolvedValue(mockSessions as any)

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules/schedule-1'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.id).toBe('schedule-1')
      expect(body.data.sessions).toHaveLength(1)
    })

    it('returns 404 when schedule not found', async () => {
      vi.mocked(scheduleRepository.findById).mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules/non-existent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/schedules/generate', () => {
    it('generates a new schedule successfully', async () => {
      const mockSchedule = {
        id: 'new-schedule',
        weekStartDate: new Date('2025-01-06'),
        status: 'draft'
      }
      const mockGenerationResult = {
        sessions: [
          { scheduleId: '', therapistId: 'staff-1', patientId: 'patient-1', date: new Date(), startTime: '09:00', endTime: '10:00' }
        ],
        warnings: [],
        stats: { totalSessions: 1, patientsScheduled: 1, therapistsUsed: 1 }
      }
      const mockSessions = [
        { id: 'session-1', therapistId: 'staff-1', patientId: 'patient-1' }
      ]

      // Set OPENAI_API_KEY for test
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(generateSchedule).mockResolvedValue(mockGenerationResult)
      vi.mocked(scheduleRepository.create).mockResolvedValue(mockSchedule as any)
      vi.mocked(scheduleRepository.addSessions).mockResolvedValue([])
      vi.mocked(sessionRepository.findBySchedule).mockResolvedValue(mockSessions as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/generate',
        payload: { weekStartDate: '2025-01-06' }
      })

      // Restore env
      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.payload)
      expect(body.data.id).toBe('new-schedule')
      expect(body.meta.stats.totalSessions).toBe(1)
    })

    it('returns 503 when OpenAI API key is not configured', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/generate',
        payload: { weekStartDate: '2025-01-06' }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('OPENAI_API_KEY')
    })

    it('returns 400 when no active staff', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(generateSchedule).mockRejectedValue(new Error('No active staff members found'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/generate',
        payload: { weekStartDate: '2025-01-06' }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('No active staff')
    })

    it('returns 400 when no active patients', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(generateSchedule).mockRejectedValue(new Error('No active patients found'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/generate',
        payload: { weekStartDate: '2025-01-06' }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('No active patients')
    })
  })

  describe('POST /api/schedules/:id/publish', () => {
    it('publishes a schedule successfully', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        status: 'published'
      }

      vi.mocked(scheduleRepository.publish).mockResolvedValue(mockSchedule as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/schedule-1/publish'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.status).toBe('published')
    })

    it('returns 404 when schedule not found', async () => {
      vi.mocked(scheduleRepository.publish).mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/non-existent/publish'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/schedules/:id/archive', () => {
    it('archives a schedule successfully', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        status: 'archived'
      }

      vi.mocked(scheduleRepository.archive).mockResolvedValue(mockSchedule as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/schedule-1/archive'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.status).toBe('archived')
    })
  })

  describe('POST /api/schedules/:id/sessions', () => {
    it('creates a new session', async () => {
      const mockSchedule = { id: 'schedule-1', status: 'draft' }
      const mockSession = {
        id: 'session-1',
        therapistId: 'staff-1',
        patientId: 'patient-1'
      }

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.create).mockResolvedValue(mockSession as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/schedule-1/sessions',
        payload: {
          staffId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06',
          startTime: '09:00',
          endTime: '10:00'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.payload)
      expect(body.data.id).toBe('session-1')
    })

    it('returns 404 when schedule not found', async () => {
      vi.mocked(scheduleRepository.findById).mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/non-existent/sessions',
        payload: {
          staffId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06',
          startTime: '09:00',
          endTime: '10:00'
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/schedules/:scheduleId/sessions/:sessionId', () => {
    it('updates a session successfully', async () => {
      const mockSchedule = { id: 'schedule-1', status: 'draft' }
      const mockSession = {
        id: 'session-1',
        startTime: '10:00',
        endTime: '11:00'
      }

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.update).mockResolvedValue(mockSession as any)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedules/schedule-1/sessions/session-1',
        payload: {
          startTime: '10:00',
          endTime: '11:00'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.startTime).toBe('10:00')
    })

    it('returns 404 when session not found', async () => {
      const mockSchedule = { id: 'schedule-1', status: 'draft' }

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.update).mockResolvedValue(null)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedules/schedule-1/sessions/non-existent',
        payload: {
          startTime: '10:00'
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/schedules/:scheduleId/sessions/:sessionId', () => {
    it('deletes a session successfully', async () => {
      const mockSchedule = { id: 'schedule-1', status: 'draft' }

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.delete).mockResolvedValue(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/schedule-1/sessions/session-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('returns 404 when session not found', async () => {
      const mockSchedule = { id: 'schedule-1', status: 'draft' }

      vi.mocked(scheduleRepository.findById).mockResolvedValue(mockSchedule as any)
      vi.mocked(sessionRepository.delete).mockResolvedValue(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/schedule-1/sessions/non-existent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/schedules/:id/modify-voice', () => {
    const mockSchedule = {
      id: 'schedule-1',
      status: 'draft',
      weekStartDate: new Date('2025-01-06')
    }

    describe('cancel action', () => {
      it('cancels a session via voice command', async () => {
        const mockSession = {
          id: 'session-1',
          therapistId: 'staff-1',
          patientId: 'patient-1',
          therapistName: 'Sarah Johnson',
          patientName: 'Emily Carter',
          date: new Date('2025-01-06'),
          startTime: '09:00',
          endTime: '10:00'
        }

        vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(mockSchedule as any)
        vi.mocked(findMatchingSessions).mockResolvedValue([
          { session: mockSession, matchScore: 80, matchDetails: ['Therapist: Sarah Johnson'] }
        ] as any)
        vi.mocked(sessionRepository.delete).mockResolvedValue(true)

        const response = await app.inject({
          method: 'POST',
          url: '/api/schedules/schedule-1/modify-voice',
          payload: {
            action: 'cancel',
            therapistName: 'Sarah'
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.data.action).toBe('cancelled')
        expect(body.data.message).toContain('Sarah Johnson')
      })

      it('returns 404 when no matching session found', async () => {
        vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(mockSchedule as any)
        vi.mocked(findMatchingSessions).mockResolvedValue([])

        const response = await app.inject({
          method: 'POST',
          url: '/api/schedules/schedule-1/modify-voice',
          payload: {
            action: 'cancel',
            therapistName: 'Unknown Therapist'
          }
        })

        expect(response.statusCode).toBe(404)
        const body = JSON.parse(response.payload)
        expect(body.error).toContain('Could not find a session')
      })
    })

    describe('move action', () => {
      it('moves a session to a new time', async () => {
        const mockSession = {
          id: 'session-1',
          therapistId: 'staff-1',
          patientId: 'patient-1',
          therapistName: 'Sarah Johnson',
          patientName: 'Emily Carter',
          date: new Date('2025-01-06'),
          startTime: '09:00',
          endTime: '10:00'
        }

        vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(mockSchedule as any)
        vi.mocked(findMatchingSessions).mockResolvedValue([
          { session: mockSession, matchScore: 80, matchDetails: [] }
        ] as any)
        vi.mocked(checkForConflicts).mockResolvedValue([])
        vi.mocked(sessionRepository.update).mockResolvedValue({
          ...mockSession,
          startTime: '14:00',
          endTime: '15:00'
        } as any)

        const response = await app.inject({
          method: 'POST',
          url: '/api/schedules/schedule-1/modify-voice',
          payload: {
            action: 'move',
            therapistName: 'Sarah',
            newStartTime: '14:00'
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.payload)
        expect(body.data.action).toBe('moved')
        expect(body.data.to.startTime).toBe('14:00')
      })

      it('returns 409 when there is a time conflict', async () => {
        const mockSession = {
          id: 'session-1',
          therapistId: 'staff-1',
          patientId: 'patient-1',
          therapistName: 'Sarah Johnson',
          date: new Date('2025-01-06'),
          startTime: '09:00',
          endTime: '10:00'
        }
        const conflictSession = {
          id: 'session-2',
          therapistName: 'Sarah Johnson',
          patientName: 'Michael Brown',
          startTime: '14:00',
          endTime: '15:00'
        }

        vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(mockSchedule as any)
        vi.mocked(findMatchingSessions).mockResolvedValue([
          { session: mockSession, matchScore: 80, matchDetails: [] }
        ] as any)
        vi.mocked(checkForConflicts).mockResolvedValue([conflictSession] as any)

        const response = await app.inject({
          method: 'POST',
          url: '/api/schedules/schedule-1/modify-voice',
          payload: {
            action: 'move',
            therapistName: 'Sarah',
            newStartTime: '14:00'
          }
        })

        expect(response.statusCode).toBe(409)
        const body = JSON.parse(response.payload)
        expect(body.error).toContain('Time conflict')
      })
    })

    it('returns 400 when trying to modify a published schedule', async () => {
      const publishedSchedule = { ...mockSchedule, status: 'published' }

      vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(publishedSchedule as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/schedule-1/modify-voice',
        payload: {
          action: 'cancel',
          therapistName: 'Sarah'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('Cannot modify a published schedule')
    })

    it('returns 501 for swap action', async () => {
      vi.mocked(scheduleRepository.findByIdWithSessions).mockResolvedValue(mockSchedule as any)
      vi.mocked(findMatchingSessions).mockResolvedValue([
        { session: { id: 'session-1' }, matchScore: 80, matchDetails: [] }
      ] as any)

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/schedule-1/modify-voice',
        payload: {
          action: 'swap',
          therapistName: 'Sarah'
        }
      })

      expect(response.statusCode).toBe(501)
    })
  })
})
