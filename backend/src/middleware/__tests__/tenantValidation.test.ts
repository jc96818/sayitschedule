import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { validateTenantAccess } from '../tenantValidation.js'
import type { JWTPayload } from '../../types/index.js'

describe('Tenant Validation Middleware', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify({ logger: false })
  })

  afterEach(async () => {
    await app.close()
  })

  // Helper to setup the app with specific context
  function setupApp(ctxSetup: { user: JWTPayload | null; organizationId: string | null }) {
    app.addHook('onRequest', async (request) => {
      request.ctx = {
        user: ctxSetup.user,
        organizationId: ctxSetup.organizationId
      }
    })

    app.get('/test', {
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        await validateTenantAccess(request, reply)
      }
    }, async (request) => {
      return {
        organizationId: request.ctx.organizationId,
        userOrgId: request.ctx.user?.organizationId
      }
    })
  }

  describe('Host-Org Confusion Attack Prevention (CRITICAL)', () => {
    it('overrides host-derived org with JWT org when they differ', async () => {
      // Setup: User from org-A tries to access via org-B subdomain
      setupApp({
        user: {
          userId: 'user-1',
          email: 'user@org-a.com',
          role: 'admin',
          organizationId: 'org-A' // User belongs to org-A
        },
        organizationId: 'org-B' // Host header derived org-B (attacker's target)
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)

      // CRITICAL: Must use JWT org (org-A), NOT host-derived org (org-B)
      expect(body.organizationId).toBe('org-A')
      expect(body.organizationId).not.toBe('org-B')
    })

    it('allows request when host-derived org matches JWT org', async () => {
      setupApp({
        user: {
          userId: 'user-1',
          email: 'user@org-a.com',
          role: 'admin',
          organizationId: 'org-A'
        },
        organizationId: 'org-A' // Same as JWT
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.organizationId).toBe('org-A')
    })

    it('sets organizationId from JWT when host has no subdomain', async () => {
      setupApp({
        user: {
          userId: 'user-1',
          email: 'user@org-a.com',
          role: 'admin',
          organizationId: 'org-A'
        },
        organizationId: null // No org from host (e.g., localhost)
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.organizationId).toBe('org-A')
    })
  })

  describe('Super Admin Access', () => {
    it('allows super_admin to access any organization via host header', async () => {
      setupApp({
        user: {
          userId: 'super-user',
          email: 'super@admin.com',
          role: 'super_admin',
          organizationId: null // Super admins have no org
        },
        organizationId: 'org-B' // Accessing org-B via subdomain
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      // Super admin should use host-derived org for cross-org access
      expect(body.organizationId).toBe('org-B')
    })

    it('allows super_admin to access with null organizationId', async () => {
      setupApp({
        user: {
          userId: 'super-user',
          email: 'super@admin.com',
          role: 'super_admin',
          organizationId: null
        },
        organizationId: null // No host-derived org
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.organizationId).toBeNull()
    })
  })

  describe('Non-Super-Admin Without OrganizationId', () => {
    it('returns 403 for admin without organizationId in JWT', async () => {
      setupApp({
        user: {
          userId: 'bad-user',
          email: 'bad@user.com',
          role: 'admin',
          organizationId: null // Invalid: non-super-admin without org
        },
        organizationId: 'org-B'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('not associated with an organization')
    })

    it('returns 403 for admin_assistant without organizationId in JWT', async () => {
      setupApp({
        user: {
          userId: 'bad-user',
          email: 'bad@user.com',
          role: 'admin_assistant',
          organizationId: null
        },
        organizationId: 'org-B'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(403)
    })

    it('returns 403 for staff without organizationId in JWT', async () => {
      setupApp({
        user: {
          userId: 'bad-user',
          email: 'bad@user.com',
          role: 'staff',
          organizationId: null
        },
        organizationId: 'org-B'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('Role-based Enforcement', () => {
    it.each([
      ['admin', 'org-A'],
      ['admin_assistant', 'org-A'],
      ['staff', 'org-A']
    ])('enforces JWT org for %s role even when host differs', async (role, expectedOrg) => {
      setupApp({
        user: {
          userId: 'user-1',
          email: 'user@example.com',
          role: role as 'admin' | 'admin_assistant' | 'staff',
          organizationId: 'org-A'
        },
        organizationId: 'org-ATTACKER' // Attacker's subdomain
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.organizationId).toBe(expectedOrg)
      expect(body.organizationId).not.toBe('org-ATTACKER')
    })
  })

  describe('Edge Cases', () => {
    it('skips validation when no user is present (not authenticated)', async () => {
      setupApp({
        user: null,
        organizationId: 'org-B'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/test'
      })

      // Should pass through - auth middleware should handle 401
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      // Context remains unchanged
      expect(body.organizationId).toBe('org-B')
    })
  })
})
