import type { FastifyRequest, FastifyReply } from 'fastify'
import type { JWTPayload, UserRole } from '../types/index.js'

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const decoded = await request.jwtVerify<JWTPayload>()
    request.ctx.user = decoded

    // Set organization context from user if not already set
    if (!request.ctx.organizationId && decoded.organizationId) {
      request.ctx.organizationId = decoded.organizationId
    }
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)

    if (!request.ctx.user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    if (!roles.includes(request.ctx.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

export function requireSuperAdmin() {
  return requireRole('super_admin')
}

export function requireAdmin() {
  return requireRole('super_admin', 'admin')
}

export function requireAdminOrAssistant() {
  return requireRole('super_admin', 'admin', 'admin_assistant')
}
