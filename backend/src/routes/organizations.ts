import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin, authenticate } from '../middleware/auth.js'
import { organizationRepository } from '../repositories/organizations.js'
import { logAudit } from '../repositories/audit.js'

const createOrgSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1).regex(/^[a-z0-9-]+$/),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional()
})

const updateOrgSchema = createOrgSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export async function organizationRoutes(fastify: FastifyInstance) {
  // List all organizations (super admin only)
  fastify.get('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest) => {
    const { page, limit, search, status } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
    }

    const result = await organizationRepository.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status
    })

    // Get stats for each organization
    const dataWithStats = await Promise.all(
      result.data.map(async (org) => {
        const stats = await organizationRepository.getStats(org.id)
        return {
          ...org,
          users: stats.users,
          staff: stats.staff,
          patients: stats.patients
        }
      })
    )

    return {
      ...result,
      data: dataWithStats
    }
  })

  // Get single organization
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    // Non-super admins can only view their own organization
    if (ctx.role !== 'super_admin' && ctx.organizationId !== id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const organization = await organizationRepository.findById(id)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    const stats = await organizationRepository.getStats(id)

    return {
      data: {
        ...organization,
        users: stats.users,
        staff: stats.staff,
        patients: stats.patients
      }
    }
  })

  // Create organization (super admin only)
  fastify.post('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createOrgSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if subdomain is already taken
    const existing = await organizationRepository.findBySubdomain(body.subdomain)
    if (existing) {
      return reply.status(400).send({ error: 'Subdomain already in use' })
    }

    const organization = await organizationRepository.create(body)

    await logAudit(ctx.userId, 'create', 'organization', organization.id, null, body)

    return reply.status(201).send({ data: organization })
  })

  // Update organization
  fastify.put('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateOrgSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if subdomain is already taken by another org
    if (body.subdomain) {
      const existing = await organizationRepository.findBySubdomain(body.subdomain)
      if (existing && existing.id !== id) {
        return reply.status(400).send({ error: 'Subdomain already in use' })
      }
    }

    const organization = await organizationRepository.update(id, body)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    await logAudit(ctx.userId, 'update', 'organization', id, null, body)

    return { data: organization }
  })

  // Switch organization context (super admin only)
  fastify.post('/:id/switch', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const organization = await organizationRepository.findById(id)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    if (organization.status !== 'active') {
      return reply.status(400).send({ error: 'Organization is inactive' })
    }

    return { success: true, organization }
  })
}
