import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

// Mock the user repository
const mockUserRepository = {
  findByIdWithPassword: vi.fn(),
  verifyPassword: vi.fn(),
  updatePassword: vi.fn(),
  getMfaData: vi.fn(),
  updateMfa: vi.fn(),
  updateBackupCodes: vi.fn()
}

// Mock the MFA service
const mockMfaService = {
  generateSecret: vi.fn(),
  verifyToken: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCodes: vi.fn(),
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn()
}

vi.mock('../../repositories/users.js', () => ({
  userRepository: mockUserRepository
}))

vi.mock('../../services/mfa.js', () => ({
  mfaService: mockMfaService
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

describe('Account Routes', () => {
  let app: FastifyInstance
  let userToken: string

  const testUser: JWTPayload = {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'admin',
    organizationId: 'org-1'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(jwt, { secret: 'test-secret' })

    // Add mock context middleware
    app.addHook('onRequest', async (request) => {
      const authHeader = request.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = app.jwt.verify(authHeader.substring(7)) as JWTPayload
          request.ctx = {
            user: decoded,
            organizationId: decoded.organizationId
          }
        } catch {
          request.ctx = { user: null, organizationId: null }
        }
      } else {
        request.ctx = { user: null, organizationId: null }
      }
    })

    // Import and register routes
    const { accountRoutes } = await import('../account.js')
    await app.register(accountRoutes, { prefix: '/api/account' })

    userToken = app.jwt.sign(testUser)
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/account/change-password', () => {
    it('should change password with valid current password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValueOnce(true) // Current password valid
      mockUserRepository.verifyPassword.mockResolvedValueOnce(false) // New password is different
      mockUserRepository.updatePassword.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/change-password',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
    })

    it('should reject incorrect current password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/change-password',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword456!'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('incorrect')
    })

    it('should reject same new password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(true) // Both verifications pass

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/change-password',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentPassword: 'SamePassword123!',
          newPassword: 'SamePassword123!'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('different')
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/change-password',
        payload: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/account/mfa/status', () => {
    it('should return MFA status when enabled', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaBackupCodes: ['code1', 'code2', 'code3']
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/mfa/status',
        headers: { authorization: `Bearer ${userToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.enabled).toBe(true)
      expect(body.backupCodesRemaining).toBe(3)
    })

    it('should return MFA status when disabled', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false,
        mfaBackupCodes: []
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/mfa/status',
        headers: { authorization: `Bearer ${userToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.enabled).toBe(false)
      expect(body.backupCodesRemaining).toBe(0)
    })
  })

  describe('POST /api/account/mfa/setup', () => {
    it('should generate MFA setup data', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false
      })
      mockMfaService.generateSecret.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,abc123',
        otpauthUrl: 'otpauth://totp/...'
      })
      mockMfaService.encryptSecret.mockReturnValue('encrypted-secret')
      mockUserRepository.updateMfa.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/setup',
        headers: { authorization: `Bearer ${userToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.qrCode).toBeDefined()
      expect(body.secret).toBeDefined()
      expect(body.otpauthUrl).toBeDefined()
    })

    it('should reject if MFA already enabled', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/setup',
        headers: { authorization: `Bearer ${userToken}` }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('already enabled')
    })
  })

  describe('POST /api/account/mfa/verify', () => {
    it('should verify and enable MFA', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: 'encrypted-secret'
      })
      mockMfaService.decryptSecret.mockReturnValue('JBSWY3DPEHPK3PXP')
      mockMfaService.verifyToken.mockReturnValue(true)
      mockMfaService.generateBackupCodes.mockReturnValue([
        'ABCD-1234',
        'EFGH-5678'
      ])
      mockMfaService.hashBackupCodes.mockResolvedValue([
        'hashed1',
        'hashed2'
      ])
      mockUserRepository.updateMfa.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { code: '123456' }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.backupCodes).toHaveLength(2)
    })

    it('should reject invalid verification code', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: 'encrypted-secret'
      })
      mockMfaService.decryptSecret.mockReturnValue('JBSWY3DPEHPK3PXP')
      mockMfaService.verifyToken.mockReturnValue(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { code: '000000' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid')
    })

    it('should reject if MFA setup not started', async () => {
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: null
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { code: '123456' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('setup not started')
    })
  })

  describe('POST /api/account/mfa/disable', () => {
    it('should disable MFA with correct password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true
      })
      mockUserRepository.updateMfa.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/disable',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: 'CorrectPassword123!' }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
    })

    it('should reject incorrect password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/disable',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: 'WrongPassword' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Incorrect password')
    })

    it('should reject if MFA not enabled', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/disable',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: 'CorrectPassword123!' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('not enabled')
    })
  })

  describe('POST /api/account/mfa/backup-codes', () => {
    it('should regenerate backup codes with correct password', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true
      })
      mockMfaService.generateBackupCodes.mockReturnValue([
        'NEW1-CODE',
        'NEW2-CODE'
      ])
      mockMfaService.hashBackupCodes.mockResolvedValue([
        'hashed1',
        'hashed2'
      ])
      mockUserRepository.updateBackupCodes.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/backup-codes',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: 'CorrectPassword123!' }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.backupCodes).toHaveLength(2)
    })

    it('should reject if MFA not enabled', async () => {
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-password'
      })
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/mfa/backup-codes',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: 'CorrectPassword123!' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('not enabled')
    })
  })
})
