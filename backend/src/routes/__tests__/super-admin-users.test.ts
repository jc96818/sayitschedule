import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { JWTPayload } from '../../types/index.js'

// Mock the user repository
const mockUserRepository = {
  findAllSuperAdmins: vi.fn(),
  countSuperAdmins: vi.fn(),
  findById: vi.fn(),
  findByIdWithPassword: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updatePassword: vi.fn(),
  getAuthState: vi.fn()
}

// Mock the password reset token repository
const mockPasswordResetTokenRepository = {
  create: vi.fn(),
  findActiveInvitationsByUserIds: vi.fn()
}

vi.mock('../../repositories/users.js', () => ({
  userRepository: mockUserRepository
}))

vi.mock('../../repositories/passwordResetTokens.js', () => ({
  passwordResetTokenRepository: mockPasswordResetTokenRepository
}))

vi.mock('../../repositories/audit.js', () => ({
  logAudit: vi.fn()
}))

vi.mock('../../services/email.js', () => ({
  sendSuperAdminInvitation: vi.fn().mockResolvedValue(true)
}))

describe('Super Admin Users Routes', () => {
  let app: FastifyInstance
  let superAdminToken: string

  const superAdminUser: JWTPayload = {
    userId: 'super-admin-1',
    email: 'superadmin@example.com',
    role: 'super_admin',
    organizationId: null
  }

  const regularAdminUser: JWTPayload = {
    userId: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    organizationId: 'org-1'
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUserRepository.getAuthState.mockImplementation(async (userId: string) => {
      if (userId.startsWith('super-admin')) {
        return { role: 'super_admin', organizationId: null, passwordChangedAt: null }
      }
      return { role: 'admin', organizationId: 'org-1', passwordChangedAt: null }
    })

    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(jwt, { secret: 'test-secret' })

    // Add mock context middleware
    app.addHook('onRequest', async (request) => {
      // Extract user from token if present
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
    const { superAdminUserRoutes } = await import('../super-admin-users.js')
    await app.register(superAdminUserRoutes, { prefix: '/api/super-admin/users' })

    // Generate token
    superAdminToken = app.jwt.sign(superAdminUser)
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /api/super-admin/users', () => {
    it('should return list of super admin users with invitation status', async () => {
      const mockResult = {
        data: [
          {
            id: 'super-admin-1',
            email: 'admin1@example.com',
            name: 'Admin One',
            role: 'super_admin',
            createdAt: new Date(),
            lastLogin: null,
            mfaEnabled: false,
            status: 'active'
          },
          {
            id: 'super-admin-2',
            email: 'admin2@example.com',
            name: 'Admin Two',
            role: 'super_admin',
            createdAt: new Date(),
            lastLogin: null,
            mfaEnabled: false,
            status: 'pending'
          }
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      }
      mockUserRepository.findAllSuperAdmins.mockResolvedValue(mockResult)
      mockPasswordResetTokenRepository.findActiveInvitationsByUserIds.mockResolvedValue([
        { userId: 'super-admin-2', expiresAt: new Date(Date.now() + 86400000) }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/super-admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toHaveLength(2)
      expect(body.data[0]).toHaveProperty('email', 'admin1@example.com')
      expect(body.data[0].invitationExpiresAt).toBeNull()
      expect(body.data[1].invitationExpiresAt).toBeDefined()
    })

    it('should reject non-super-admin users', async () => {
      const adminToken = app.jwt.sign(regularAdminUser)

      const response = await app.inject({
        method: 'GET',
        url: '/api/super-admin/users',
        headers: { authorization: `Bearer ${adminToken}` }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/super-admin/users'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/super-admin/users', () => {
    it('should create a new super admin user and send invite', async () => {
      const newUser = {
        email: 'newadmin@example.com',
        name: 'New Admin'
      }

      mockUserRepository.findByEmail.mockResolvedValue(null)
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-1',
        name: 'Current Admin'
      })
      mockUserRepository.create.mockResolvedValue({
        id: 'new-super-admin',
        ...newUser,
        role: 'super_admin',
        organizationId: null,
        createdAt: new Date(),
        lastLogin: null,
        mfaEnabled: false,
        mfaRequired: true,
        status: 'pending'
      })
      mockPasswordResetTokenRepository.create.mockResolvedValue({
        id: 'token-1',
        token: 'test-invite-token',
        userId: 'new-super-admin',
        type: 'invitation'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: newUser
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.data.email).toBe('newadmin@example.com')
      expect(body.data.role).toBe('super_admin')
      expect(body.inviteSent).toBe(true)
      expect(body.message).toContain('invitation email sent')
    })

    it('should reject duplicate email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          email: 'existing@example.com',
          name: 'Duplicate'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('already in use')
    })

    it('should require email and name', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          email: 'newadmin@example.com'
          // missing name
        }
      })

      // Zod validation error
      expect([400, 500]).toContain(response.statusCode)
    })
  })

  describe('PUT /api/super-admin/users/:id', () => {
    it('should update a super admin user', async () => {
      const existingUser = {
        id: 'super-admin-2',
        email: 'admin2@example.com',
        name: 'Admin Two',
        role: 'super_admin',
        organizationId: null
      }

      mockUserRepository.findById.mockResolvedValue(existingUser)
      mockUserRepository.findByEmail.mockResolvedValue(null)
      mockUserRepository.update.mockResolvedValue({
        ...existingUser,
        name: 'Updated Name'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/super-admin/users/super-admin-2',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.name).toBe('Updated Name')
    })

    it('should reject update of non-super-admin user', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'regular-admin',
        role: 'admin',
        organizationId: 'org-1'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/super-admin/users/regular-admin',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { name: 'Hacked' }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/super-admin/users/:id', () => {
    it('should delete a super admin user', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-2',
        role: 'super_admin',
        organizationId: null
      })
      mockUserRepository.countSuperAdmins.mockResolvedValue(2)
      mockUserRepository.delete.mockResolvedValue(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/super-admin/users/super-admin-2',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(204)
    })

    it('should prevent deleting own account', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-1', // Same as the authenticated user
        role: 'super_admin',
        organizationId: null
      })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/super-admin/users/super-admin-1',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Cannot delete your own account')
    })

    it('should prevent deleting the last super admin', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-2',
        role: 'super_admin',
        organizationId: null
      })
      mockUserRepository.countSuperAdmins.mockResolvedValue(1)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/super-admin/users/super-admin-2',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('last super admin')
    })
  })

  describe('POST /api/super-admin/users/:id/resend-invite', () => {
    it('should resend invite for a pending super admin', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-2',
        email: 'pending@example.com',
        name: 'Pending Admin',
        role: 'super_admin',
        organizationId: null
      })
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'super-admin-2',
        passwordHash: null  // No password set yet
      })
      mockPasswordResetTokenRepository.create.mockResolvedValue({
        id: 'token-2',
        token: 'new-invite-token',
        userId: 'super-admin-2',
        type: 'invitation'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users/super-admin-2/resend-invite',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invitation email sent')
    })

    it('should reject resend for user who already set up password', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'super-admin-2',
        role: 'super_admin',
        organizationId: null
      })
      mockUserRepository.findByIdWithPassword.mockResolvedValue({
        id: 'super-admin-2',
        passwordHash: 'some-hashed-password'  // Password already set
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users/super-admin-2/resend-invite',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('already set up their password')
    })

    it('should reject resend for non-super-admin user', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'regular-admin',
        role: 'admin',
        organizationId: 'org-1'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/super-admin/users/regular-admin/resend-invite',
        headers: { authorization: `Bearer ${superAdminToken}` }
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
