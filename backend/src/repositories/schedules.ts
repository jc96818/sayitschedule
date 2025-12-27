import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Schedule, Session, ScheduleStatus, Gender } from '@prisma/client'

export type { Schedule, Session, ScheduleStatus }

export interface ScheduleCreate {
  organizationId: string
  weekStartDate: Date
  createdBy: string
}

export interface SessionCreate {
  scheduleId: string
  therapistId: string
  patientId: string
  roomId?: string | null
  date: Date
  startTime: string
  endTime: string
  notes?: string | null
}

export interface SessionUpdate {
  therapistId?: string
  patientId?: string
  roomId?: string | null
  date?: Date
  startTime?: string
  endTime?: string
  notes?: string | null
}

export interface SessionWithDetails extends Session {
  therapistName?: string
  patientName?: string
  therapistGender?: Gender
  roomName?: string
  roomCapabilities?: string[]
}

export interface ScheduleWithSessions extends Schedule {
  sessions: SessionWithDetails[]
}

export class ScheduleRepository {
  async findAll(
    organizationId: string,
    params: PaginationParams & { status?: string }
  ): Promise<PaginatedResult<Schedule>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: { organizationId: string; status?: ScheduleStatus } = { organizationId }

    if (params.status) {
      where.status = params.status as ScheduleStatus
    }

    const [data, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        take,
        skip,
        orderBy: { weekStartDate: 'desc' }
      }),
      prisma.schedule.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string, organizationId?: string): Promise<Schedule | null> {
    const where: { id: string; organizationId?: string } = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    return prisma.schedule.findFirst({ where })
  }

  async findByIdWithSessions(id: string, organizationId?: string): Promise<ScheduleWithSessions | null> {
    const where: { id: string; organizationId?: string } = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    const schedule = await prisma.schedule.findFirst({
      where,
      include: {
        sessions: {
          include: {
            therapist: { select: { name: true, gender: true } },
            patient: { select: { name: true } },
            room: { select: { name: true, capabilities: true } }
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
        }
      }
    })

    if (!schedule) return null

    return {
      ...schedule,
      sessions: schedule.sessions.map(s => ({
        ...s,
        therapistName: s.therapist?.name || undefined,
        patientName: s.patient?.name || undefined,
        therapistGender: s.therapist?.gender || undefined,
        roomName: s.room?.name || undefined,
        roomCapabilities: (s.room?.capabilities as string[]) || undefined,
        therapist: undefined,
        patient: undefined,
        room: undefined
      })) as SessionWithDetails[]
    }
  }

  async findByWeek(organizationId: string, weekStartDate: Date): Promise<Schedule | null> {
    return prisma.schedule.findFirst({
      where: { organizationId, weekStartDate }
    })
  }

  async create(data: ScheduleCreate): Promise<Schedule> {
    return prisma.schedule.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        weekStartDate: data.weekStartDate,
        createdBy: { connect: { id: data.createdBy } }
      }
    })
  }

  async publish(id: string, organizationId: string): Promise<Schedule | null> {
    try {
      return await prisma.schedule.update({
        where: { id, organizationId },
        data: {
          status: 'published',
          publishedAt: new Date()
        }
      })
    } catch {
      return null
    }
  }

  async unpublish(id: string, organizationId: string): Promise<Schedule | null> {
    try {
      return await prisma.schedule.update({
        where: { id, organizationId },
        data: {
          status: 'draft',
          publishedAt: null
        }
      })
    } catch {
      return null
    }
  }

  async archive(id: string, organizationId: string): Promise<Schedule | null> {
    // For now, archive is the same as unpublish - returns to draft status
    // Could add an 'archived' status in the future
    return this.unpublish(id, organizationId)
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      // Delete sessions first, then schedule
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { scheduleId: id } }),
        prisma.schedule.delete({ where: { id, organizationId } })
      ])
      return true
    } catch {
      return false
    }
  }

  // Session methods
  async addSession(data: SessionCreate): Promise<Session> {
    return prisma.session.create({ data })
  }

  async addSessions(data: SessionCreate[]): Promise<Session[]> {
    if (data.length === 0) return []

    // Prisma doesn't support createMany with returning, so we use a transaction
    return prisma.$transaction(
      data.map(session => prisma.session.create({ data: session }))
    )
  }

  async updateSession(sessionId: string, scheduleId: string, data: SessionUpdate): Promise<Session | null> {
    try {
      return await prisma.session.update({
        where: { id: sessionId, scheduleId },
        data
      })
    } catch {
      return null
    }
  }

  async deleteSession(sessionId: string, scheduleId: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id: sessionId, scheduleId }
      })
      return true
    } catch {
      return false
    }
  }

  async getSessionsByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SessionWithDetails[]> {
    const sessions = await prisma.session.findMany({
      where: {
        schedule: { organizationId },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        therapist: { select: { name: true, gender: true } },
        patient: { select: { name: true } },
        room: { select: { name: true, capabilities: true } }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    })

    return sessions.map(s => ({
      ...s,
      therapistName: s.therapist?.name || undefined,
      patientName: s.patient?.name || undefined,
      therapistGender: s.therapist?.gender || undefined,
      roomName: s.room?.name || undefined,
      roomCapabilities: (s.room?.capabilities as string[]) || undefined,
      therapist: undefined,
      patient: undefined,
      room: undefined
    })) as SessionWithDetails[]
  }

  async countSessionsBySchedule(scheduleId: string): Promise<number> {
    return prisma.session.count({ where: { scheduleId } })
  }

  async createDraftCopy(
    sourceScheduleId: string,
    organizationId: string,
    createdBy: string
  ): Promise<ScheduleWithSessions | null> {
    // Get the source schedule with its sessions
    const sourceSchedule = await this.findByIdWithSessions(sourceScheduleId, organizationId)
    if (!sourceSchedule) return null

    // Create new draft schedule with incremented version
    const createdSchedule = await prisma.schedule.create({
      data: {
        organization: { connect: { id: sourceSchedule.organizationId } },
        weekStartDate: sourceSchedule.weekStartDate,
        createdBy: { connect: { id: createdBy } },
        status: 'draft',
        version: sourceSchedule.version + 1
      }
    })

    // Copy all sessions from source to new schedule
    if (sourceSchedule.sessions.length > 0) {
      await prisma.session.createMany({
        data: sourceSchedule.sessions.map(session => ({
          scheduleId: createdSchedule.id,
          therapistId: session.therapistId,
          patientId: session.patientId,
          roomId: session.roomId,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          notes: session.notes
        }))
      })
    }

    // Return the new schedule with its sessions
    return this.findByIdWithSessions(createdSchedule.id, organizationId)
  }
}

