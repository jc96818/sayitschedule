import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { User, UserRole, Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import { getBcryptCost } from '../config/security.js'

export type { UserRole }

export interface UserCreate {
  organizationId?: string | null
  email: string
  password: string
  name: string
  role: UserRole
}

export interface UserUpdate {
  email?: string
  password?: string
  name?: string
  role?: UserRole
}

export interface MfaUpdate {
  mfaEnabled?: boolean
  mfaSecret?: string | null
  mfaBackupCodes?: string[]
}

export type { User }
export type UserWithoutPassword = Omit<User, 'passwordHash' | 'mfaSecret' | 'mfaBackupCodes'>
export type UserWithMfaStatus = UserWithoutPassword & { mfaEnabled: boolean }

export class UserRepository {
  private sanitizeUser(user: User): UserWithoutPassword {
    const { passwordHash, mfaSecret, mfaBackupCodes, ...rest } = user
    return rest
  }

  async findAll(
    organizationId: string | null,
    params: PaginationParams & { search?: string; role?: string }
  ): Promise<PaginatedResult<UserWithoutPassword>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.UserWhereInput = {}

    if (organizationId) {
      where.organizationId = organizationId
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    if (params.role) {
      where.role = params.role as UserRole
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.user.count({ where })
    ])

    return paginate(data.map(u => this.sanitizeUser(u)), total, params)
  }

  async findById(id: string): Promise<UserWithoutPassword | null> {
    const user = await prisma.user.findUnique({
      where: { id }
    })
    return user ? this.sanitizeUser(user) : null
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
  }

  async create(data: UserCreate): Promise<UserWithoutPassword> {
    const passwordHash = await bcrypt.hash(data.password, getBcryptCost())

    const user = await prisma.user.create({
      data: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: data.role
      }
    })

    return this.sanitizeUser(user)
  }

  async update(id: string, data: UserUpdate): Promise<UserWithoutPassword | null> {
    const updateData: Parameters<typeof prisma.user.update>[0]['data'] = {}

    if (data.email) updateData.email = data.email.toLowerCase()
    if (data.name) updateData.name = data.name
    if (data.role) updateData.role = data.role
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, getBcryptCost())
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: updateData
      })
      return this.sanitizeUser(user)
    } catch {
      return null
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() }
    })
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id }
      })
      return true
    } catch {
      return false
    }
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash)
  }

  /**
   * Find all super admin users (organizationId is null, role is super_admin)
   */
  async findAllSuperAdmins(
    params: PaginationParams & { search?: string }
  ): Promise<PaginatedResult<UserWithoutPassword>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.UserWhereInput = {
      role: 'super_admin',
      organizationId: null
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.user.count({ where })
    ])

    return paginate(data.map(u => this.sanitizeUser(u)), total, params)
  }

  /**
   * Count total super admin users
   */
  async countSuperAdmins(): Promise<number> {
    return prisma.user.count({
      where: {
        role: 'super_admin',
        organizationId: null
      }
    })
  }

  /**
   * Update user password and set passwordChangedAt
   */
  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, getBcryptCost())
      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date()
        }
      })
      return true
    } catch {
      return false
    }
  }

  async getAuthState(userId: string): Promise<{
    role: UserRole
    organizationId: string | null
    passwordChangedAt: Date | null
  } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        organizationId: true,
        passwordChangedAt: true
      }
    })
    return user
  }

  /**
   * Update MFA settings for a user
   */
  async updateMfa(id: string, data: MfaUpdate): Promise<UserWithoutPassword | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          mfaEnabled: data.mfaEnabled,
          mfaSecret: data.mfaSecret,
          mfaBackupCodes: data.mfaBackupCodes
        }
      })
      return this.sanitizeUser(user)
    } catch {
      return null
    }
  }

  /**
   * Get user's MFA secret and backup codes (for verification)
   */
  async getMfaData(id: string): Promise<{
    mfaEnabled: boolean
    mfaSecret: string | null
    mfaBackupCodes: string[]
  } | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true
      }
    })
    return user
  }

  /**
   * Update only the backup codes (after one is used)
   */
  async updateBackupCodes(id: string, backupCodes: string[]): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { mfaBackupCodes: backupCodes }
      })
      return true
    } catch {
      return false
    }
  }
}

export const userRepository = new UserRepository()
