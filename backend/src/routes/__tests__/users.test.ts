import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

// Mock the user repository
const mockUserRepository = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByIdWithPassword: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getAuthState: vi.fn()
}

// Mock the organization repository
const mockOrganizationRepository = {
  findById: vi.fn()
}

// Mock the password reset token repository
const mockPasswordResetTokenRepository = {
  create: vi.fn(),
  findActiveInvitationsByUserIds: vi.fn()
}

// Mock the email service
const mockSendUserInvitation = vi.fn()

vi.mock('../../repositories/users.js', () => ({
  userRepository: mockUserRepository
}))

vi.mock('../../repositories/organizations.js', () => ({
  organizationRepository: mockOrganizationRepository
}))

vi.mock('../../repositories/passwordResetTokens.js', () => ({
  passwordResetTokenRepository: mockPasswordResetTokenRepository
}))

vi.mock('../../services/email.js', () => ({
  sendUserInvitation: mockSendUserInvitation
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

describe('User Routes', () => {
  let app: FastifyInstance
  let adminToken: string

  const adminUser: JWTPayload = {
    userId: 'admin-1',
    email: 'admin@test.com',
    role: 'admin',
    organizationId: 'org-1'
  }

  const testOrganization = {
    id: 'org-1',
    name: 'Test Org',
    subdomain: 'test',
    logoUrl: null,
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    status: 'active',
    requiresHipaa: false
  }

  const hipaaOrganization = {
    id: 'org-hipaa',
    name: 'HIPAA Org',
    subdomain: 'hipaa',
    logoUrl: null,
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    status: 'active',
    requiresHipaa: true
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up default mock for getAuthState - valid admin user
    mockUserRepository.getAuthState.mockResolvedValue({
      role: 'admin',
      organizationId: 'org-1',
      passwordChangedAt: null
    })

    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(jwt, { secret: 'test-secret' })

    // Add mock context middleware to initialize ctx
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
    const { userRoutes } = await import('../users.js')
    await app.register(userRoutes, { prefix: '/api/users' })

    // Generate admin token for tests
    adminToken = app.jwt.sign(adminUser)
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/users - Create User', () => {
    it('should create user without mfaRequired for non-HIPAA org', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null)
      mockOrganizationRepository.findById.mockResolvedValue(testOrganization)
      mockUserRepository.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'newuser@test.com',
        name: 'New User',
        role: 'staff',
        organizationId: 'org-1',
        status: 'pending',
        mfaRequired: false
      })
      mockPasswordResetTokenRepository.create.mockResolvedValue({
        id: 'token-1',
        token: 'invitation-token'
      })
      mockUserRepository.findById.mockResolvedValue({
        id: 'admin-1',
        name: 'Admin User'
      })
      mockSendUserInvitation.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: 'newuser@test.com',
          name: 'New User',
          role: 'staff'
        }
      })

      expect(response.statusCode).toBe(201)

      // Verify create was called with mfaRequired: false
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@test.com',
          name: 'New User',
          role: 'staff',
          organizationId: 'org-1',
          mfaRequired: false
        })
      )
    })

    it('should create user with mfaRequired=true for HIPAA org', async () => {
      // Create a token for HIPAA org admin
      const hipaaAdmin: JWTPayload = {
        userId: 'admin-1',
        email: 'admin@test.com',
        role: 'admin',
        organizationId: 'org-hipaa'
      }
      const hipaaToken = app.jwt.sign(hipaaAdmin)

      // Update mock for HIPAA org admin
      mockUserRepository.getAuthState.mockResolvedValue({
        role: 'admin',
        organizationId: 'org-hipaa',
        passwordChangedAt: null
      })

      mockUserRepository.findByEmail.mockResolvedValue(null)
      mockOrganizationRepository.findById.mockResolvedValue(hipaaOrganization)
      mockUserRepository.create.mockResolvedValue({
        id: 'new-user-2',
        email: 'hipaauser@test.com',
        name: 'HIPAA User',
        role: 'staff',
        organizationId: 'org-hipaa',
        status: 'pending',
        mfaRequired: true
      })
      mockPasswordResetTokenRepository.create.mockResolvedValue({
        id: 'token-2',
        token: 'invitation-token-2'
      })
      mockUserRepository.findById.mockResolvedValue({
        id: 'admin-1',
        name: 'Admin User'
      })
      mockSendUserInvitation.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${hipaaToken}` },
        payload: {
          email: 'hipaauser@test.com',
          name: 'HIPAA User',
          role: 'staff'
        }
      })

      expect(response.statusCode).toBe(201)

      // Verify create was called with mfaRequired: true
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'hipaauser@test.com',
          name: 'HIPAA User',
          role: 'staff',
          mfaRequired: true
        })
      )
    })

    it('should reject duplicate email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@test.com'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: 'existing@test.com',
          name: 'Existing User',
          role: 'staff'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Email already in use')
    })

    it('should send invitation email when user is created without password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null)
      mockOrganizationRepository.findById.mockResolvedValue(testOrganization)
      mockUserRepository.create.mockResolvedValue({
        id: 'new-user-3',
        email: 'invited@test.com',
        name: 'Invited User',
        role: 'staff',
        organizationId: 'org-1',
        status: 'pending'
      })
      mockPasswordResetTokenRepository.create.mockResolvedValue({
        id: 'token-3',
        token: 'invitation-token-3'
      })
      mockUserRepository.findById.mockResolvedValue({
        id: 'admin-1',
        name: 'Admin User'
      })
      mockSendUserInvitation.mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: 'invited@test.com',
          name: 'Invited User',
          role: 'staff'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.inviteSent).toBe(true)
      expect(mockSendUserInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { email: 'invited@test.com', name: 'Invited User' },
          token: 'invitation-token-3'
        })
      )
    })
  })

  describe('GET /api/users - List Users', () => {
    it('should return users with status and invitation expiry', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'active@test.com',
          name: 'Active User',
          role: 'staff',
          status: 'active'
        },
        {
          id: 'user-2',
          email: 'pending@test.com',
          name: 'Pending User',
          role: 'staff',
          status: 'pending'
        }
      ]

      mockUserRepository.findAll.mockResolvedValue({
        data: users,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      })

      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
      mockPasswordResetTokenRepository.findActiveInvitationsByUserIds.mockResolvedValue([
        {
          userId: 'user-2',
          expiresAt: futureDate
        }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${adminToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.data).toHaveLength(2)

      // Active user should have null invitationExpiresAt
      const activeUser = body.data.find((u: { id: string }) => u.id === 'user-1')
      expect(activeUser.invitationExpiresAt).toBeNull()

      // Pending user should have invitationExpiresAt set
      const pendingUser = body.data.find((u: { id: string }) => u.id === 'user-2')
      expect(pendingUser.invitationExpiresAt).toBeDefined()
    })
  })
})
