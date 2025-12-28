import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin } from '../middleware/auth.js'
import { userRepository } from '../repositories/users.js'
import { logAudit } from '../repositories/audit.js'

const createSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
})

const updateSuperAdminSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional()
})

const resetPasswordSchema = z.object({
  password: z.string().min(8)
})

export async function superAdminUserRoutes(fastify: FastifyInstance) {
  // List all super admin users
  fastify.get('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest) => {
    const { page, limit, search } = request.query as {
      page?: string
      limit?: string
      search?: string
    }

    const result = await userRepository.findAllSuperAdmins({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search
    })

    return result
  })

  // Get single super admin user
  fastify.get('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const user = await userRepository.findById(id)
    if (!user || user.role !== 'super_admin' || user.organizationId !== null) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    return { data: user }
  })

  // Create new super admin user
  fastify.post('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createSuperAdminSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if email is already in use
    const existing = await userRepository.findByEmail(body.email)
    if (existing) {
      return reply.status(400).send({ error: 'Email already in use' })
    }

    const user = await userRepository.create({
      organizationId: null, // Super admins have no organization
      email: body.email,
      password: body.password,
      name: body.name,
      role: 'super_admin'
    })

    await logAudit(ctx.userId, 'create', 'super_admin_user', user.id, null, {
      email: body.email,
      name: body.name
    })

    return reply.status(201).send({ data: user })
  })

  // Update super admin user
  fastify.put('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateSuperAdminSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if user exists and is a super admin
    const existing = await userRepository.findById(id)
    if (!existing || existing.role !== 'super_admin' || existing.organizationId !== null) {
      return reply.status(404).send({ error: 'Super admin user not found' })
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
      name: body.name
    })

    if (!user) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    await logAudit(ctx.userId, 'update', 'super_admin_user', id, null, {
      email: body.email,
      name: body.name
    })

    return { data: user }
  })

  // Reset another super admin's password
  fastify.post('/:id/reset-password', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = resetPasswordSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if user exists and is a super admin
    const existing = await userRepository.findById(id)
    if (!existing || existing.role !== 'super_admin' || existing.organizationId !== null) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    const success = await userRepository.updatePassword(id, body.password)
    if (!success) {
      return reply.status(500).send({ error: 'Failed to reset password' })
    }

    await logAudit(ctx.userId, 'reset_password', 'super_admin_user', id, null)

    return { success: true }
  })

  // Delete super admin user
  fastify.delete('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    // Prevent deleting yourself
    if (id === ctx.userId) {
      return reply.status(400).send({ error: 'Cannot delete your own account' })
    }

    // Check if user exists and is a super admin
    const existing = await userRepository.findById(id)
    if (!existing || existing.role !== 'super_admin' || existing.organizationId !== null) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    // Ensure at least one super admin remains
    const superAdminCount = await userRepository.countSuperAdmins()
    if (superAdminCount <= 1) {
      return reply.status(400).send({ error: 'Cannot delete the last super admin user' })
    }

    const deleted = await userRepository.delete(id)
    if (!deleted) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    await logAudit(ctx.userId, 'delete', 'super_admin_user', id, null)

    return reply.status(204).send()
  })
}