export const scheduleRepository = new ScheduleRepository()

// SessionRepository as a separate class for route compatibility
export class SessionRepository {
  async findBySchedule(scheduleId: string): Promise<SessionWithDetails[]> {
    const sessions = await prisma.session.findMany({
      where: { scheduleId },
      include: {
        therapist: { select: { name: true, gender: true } },
        patient: { select: { name: true } },
        room: { select: { name: true, capabilities: true } }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    })

    return sessions.map(s => ({
      ...s,
      therapistName: s.therapist?.name || undefined,
      patientName: s.patient?.name || undefined,
      therapistGender: s.therapist?.gender || undefined,
      roomName: s.room?.name || undefined,
      roomCapabilities: (s.room?.capabilities as string[]) || undefined,
      therapist: undefined,
      patient: undefined,
      room: undefined
    })) as SessionWithDetails[]
  }

  async create(data: SessionCreate): Promise<Session> {
    return prisma.session.create({ data })
  }

  async update(sessionId: string, scheduleId: string, data: SessionUpdate): Promise<Session | null> {
    try {
      return await prisma.session.update({
        where: { id: sessionId, scheduleId },
        data
      })
    } catch {
      return null
    }
  }

  async delete(sessionId: string, scheduleId: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id: sessionId, scheduleId }
      })
      return true
    } catch {
      return false
    }
  }
}

export const sessionRepository = new SessionRepository()
