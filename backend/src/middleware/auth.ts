import type { FastifyRequest, FastifyReply } from 'fastify'
import type { JWTPayload, UserRole } from '../types/index.js'
import { validateTenantAccess } from './tenantValidation.js'
import { userRepository } from '../repositories/users.js'

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

    if (reply.sent) {
      return
    }

    // Validate that the user still exists and has not changed role/org or password since token issuance.
    const authState = await userRepository.getAuthState(decoded.userId)
    if (!authState) {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    if (authState.role !== decoded.role) {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    if (decoded.role !== 'super_admin' && authState.organizationId !== decoded.organizationId) {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    const issuedAtMs = decoded.iat ? decoded.iat * 1000 : null
    if (issuedAtMs && authState.passwordChangedAt && issuedAtMs < authState.passwordChangedAt.getTime()) {
      return reply.status(401).send({ error: 'Invalid token' })
    }
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
