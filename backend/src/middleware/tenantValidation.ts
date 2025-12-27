import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Tenant validation middleware - MUST run after authenticate middleware.
 *
 * Security: This middleware enforces that non-super-admin users can only
 * access data within their own organization, regardless of the Host header.
 *
 * This prevents the "host-org confusion" attack where an attacker could
 * access another organization's data by manipulating the subdomain while
 * using a valid JWT from their own organization.
 *
 * For non-super-admin users:
 *   - Overrides request.ctx.organizationId with the user's JWT organizationId
 *   - If user has no organizationId in JWT, returns 403
 *   - If host-derived org differs from JWT org, logs security warning
 *
 * For super_admin users:
 *   - Allows access to any organization (host-derived org is used)
 *   - This enables super_admin to manage multiple orgs via subdomain
 */
export async function validateTenantAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip if no authenticated user (let auth middleware handle 401)
  if (!request.ctx.user) {
    return
  }

  const user = request.ctx.user
  const hostDerivedOrgId = request.ctx.organizationId
  const jwtOrgId = user.organizationId

  // Super admins can access any organization
  if (user.role === 'super_admin') {
    // Keep the host-derived org for super_admin cross-org access
    // This allows super_admin to operate on orgB.example.com
    return
  }

  // Non-super-admin users MUST have an organizationId in their JWT
  if (!jwtOrgId) {
    request.log.warn(
      {
        userId: user.userId,
        email: user.email,
        role: user.role
      },
      'Non-super-admin user without organizationId attempted access'
    )

    return reply.status(403).send({
      error: 'Forbidden: User not associated with an organization'
    })
  }

  // SECURITY: If host-derived org differs from JWT org, log warning and override
  if (hostDerivedOrgId && hostDerivedOrgId !== jwtOrgId) {
    request.log.warn(
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
        hostDerivedOrgId,
        jwtOrgId,
        host: request.headers.host
      },
      'SECURITY: Host-org mismatch detected - potential tenant confusion attack'
    )
  }

  // CRITICAL: Always use JWT organizationId for non-super-admin users
  request.ctx.organizationId = jwtOrgId
}
