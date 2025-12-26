import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../middleware/auth.js'
import { userRepository } from '../repositories/users.js'
import { logAudit } from '../repositories/audit.js'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'admin_assistant', 'staff'])
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'admin_assistant', 'staff']).optional(),
  password: z.string().min(8).optional()
})

export async function userRoutes(fastify: FastifyInstance) {
  // List all users in organization
  fastify.get('/', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, search, role } = request.query as {
      page?: string
      limit?: string
      search?: string
      role?: string
    }

    const result = await userRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      role
    })

    return result
  })

  // Get single user
  fastify.get('/:id', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const user = await userRepository.findById(id)
    if (!user || user.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return { data: user }
  })

  // Create user
  fastify.post('/', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createUserSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Check if email is already in use
    const existing = await userRepository.findByEmail(body.email)
    if (existing) {
      return reply.status(400).send({ error: 'Email already in use' })
    }

    const user = await userRepository.create({
      organizationId,
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role
    })

    await logAudit(ctx.userId, 'create', 'user', user.id, organizationId, { email: body.email, name: body.name, role: body.role })

    return reply.status(201).send({ data: user })
  })

  // Update user
  fastify.put('/:id', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateUserSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Check if user exists and belongs to this organization
    const existing = await userRepository.findById(id)
    if (!existing || existing.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Check if new email is already in use by another user
    if (body.email && body.email !== existing.email) {
      const emailTaken = await userRepository.findByEmail(body.email)
      if (emailTaken) {
        return reply.status(400).send({ error: 'Email already in use' })
      }
    }

    const user = await userRepository.update(id, {
      email: body.email,
      name: body.name,
      role: body.role,
      password: body.password
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    await logAudit(ctx.userId, 'update', 'user', id, organizationId, { email: body.email, name: body.name, role: body.role })

    return { data: user }
  })

  // Delete user
  fastify.delete('/:id', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Prevent deleting yourself
    if (id === ctx.userId) {
      return reply.status(400).send({ error: 'Cannot delete your own account' })
    }

    // Check if user exists and belongs to this organization
    const existing = await userRepository.findById(id)
    if (!existing || existing.organizationId !== organizationId) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const deleted = await userRepository.delete(id)
    if (!deleted) {
      return reply.status(404).send({ error: 'User not found' })
    }

    await logAudit(ctx.userId, 'delete', 'user', id, organizationId)

    return reply.status(204).send()
  })
}
