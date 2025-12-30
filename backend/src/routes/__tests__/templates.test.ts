import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'
import type { BusinessTypeTemplate } from '@prisma/client'

// Default mock super admin user for test assertions
const defaultMockSuperAdmin: JWTPayload = {
  userId: 'super-admin-id',
  email: 'super@example.com',
  role: 'super_admin' as const,
  organizationId: null
}

// Mock admin user (not super admin)
const mockAdmin: JWTPayload = {
  userId: 'admin-id',
  email: 'admin@example.com',
  role: 'admin' as const,
  organizationId: 'test-org-id'
}

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  requireRole: vi.fn(() => async () => {}),
  requireSuperAdmin: vi.fn(() => async (request: any, reply: any) => {
    if (request.ctx.user?.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Super admin role required' })
    }
  }),
  requireAdmin: vi.fn(() => async () => {}),
  requireAdminOrAssistant: vi.fn(() => async () => {})
}))

// Mock the repositories
vi.mock('../../repositories/templates.js', () => ({
  templateRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findDefault: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOrganizationCount: vi.fn()
  }
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

// Import mocked modules
import { templateRepository } from '../../repositories/templates.js'

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

  const mockUser = options?.mockUser !== undefined ? options.mockUser : defaultMockSuperAdmin

  // Add mock context middleware
  app.addHook('onRequest', async (request) => {
    request.ctx = {
      user: mockUser,
      organizationId: mockUser?.organizationId || null
    }
  })

  // Import routes dynamically after setting up mocks
  const { templateRoutes } = await import('../templates.js')

  // Register routes
  await app.register(templateRoutes, { prefix: '/api/templates' })

  return app
}

// Mock template data
const mockTemplate: BusinessTypeTemplate = {
  id: 'template-1',
  name: 'ABA Therapy',
  description: 'Template for ABA therapy clinics',
  isDefault: false,
  isActive: true,
  staffLabel: 'Therapists',
  staffLabelSingular: 'Therapist',
  patientLabel: 'Clients',
  patientLabelSingular: 'Client',
  roomLabel: 'Treatment Rooms',
  roomLabelSingular: 'Treatment Room',
  certificationLabel: 'Credentials',
  equipmentLabel: 'Equipment',
  suggestedCertifications: ['BCBA', 'RBT', 'BCaBA'],
  suggestedRoomEquipment: ['sensory_equipment', 'therapy_swing'],
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('Template Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /api/templates', () => {
    it('returns list of templates with organization counts', async () => {
      vi.mocked(templateRepository.findAll).mockResolvedValue({
        data: [mockTemplate],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
      })
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(5)

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('ABA Therapy')
      expect(body.data[0].organizationCount).toBe(5)
      expect(body.pagination.total).toBe(1)
    })

    it('filters by isActive parameter', async () => {
      vi.mocked(templateRepository.findAll).mockResolvedValue({
        data: [mockTemplate],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
      })
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(0)

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates?isActive=true'
      })

      expect(response.statusCode).toBe(200)
      expect(templateRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      )
    })

    it('supports search parameter', async () => {
      vi.mocked(templateRepository.findAll).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates?search=therapy'
      })

      expect(response.statusCode).toBe(200)
      expect(templateRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'therapy' })
      )
    })

    it('returns 403 for non-super admin', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: mockAdmin })

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates'
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Super admin role required')
    })
  })

  describe('GET /api/templates/active', () => {
    it('returns only active templates', async () => {
      vi.mocked(templateRepository.findAll).mockResolvedValue({
        data: [mockTemplate],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates/active'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toHaveLength(1)
      expect(templateRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      )
    })
  })

  describe('GET /api/templates/:id', () => {
    it('returns single template with organization count', async () => {
      vi.mocked(templateRepository.findById).mockResolvedValue(mockTemplate)
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(3)

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates/template-1'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.name).toBe('ABA Therapy')
      expect(body.data.organizationCount).toBe(3)
      expect(templateRepository.findById).toHaveBeenCalledWith('template-1')
    })

    it('returns 404 when template not found', async () => {
      vi.mocked(templateRepository.findById).mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/templates/nonexistent'
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Template not found')
    })
  })

  describe('POST /api/templates', () => {
    it('creates new template with all fields', async () => {
      const newTemplate = { ...mockTemplate, id: 'new-template-id' }
      vi.mocked(templateRepository.create).mockResolvedValue(newTemplate)

      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: {
          name: 'ABA Therapy',
          description: 'Template for ABA therapy clinics',
          staffLabel: 'Therapists',
          staffLabelSingular: 'Therapist',
          patientLabel: 'Clients',
          patientLabelSingular: 'Client',
          roomLabel: 'Treatment Rooms',
          roomLabelSingular: 'Treatment Room',
          certificationLabel: 'Credentials',
          equipmentLabel: 'Equipment',
          suggestedCertifications: ['BCBA', 'RBT'],
          suggestedRoomEquipment: ['sensory_equipment']
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.data.name).toBe('ABA Therapy')
      expect(templateRepository.create).toHaveBeenCalled()
    })

    it('creates template with only required fields', async () => {
      const minimalTemplate = {
        ...mockTemplate,
        description: null,
        suggestedCertifications: [],
        suggestedRoomEquipment: []
      }
      vi.mocked(templateRepository.create).mockResolvedValue(minimalTemplate)

      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: {
          name: 'Basic Template'
        }
      })

      expect(response.statusCode).toBe(201)
      expect(templateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Basic Template' })
      )
    })

    it('validates name is required', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    it('validates name max length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: {
          name: 'a'.repeat(101) // exceeds 100 char limit
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('validates suggested certifications max items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: {
          name: 'Test Template',
          suggestedCertifications: Array(51).fill('cert') // exceeds 50 item limit
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 403 for non-super admin', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: mockAdmin })

      const response = await app.inject({
        method: 'POST',
        url: '/api/templates',
        payload: { name: 'Test' }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('PUT /api/templates/:id', () => {
    it('updates template fields', async () => {
      const updatedTemplate = {
        ...mockTemplate,
        name: 'Updated ABA Therapy',
        staffLabel: 'BCBAs'
      }
      vi.mocked(templateRepository.update).mockResolvedValue(updatedTemplate)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/templates/template-1',
        payload: {
          name: 'Updated ABA Therapy',
          staffLabel: 'BCBAs'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.name).toBe('Updated ABA Therapy')
      expect(body.data.staffLabel).toBe('BCBAs')
    })

    it('can deactivate template', async () => {
      const deactivatedTemplate = { ...mockTemplate, isActive: false }
      vi.mocked(templateRepository.update).mockResolvedValue(deactivatedTemplate)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/templates/template-1',
        payload: {
          isActive: false
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.isActive).toBe(false)
    })

    it('can set template as default', async () => {
      const defaultTemplate = { ...mockTemplate, isDefault: true }
      vi.mocked(templateRepository.update).mockResolvedValue(defaultTemplate)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/templates/template-1',
        payload: {
          isDefault: true
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.isDefault).toBe(true)
    })

    it('returns 404 when template not found', async () => {
      vi.mocked(templateRepository.update).mockResolvedValue(null)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/templates/nonexistent',
        payload: { name: 'Updated' }
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Template not found')
    })
  })

  describe('DELETE /api/templates/:id', () => {
    it('soft deletes template with no organizations', async () => {
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(0)
      vi.mocked(templateRepository.delete).mockResolvedValue(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/templates/template-1'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(templateRepository.delete).toHaveBeenCalledWith('template-1')
    })

    it('prevents deletion when organizations are using template', async () => {
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(3)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/templates/template-1'
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Cannot delete template with active organizations')
      expect(body.detail).toContain('3 organization(s)')
      expect(templateRepository.delete).not.toHaveBeenCalled()
    })

    it('returns 404 when template not found', async () => {
      vi.mocked(templateRepository.getOrganizationCount).mockResolvedValue(0)
      vi.mocked(templateRepository.delete).mockResolvedValue(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/templates/nonexistent'
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Template not found')
    })

    it('returns 403 for non-super admin', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: mockAdmin })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/templates/template-1'
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
