import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Schedule, Session, ScheduleStatus, Gender, SessionStatus, CancellationReason } from '@prisma/client'

export type { Schedule, Session, ScheduleStatus, SessionStatus, CancellationReason }

export interface ScheduleCreate {
  organizationId: string
  weekStartDate: Date
  createdBy: string
}

export interface SessionCreate {
  scheduleId: string
  therapistId: string
  patientId: string
  sessionSpecId?: string | null
  roomId?: string | null
  date: Date
  startTime: string
  endTime: string
  notes?: string | null
}

export interface SessionUpdate {
  therapistId?: string
  patientId?: string
  sessionSpecId?: string | null
  roomId?: string | null
  date?: Date
  startTime?: string
  endTime?: string
  notes?: string | null
}

export interface SessionStatusUpdate {
  status: SessionStatus
  updatedById: string
  actualStartTime?: Date
  actualEndTime?: Date
  notes?: string
}

export interface SessionCancellation {
  cancelledById: string
  reason: CancellationReason
  notes?: string
  isLateCancellation?: boolean
}

export interface SessionConfirmation {
  confirmedById: string
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
      // SECURITY: Delete sessions only for schedules belonging to this organization
      // Uses a subquery to ensure we only delete sessions from org-owned schedules
      await prisma.$transaction([
        prisma.session.deleteMany({
          where: {
            schedule: {
              id,
              organizationId
            }
          }
        }),
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
    // Explicitly specify each field to avoid adapter issues
    return prisma.$transaction(
      data.map(session => prisma.session.create({
        data: {
          scheduleId: session.scheduleId,
          therapistId: session.therapistId,
          patientId: session.patientId,
          roomId: session.roomId ?? null,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          notes: session.notes ?? null
        }
      }))
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

  async createDraftCopyWithValidation(
    sourceScheduleId: string,
    organizationId: string,
    createdBy: string,
    validSessions: SessionCreate[]
  ): Promise<ScheduleWithSessions | null> {
    // Get the source schedule to get version number
    const sourceSchedule = await this.findById(sourceScheduleId, organizationId)
    if (!sourceSchedule) return null

    // Create new draft schedule with incremented version
    const createdSchedule = await prisma.schedule.create({
      data: {
        organization: { connect: { id: organizationId } },
        weekStartDate: sourceSchedule.weekStartDate,
        createdBy: { connect: { id: createdBy } },
        status: 'draft',
        version: sourceSchedule.version + 1
      }
    })

    // Add validated sessions to the new schedule
    if (validSessions.length > 0) {
      await prisma.session.createMany({
        data: validSessions.map(session => ({
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

  async delete(sessionId: string, scheduleId: string, organizationId?: string): Promise<boolean> {
    try {
      // If organizationId is provided, use a more secure delete that verifies org ownership
      if (organizationId) {
        await prisma.session.deleteMany({
          where: {
            id: sessionId,
            schedule: {
              id: scheduleId,
              organizationId
            }
          }
        })
      } else {
        // Fallback for cases where org context isn't available (should be rare)
        await prisma.session.delete({
          where: { id: sessionId, scheduleId }
        })
      }
      return true
    } catch {
      return false
    }
  }

  async findById(sessionId: string, organizationId?: string): Promise<SessionWithDetails | null> {
    const where: { id: string; schedule?: { organizationId: string } } = { id: sessionId }
    if (organizationId) {
      where.schedule = { organizationId }
    }

    const session = await prisma.session.findFirst({
      where,
      include: {
        therapist: { select: { name: true, gender: true } },
        patient: { select: { name: true } },
        room: { select: { name: true, capabilities: true } },
        statusUpdatedBy: { select: { email: true } },
        cancelledBy: { select: { email: true } },
        confirmedBy: { select: { email: true } }
      }
    })

    if (!session) return null

    return {
      ...session,
      therapistName: session.therapist?.name || undefined,
      patientName: session.patient?.name || undefined,
      therapistGender: session.therapist?.gender || undefined,
      roomName: session.room?.name || undefined,
      roomCapabilities: (session.room?.capabilities as string[]) || undefined,
      therapist: undefined,
      patient: undefined,
      room: undefined
    } as SessionWithDetails
  }

  async updateStatus(
    sessionId: string,
    organizationId: string,
    data: SessionStatusUpdate
  ): Promise<Session | null> {
    try {
      return await prisma.session.update({
        where: {
          id: sessionId,
          schedule: { organizationId }
        },
        data: {
          status: data.status,
          statusUpdatedAt: new Date(),
          statusUpdatedById: data.updatedById,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          notes: data.notes !== undefined ? data.notes : undefined
        }
      })
    } catch {
      return null
    }
  }

  async checkIn(sessionId: string, organizationId: string, userId: string): Promise<Session | null> {
    return this.updateStatus(sessionId, organizationId, {
      status: 'checked_in',
      updatedById: userId,
      actualStartTime: new Date()
    })
  }

  async startSession(sessionId: string, organizationId: string, userId: string): Promise<Session | null> {
    return this.updateStatus(sessionId, organizationId, {
      status: 'in_progress',
      updatedById: userId,
      actualStartTime: new Date()
    })
  }

  async completeSession(sessionId: string, organizationId: string, userId: string): Promise<Session | null> {
    return this.updateStatus(sessionId, organizationId, {
      status: 'completed',
      updatedById: userId,
      actualEndTime: new Date()
    })
  }

  async cancelSession(
    sessionId: string,
    organizationId: string,
    data: SessionCancellation
  ): Promise<Session | null> {
    try {
      const status: SessionStatus = data.isLateCancellation ? 'late_cancel' : 'cancelled'

      return await prisma.session.update({
        where: {
          id: sessionId,
          schedule: { organizationId }
        },
        data: {
          status,
          statusUpdatedAt: new Date(),
          statusUpdatedById: data.cancelledById,
          cancellationReason: data.reason,
          cancellationNotes: data.notes,
          cancelledAt: new Date(),
          cancelledById: data.cancelledById
        }
      })
    } catch {
      return null
    }
  }

  async markNoShow(sessionId: string, organizationId: string, userId: string): Promise<Session | null> {
    return this.updateStatus(sessionId, organizationId, {
      status: 'no_show',
      updatedById: userId
    })
  }

  async confirmSession(
    sessionId: string,
    organizationId: string,
    data: SessionConfirmation
  ): Promise<Session | null> {
    try {
      return await prisma.session.update({
        where: {
          id: sessionId,
          schedule: { organizationId }
        },
        data: {
          status: 'confirmed',
          statusUpdatedAt: new Date(),
          statusUpdatedById: data.confirmedById,
          confirmedAt: new Date(),
          confirmedById: data.confirmedById
        }
      })
    } catch {
      return null
    }
  }

  async findByStatus(
    organizationId: string,
    status: SessionStatus,
    params: PaginationParams & { dateFrom?: Date; dateTo?: Date }
  ): Promise<PaginatedResult<SessionWithDetails>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: {
      schedule: { organizationId: string }
      status: SessionStatus
      date?: { gte?: Date; lte?: Date }
    } = {
      schedule: { organizationId },
      status
    }

    if (params.dateFrom || params.dateTo) {
      where.date = {}
      if (params.dateFrom) where.date.gte = params.dateFrom
      if (params.dateTo) where.date.lte = params.dateTo
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          therapist: { select: { name: true, gender: true } },
          patient: { select: { name: true } },
          room: { select: { name: true, capabilities: true } }
        },
        take,
        skip,
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
      }),
      prisma.session.count({ where })
    ])

    const data = sessions.map(s => ({
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

    return paginate(data, total, params)
  }

  async getStatusCounts(organizationId: string, dateFrom?: Date, dateTo?: Date): Promise<Record<SessionStatus, number>> {
    const where: {
      schedule: { organizationId: string }
      date?: { gte?: Date; lte?: Date }
    } = {
      schedule: { organizationId }
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = dateFrom
      if (dateTo) where.date.lte = dateTo
    }

    const counts = await prisma.session.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    })

    // Initialize all statuses to 0
    const result: Record<SessionStatus, number> = {
      pending: 0,
      scheduled: 0,
      confirmed: 0,
      checked_in: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      late_cancel: 0,
      no_show: 0
    }

    // Fill in actual counts
    for (const { status, _count } of counts) {
      result[status] = _count.status
    }

    return result
  }

  async findTodaysSessions(organizationId: string, therapistId?: string): Promise<SessionWithDetails[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const where: {
      schedule: { organizationId: string; status: 'published' }
      date: { gte: Date; lt: Date }
      therapistId?: string
    } = {
      schedule: { organizationId, status: 'published' },
      date: { gte: today, lt: tomorrow }
    }

    if (therapistId) {
      where.therapistId = therapistId
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        therapist: { select: { name: true, gender: true } },
        patient: { select: { name: true } },
        room: { select: { name: true, capabilities: true } }
      },
      orderBy: [{ startTime: 'asc' }]
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
}

export const sessionRepository = new SessionRepository()
