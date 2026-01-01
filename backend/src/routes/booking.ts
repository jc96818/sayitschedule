/**
 * Booking API Routes
 *
 * Provides endpoints for the booking engine:
 * - GET /booking/availability - Get available time slots
 * - GET /booking/staff/:staffId/availability - Get a staff member's availability for a day
 * - POST /booking/hold - Create a temporary hold on a time slot
 * - DELETE /booking/hold/:holdId - Release a hold
 * - POST /booking/hold/:holdId/extend - Extend a hold's expiration
 * - POST /booking/book - Book from a hold
 * - POST /booking/book-direct - Book directly (admin/staff only)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin, requireAdminOrAssistant } from '../middleware/auth.js'
import { availabilityService } from '../services/availability.js'
import { bookingRepository } from '../repositories/booking.js'
import { auditRepository } from '../repositories/audit.js'
import { BookingSource } from '@prisma/client'

/**
 * Helper to get organizationId from request context, returning 403 if not available
 */
function getOrganizationId(request: FastifyRequest, reply: FastifyReply): string | null {
  const { organizationId } = request.ctx.user!
  if (!organizationId) {
    reply.code(403).send({
      error: 'Organization context required',
      message: 'This endpoint requires an organization context'
    })
    return null
  }
  return organizationId
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AvailabilityQueryParams {
  dateFrom: string
  dateTo: string
  duration?: string
  staffId?: string
  roomId?: string
  patientId?: string
}

interface StaffAvailabilityParams {
  staffId: string
}

interface StaffAvailabilityQuery {
  date: string
}

interface CreateHoldBody {
  staffId?: string
  roomId?: string
  date: string
  startTime: string
  endTime: string
  holdDurationMinutes?: number
}

interface HoldIdParams {
  holdId: string
}

interface ExtendHoldBody {
  additionalMinutes?: number
}

interface BookFromHoldBody {
  holdId: string
  scheduleId?: string // Optional - auto-creates if not provided
  patientId: string
  notes?: string
}

interface BookDirectBody {
  scheduleId?: string // Optional - auto-creates if not provided
  staffId: string
  patientId: string
  roomId?: string
  date: string
  startTime: string
  endTime: string
  notes?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export default async function bookingRoutes(fastify: FastifyInstance) {
  /**
   * GET /booking/availability
   * Get available time slots for booking
   */
  fastify.get<{ Querystring: AvailabilityQueryParams }>(
    '/availability',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Querystring: AvailabilityQueryParams }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { dateFrom, dateTo, duration, staffId, roomId, patientId } = request.query

      if (!dateFrom || !dateTo) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'dateFrom and dateTo are required (YYYY-MM-DD format)'
        })
      }

      // Parse dates
      const from = new Date(dateFrom)
      const to = new Date(dateTo)

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format',
          message: 'Dates must be in YYYY-MM-DD format'
        })
      }

      // Limit query range to 30 days
      const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 30) {
        return reply.code(400).send({
          error: 'Date range too large',
          message: 'Maximum date range is 30 days'
        })
      }

      try {
        const result = await availabilityService.getAvailableSlots({
          organizationId,
          dateFrom: from,
          dateTo: to,
          durationMinutes: duration ? parseInt(duration, 10) : undefined,
          staffId,
          roomId,
          patientId
        })

        return reply.send(result)
      } catch (error) {
        console.error('Failed to get availability:', error)
        return reply.code(500).send({
          error: 'Failed to get availability',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * GET /booking/staff/:staffId/availability
   * Get detailed availability for a specific staff member on a specific day
   */
  fastify.get<{ Params: StaffAvailabilityParams; Querystring: StaffAvailabilityQuery }>(
    '/staff/:staffId/availability',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: StaffAvailabilityParams; Querystring: StaffAvailabilityQuery }>,
      reply: FastifyReply
    ) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { staffId } = request.params
      const { date } = request.query

      if (!date) {
        return reply.code(400).send({
          error: 'Missing required parameter',
          message: 'date is required (YYYY-MM-DD format)'
        })
      }

      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format'
        })
      }

      try {
        const result = await availabilityService.getStaffDayAvailability(
          organizationId,
          staffId,
          dateObj
        )

        if (!result) {
          return reply.code(404).send({
            error: 'Staff member not found',
            message: 'The specified staff member does not exist or is not active'
          })
        }

        return reply.send(result)
      } catch (error) {
        console.error('Failed to get staff availability:', error)
        return reply.code(500).send({
          error: 'Failed to get staff availability',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * POST /booking/hold
   * Create a temporary hold on a time slot during checkout
   */
  fastify.post<{ Body: CreateHoldBody }>(
    '/hold',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Body: CreateHoldBody }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { userId } = request.ctx.user!
      const { staffId, roomId, date, startTime, endTime, holdDurationMinutes } = request.body

      if (!date || !startTime || !endTime) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'date, startTime, and endTime are required'
        })
      }

      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format'
        })
      }

      try {
        const result = await bookingRepository.createHold({
          organizationId,
          staffId,
          roomId,
          date: dateObj,
          startTime,
          endTime,
          createdByUserId: userId,
          holdDurationMinutes
        })

        if (!result.success) {
          return reply.code(409).send({
            error: 'Hold creation failed',
            message: result.error
          })
        }

        return reply.code(201).send({
          message: 'Hold created successfully',
          hold: result.hold
        })
      } catch (error) {
        console.error('Failed to create hold:', error)
        return reply.code(500).send({
          error: 'Failed to create hold',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * DELETE /booking/hold/:holdId
   * Release a hold without booking
   */
  fastify.delete<{ Params: HoldIdParams }>(
    '/hold/:holdId',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Params: HoldIdParams }>, reply: FastifyReply) => {
      const { holdId } = request.params

      try {
        const released = await bookingRepository.releaseHold(holdId)

        if (!released) {
          return reply.code(404).send({
            error: 'Hold not found',
            message: 'The hold does not exist or has already been released'
          })
        }

        return reply.send({
          message: 'Hold released successfully'
        })
      } catch (error) {
        console.error('Failed to release hold:', error)
        return reply.code(500).send({
          error: 'Failed to release hold',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * POST /booking/hold/:holdId/extend
   * Extend a hold's expiration time
   */
  fastify.post<{ Params: HoldIdParams; Body: ExtendHoldBody }>(
    '/hold/:holdId/extend',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: HoldIdParams; Body: ExtendHoldBody }>,
      reply: FastifyReply
    ) => {
      const { holdId } = request.params
      const { additionalMinutes } = request.body

      try {
        const result = await bookingRepository.extendHold(holdId, additionalMinutes)

        if (!result.success) {
          return reply.code(404).send({
            error: 'Hold extension failed',
            message: result.error
          })
        }

        return reply.send({
          message: 'Hold extended successfully',
          hold: result.hold
        })
      } catch (error) {
        console.error('Failed to extend hold:', error)
        return reply.code(500).send({
          error: 'Failed to extend hold',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * POST /booking/book
   * Convert a hold to a booked session
   */
  fastify.post<{ Body: BookFromHoldBody }>(
    '/book',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Body: BookFromHoldBody }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { userId } = request.ctx.user!
      const { holdId, scheduleId, patientId, notes } = request.body

      if (!holdId || !patientId) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'holdId and patientId are required'
        })
      }

      try {
        const result = await bookingRepository.bookFromHold({
          holdId,
          organizationId,
          scheduleId,
          patientId,
          notes,
          bookedVia: 'admin' as BookingSource
        })

        if (!result.success) {
          return reply.code(409).send({
            error: 'Booking failed',
            message: result.error
          })
        }

        // Audit log
        await auditRepository.log(
          userId,
          'session.booked',
          'session',
          result.sessionId!,
          organizationId,
          { holdId, patientId, bookedVia: 'admin' }
        )

        return reply.code(201).send({
          message: 'Session booked successfully',
          sessionId: result.sessionId
        })
      } catch (error) {
        console.error('Failed to book from hold:', error)
        return reply.code(500).send({
          error: 'Failed to complete booking',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * POST /booking/book-direct
   * Book a session directly without a hold (admin/staff only)
   */
  fastify.post<{ Body: BookDirectBody }>(
    '/book-direct',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Body: BookDirectBody }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { userId } = request.ctx.user!
      const { scheduleId, staffId, patientId, roomId, date, startTime, endTime, notes } = request.body

      if (!staffId || !patientId || !date || !startTime || !endTime) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'staffId, patientId, date, startTime, and endTime are required'
        })
      }

      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format'
        })
      }

      try {
        const result = await bookingRepository.bookDirect({
          organizationId,
          scheduleId,
          staffId,
          patientId,
          roomId,
          date: dateObj,
          startTime,
          endTime,
          notes,
          bookedVia: 'admin' as BookingSource,
          createdByUserId: userId
        })

        if (!result.success) {
          return reply.code(409).send({
            error: 'Booking failed',
            message: result.error
          })
        }

        // Audit log
        await auditRepository.log(
          userId,
          'session.booked_direct',
          'session',
          result.sessionId!,
          organizationId,
          { staffId, patientId, date, startTime, endTime, bookedVia: 'admin' }
        )

        return reply.code(201).send({
          message: 'Session booked successfully',
          sessionId: result.sessionId
        })
      } catch (error) {
        console.error('Failed to book directly:', error)
        return reply.code(500).send({
          error: 'Failed to create booking',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * GET /booking/holds
   * Get all active holds for the organization (admin only)
   */
  fastify.get<{ Querystring: { dateFrom?: string; dateTo?: string } }>(
    '/holds',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Querystring: { dateFrom?: string; dateTo?: string } }>,
      reply: FastifyReply
    ) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { dateFrom, dateTo } = request.query

      try {
        const from = dateFrom ? new Date(dateFrom) : undefined
        const to = dateTo ? new Date(dateTo) : undefined

        const holds = await bookingRepository.getActiveHolds(organizationId, from, to)

        return reply.send({
          holds,
          count: holds.length
        })
      } catch (error) {
        console.error('Failed to get holds:', error)
        return reply.code(500).send({
          error: 'Failed to get holds',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * POST /booking/cleanup-holds
   * Clean up expired holds (admin only, could also be a cron job)
   */
  fastify.post(
    '/cleanup-holds',
    { preHandler: [requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { userId } = request.ctx.user!

      try {
        const count = await bookingRepository.cleanupExpiredHolds()

        // Audit log
        await auditRepository.log(
          userId,
          'holds.cleanup',
          'appointment_hold',
          'batch',
          organizationId,
          { expiredHoldsRemoved: count }
        )

        return reply.send({
          message: 'Cleanup completed',
          expiredHoldsRemoved: count
        })
      } catch (error) {
        console.error('Failed to cleanup holds:', error)
        return reply.code(500).send({
          error: 'Failed to cleanup holds',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * GET /booking/check-availability
   * Quick check if a specific slot is available
   */
  fastify.get<{
    Querystring: { staffId: string; date: string; startTime: string; endTime: string; excludeSessionId?: string }
  }>(
    '/check-availability',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{
        Querystring: { staffId: string; date: string; startTime: string; endTime: string; excludeSessionId?: string }
      }>,
      reply: FastifyReply
    ) => {
      const organizationId = getOrganizationId(request, reply)
      if (!organizationId) return

      const { staffId, date, startTime, endTime, excludeSessionId } = request.query

      if (!staffId || !date || !startTime || !endTime) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'staffId, date, startTime, and endTime are required'
        })
      }

      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format'
        })
      }

      try {
        const result = await availabilityService.isSlotAvailable(
          organizationId,
          staffId,
          dateObj,
          startTime,
          endTime,
          excludeSessionId
        )

        return reply.send(result)
      } catch (error) {
        console.error('Failed to check availability:', error)
        return reply.code(500).send({
          error: 'Failed to check availability',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )
}
