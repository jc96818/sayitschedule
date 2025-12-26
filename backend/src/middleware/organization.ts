import type { FastifyRequest, FastifyReply } from 'fastify'
import { organizationRepository } from '../repositories/organizations.js'

// Cache for organization lookups (subdomain -> id)
const orgCache = new Map<string, { id: string; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getOrganizationId(subdomain: string): Promise<string | null> {
  // Check cache first
  const cached = orgCache.get(subdomain)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id
  }

  // Look up from database
  const org = await organizationRepository.findBySubdomain(subdomain)
  if (org) {
    orgCache.set(subdomain, { id: org.id, expiresAt: Date.now() + CACHE_TTL })
    return org.id
  }

  return null
}

export async function organizationMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Initialize context
  request.ctx = {
    user: null,
    organizationId: null
  }

  // Skip organization context for super admin routes and auth routes
  if (
    request.url.startsWith('/api/organizations') ||
    request.url.startsWith('/api/auth')
  ) {
    return
  }

  // Get organization from subdomain or environment variable (for local dev)
  const host = request.headers.host || ''
  const subdomain = host.split('.')[0]

  // In development, use ORG_DOMAIN env var to specify subdomain
  const targetSubdomain = process.env.NODE_ENV === 'development' && process.env.ORG_DOMAIN
    ? process.env.ORG_DOMAIN
    : subdomain

  // Look up organization ID from subdomain
  if (targetSubdomain && targetSubdomain !== 'localhost' && targetSubdomain !== 'www') {
    const orgId = await getOrganizationId(targetSubdomain)
    if (orgId) {
      request.ctx.organizationId = orgId
    }
  }
}
