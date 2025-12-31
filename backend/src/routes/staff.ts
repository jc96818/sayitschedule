import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { staffRepository } from '../repositories/staff.js'
import { logAudit } from '../repositories/audit.js'

const createStaffSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  defaultHours: z.record(z.object({ start: z.string(), end: z.string() }).nullable()).optional(),
  hireDate: z.string().optional()
})

const updateStaffSchema = createStaffSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export async function staffRoutes(fastify: FastifyInstance) {
  // Get current user's linked staff profile
  fastify.get('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.ctx.user!

    // Find staff member linked to the current user
    const staffMember = await staffRepository.findByUserId(user.userId)
    if (!staffMember) {
      return reply.status(404).send({ error: 'No staff profile linked to your account' })
    }

    return { data: staffMember }
  })

  // List all staff
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, search, status, gender } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
      gender?: string
    }

    const result = await staffRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      gender
    })

    return result
  })

  // Get single staff member
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const staffMember = await staffRepository.findById(id, organizationId)
    if (!staffMember) {
      return reply.status(404).send({ error: 'Staff member not found' })
    }

    return { data: staffMember }
  })

  // Create staff member
  fastify.post('/', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createStaffSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const staffMember = await staffRepository.create({
      organizationId,
      name: body.name,
      gender: body.gender,
      email: body.email,
      phone: body.phone,
      certifications: body.certifications,
      defaultHours: body.defaultHours,
      hireDate: body.hireDate ? new Date(body.hireDate) : null
    })

    await logAudit(ctx.userId, 'create', 'staff', staffMember.id, organizationId, body)

    return reply.status(201).send({ data: staffMember })
  })

  // Update staff member
  fastify.put('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateStaffSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const staffMember = await staffRepository.update(id, organizationId, {
      ...body,
      hireDate: body.hireDate ? new Date(body.hireDate) : undefined
    })

    if (!staffMember) {
      return reply.status(404).send({ error: 'Staff member not found' })
    }

    await logAudit(ctx.userId, 'update', 'staff', id, organizationId, body)

    return { data: staffMember }
  })

  // Delete staff member
  fastify.delete('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const deleted = await staffRepository.delete(id, organizationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Staff member not found' })
    }

    await logAudit(ctx.userId, 'delete', 'staff', id, organizationId)

    return reply.status(204).send()
  })
}
