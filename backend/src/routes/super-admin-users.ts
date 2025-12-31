import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin } from '../middleware/auth.js'
import { userRepository } from '../repositories/users.js'
import { passwordResetTokenRepository } from '../repositories/passwordResetTokens.js'
import { logAudit } from '../repositories/audit.js'
import { sendSuperAdminInvitation } from '../services/email.js'

const createSuperAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
})

const updateSuperAdminSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional()
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

    // For pending users, fetch invitation expiry information
    const pendingUserIds = result.data
      .filter(u => u.status === 'pending')
      .map(u => u.id)

    const invitationTokens = await passwordResetTokenRepository.findActiveInvitationsByUserIds(pendingUserIds)

    // Create a map of userId -> expiresAt
    const expiryMap = new Map(invitationTokens.map(t => [t.userId, t.expiresAt]))

    // Merge invitation expiry into response
    const dataWithExpiry = result.data.map(user => ({
      ...user,
      invitationExpiresAt: user.status === 'pending' ? expiryMap.get(user.id) || null : null
    }))

    return {
      ...result,
      data: dataWithExpiry
    }
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

  // Create new super admin user (sends invitation email)
  fastify.post('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createSuperAdminSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if email is already in use
    const existing = await userRepository.findByEmail(body.email)
    if (existing) {
      return reply.status(400).send({ error: 'Email already in use' })
    }

    // Create user without password (will be set via invite link)
    // Super admins always require MFA
    const user = await userRepository.create({
      organizationId: null, // Super admins have no organization
      email: body.email,
      name: body.name,
      role: 'super_admin',
      mfaRequired: true  // Super admins must set up MFA
    })

    await logAudit(ctx.userId, 'create', 'super_admin_user', user.id, null, {
      email: body.email,
      name: body.name
    })

    // Send invitation email
    let inviteSent = false
    try {
      // Create invitation token
      const tokenRecord = await passwordResetTokenRepository.create(user.id, 'invitation')

      // Get inviter's name
      const inviter = await userRepository.findById(ctx.userId)
      const inviterName = inviter?.name || 'A super administrator'

      // Send invitation email
      await sendSuperAdminInvitation({
        user: { email: body.email, name: body.name },
        token: tokenRecord.token,
        invitedByName: inviterName
      })

      inviteSent = true
    } catch (error) {
      console.error('Failed to send super admin invitation email:', error)
      // Don't fail the request - user was created, just email failed
    }

    return reply.status(201).send({
      data: user,
      inviteSent,
      message: inviteSent
        ? 'Super admin created and invitation email sent'
        : 'Super admin created (invitation email failed to send)'
    })
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

  // Resend invitation email for a pending super admin
  fastify.post('/:id/resend-invite', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    // Check if user exists and is a super admin
    const existing = await userRepository.findById(id)
    if (!existing || existing.role !== 'super_admin' || existing.organizationId !== null) {
      return reply.status(404).send({ error: 'Super admin user not found' })
    }

    // Check if user already has a password (already set up)
    const userWithPassword = await userRepository.findByIdWithPassword(id)
    if (userWithPassword?.passwordHash) {
      return reply.status(400).send({ error: 'User has already set up their password' })
    }

    try {
      // Create new invitation token (invalidates old ones)
      const tokenRecord = await passwordResetTokenRepository.create(id, 'invitation')

      // Get inviter's name
      const inviter = await userRepository.findById(ctx.userId)
      const inviterName = inviter?.name || 'A super administrator'

      // Send invitation email
      await sendSuperAdminInvitation({
        user: { email: existing.email, name: existing.name },
        token: tokenRecord.token,
        invitedByName: inviterName
      })

      await logAudit(ctx.userId, 'resend_invite', 'super_admin_user', id, null)

      return { message: 'Invitation email sent' }
    } catch (error) {
      console.error('Failed to send super admin invitation email:', error)
      return reply.status(500).send({ error: 'Failed to send invitation email' })
    }
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
