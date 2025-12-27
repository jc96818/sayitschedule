import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

// Mock user context for testing
export interface MockUserContext {
  userId: string
  email: string
  role: 'super_admin' | 'admin' | 'admin_assistant' | 'viewer'
  organizationId: string
}

export const defaultMockUser: MockUserContext = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'test-org-id'
}

// Create mock auth middleware that bypasses token verification
function createMockAuthMiddleware(mockUser: MockUserContext | null) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mockUser) {
      // Simulate unauthorized if no user
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    // User is already set by onRequest hook
  }
}

export async function buildTestApp(options?: {
  mockUser?: MockUserContext | null
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
  // But first, let's mock the auth middleware
  const { scheduleRoutes } = await import('../schedules.js')
  const { voiceRoutes } = await import('../voice.js')

  // Register routes
  await app.register(scheduleRoutes, { prefix: '/api/schedules' })
  await app.register(voiceRoutes, { prefix: '/api/voice' })

  return app
}

// Helper to generate auth token for testing
export function generateTestToken(app: FastifyInstance, user: MockUserContext): string {
  return app.jwt.sign({
    userId: user.userId,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  })
}
