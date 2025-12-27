import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

// Default mock user for testing
const defaultMockUser: JWTPayload = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'test-org-id'
}

export async function buildTestApp(options?: {
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

  // We need to import routes dynamically after setting up mocks
  const { scheduleRoutes } = await import('../schedules.js')
  const { voiceRoutes } = await import('../voice.js')

  // Register routes
  await app.register(scheduleRoutes, { prefix: '/api/schedules' })
  await app.register(voiceRoutes, { prefix: '/api/voice' })

  return app
}

// Helper to generate auth token for testing
export function generateTestToken(app: FastifyInstance, user: JWTPayload): string {
  return app.jwt.sign({
    userId: user.userId,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  })
}
