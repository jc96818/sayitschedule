import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { MedicalSpecialty, Status, TranscriptionProvider } from '@prisma/client'
import type { JWTPayload } from '../../types/index.js'

// Default mock user for test assertions
const defaultMockUser: JWTPayload = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin' as const,
  organizationId: 'test-org-id'
}

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  requireRole: vi.fn(() => async () => {}),
  requireSuperAdmin: vi.fn(() => async () => {}),
  requireAdmin: vi.fn(() => async () => {}),
  requireAdminOrAssistant: vi.fn(() => async () => {})
}))

// Mock the repositories
vi.mock('../../repositories/organizations.js', () => ({
  organizationRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySubdomain: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
    getTranscriptionSettings: vi.fn()
  }
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

// Import mocked modules
import { organizationRepository } from '../../repositories/organizations.js'

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

  // Add mock organization middleware
  app.addHook('onRequest', async (request) => {
    request.ctx = {
      user: mockUser,
      organizationId: mockUser?.organizationId || null
    }
  })

  // Import routes dynamically after setting up mocks
  const { organizationRoutes } = await import('../organizations.js')

  // Register routes
  await app.register(organizationRoutes, { prefix: '/api/organizations' })

  return app
}

describe('Organization Routes - Transcription Settings', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

	describe('GET /api/organizations/current/transcription', () => {
	    it('returns transcription settings for current organization', async () => {
	      const mockSettings = {
	        transcriptionProvider: TranscriptionProvider.aws_medical,
	        medicalSpecialty: MedicalSpecialty.PRIMARYCARE
	      }

      vi.mocked(organizationRepository.getTranscriptionSettings).mockResolvedValue(mockSettings)

      const response = await app.inject({
        method: 'GET',
        url: '/api/organizations/current/transcription'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toEqual(mockSettings)
      expect(organizationRepository.getTranscriptionSettings).toHaveBeenCalledWith('test-org-id')
    })

    it('returns 404 when organization not found', async () => {
      vi.mocked(organizationRepository.getTranscriptionSettings).mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/organizations/current/transcription'
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Organization not found')
    })

    it('returns 400 when no organization context', async () => {
      await app.close()
      app = await buildTestApp({
        mockUser: {
          userId: 'test-user-id',
          email: 'test@example.com',
          role: 'admin',
          organizationId: null
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/organizations/current/transcription'
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Organization context required')
    })
  })

  describe('PUT /api/organizations/current/transcription', () => {
	    it('updates transcription settings for current organization', async () => {
	      const mockOrganization = {
	        id: 'test-org-id',
	        name: 'Test Org',
	        subdomain: 'test',
	        logoUrl: null,
	        primaryColor: '#2563eb',
	        secondaryColor: '#1e40af',
	        status: Status.active,
	        createdAt: new Date(),
	        updatedAt: new Date(),
	        transcriptionProvider: TranscriptionProvider.aws_standard,
	        medicalSpecialty: MedicalSpecialty.CARDIOLOGY
	      }

      vi.mocked(organizationRepository.update).mockResolvedValue(mockOrganization)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          transcriptionProvider: 'aws_standard',
          medicalSpecialty: 'CARDIOLOGY'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
	      expect(body.data.transcriptionProvider).toBe('aws_standard')
	      expect(body.data.medicalSpecialty).toBe('CARDIOLOGY')
	      expect(organizationRepository.update).toHaveBeenCalledWith('test-org-id', {
	        transcriptionProvider: TranscriptionProvider.aws_standard,
	        medicalSpecialty: MedicalSpecialty.CARDIOLOGY
	      })
	    })

    it('returns 403 when user is not admin', async () => {
      await app.close()
      app = await buildTestApp({
        mockUser: {
          userId: 'test-user-id',
          email: 'test@example.com',
          role: 'staff',
          organizationId: 'test-org-id'
        }
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          transcriptionProvider: 'aws_standard'
        }
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Admin role required')
    })

    it('returns 404 when organization not found', async () => {
      vi.mocked(organizationRepository.update).mockResolvedValue(null)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          transcriptionProvider: 'aws_standard'
        }
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Organization not found')
    })

    it('validates transcription provider enum', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          transcriptionProvider: 'invalid_provider'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('validates medical specialty enum', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          medicalSpecialty: 'INVALID_SPECIALTY'
        }
      })

      expect(response.statusCode).toBe(400)
    })

	    it('allows super_admin to update another organization', async () => {
      await app.close()
      app = await buildTestApp({
        mockUser: {
          userId: 'super-admin-id',
          email: 'super@example.com',
          role: 'super_admin',
          organizationId: null
        }
      })

	      const mockOrganization = {
	        id: 'other-org-id',
	        name: 'Other Org',
	        subdomain: 'other',
	        logoUrl: null,
	        primaryColor: '#2563eb',
	        secondaryColor: '#1e40af',
	        status: Status.active,
	        createdAt: new Date(),
	        updatedAt: new Date(),
	        transcriptionProvider: TranscriptionProvider.aws_medical,
	        medicalSpecialty: MedicalSpecialty.ONCOLOGY
	      }

      vi.mocked(organizationRepository.update).mockResolvedValue(mockOrganization)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/organizations/current/transcription',
        payload: {
          transcriptionProvider: 'aws_medical',
          medicalSpecialty: 'ONCOLOGY',
          organizationId: 'other-org-id'
        }
      })

	      expect(response.statusCode).toBe(200)
	      expect(organizationRepository.update).toHaveBeenCalledWith('other-org-id', {
	        transcriptionProvider: TranscriptionProvider.aws_medical,
	        medicalSpecialty: MedicalSpecialty.ONCOLOGY
	      })
	    })
  })
})
