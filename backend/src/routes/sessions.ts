import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { sessionRepository, type SessionStatus, type CancellationReason } from '../repositories/schedules.js'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
import { logAudit } from '../repositories/audit.js'

// Valid status transitions - ensures proper workflow
const validStatusTransitions: Record<SessionStatus, SessionStatus[]> = {
  pending: ['scheduled', 'cancelled'], // Pending approval - can approve (scheduled) or reject (cancelled)
  scheduled: ['confirmed', 'cancelled', 'late_cancel'],
  confirmed: ['checked_in', 'cancelled', 'late_cancel', 'no_show'],
  checked_in: ['in_progress', 'cancelled', 'late_cancel'],
  in_progress: ['completed', 'cancelled'],
  completed: [], // Final state
  cancelled: [], // Final state
  late_cancel: [], // Final state
  no_show: [] // Final state
}

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'late_cancel', 'no_show']),
  notes: z.string().optional()
})

const cancelSessionSchema = z.object({
  reason: z.enum(['patient_request', 'caregiver_request', 'therapist_unavailable', 'weather', 'illness', 'scheduling_conflict', 'other']),
  notes: z.string().optional()
})

export async function sessionRoutes(fastify: FastifyInstance) {
  // Get today's sessions for the authenticated user (or all sessions for admins)
  fastify.get('/today', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId
    const user = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // If staff role, get their associated therapist ID
    let therapistId: string | undefined
    if (user.role === 'staff') {
      const { staffRepository } = await import('../repositories/staff.js')
      const staff = await staffRepository.findByUserId(user.userId)
      if (staff) {
        therapistId = staff.id
      }
    }

    const sessions = await sessionRepository.findTodaysSessions(organizationId, therapistId)

    return { data: sessions }
  })

  // Get session status counts (dashboard metrics)
  fastify.get('/status-counts', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId
    const { dateFrom, dateTo } = request.query as { dateFrom?: string; dateTo?: string }

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const counts = await sessionRepository.getStatusCounts(
      organizationId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    )

    return { data: counts }
  })

  // Get sessions by status
  fastify.get('/by-status/:status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status } = request.params as { status: string }
    const { page, limit, dateFrom, dateTo } = request.query as {
      page?: string
      limit?: string
      dateFrom?: string
      dateTo?: string
    }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Validate status
    const validStatuses: SessionStatus[] = ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'late_cancel', 'no_show']
    if (!validStatuses.includes(status as SessionStatus)) {
      return reply.status(400).send({ error: 'Invalid status' })
    }

    const result = await sessionRepository.findByStatus(
      organizationId,
      status as SessionStatus,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      }
    )

    return result
  })

  // Get a single session
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const session = await sessionRepository.findById(id, organizationId)
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    return { data: session }
  })

  // Update session status (generic)
  fastify.put('/:id/status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateStatusSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Get current session to validate transition
    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    // Validate status transition
    const allowedTransitions = validStatusTransitions[currentSession.status as SessionStatus]
    if (!allowedTransitions.includes(body.status as SessionStatus)) {
      return reply.status(400).send({
        error: `Invalid status transition from '${currentSession.status}' to '${body.status}'`,
        allowedTransitions
      })
    }

    const session = await sessionRepository.updateStatus(id, organizationId, {
      status: body.status as SessionStatus,
      updatedById: ctx.userId,
      notes: body.notes
    })

    if (!session) {
      return reply.status(500).send({ error: 'Failed to update session status' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'status_change',
      fromStatus: currentSession.status,
      toStatus: body.status
    })

    return { data: session }
  })

  // Quick action: Check in
  fastify.post('/:id/check-in', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Validate current status allows check-in
    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    if (!['scheduled', 'confirmed'].includes(currentSession.status)) {
      return reply.status(400).send({
        error: `Cannot check in from status '${currentSession.status}'`
      })
    }

    const session = await sessionRepository.checkIn(id, organizationId, ctx.userId)

    if (!session) {
      return reply.status(500).send({ error: 'Failed to check in' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'check_in'
    })

    return { data: session }
  })

  // Quick action: Start session
  fastify.post('/:id/start', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    if (!['scheduled', 'confirmed', 'checked_in'].includes(currentSession.status)) {
      return reply.status(400).send({
        error: `Cannot start session from status '${currentSession.status}'`
      })
    }

    const session = await sessionRepository.startSession(id, organizationId, ctx.userId)

    if (!session) {
      return reply.status(500).send({ error: 'Failed to start session' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'start_session'
    })

    return { data: session }
  })

  // Quick action: Complete session
  fastify.post('/:id/complete', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    if (!['in_progress', 'checked_in'].includes(currentSession.status)) {
      return reply.status(400).send({
        error: `Cannot complete session from status '${currentSession.status}'`
      })
    }

    const session = await sessionRepository.completeSession(id, organizationId, ctx.userId)

    if (!session) {
      return reply.status(500).send({ error: 'Failed to complete session' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'complete_session'
    })

    return { data: session }
  })

  // Cancel session with reason
  fastify.post('/:id/cancel', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = cancelSessionSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    // Check if already in a final state
    if (['completed', 'cancelled', 'late_cancel', 'no_show'].includes(currentSession.status)) {
      return reply.status(400).send({
        error: `Cannot cancel session with status '${currentSession.status}'`
      })
    }

    // Check if this is a late cancellation
    const sessionDateTime = new Date(currentSession.date)
    const [hours, minutes] = currentSession.startTime.split(':').map(Number)
    sessionDateTime.setHours(hours, minutes, 0, 0)

    const isLateCancellation = await organizationSettingsRepository.isLateCancellation(
      organizationId,
      sessionDateTime
    )

    const session = await sessionRepository.cancelSession(id, organizationId, {
      cancelledById: ctx.userId,
      reason: body.reason as CancellationReason,
      notes: body.notes,
      isLateCancellation
    })

    if (!session) {
      return reply.status(500).send({ error: 'Failed to cancel session' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'cancel_session',
      reason: body.reason,
      isLateCancellation
    })

    return {
      data: session,
      meta: {
        isLateCancellation,
        message: isLateCancellation
          ? 'Session marked as late cancellation (within cancellation window)'
          : 'Session cancelled successfully'
      }
    }
  })

  // Mark as no-show
  fastify.post('/:id/no-show', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    // Only scheduled or confirmed sessions can be marked as no-show
    if (!['scheduled', 'confirmed'].includes(currentSession.status)) {
      return reply.status(400).send({
        error: `Cannot mark as no-show from status '${currentSession.status}'`
      })
    }

    const session = await sessionRepository.markNoShow(id, organizationId, ctx.userId)

    if (!session) {
      return reply.status(500).send({ error: 'Failed to mark as no-show' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'mark_no_show'
    })

    return { data: session }
  })

  // Confirm session (typically from patient portal, but also available to staff)
  fastify.post('/:id/confirm', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const currentSession = await sessionRepository.findById(id, organizationId)
    if (!currentSession) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    if (currentSession.status !== 'scheduled') {
      return reply.status(400).send({
        error: `Cannot confirm session with status '${currentSession.status}'`
      })
    }

    const session = await sessionRepository.confirmSession(id, organizationId, {
      confirmedById: ctx.userId
    })

    if (!session) {
      return reply.status(500).send({ error: 'Failed to confirm session' })
    }

    await logAudit(ctx.userId, 'update', 'session', id, organizationId, {
      action: 'confirm_session'
    })

    return { data: session }
  })
}
