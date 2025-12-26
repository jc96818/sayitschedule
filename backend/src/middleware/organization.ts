import type { FastifyRequest, FastifyReply } from 'fastify'

export async function organizationMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Initialize context
  request.ctx = {
    user: null,
    organizationId: null
  }

  // Get organization from subdomain or environment variable (for local dev)
  const host = request.headers.host || ''
  const subdomain = host.split('.')[0]

  // In development, use ORG_DOMAIN env var
  if (process.env.NODE_ENV === 'development' && process.env.ORG_DOMAIN) {
    request.ctx.organizationId = process.env.ORG_DOMAIN
    return
  }

  // Skip organization context for super admin routes and auth routes
  if (
    request.url.startsWith('/api/organizations') ||
    request.url.startsWith('/api/auth')
  ) {
    return
  }

  // Set organization context from subdomain
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    // TODO: Look up organization by subdomain from database
    request.ctx.organizationId = subdomain
  }
}
