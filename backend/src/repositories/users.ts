import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { User, UserRole, Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'

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

export type { User }
export type UserWithoutPassword = Omit<User, 'passwordHash'>

export class UserRepository {
  private sanitizeUser(user: User): UserWithoutPassword {
    const { passwordHash, ...rest } = user
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
    const passwordHash = await bcrypt.hash(data.password, 10)

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
      updateData.passwordHash = await bcrypt.hash(data.password, 10)
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
}

export const userRepository = new UserRepository()
