import { eq, and, count, desc, gte, lte } from 'drizzle-orm'
import { getDb, schedules, sessions, staff, patients } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export type ScheduleStatus = 'draft' | 'published'

export interface ScheduleCreate {
  organizationId: string
  weekStartDate: Date
  createdBy: string
}

export interface SessionCreate {
  scheduleId: string
  therapistId: string
  patientId: string
  date: Date
  startTime: string
  endTime: string
  notes?: string | null
}

export interface SessionUpdate {
  therapistId?: string
  patientId?: string
  date?: Date
  startTime?: string
  endTime?: string
  notes?: string | null
}

export type Schedule = typeof schedules.$inferSelect
export type Session = typeof sessions.$inferSelect

export interface SessionWithDetails extends Session {
  therapistName?: string
  patientName?: string
}

export interface ScheduleWithSessions extends Schedule {
  sessions: SessionWithDetails[]
}

export class ScheduleRepository {
  private get db() {
    return getDb()
  }

  async findAll(
    organizationId: string,
    params: PaginationParams & { status?: string }
  ): Promise<PaginatedResult<Schedule>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = [eq(schedules.organizationId, organizationId)]

    if (params.status) {
      conditions.push(eq(schedules.status, params.status as ScheduleStatus))
    }

    const whereClause = and(...conditions)

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schedules)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(schedules.weekStartDate)),
      this.db
        .select({ count: count() })
        .from(schedules)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string, organizationId?: string): Promise<Schedule | null> {
    const conditions = [eq(schedules.id, id)]
    if (organizationId) {
      conditions.push(eq(schedules.organizationId, organizationId))
    }

    const result = await this.db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .limit(1)

    return result[0] || null
  }

  async findByIdWithSessions(id: string, organizationId?: string): Promise<ScheduleWithSessions | null> {
    const schedule = await this.findById(id, organizationId)
    if (!schedule) return null

    const sessionData = await this.db
      .select({
        session: sessions,
        therapistName: staff.name,
        patientName: patients.name
      })
      .from(sessions)
      .leftJoin(staff, eq(sessions.therapistId, staff.id))
      .leftJoin(patients, eq(sessions.patientId, patients.id))
      .where(eq(sessions.scheduleId, id))
      .orderBy(sessions.date, sessions.startTime)

    return {
      ...schedule,
      sessions: sessionData.map(s => ({
        ...s.session,
        therapistName: s.therapistName || undefined,
        patientName: s.patientName || undefined
      }))
    }
  }

  async findByWeek(organizationId: string, weekStartDate: Date): Promise<Schedule | null> {
    const result = await this.db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.organizationId, organizationId),
          eq(schedules.weekStartDate, weekStartDate)
        )
      )
      .limit(1)

    return result[0] || null
  }

  async create(data: ScheduleCreate): Promise<Schedule> {
    const result = await this.db
      .insert(schedules)
      .values({
        organizationId: data.organizationId,
        weekStartDate: data.weekStartDate,
        createdBy: data.createdBy
      })
      .returning()

    return result[0]
  }

  async publish(id: string, organizationId: string): Promise<Schedule | null> {
    const result = await this.db
      .update(schedules)
      .set({
        status: 'published',
        publishedAt: new Date()
      })
      .where(and(eq(schedules.id, id), eq(schedules.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async unpublish(id: string, organizationId: string): Promise<Schedule | null> {
    const result = await this.db
      .update(schedules)
      .set({
        status: 'draft',
        publishedAt: null,
        version: schedules.version
      })
      .where(and(eq(schedules.id, id), eq(schedules.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    // Delete sessions first
    await this.db
      .delete(sessions)
      .where(eq(sessions.scheduleId, id))

    const result = await this.db
      .delete(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.organizationId, organizationId)))
      .returning({ id: schedules.id })

    return result.length > 0
  }

  // Session methods
  async addSession(data: SessionCreate): Promise<Session> {
    const result = await this.db
      .insert(sessions)
      .values(data)
      .returning()

    return result[0]
  }

  async addSessions(data: SessionCreate[]): Promise<Session[]> {
    if (data.length === 0) return []

    const result = await this.db
      .insert(sessions)
      .values(data)
      .returning()

    return result
  }

  async updateSession(sessionId: string, scheduleId: string, data: SessionUpdate): Promise<Session | null> {
    const result = await this.db
      .update(sessions)
      .set(data)
      .where(and(eq(sessions.id, sessionId), eq(sessions.scheduleId, scheduleId)))
      .returning()

    return result[0] || null
  }

  async deleteSession(sessionId: string, scheduleId: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.scheduleId, scheduleId)))
      .returning({ id: sessions.id })

    return result.length > 0
  }

  async getSessionsByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SessionWithDetails[]> {
    const result = await this.db
      .select({
        session: sessions,
        therapistName: staff.name,
        patientName: patients.name
      })
      .from(sessions)
      .innerJoin(schedules, eq(sessions.scheduleId, schedules.id))
      .leftJoin(staff, eq(sessions.therapistId, staff.id))
      .leftJoin(patients, eq(sessions.patientId, patients.id))
      .where(
        and(
          eq(schedules.organizationId, organizationId),
          gte(sessions.date, startDate),
          lte(sessions.date, endDate)
        )
      )
      .orderBy(sessions.date, sessions.startTime)

    return result.map(s => ({
      ...s.session,
      therapistName: s.therapistName || undefined,
      patientName: s.patientName || undefined
    }))
  }

  async countSessionsBySchedule(scheduleId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.scheduleId, scheduleId))

    return result[0]?.count || 0
  }
}

export const scheduleRepository = new ScheduleRepository()
