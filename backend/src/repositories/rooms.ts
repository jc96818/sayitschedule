import { eq, and, ilike, or, count } from 'drizzle-orm'
import { getDb, rooms } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export type Status = 'active' | 'inactive'

export interface RoomCreate {
  organizationId: string
  name: string
  capabilities?: string[]
  description?: string | null
}

export interface RoomUpdate {
  name?: string
  capabilities?: string[]
  description?: string | null
  status?: Status
}

export type Room = typeof rooms.$inferSelect

export class RoomRepository {
  private get db() {
    return getDb()
  }

  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string }
  ): Promise<PaginatedResult<Room>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = [eq(rooms.organizationId, organizationId)]

    if (params.search) {
      conditions.push(
        or(
          ilike(rooms.name, `%${params.search}%`),
          ilike(rooms.description, `%${params.search}%`)
        )!
      )
    }

    if (params.status) {
      conditions.push(eq(rooms.status, params.status as Status))
    }

    const whereClause = and(...conditions)

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(rooms)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(rooms.name),
      this.db
        .select({ count: count() })
        .from(rooms)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string, organizationId?: string): Promise<Room | null> {
    const conditions = [eq(rooms.id, id)]
    if (organizationId) {
      conditions.push(eq(rooms.organizationId, organizationId))
    }

    const result = await this.db
      .select()
      .from(rooms)
      .where(and(...conditions))
      .limit(1)

    return result[0] || null
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Room[]> {
    const conditions = [eq(rooms.organizationId, organizationId)]
    if (status) {
      conditions.push(eq(rooms.status, status))
    }

    return this.db
      .select()
      .from(rooms)
      .where(and(...conditions))
      .orderBy(rooms.name)
  }

  async findByCapabilities(organizationId: string, requiredCapabilities: string[]): Promise<Room[]> {
    // Find rooms that have ALL required capabilities
    const activeRooms = await this.findByOrganization(organizationId, 'active')

    if (requiredCapabilities.length === 0) {
      return activeRooms
    }

    return activeRooms.filter(room => {
      const roomCaps = room.capabilities || []
      return requiredCapabilities.every(cap => roomCaps.includes(cap))
    })
  }

  async create(data: RoomCreate): Promise<Room> {
    const now = new Date()
    const result = await this.db
      .insert(rooms)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        capabilities: data.capabilities || [],
        description: data.description,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    return result[0]
  }

  async update(id: string, organizationId: string, data: RoomUpdate): Promise<Room | null> {
    const result = await this.db
      .update(rooms)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(rooms.id, id), eq(rooms.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    // Soft delete by setting status to inactive
    const result = await this.db
      .update(rooms)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(and(eq(rooms.id, id), eq(rooms.organizationId, organizationId)))
      .returning({ id: rooms.id })

    return result.length > 0
  }

  async hardDelete(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.organizationId, organizationId)))
      .returning({ id: rooms.id })

    return result.length > 0
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(rooms)
      .where(and(eq(rooms.organizationId, organizationId), eq(rooms.status, 'active')))

    return result[0]?.count || 0
  }
}

export const roomRepository = new RoomRepository()
