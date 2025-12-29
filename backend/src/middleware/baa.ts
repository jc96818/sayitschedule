import type { FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from './auth.js'
import { baaAgreementRepository } from '../repositories/baa.js'

/**
 * Middleware to require an executed BAA before accessing PHI-related routes.
 *
 * This middleware:
 * 1. Authenticates the user
 * 2. Checks if the user's organization has an executed BAA
 * 3. Returns 403 if no executed BAA exists
 *
 * Super admins are exempt from this check as they may need to access
 * organizations for support purposes.
 *
 * Use this middleware on routes that handle PHI:
 * - /api/patients/*
 * - /api/schedules/*
 * - /api/voice/*
 * - /api/transcription/*
 */
export function requireExecutedBaa() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // First authenticate
    await authenticate(request, reply)

    // Return early if authenticate already sent a response
    if (reply.sent) {
      return
    }

    if (!request.ctx.user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Super admins bypass BAA check - they need system access for support
    if (request.ctx.user.role === 'super_admin') {
      return
    }

    // Get the organization ID from the authenticated context
    const organizationId = request.ctx.organizationId || request.ctx.user.organizationId
    if (!organizationId) {
      return reply.status(403).send({
        error: 'Forbidden',
        reason: 'no_organization',
        message: 'No organization context available'
      })
    }

    // Check for executed BAA
    const hasExecutedBaa = await baaAgreementRepository.hasExecutedBaa(organizationId)

    if (!hasExecutedBaa) {
      return reply.status(403).send({
        error: 'Forbidden',
        reason: 'baa_not_executed',
        message: 'A Business Associate Agreement (BAA) must be signed before accessing this feature. Please contact your administrator to complete the BAA signing process.',
        redirectTo: '/baa'
      })
    }
  }
}

/**
 * Helper to check BAA status without blocking (for informational purposes)
 * Returns the BAA status for the current organization
 */
export async function getBaaStatusForRequest(request: FastifyRequest): Promise<{
  hasExecutedBaa: boolean
  organizationId: string | null
}> {
  const organizationId = request.ctx.organizationId || request.ctx.user?.organizationId || null

  if (!organizationId) {
    return { hasExecutedBaa: false, organizationId: null }
  }

  const hasExecutedBaa = await baaAgreementRepository.hasExecutedBaa(organizationId)
  return { hasExecutedBaa, organizationId }
}
