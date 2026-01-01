/**
 * Portal Authentication Middleware
 *
 * Separate from staff auth - handles patient/caregiver portal sessions.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { portalAuthService, type PortalUser } from '../services/portalAuth.js'
import { organizationFeaturesRepository } from '../repositories/organizationFeatures.js'

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
  const expectedOrganizationId = request.ctx?.organizationId

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    })
  }

  if (!expectedOrganizationId) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Organization context required'
    })
  }

  const token = authHeader.substring(7)

  const user = await portalAuthService.validateSessionForOrganization(token, expectedOrganizationId)

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
 * Require that the patient portal feature is enabled for the organization.
 * Intended to run after `portalAuthenticate`.
 */
export async function requirePatientPortalEnabled(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.portalUser) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Portal user not authenticated'
    })
  }

  const enabled = await organizationFeaturesRepository.isPatientPortalEnabled(
    request.portalUser.organizationId
  )

  if (!enabled) {
    return reply.code(403).send({
      error: 'Feature Not Available',
      message: 'The Patient Portal feature is not enabled for this organization.',
      feature: 'patientPortal',
      upgradeRequired: true
    })
  }
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
