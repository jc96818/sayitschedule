import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  requireRole: vi.fn(() => async () => {}),
  requireSuperAdmin: vi.fn(() => async () => {}),
  requireAdmin: vi.fn(() => async () => {}),
  requireAdminOrAssistant: vi.fn(() => async () => {})
}))

// Mock the repositories
vi.mock('../../repositories/rules.js', () => ({
  ruleRepository: {
    findActiveByOrganization: vi.fn()
  }
}))

vi.mock('../../repositories/staff.js', () => ({
  staffRepository: {
    findByOrganization: vi.fn()
  }
}))

vi.mock('../../repositories/patients.js', () => ({
  patientRepository: {
    findByOrganization: vi.fn()
  }
}))

vi.mock('../../repositories/rooms.js', () => ({
  roomRepository: {
    findByOrganization: vi.fn()
  }
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

// Mock the OpenAI service
vi.mock('../../services/openai.js', () => ({
  analyzeRulesWithAI: vi.fn()
}))

// Import mocked modules
import { ruleRepository } from '../../repositories/rules.js'
import { staffRepository } from '../../repositories/staff.js'
import { patientRepository } from '../../repositories/patients.js'
import { roomRepository } from '../../repositories/rooms.js'
import { analyzeRulesWithAI } from '../../services/openai.js'

// Default mock user for testing
const defaultMockUser: JWTPayload = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'test-org-id'
}

async function buildTestApp(options?: {
  mockUser?: JWTPayload | null
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false
  })

  await app.register(cookie)
  await app.register(jwt, {
    secret: 'test-secret'
  })

  const mockUser = options?.mockUser !== undefined ? options.mockUser : defaultMockUser

  app.addHook('onRequest', async (request) => {
    request.ctx = {
      user: mockUser,
      organizationId: mockUser?.organizationId || null
    }
  })

  const { ruleRoutes } = await import('../rules.js')
  await app.register(ruleRoutes, { prefix: '/api/rules' })

  return app
}

describe('Rules Analyze Route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/rules/analyze', () => {
    it('returns empty results when no active rules exist', async () => {
      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue([])

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.summary.totalRulesAnalyzed).toBe(0)
      expect(body.data.conflicts).toEqual([])
      expect(body.data.duplicates).toEqual([])
      expect(body.data.enhancements).toEqual([])
    })

    it('analyzes rules and returns results', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          organizationId: 'test-org-id',
          category: 'gender_pairing',
          description: 'Male therapists can only see male patients',
          ruleLogic: {},
          priority: 10,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'rule-2',
          organizationId: 'test-org-id',
          category: 'gender_pairing',
          description: 'Female therapists can see any patient',
          ruleLogic: {},
          priority: 5,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockStaff = [
        { id: 'staff-1', name: 'John Smith', gender: 'male' },
        { id: 'staff-2', name: 'Jane Doe', gender: 'female' }
      ]

      const mockPatients = [
        { id: 'patient-1', name: 'Patient A' },
        { id: 'patient-2', name: 'Patient B' }
      ]

      const mockRooms = [
        { id: 'room-1', name: 'Room 101' }
      ]

      const mockAnalysisResult = {
        conflicts: [],
        duplicates: [],
        enhancements: [
          {
            relatedRuleIds: ['rule-1'],
            suggestion: 'Consider adding a rule for non-binary therapists',
            rationale: 'Current rules only cover male and female therapists',
            priority: 'low' as const
          }
        ],
        summary: {
          totalRulesAnalyzed: 2,
          conflictsFound: 0,
          duplicatesFound: 0,
          enhancementsSuggested: 1
        }
      }

      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue(mockRules)
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue(mockStaff as any)
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue(mockPatients as any)
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue(mockRooms as any)
      vi.mocked(analyzeRulesWithAI).mockResolvedValue(mockAnalysisResult)

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)

      expect(body.data.summary.totalRulesAnalyzed).toBe(2)
      expect(body.data.enhancements).toHaveLength(1)
      expect(body.data.enhancements[0].suggestion).toContain('non-binary')

      // Verify the context was passed correctly
      expect(analyzeRulesWithAI).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'rule-1', category: 'gender_pairing' }),
          expect.objectContaining({ id: 'rule-2', category: 'gender_pairing' })
        ]),
        expect.objectContaining({
          staffNames: ['John Smith', 'Jane Doe'],
          patientNames: ['Patient A', 'Patient B'],
          roomNames: ['Room 101']
        })
      )
    })

    it('returns conflicts when detected', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          organizationId: 'test-org-id',
          category: 'specific_pairing',
          description: 'Always pair John with Patient A',
          ruleLogic: {},
          priority: 10,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'rule-2',
          organizationId: 'test-org-id',
          category: 'specific_pairing',
          description: 'Never pair John with Patient A',
          ruleLogic: {},
          priority: 10,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockAnalysisResult = {
        conflicts: [
          {
            ruleIds: ['rule-1', 'rule-2'],
            description: 'Rules contradict each other regarding John and Patient A pairing',
            severity: 'high' as const,
            suggestion: 'Remove one of these conflicting rules'
          }
        ],
        duplicates: [],
        enhancements: [],
        summary: {
          totalRulesAnalyzed: 2,
          conflictsFound: 1,
          duplicatesFound: 0,
          enhancementsSuggested: 0
        }
      }

      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue(mockRules)
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(analyzeRulesWithAI).mockResolvedValue(mockAnalysisResult)

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)

      expect(body.data.conflicts).toHaveLength(1)
      expect(body.data.conflicts[0].severity).toBe('high')
      expect(body.data.summary.conflictsFound).toBe(1)
    })

    it('returns 400 when organization context is missing', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: null })

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toBe('Organization context required')
    })

    it('returns 500 when AI analysis fails', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          organizationId: 'test-org-id',
          category: 'session',
          description: 'Some rule',
          ruleLogic: {},
          priority: 5,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue(mockRules)
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(analyzeRulesWithAI).mockRejectedValue(new Error('AI service error: timeout'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(500)
    })

    it('detects duplicate rules', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          organizationId: 'test-org-id',
          category: 'session',
          description: 'Each therapist has max 2 sessions per day',
          ruleLogic: {},
          priority: 5,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'rule-2',
          organizationId: 'test-org-id',
          category: 'session',
          description: 'Therapists can have maximum of 2 sessions each day',
          ruleLogic: {},
          priority: 5,
          isActive: true,
          createdById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockAnalysisResult = {
        conflicts: [],
        duplicates: [
          {
            ruleIds: ['rule-1', 'rule-2'],
            description: 'Both rules express the same constraint about therapist daily sessions',
            recommendation: 'Keep rule-1 and remove rule-2 as they are functionally identical'
          }
        ],
        enhancements: [],
        summary: {
          totalRulesAnalyzed: 2,
          conflictsFound: 0,
          duplicatesFound: 1,
          enhancementsSuggested: 0
        }
      }

      vi.mocked(ruleRepository.findActiveByOrganization).mockResolvedValue(mockRules)
      vi.mocked(staffRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(patientRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(roomRepository.findByOrganization).mockResolvedValue([])
      vi.mocked(analyzeRulesWithAI).mockResolvedValue(mockAnalysisResult)

      const response = await app.inject({
        method: 'POST',
        url: '/api/rules/analyze'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)

      expect(body.data.duplicates).toHaveLength(1)
      expect(body.data.summary.duplicatesFound).toBe(1)
    })
  })
})
