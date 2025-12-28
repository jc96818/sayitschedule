import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { getClientIp, rateLimit } from '../middleware/rateLimit.js'
import { userRepository } from '../repositories/users.js'
import { organizationRepository } from '../repositories/organizations.js'
import { logAudit } from '../repositories/audit.js'
import { mfaService } from '../services/mfa.js'
import {
  getAuthLoginMaxPerIp,
  getAuthLoginMaxPerIpEmail,
  getAuthRateLimitWindowMs,
  getAuthVerifyMfaMaxPerIp
} from '../config/security.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const verifyMfaSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(10) // 6 digits for TOTP, up to 10 for backup codes (XXXX-XXXX)
})

export async function authRoutes(fastify: FastifyInstance) {
  const windowMs = getAuthRateLimitWindowMs()
  const loginLimiterPerIp = rateLimit({
    windowMs,
    max: getAuthLoginMaxPerIp(),
    key: (request) => getClientIp(request)
  })
  const loginLimiterPerIpEmail = rateLimit({
    windowMs,
    max: getAuthLoginMaxPerIpEmail(),
    key: (request) => {
      const body = request.body as { email?: string } | undefined
      const email = body?.email?.toLowerCase() || ''
      return `${getClientIp(request)}:${email}`
    }
  })
  const verifyMfaLimiterPerIp = rateLimit({
    windowMs,
    max: getAuthVerifyMfaMaxPerIp(),
    key: (request) => getClientIp(request)
  })

  // Login
  fastify.post('/login', { preHandler: [loginLimiterPerIp, loginLimiterPerIpEmail] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // Check if MFA is enabled for this user
    const mfaData = await userRepository.getMfaData(user.id)
    if (mfaData?.mfaEnabled) {
      // Generate a temporary MFA token (5 minute expiry)
      const mfaToken = fastify.jwt.sign(
        {
          userId: user.id,
          purpose: 'mfa-verification',
          organizationId: request.ctx.organizationId // Include subdomain context
        },
        { expiresIn: '5m' }
      )

      return {
        requiresMfa: true,
        mfaToken
      }
    }

    // No MFA - proceed with normal login
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
        lastLogin: user.lastLogin,
        mfaEnabled: false
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

  // Verify MFA code to complete login
  fastify.post('/verify-mfa', { preHandler: verifyMfaLimiterPerIp }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = verifyMfaSchema.parse(request.body)

    // Verify and decode the MFA token
    let decoded: { userId: string; purpose: string; organizationId?: string }
    try {
      decoded = fastify.jwt.verify(body.mfaToken) as { userId: string; purpose: string; organizationId?: string }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired MFA token. Please login again.' })
    }

    if (decoded.purpose !== 'mfa-verification') {
      return reply.status(401).send({ error: 'Invalid token type' })
    }

    // Get user and MFA data
    const user = await userRepository.findById(decoded.userId)
    if (!user) {
      return reply.status(401).send({ error: 'User not found' })
    }

    const mfaData = await userRepository.getMfaData(user.id)
    if (!mfaData?.mfaEnabled || !mfaData.mfaSecret) {
      return reply.status(400).send({ error: 'MFA is not enabled for this account' })
    }

    // Try TOTP verification first
    const secret = mfaService.decryptSecret(mfaData.mfaSecret)
    let isValid = mfaService.verifyToken(secret, body.code)

    // If TOTP fails, try backup code
    const looksLikeBackupCode = /^[a-zA-Z0-9]{4}-?[a-zA-Z0-9]{4}$/.test(body.code)
    if (!isValid && looksLikeBackupCode) {
      const result = await mfaService.verifyBackupCode(mfaData.mfaBackupCodes, body.code)
      if (result.valid) {
        isValid = true
        // Update remaining backup codes
        await userRepository.updateBackupCodes(user.id, result.remainingCodes)
      }
    }

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid verification code' })
    }

    // MFA verified - complete login
    await userRepository.updateLastLogin(user.id)

    // Get organization using the context from MFA token (for super_admin on subdomain)
    let organization = null
    const orgId = user.organizationId || (user.role === 'super_admin' ? decoded.organizationId : null)
    if (orgId) {
      organization = await organizationRepository.findById(orgId)
    }

    // Generate final JWT token
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
        lastLogin: user.lastLogin,
        mfaEnabled: true
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
