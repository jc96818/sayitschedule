import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

// Mock the user repository
const mockUserRepository = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  verifyPassword: vi.fn(),
  getMfaData: vi.fn(),
  updateLastLogin: vi.fn(),
  updateBackupCodes: vi.fn()
}

// Mock the organization repository
const mockOrganizationRepository = {
  findById: vi.fn()
}

// Mock the MFA service
const mockMfaService = {
  decryptSecret: vi.fn(),
  verifyToken: vi.fn(),
  verifyBackupCode: vi.fn()
}

vi.mock('../../repositories/users.js', () => ({
  userRepository: mockUserRepository
}))

vi.mock('../../repositories/organizations.js', () => ({
  organizationRepository: mockOrganizationRepository
}))

vi.mock('../../services/mfa.js', () => ({
  mfaService: mockMfaService
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

describe('Auth Routes - MFA Flow', () => {
  let app: FastifyInstance

  const testUserWithMfa = {
    id: 'user-1',
    email: 'mfa-user@example.com',
    name: 'MFA User',
    role: 'admin',
    organizationId: 'org-1',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    lastLogin: null
  }

  const testUserWithoutMfa = {
    id: 'user-2',
    email: 'regular-user@example.com',
    name: 'Regular User',
    role: 'admin',
    organizationId: 'org-1',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    lastLogin: null
  }

  const testOrganization = {
    id: 'org-1',
    name: 'Test Org',
    subdomain: 'test',
    logoUrl: null,
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    status: 'active'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(jwt, { secret: 'test-secret' })

    // Add mock context middleware
    app.addHook('onRequest', async (request) => {
      request.ctx = {
        user: null,
        organizationId: null
      }
    })

    // Import and register routes
    const { authRoutes } = await import('../auth.js')
    await app.register(authRoutes, { prefix: '/api/auth' })
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/auth/login - MFA enabled user', () => {
    it('should return requiresMfa true when user has MFA enabled', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'mfa-user@example.com',
          password: 'correct-password'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.requiresMfa).toBe(true)
      expect(body.mfaToken).toBeDefined()
      expect(body.token).toBeUndefined()
      expect(body.user).toBeUndefined()
    })

    it('should not update lastLogin until MFA is verified', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret'
      })

      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'mfa-user@example.com',
          password: 'correct-password'
        }
      })

      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/auth/login - MFA disabled user', () => {
    it('should return token directly when user has MFA disabled', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithoutMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: null
      })
      mockOrganizationRepository.findById.mockResolvedValue(testOrganization)
      mockUserRepository.updateLastLogin.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'regular-user@example.com',
          password: 'correct-password'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.requiresMfa).toBeUndefined()
      expect(body.mfaToken).toBeUndefined()
      expect(body.token).toBeDefined()
      expect(body.user).toBeDefined()
      expect(body.user.mfaEnabled).toBe(false)
    })
  })

  describe('POST /api/auth/verify-mfa', () => {
    it('should complete login with valid TOTP code', async () => {
      // First, simulate the login step
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
        mfaBackupCodes: []
      })

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'mfa-user@example.com',
          password: 'correct-password'
        }
      })

      const { mfaToken } = JSON.parse(loginResponse.body)

      // Now verify MFA
      mockUserRepository.findById.mockResolvedValue(testUserWithMfa)
      mockMfaService.decryptSecret.mockReturnValue('decrypted-secret')
      mockMfaService.verifyToken.mockReturnValue(true)
      mockOrganizationRepository.findById.mockResolvedValue(testOrganization)
      mockUserRepository.updateLastLogin.mockResolvedValue(true)

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken,
          code: '123456'
        }
      })

      expect(verifyResponse.statusCode).toBe(200)
      const body = JSON.parse(verifyResponse.body)
      expect(body.token).toBeDefined()
      expect(body.user).toBeDefined()
      expect(body.user.mfaEnabled).toBe(true)
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalled()
    })

    it('should complete login with valid backup code', async () => {
      // First, get MFA token
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
        mfaBackupCodes: ['hashed-backup-1', 'hashed-backup-2']
      })

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'mfa-user@example.com',
          password: 'correct-password'
        }
      })

      const { mfaToken } = JSON.parse(loginResponse.body)

      // Verify with backup code
      mockUserRepository.findById.mockResolvedValue(testUserWithMfa)
      mockMfaService.decryptSecret.mockReturnValue('decrypted-secret')
      mockMfaService.verifyToken.mockReturnValue(false) // TOTP fails
      mockMfaService.verifyBackupCode.mockResolvedValue({
        valid: true,
        remainingCodes: ['hashed-backup-2']
      })
      mockUserRepository.updateBackupCodes.mockResolvedValue(true)
      mockOrganizationRepository.findById.mockResolvedValue(testOrganization)
      mockUserRepository.updateLastLogin.mockResolvedValue(true)

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken,
          code: 'ABCD-1234'
        }
      })

      expect(verifyResponse.statusCode).toBe(200)
      expect(mockUserRepository.updateBackupCodes).toHaveBeenCalledWith(
        'user-1',
        ['hashed-backup-2']
      )
    })

    it('should reject invalid TOTP code', async () => {
      // Get MFA token
      mockUserRepository.findByEmail.mockResolvedValue(testUserWithMfa)
      mockUserRepository.verifyPassword.mockResolvedValue(true)
      mockUserRepository.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
        mfaBackupCodes: []
      })

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'mfa-user@example.com',
          password: 'correct-password'
        }
      })

      const { mfaToken } = JSON.parse(loginResponse.body)

      // Try to verify with invalid code
      mockUserRepository.findById.mockResolvedValue(testUserWithMfa)
      mockMfaService.decryptSecret.mockReturnValue('decrypted-secret')
      mockMfaService.verifyToken.mockReturnValue(false)

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken,
          code: '000000'
        }
      })

      expect(verifyResponse.statusCode).toBe(401)
      const body = JSON.parse(verifyResponse.body)
      expect(body.error).toContain('Invalid verification code')
    })

    it('should reject expired MFA token', async () => {
      // Use an invalid/expired token string
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJwdXJwb3NlIjoibWZhLXZlcmlmaWNhdGlvbiIsImlhdCI6MTAwMDAwMDAwMCwiZXhwIjoxMDAwMDAwMDAxfQ.invalid_signature'

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken: expiredToken,
          code: '123456'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('expired') // or 'Invalid'
    })

    it('should reject token with wrong purpose', async () => {
      // Create a token with wrong purpose
      const wrongToken = app.jwt.sign(
        { userId: 'user-1', purpose: 'wrong-purpose' },
        { expiresIn: '5m' }
      )

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken: wrongToken,
          code: '123456'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid token type')
    })

    it('should reject if user not found', async () => {
      const mfaToken = app.jwt.sign(
        { userId: 'nonexistent-user', purpose: 'mfa-verification' },
        { expiresIn: '5m' }
      )

      mockUserRepository.findById.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-mfa',
        payload: {
          mfaToken,
          code: '123456'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('User not found')
    })
  })
})
