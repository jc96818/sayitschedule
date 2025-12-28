import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { getClientIp, rateLimit } from '../middleware/rateLimit.js'
import { userRepository } from '../repositories/users.js'
import { mfaService } from '../services/mfa.js'
import { logAudit } from '../repositories/audit.js'
import { getAuthRateLimitWindowMs } from '../config/security.js'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
})

const verifyMfaSchema = z.object({
  code: z.string().min(6).max(8)
})

const setupMfaSchema = z.object({
  password: z.string().min(1)
})

const disableMfaSchema = z.object({
  password: z.string().min(1)
})

const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1)
})

export async function accountRoutes(fastify: FastifyInstance) {
  const windowMs = getAuthRateLimitWindowMs()
  const mfaSetupLimiter = rateLimit({
    windowMs,
    max: 5,
    key: (request) => request.ctx.user?.userId || getClientIp(request)
  })
  const mfaVerifyLimiter = rateLimit({
    windowMs,
    max: 10,
    key: (request) => request.ctx.user?.userId || getClientIp(request)
  })

  // Change password (requires current password)
  fastify.post('/change-password', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = changePasswordSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Get user with password hash for verification
    const user = await userRepository.findByIdWithPassword(ctx.userId)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Verify current password
    const isValid = await userRepository.verifyPassword(user, body.currentPassword)
    if (!isValid) {
      return reply.status(400).send({ error: 'Current password is incorrect' })
    }

    // Check new password is different
    const isSame = await userRepository.verifyPassword(user, body.newPassword)
    if (isSame) {
      return reply.status(400).send({ error: 'New password must be different from current password' })
    }

    // Update password
    const success = await userRepository.updatePassword(ctx.userId, body.newPassword)
    if (!success) {
      return reply.status(500).send({ error: 'Failed to update password' })
    }

    await logAudit(ctx.userId, 'change_password', 'user', ctx.userId, ctx.organizationId)

    return { success: true }
  })

  // Get MFA status
  fastify.get('/mfa/status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const mfaData = await userRepository.getMfaData(ctx.userId)
    if (!mfaData) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return {
      enabled: mfaData.mfaEnabled,
      backupCodesRemaining: mfaData.mfaBackupCodes.length
    }
  })

  // Setup MFA - generate secret and QR code
  fastify.post('/mfa/setup', { preHandler: [authenticate, mfaSetupLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = setupMfaSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Require password re-entry before starting MFA setup (recent auth)
    const user = await userRepository.findByIdWithPassword(ctx.userId)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const isValidPassword = await userRepository.verifyPassword(user, body.password)
    if (!isValidPassword) {
      return reply.status(400).send({ error: 'Incorrect password' })
    }

    // Check if MFA is already enabled
    const mfaData = await userRepository.getMfaData(ctx.userId)
    if (mfaData?.mfaEnabled) {
      return reply.status(400).send({ error: 'MFA is already enabled. Disable it first to set up again.' })
    }

    // Generate new secret
    const { secret, qrCode, otpauthUrl } = await mfaService.generateSecret(ctx.email)

    // Encrypt and store the secret temporarily (not yet enabled)
    const encryptedSecret = mfaService.encryptSecret(secret)
    await userRepository.updateMfa(ctx.userId, {
      mfaSecret: encryptedSecret,
      mfaEnabled: false
    })

    return {
      qrCode,
      secret, // Base32 secret for manual entry
      otpauthUrl
    }
  })

  // Verify MFA code and enable MFA
  fastify.post('/mfa/verify', { preHandler: [authenticate, mfaVerifyLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = verifyMfaSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Get the stored secret
    const mfaData = await userRepository.getMfaData(ctx.userId)
    if (!mfaData?.mfaSecret) {
      return reply.status(400).send({ error: 'MFA setup not started. Call /mfa/setup first.' })
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
    await userRepository.updateMfa(ctx.userId, {
      mfaEnabled: true,
      mfaBackupCodes: hashedBackupCodes
    })

    await logAudit(ctx.userId, 'enable_mfa', 'user', ctx.userId, ctx.organizationId)

    return {
      success: true,
      backupCodes // Return plaintext backup codes (one-time view)
    }
  })

  // Disable MFA (requires password)
  fastify.post('/mfa/disable', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = disableMfaSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Get user with password hash
    const user = await userRepository.findByIdWithPassword(ctx.userId)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Verify password
    const isValid = await userRepository.verifyPassword(user, body.password)
    if (!isValid) {
      return reply.status(400).send({ error: 'Incorrect password' })
    }

    // Check if MFA is enabled
    const mfaData = await userRepository.getMfaData(ctx.userId)
    if (!mfaData?.mfaEnabled) {
      return reply.status(400).send({ error: 'MFA is not enabled' })
    }

    // Disable MFA and clear secret/backup codes
    await userRepository.updateMfa(ctx.userId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: []
    })

    await logAudit(ctx.userId, 'disable_mfa', 'user', ctx.userId, ctx.organizationId)

    return { success: true }
  })

  // Regenerate backup codes (requires password)
  fastify.post('/mfa/backup-codes', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = regenerateBackupCodesSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Get user with password hash
    const user = await userRepository.findByIdWithPassword(ctx.userId)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Verify password
    const isValid = await userRepository.verifyPassword(user, body.password)
    if (!isValid) {
      return reply.status(400).send({ error: 'Incorrect password' })
    }

    // Check if MFA is enabled
    const mfaData = await userRepository.getMfaData(ctx.userId)
    if (!mfaData?.mfaEnabled) {
      return reply.status(400).send({ error: 'MFA is not enabled' })
    }

    // Generate new backup codes
    const backupCodes = mfaService.generateBackupCodes()
    const hashedBackupCodes = await mfaService.hashBackupCodes(backupCodes)

    // Store new hashed backup codes
    await userRepository.updateBackupCodes(ctx.userId, hashedBackupCodes)

    await logAudit(ctx.userId, 'regenerate_backup_codes', 'user', ctx.userId, ctx.organizationId)

    return {
      backupCodes // Return plaintext backup codes (one-time view)
    }
  })
}
