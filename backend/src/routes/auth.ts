import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { getClientIp, rateLimit } from '../middleware/rateLimit.js'
import { userRepository } from '../repositories/users.js'
import { organizationRepository } from '../repositories/organizations.js'
import { passwordResetTokenRepository } from '../repositories/passwordResetTokens.js'
import { logAudit } from '../repositories/audit.js'
import { mfaService } from '../services/mfa.js'
import { sendPasswordResetEmail } from '../services/email.js'
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

const verifyTokenSchema = z.object({
  token: z.string().min(1)
})

const setupPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
})

const requestPasswordResetSchema = z.object({
  email: z.string().email()
})

// Schemas for first-time MFA setup flow (HIPAA requirement)
const firstTimeMfaSetupSchema = z.object({
  mfaSetupToken: z.string().min(1)
})

const firstTimeMfaVerifySchema = z.object({
  mfaSetupToken: z.string().min(1),
  code: z.string().min(6).max(8)
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
            status: organization.status,
            requiresHipaa: organization.requiresHipaa
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
            status: organization.status,
            requiresHipaa: organization.requiresHipaa
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
            status: organization.status,
            requiresHipaa: organization.requiresHipaa
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

  // Request password reset - rate limited to prevent abuse
  const passwordResetLimiter = rateLimit({
    windowMs,
    max: 5, // 5 requests per minute per IP
    key: (request) => getClientIp(request)
  })

  fastify.post('/request-password-reset', { preHandler: passwordResetLimiter }, async (request: FastifyRequest) => {
    const body = requestPasswordResetSchema.parse(request.body)

    // Always return success to prevent email enumeration attacks
    // But only actually send email if user exists and has a password set
    const user = await userRepository.findByEmail(body.email)

    if (user) {
      // Check if user has a password (is active, not pending invitation)
      const userWithPassword = await userRepository.findByIdWithPassword(user.id)

      if (userWithPassword?.passwordHash) {
        try {
          // Create password reset token (1 hour expiry)
          const tokenRecord = await passwordResetTokenRepository.create(user.id, 'password_reset')

          // Get organization for email branding
          let organization = null
          if (user.organizationId) {
            organization = await organizationRepository.findById(user.organizationId)
          }

          // Send password reset email
          await sendPasswordResetEmail({
            user: { email: user.email, name: user.name },
            organization: organization ? {
              name: organization.name,
              subdomain: organization.subdomain,
              primaryColor: organization.primaryColor
            } : null,
            token: tokenRecord.token
          })

          // Log the request
          await logAudit(user.id, 'request_password_reset', 'user', user.id, user.organizationId)
        } catch (error) {
          // Log error but don't expose to user
          console.error('Failed to send password reset email:', error)
        }
      }
    }

    // Always return success message (security best practice)
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }
  })

  // Verify invitation/password reset token (for checking if token is valid before showing form)
  fastify.post('/verify-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = verifyTokenSchema.parse(request.body)

    const tokenRecord = await passwordResetTokenRepository.findValidTokenWithUser(body.token)
    if (!tokenRecord) {
      return reply.status(400).send({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      })
    }

    return {
      valid: true,
      type: tokenRecord.type,
      user: {
        email: tokenRecord.user.email,
        name: tokenRecord.user.name
      },
      organization: tokenRecord.user.organization ? {
        name: tokenRecord.user.organization.name,
        subdomain: tokenRecord.user.organization.subdomain
      } : null
    }
  })

  // Set up password (for invitation or password reset)
  fastify.post('/setup-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = setupPasswordSchema.parse(request.body)

    // Find and validate token
    const tokenRecord = await passwordResetTokenRepository.findValidTokenWithUser(body.token)
    if (!tokenRecord) {
      return reply.status(400).send({
        error: 'Invalid or expired token. Please request a new invitation.',
        code: 'INVALID_TOKEN'
      })
    }

    // Update user's password
    const success = await userRepository.updatePassword(tokenRecord.userId, body.password)
    if (!success) {
      return reply.status(500).send({ error: 'Failed to set password' })
    }

    // Mark token as used
    await passwordResetTokenRepository.markAsUsed(tokenRecord.id)

    // Log the action
    await logAudit(
      tokenRecord.userId,
      tokenRecord.type === 'invitation' ? 'accept_invite' : 'reset_password',
      'user',
      tokenRecord.userId,
      tokenRecord.user.organizationId
    )

    // Auto-login: generate JWT token
    const user = await userRepository.findById(tokenRecord.userId)
    if (!user) {
      return reply.status(500).send({ error: 'User not found' })
    }

    // Get organization for response
    let organization = null
    if (user.organizationId) {
      organization = await organizationRepository.findById(user.organizationId)
    }

    // Check if MFA setup is required (HIPAA compliance)
    // For new invitations, if mfaRequired is set but MFA not yet enabled, require setup
    const requiresMfaSetup = tokenRecord.type === 'invitation' &&
      tokenRecord.user.mfaRequired &&
      !tokenRecord.user.mfaEnabled

    if (requiresMfaSetup) {
      // Generate a temporary token for MFA setup (30 minute expiry)
      const mfaSetupToken = fastify.jwt.sign(
        {
          userId: user.id,
          purpose: 'mfa-setup',
          organizationId: user.organizationId
        },
        { expiresIn: '30m' }
      )

      return {
        success: true,
        requiresMfaSetup: true,
        message: 'Password set successfully. MFA setup is required for your organization.',
        mfaSetupToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId
        },
        organization: organization
          ? {
              id: organization.id,
              name: organization.name,
              subdomain: organization.subdomain,
              logoUrl: organization.logoUrl,
              primaryColor: organization.primaryColor,
              secondaryColor: organization.secondaryColor,
              status: organization.status,
              requiresHipaa: organization.requiresHipaa
            }
          : null
      }
    }

    // No MFA required - proceed with normal auto-login
    // Generate JWT token
    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    })

    // Update last login
    await userRepository.updateLastLogin(user.id)

    return {
      success: true,
      message: tokenRecord.type === 'invitation'
        ? 'Account setup complete! You are now logged in.'
        : 'Password reset successful! You are now logged in.',
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
            status: organization.status,
            requiresHipaa: organization.requiresHipaa
          }
        : null
    }
  })

  // First-time MFA setup - Step 1: Generate QR code
  // Used during HIPAA-required MFA setup flow after password setup
  fastify.post('/mfa/first-time-setup', { preHandler: verifyMfaLimiterPerIp }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = firstTimeMfaSetupSchema.parse(request.body)

    // Verify the MFA setup token
    let decoded: { userId: string; purpose: string; organizationId?: string | null }
    try {
      decoded = fastify.jwt.verify(body.mfaSetupToken) as typeof decoded
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired setup token. Please start registration again.' })
    }

    if (decoded.purpose !== 'mfa-setup') {
      return reply.status(401).send({ error: 'Invalid token type' })
    }

    // Get user
    const user = await userRepository.findByIdWithPassword(decoded.userId)
    if (!user) {
      return reply.status(401).send({ error: 'User not found' })
    }

    // Check if user hasn't already set up MFA
    const mfaData = await userRepository.getMfaData(user.id)
    if (mfaData?.mfaEnabled) {
      return reply.status(400).send({ error: 'MFA is already enabled' })
    }

    // Generate new secret
    const { secret, qrCode, otpauthUrl } = await mfaService.generateSecret(user.email)

    // Encrypt and store the secret temporarily (not yet enabled)
    const encryptedSecret = mfaService.encryptSecret(secret)
    await userRepository.updateMfa(user.id, {
      mfaSecret: encryptedSecret,
      mfaEnabled: false
    })

    return {
      qrCode,
      secret, // Base32 secret for manual entry
      otpauthUrl
    }
  })

  // First-time MFA setup - Step 2: Verify code and complete setup
  // Returns full auth token after MFA is enabled
  fastify.post('/mfa/first-time-verify', { preHandler: verifyMfaLimiterPerIp }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = firstTimeMfaVerifySchema.parse(request.body)

    // Verify the MFA setup token
    let decoded: { userId: string; purpose: string; organizationId?: string | null }
    try {
      decoded = fastify.jwt.verify(body.mfaSetupToken) as typeof decoded
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired setup token. Please start registration again.' })
    }

    if (decoded.purpose !== 'mfa-setup') {
      return reply.status(401).send({ error: 'Invalid token type' })
    }

    // Get the stored secret
    const mfaData = await userRepository.getMfaData(decoded.userId)
    if (!mfaData?.mfaSecret) {
      return reply.status(400).send({ error: 'MFA setup not started. Call /mfa/first-time-setup first.' })
    }

    if (mfaData.mfaEnabled) {
      return reply.status(400).send({ error: 'MFA is already enabled.' })
    }

    // Decrypt and verify the code
    const secret = mfaService.decryptSecret(mfaData.mfaSecret)
    const isValid = mfaService.verifyToken(secret, body.code)

    if (!isValid) {
      return reply.status(400).send({ error: 'Invalid verification code. Please try again.' })
    }

    // Generate backup codes
    const backupCodes = mfaService.generateBackupCodes()
    const hashedBackupCodes = await mfaService.hashBackupCodes(backupCodes)

    // Enable MFA and store hashed backup codes
    await userRepository.updateMfa(decoded.userId, {
      mfaEnabled: true,
      mfaBackupCodes: hashedBackupCodes
    })

    // Get user for token generation
    const user = await userRepository.findById(decoded.userId)
    if (!user) {
      return reply.status(500).send({ error: 'User not found' })
    }

    // Get organization for response
    let organization = null
    if (user.organizationId) {
      organization = await organizationRepository.findById(user.organizationId)
    }

    // Generate full JWT token - user has completed MFA setup
    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    })

    // Update last login
    await userRepository.updateLastLogin(user.id)

    // Log the events
    await logAudit(user.id, 'enable_mfa', 'user', user.id, user.organizationId)
    await logAudit(user.id, 'login', 'user', user.id, user.organizationId)

    return {
      success: true,
      backupCodes, // Return plaintext backup codes (one-time view)
      message: 'MFA setup complete! You are now logged in.',
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
            status: organization.status,
            requiresHipaa: organization.requiresHipaa
          }
        : null
    }
  })
}
