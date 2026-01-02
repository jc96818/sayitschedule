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

  // Always allow health checks to succeed even if the DB is down.
  if (request.url.startsWith('/api/health')) {
    return
  }

  // Skip organization context for super admin routes
  // Note: Auth routes DO need organization context for subdomain-based login
  if (request.url.startsWith('/api/organizations')) {
    return
  }

  // Get organization from subdomain or environment variable (for local dev)
  // In development, Vite proxy forwards the original host via X-Forwarded-Host.
  // Do not trust X-Forwarded-Host in production; clients can spoof it and cross-tenant requests.
  const forwardedHost = process.env.NODE_ENV === 'development'
    ? (request.headers['x-forwarded-host'] as string | undefined)
    : undefined
  const hostHeader = forwardedHost || request.headers.host || ''
  const hostname = hostHeader.split(':')[0]

  if (!hostname) return

  // Skip lookups for plain localhost, www, and direct IP access (ALB and container health checks).
  // Note: *.localhost (e.g., demo.localhost) is allowed for local development
  if (hostname === 'localhost' || hostname === 'www' || hostname.match(/^\d{1,3}(\.\d{1,3}){3}$/)) {
    return
  }

  // Extract subdomain from hostname
  let subdomain: string | null = null

  // Handle *.localhost for local development (e.g., demo.localhost)
  if (hostname.endsWith('.localhost')) {
    subdomain = hostname.replace('.localhost', '')
  } else {
    // Production: extract first part of hostname (e.g., demo from demo.sayitschedule.com)
    subdomain = hostname.split('.')[0]
  }

  // In development, use ORG_DOMAIN env var to specify subdomain (fallback)
  const targetSubdomain = process.env.NODE_ENV === 'development' && process.env.ORG_DOMAIN
    ? process.env.ORG_DOMAIN
    : subdomain

  // Skip org lookup for special subdomains:
  // - 'sayitschedule' is the root domain (sayitschedule.com extracts as 'sayitschedule')
  // - 'admin' is the superadmin subdomain (admin.sayitschedule.com)
  const reservedSubdomains = ['localhost', 'www', 'sayitschedule', 'admin']

  // Look up organization ID from subdomain
  if (targetSubdomain && !reservedSubdomains.includes(targetSubdomain)) {
    try {
      const orgId = await getOrganizationId(targetSubdomain)
      if (orgId) {
        request.ctx.organizationId = orgId
      }
    } catch (err) {
      request.log.error({ err }, 'Failed to resolve organization from subdomain')
    }
  }
}
