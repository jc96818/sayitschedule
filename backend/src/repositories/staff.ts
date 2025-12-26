import { eq, and, ilike, or, count } from 'drizzle-orm'
import { getDb, staff } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export type Gender = 'male' | 'female' | 'other'
export type Status = 'active' | 'inactive'

export interface StaffCreate {
  organizationId: string
  userId?: string | null
  name: string
  gender: Gender
  email?: string | null
  phone?: string | null
  certifications?: string[]
  defaultHours?: Record<string, { start: string; end: string } | null>
  hireDate?: Date | null
}

export interface StaffUpdate {
  name?: string
  gender?: Gender
  email?: string | null
  phone?: string | null
  certifications?: string[]
  defaultHours?: Record<string, { start: string; end: string } | null>
  status?: Status
  hireDate?: Date | null
}

export type Staff = typeof staff.$inferSelect

export class StaffRepository {
  private get db() {
    return getDb()
  }

  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string; gender?: string }
  ): Promise<PaginatedResult<Staff>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = [eq(staff.organizationId, organizationId)]

    if (params.search) {
      conditions.push(
        or(
          ilike(staff.name, `%${params.search}%`),
          ilike(staff.email, `%${params.search}%`)
        )!
      )
    }

    if (params.status) {
      conditions.push(eq(staff.status, params.status as Status))
    }

    if (params.gender) {
      conditions.push(eq(staff.gender, params.gender as Gender))
    }

    const whereClause = and(...conditions)

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(staff)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(staff.name),
      this.db
        .select({ count: count() })
        .from(staff)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string, organizationId?: string): Promise<Staff | null> {
    const conditions = [eq(staff.id, id)]
    if (organizationId) {
      conditions.push(eq(staff.organizationId, organizationId))
    }

    const result = await this.db
      .select()
      .from(staff)
      .where(and(...conditions))
      .limit(1)

    return result[0] || null
  }

  async findByUserId(userId: string): Promise<Staff | null> {
    const result = await this.db
      .select()
      .from(staff)
      .where(eq(staff.userId, userId))
      .limit(1)

    return result[0] || null
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Staff[]> {
    const conditions = [eq(staff.organizationId, organizationId)]
    if (status) {
      conditions.push(eq(staff.status, status))
    }

    return this.db
      .select()
      .from(staff)
      .where(and(...conditions))
      .orderBy(staff.name)
  }

  async create(data: StaffCreate): Promise<Staff> {
    const result = await this.db
      .insert(staff)
      .values({
        organizationId: data.organizationId,
        userId: data.userId,
        name: data.name,
        gender: data.gender,
        email: data.email,
        phone: data.phone,
        certifications: data.certifications || [],
        defaultHours: data.defaultHours,
        hireDate: data.hireDate
      })
      .returning()

    return result[0]
  }

  async update(id: string, organizationId: string, data: StaffUpdate): Promise<Staff | null> {
    const result = await this.db
      .update(staff)
      .set(data)
      .where(and(eq(staff.id, id), eq(staff.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    // Soft delete by setting status to inactive
    const result = await this.db
      .update(staff)
      .set({ status: 'inactive' })
      .where(and(eq(staff.id, id), eq(staff.organizationId, organizationId)))
      .returning({ id: staff.id })

    return result.length > 0
  }

  async hardDelete(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(staff)
      .where(and(eq(staff.id, id), eq(staff.organizationId, organizationId)))
      .returning({ id: staff.id })

    return result.length > 0
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(staff)
      .where(and(eq(staff.organizationId, organizationId), eq(staff.status, 'active')))

    return result[0]?.count || 0
  }
}

export const staffRepository = new StaffRepository()
