/**
 * Booking Repository
 *
 * Handles appointment holds and booking operations with race condition protection.
 */

import { prisma } from './base.js'
import type { AppointmentHold, BookingSource } from '@prisma/client'
import { availabilityService } from '../services/availability.js'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateHoldInput {
  organizationId: string
  staffId?: string
  roomId?: string
  date: Date
  startTime: string
  endTime: string
  createdByContactId?: string
  createdByUserId?: string
  holdDurationMinutes?: number // Default: 5 minutes
}

export interface BookFromHoldInput {
  holdId: string
  organizationId: string
  scheduleId?: string // Optional - will auto-find/create if not provided
  patientId: string
  notes?: string
  bookedVia: BookingSource
  bookedByContactId?: string
}

export interface BookDirectInput {
  organizationId: string
  scheduleId?: string // Optional - will auto-find/create if not provided
  staffId: string
  patientId: string
  roomId?: string
  date: Date
  startTime: string
  endTime: string
  notes?: string
  bookedVia: BookingSource
  bookedByContactId?: string
  createdByUserId?: string
}

export interface HoldResult {
  success: boolean
  hold?: AppointmentHold
  error?: string
}

export interface BookingResult {
  success: boolean
  sessionId?: string
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the Monday of the week for a given date
 */
function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Find or create a schedule for the given date's week.
 * Used by booking flows when a schedule isn't explicitly selected.
 */
async function findOrCreateSchedule(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  organizationId: string,
  date: Date,
  createdByUserId?: string
): Promise<string> {
  const weekStart = getWeekStartDate(date)

  async function resolveScheduleCreatedById(): Promise<string> {
    if (createdByUserId) {
      const user = await tx.user.findFirst({
        where: { id: createdByUserId, organizationId },
        select: { id: true }
      })
      if (user) return user.id
    }

    const admin = await tx.user.findFirst({
      where: { organizationId, role: { in: ['admin', 'super_admin'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    })
    if (admin) return admin.id

    const assistant = await tx.user.findFirst({
      where: { organizationId, role: 'admin_assistant' },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    })
    if (assistant) return assistant.id

    const anyUser = await tx.user.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    })
    if (anyUser) return anyUser.id

    throw new Error('Cannot create schedule: no users exist for this organization')
  }

  // Try to find existing schedule for this week
  let schedule = await tx.schedule.findFirst({
    where: {
      organizationId,
      weekStartDate: weekStart
    },
    orderBy: { version: 'desc' }
  })

  if (schedule) {
    return schedule.id
  }

  // Create a new schedule for this week
  const scheduleCreatedById = await resolveScheduleCreatedById()
  schedule = await tx.schedule.create({
    data: {
      organizationId,
      weekStartDate: weekStart,
      status: 'draft',
      createdById: scheduleCreatedById,
      version: 1
    }
  })

  return schedule.id
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class BookingRepository {
  /**
   * Create an appointment hold to reserve a time slot during checkout
   */
  async createHold(input: CreateHoldInput): Promise<HoldResult> {
    const {
      organizationId,
      staffId,
      roomId,
      date,
      startTime,
      endTime,
      createdByContactId,
      createdByUserId,
      holdDurationMinutes = 5
    } = input

    // Verify the slot is still available
    if (staffId) {
      const availability = await availabilityService.isSlotAvailable(
        organizationId,
        staffId,
        date,
        startTime,
        endTime
      )

      if (!availability.available) {
        return {
          success: false,
          error: availability.reason || 'Time slot is not available'
        }
      }
    }

    // Calculate expiration time
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + holdDurationMinutes)

    try {
      // Use a transaction to ensure atomicity
      const hold = await prisma.$transaction(async (tx) => {
        // Double-check for conflicting holds within the transaction
        if (staffId) {
          const existingHold = await tx.appointmentHold.findFirst({
            where: {
              organizationId,
              staffId,
              date,
              expiresAt: { gt: new Date() },
              releasedAt: null,
              convertedToSessionId: null,
              // Overlapping time check (exclusive boundaries for back-to-back bookings)
              // Two slots overlap if: start1 < end2 AND start2 < end1
              startTime: { lt: endTime },
              endTime: { gt: startTime }
            }
          })

          if (existingHold) {
            throw new Error('Time slot is currently on hold for another booking')
          }
        }

        // Create the hold
        return tx.appointmentHold.create({
          data: {
            organizationId,
            staffId,
            roomId,
            date,
            startTime,
            endTime,
            expiresAt,
            createdByContactId,
            createdByUserId
          }
        })
      })

      return {
        success: true,
        hold
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create hold'
      }
    }
  }

  /**
   * Release a hold without converting it to a booking
   */
  async releaseHold(holdId: string): Promise<boolean> {
    try {
      await prisma.appointmentHold.update({
        where: { id: holdId },
        data: { releasedAt: new Date() }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get an active hold by ID
   */
  async getHold(holdId: string): Promise<AppointmentHold | null> {
    return prisma.appointmentHold.findFirst({
      where: {
        id: holdId,
        expiresAt: { gt: new Date() },
        releasedAt: null,
        convertedToSessionId: null
      }
    })
  }

  /**
   * Convert a hold to a booked session
   */
  async bookFromHold(input: BookFromHoldInput): Promise<BookingResult> {
    const { holdId, organizationId, scheduleId, patientId, notes, bookedVia, bookedByContactId } = input

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get and validate the hold
        const hold = await tx.appointmentHold.findFirst({
          where: {
            id: holdId,
            organizationId,
            expiresAt: { gt: new Date() },
            releasedAt: null,
            convertedToSessionId: null
          }
        })

        if (!hold) {
          throw new Error('Hold has expired or is no longer valid')
        }

        if (!hold.staffId) {
          throw new Error('Hold does not have a staff member assigned')
        }

        // Double-check for conflicts within the transaction
        // Use exclusive boundaries: start1 < end2 AND start2 < end1
        const conflictingSession = await tx.session.findFirst({
          where: {
            therapistId: hold.staffId,
            date: hold.date,
            status: { notIn: ['cancelled', 'late_cancel'] },
            schedule: { organizationId },
            startTime: { lt: hold.endTime },
            endTime: { gt: hold.startTime }
          }
        })

        if (conflictingSession) {
          throw new Error('Time slot is no longer available')
        }

        // Get or create schedule for this date
        const effectiveScheduleId = scheduleId || await findOrCreateSchedule(
          tx,
          organizationId,
          hold.date,
          hold.createdByUserId || undefined
        )

        // Create the session
        const session = await tx.session.create({
          data: {
            scheduleId: effectiveScheduleId,
            therapistId: hold.staffId,
            patientId,
            roomId: hold.roomId,
            date: hold.date,
            startTime: hold.startTime,
            endTime: hold.endTime,
            notes,
            status: 'scheduled',
            bookedVia,
            bookedByContactId
          }
        })

        // Mark the hold as converted
        await tx.appointmentHold.update({
          where: { id: holdId },
          data: { convertedToSessionId: session.id }
        })

        return session
      })

      return {
        success: true,
        sessionId: result.id
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete booking'
      }
    }
  }

  /**
   * Book directly without a hold (for admin/staff use)
   * This still checks availability to prevent double-booking
   */
  async bookDirect(input: BookDirectInput): Promise<BookingResult> {
    const {
      organizationId,
      scheduleId,
      staffId,
      patientId,
      roomId,
      date,
      startTime,
      endTime,
      notes,
      bookedVia,
      bookedByContactId,
      createdByUserId
    } = input

    // Check availability
    const availability = await availabilityService.isSlotAvailable(
      organizationId,
      staffId,
      date,
      startTime,
      endTime
    )

    if (!availability.available) {
      return {
        success: false,
        error: availability.reason || 'Time slot is not available'
      }
    }

    try {
      const session = await prisma.$transaction(async (tx) => {
        // Double-check for conflicts within the transaction
        // Use exclusive boundaries: start1 < end2 AND start2 < end1
        const conflictingSession = await tx.session.findFirst({
          where: {
            therapistId: staffId,
            date,
            status: { notIn: ['cancelled', 'late_cancel'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime }
          }
        })

        if (conflictingSession) {
          throw new Error('Time slot is no longer available')
        }

        // Get or create schedule for this date if not provided
        const effectiveScheduleId = scheduleId || await findOrCreateSchedule(
          tx,
          organizationId,
          date,
          createdByUserId
        )

        return tx.session.create({
          data: {
            scheduleId: effectiveScheduleId,
            therapistId: staffId,
            patientId,
            roomId,
            date,
            startTime,
            endTime,
            notes,
            status: 'scheduled',
            bookedVia,
            bookedByContactId
          }
        })
      })

      return {
        success: true,
        sessionId: session.id
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create booking'
      }
    }
  }

  /**
   * Clean up expired holds (can be run periodically)
   */
  async cleanupExpiredHolds(): Promise<number> {
    const result = await prisma.appointmentHold.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        convertedToSessionId: null
      }
    })
    return result.count
  }

  /**
   * Get all active holds for an organization
   */
  async getActiveHolds(
    organizationId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AppointmentHold[]> {
    return prisma.appointmentHold.findMany({
      where: {
        organizationId,
        expiresAt: { gt: new Date() },
        releasedAt: null,
        convertedToSessionId: null,
        ...(dateFrom && dateTo ? {
          date: { gte: dateFrom, lte: dateTo }
        } : {})
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    })
  }

  /**
   * Extend the expiration time of a hold
   */
  async extendHold(holdId: string, additionalMinutes: number = 5): Promise<HoldResult> {
    try {
      const hold = await prisma.appointmentHold.findFirst({
        where: {
          id: holdId,
          expiresAt: { gt: new Date() },
          releasedAt: null,
          convertedToSessionId: null
        }
      })

      if (!hold) {
        return {
          success: false,
          error: 'Hold not found or has expired'
        }
      }

      const newExpiration = new Date(hold.expiresAt)
      newExpiration.setMinutes(newExpiration.getMinutes() + additionalMinutes)

      const updatedHold = await prisma.appointmentHold.update({
        where: { id: holdId },
        data: { expiresAt: newExpiration }
      })

      return {
        success: true,
        hold: updatedHold
      }
    } catch {
      return {
        success: false,
        error: 'Failed to extend hold'
      }
    }
  }
}

export const bookingRepository = new BookingRepository()
