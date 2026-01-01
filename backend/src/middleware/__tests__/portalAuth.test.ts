import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { portalAuthenticate } from '../portalAuth.js'

const mockPortalAuthService = vi.hoisted(() => ({
  validateSessionForOrganization: vi.fn()
}))

vi.mock('../../services/portalAuth.js', () => ({
  portalAuthService: mockPortalAuthService
}))

describe('Portal Auth Middleware', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify({ logger: false })
  })

  afterEach(async () => {
    await app.close()
  })

  function setupRoute(ctx: { organizationId: string | null }) {
    app.addHook('onRequest', async (request) => {
      request.ctx = { user: null, organizationId: ctx.organizationId }
    })

    app.get(
      '/test',
      {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          await portalAuthenticate(request, reply)
        }
      },
      async (request: FastifyRequest) => {
        return { portalUser: request.portalUser }
      }
    )
  }

  it('returns 401 when organization context is missing', async () => {
    setupRoute({ organizationId: null })

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: 'Bearer test-token' }
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when session is invalid for organization', async () => {
    setupRoute({ organizationId: 'org-1' })
    mockPortalAuthService.validateSessionForOrganization.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: 'Bearer test-token' }
    })

    expect(response.statusCode).toBe(401)
    expect(mockPortalAuthService.validateSessionForOrganization).toHaveBeenCalledWith('test-token', 'org-1')
  })

  it('attaches portalUser when session is valid for organization', async () => {
    setupRoute({ organizationId: 'org-1' })
    mockPortalAuthService.validateSessionForOrganization.mockResolvedValueOnce({
      contactId: 'contact-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: null
    })

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: 'Bearer test-token' }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.portalUser.organizationId).toBe('org-1')
  })
})
