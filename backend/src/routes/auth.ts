import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { userRepository } from '../repositories/users.js'
import { organizationRepository } from '../repositories/organizations.js'
import { logAudit } from '../repositories/audit.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body)

    // Look up user from database
    const user = await userRepository.findByEmail(body.email)
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    // Verify password
    const isValid = await userRepository.verifyPassword(user, body.password)
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    // Update last login
    await userRepository.updateLastLogin(user.id)

    // Get organization:
    // - For regular users: use their organizationId from the database
    // - For super_admin on an org subdomain: use the org from the subdomain context
    let organization = null
    const orgId = user.organizationId || (user.role === 'super_admin' ? request.ctx.organizationId : null)
    if (orgId) {
      organization = await organizationRepository.findById(orgId)
    }

    // Generate JWT token
    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    })

    // Log the login
    await logAudit(user.id, 'login', 'user', user.id, user.organizationId)

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            subdomain: organization.subdomain,
            logoUrl: organization.logoUrl,
            primaryColor: organization.primaryColor,
            secondaryColor: organization.secondaryColor,
            status: organization.status
          }
        : null
    }
  })

  // Get current user
  fastify.get('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    // Look up user from database
    const user = await userRepository.findById(ctx.userId)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Get organization:
    // - For regular users: use their organizationId from the database
    // - For super_admin on an org subdomain: use the org from the subdomain context
    let organization = null
    const orgId = user.organizationId || (user.role === 'super_admin' ? request.ctx.organizationId : null)

    if (orgId) {
      organization = await organizationRepository.findById(orgId)
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            subdomain: organization.subdomain,
            logoUrl: organization.logoUrl,
            primaryColor: organization.primaryColor,
            secondaryColor: organization.secondaryColor,
            status: organization.status
          }
        : null
    }
  })

  // Logout (client-side token removal, but we can track it server-side)
  fastify.post('/logout', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const ctx = request.ctx.user!

    // Log the logout
    await logAudit(ctx.userId, 'logout', 'user', ctx.userId, ctx.organizationId)

    return { success: true }
  })
}
