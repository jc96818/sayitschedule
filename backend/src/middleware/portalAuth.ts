/**
 * Portal Authentication Middleware
 *
 * Separate from staff auth - handles patient/caregiver portal sessions.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { portalAuthService, type PortalUser } from '../services/portalAuth.js'

// Extend FastifyRequest to include portal user
declare module 'fastify' {
  interface FastifyRequest {
    portalUser?: PortalUser
  }
}

/**
 * Authenticate portal users via Bearer token
 */
export async function portalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    })
  }

  const token = authHeader.substring(7)

  const user = await portalAuthService.validateSession(token)

  if (!user) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired session'
    })
  }

  // Attach user to request
  request.portalUser = user
}

/**
 * Get portal user from request (throws if not authenticated)
 */
export function getPortalUser(request: FastifyRequest): PortalUser {
  if (!request.portalUser) {
    throw new Error('Portal user not authenticated')
  }
  return request.portalUser
}
