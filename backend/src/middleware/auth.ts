import type { FastifyRequest, FastifyReply } from 'fastify'
import type { JWTPayload, UserRole } from '../types/index.js'
import { validateTenantAccess } from './tenantValidation.js'

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

    // Apply tenant validation to enforce JWT org as source of truth
    // This prevents host-org confusion attacks where attacker uses
    // their valid JWT but sends request to another org's subdomain
    await validateTenantAccess(request, reply)
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)

    // Return early if authenticate/validateTenantAccess already sent a response
    if (reply.sent) {
      return
    }

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
