import { eq, and, ilike, or, count } from 'drizzle-orm'
import { getDb, users } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import bcrypt from 'bcrypt'

export type UserRole = 'super_admin' | 'admin' | 'admin_assistant' | 'staff'

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

export type User = typeof users.$inferSelect
export type UserWithoutPassword = Omit<User, 'passwordHash'>

export class UserRepository {
  private get db() {
    return getDb()
  }

  private sanitizeUser(user: User): UserWithoutPassword {
    const { passwordHash, ...rest } = user
    return rest
  }

  async findAll(
    organizationId: string | null,
    params: PaginationParams & { search?: string; role?: string }
  ): Promise<PaginatedResult<UserWithoutPassword>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = []

    // Super admins have null organizationId, org users have their org ID
    if (organizationId) {
      conditions.push(eq(users.organizationId, organizationId))
    }

    if (params.search) {
      conditions.push(
        or(
          ilike(users.name, `%${params.search}%`),
          ilike(users.email, `%${params.search}%`)
        )
      )
    }

    if (params.role) {
      conditions.push(eq(users.role, params.role as UserRole))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(users.name),
      this.db
        .select({ count: count() })
        .from(users)
        .where(whereClause)
    ])

    return paginate(data.map(u => this.sanitizeUser(u)), totalResult[0]?.count || 0, params)
  }

  async findById(id: string): Promise<UserWithoutPassword | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return result[0] ? this.sanitizeUser(result[0]) : null
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return result[0] || null
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    return result[0] || null
  }

  async create(data: UserCreate): Promise<UserWithoutPassword> {
    const passwordHash = await bcrypt.hash(data.password, 10)

    const result = await this.db
      .insert(users)
      .values({
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: data.role
      })
      .returning()

    return this.sanitizeUser(result[0])
  }

  async update(id: string, data: UserUpdate): Promise<UserWithoutPassword | null> {
    const updateData: Partial<typeof users.$inferInsert> = {}

    if (data.email) updateData.email = data.email.toLowerCase()
    if (data.name) updateData.name = data.name
    if (data.role) updateData.role = data.role
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10)
    }

    const result = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning()

    return result[0] ? this.sanitizeUser(result[0]) : null
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id })

    return result.length > 0
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash)
  }
}

export const userRepository = new UserRepository()
