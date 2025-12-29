import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { scheduleRepository, sessionRepository } from '../repositories/schedules.js'
import { organizationRepository } from '../repositories/organizations.js'
import { logAudit } from '../repositories/audit.js'
import { generateSchedule } from '../services/scheduler.js'
import { generateSchedulePdf } from '../services/pdfGenerator.js'
import {
  findMatchingSessions,
  checkForConflicts,
  calculateNewEndTime,
  getDateForDayOfWeek
} from '../services/sessionLookup.js'
import { validateSessionEntities } from '../services/sessionValidation.js'
import { isProviderConfigured, getActiveProvider } from '../services/aiProvider.js'

const generateScheduleSchema = z.object({
  weekStartDate: z.string()
})

const updateSessionSchema = z.object({
  staffId: z.string().optional(),
  patientId: z.string().optional(),
  roomId: z.string().nullish(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional()
})

const voiceModifySchema = z.object({
  action: z.enum(['move', 'cancel', 'swap', 'create']),
  therapistName: z.string().optional(),
  patientName: z.string().optional(),
  currentDate: z.string().optional(),
  currentDayOfWeek: z.string().optional(),
  currentStartTime: z.string().optional(),
  newDate: z.string().optional(),
  newDayOfWeek: z.string().optional(),
  newStartTime: z.string().optional(),
  newEndTime: z.string().optional(),
  notes: z.string().optional()
})

export async function scheduleRoutes(fastify: FastifyInstance) {
  // List all schedules
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, status } = request.query as {
      page?: string
      limit?: string
      status?: string
    }

    const result = await scheduleRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status
    })

    return result
  })

  // Get single schedule with sessions
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const schedule = await scheduleRepository.findById(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // Get sessions for this schedule
    const sessions = await sessionRepository.findBySchedule(id)

    return {
      data: {
        ...schedule,
        sessions
      }
    }
  })

  // Generate new schedule
  fastify.post('/generate', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = generateScheduleSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const weekStartDate = new Date(body.weekStartDate)

    // Check if AI provider is configured
    if (!isProviderConfigured()) {
      const provider = getActiveProvider()
      const configHint = provider === 'openai'
        ? 'Please set OPENAI_API_KEY.'
        : 'Please configure AWS credentials.'
      return reply.status(503).send({
        error: `AI scheduling service not configured. ${configHint}`
      })
    }

    try {
      // Generate sessions using AI
      console.log(`Generating schedule for week starting ${body.weekStartDate}...`)
      const result = await generateSchedule(organizationId, weekStartDate)
      console.log(`Generated ${result.stats.totalSessions} sessions`)

      // Create the schedule record
      const schedule = await scheduleRepository.create({
        organizationId,
        weekStartDate,
        createdBy: ctx.userId
      })

      // Add generated sessions to the schedule
      if (result.sessions.length > 0) {
        const sessionsWithScheduleId = result.sessions.map(s => ({
          ...s,
          scheduleId: schedule.id
        }))
        await scheduleRepository.addSessions(sessionsWithScheduleId)
      }

      await logAudit(ctx.userId, 'create', 'schedule', schedule.id, organizationId, {
        weekStartDate: body.weekStartDate,
        sessionsGenerated: result.stats.totalSessions,
        patientsScheduled: result.stats.patientsScheduled,
        therapistsUsed: result.stats.therapistsUsed
      })

      // Return schedule with sessions and generation metadata
      const sessions = await sessionRepository.findBySchedule(schedule.id)

      return reply.status(201).send({
        data: {
          ...schedule,
          sessions
        },
        meta: {
          stats: result.stats,
          warnings: result.warnings
        }
      })
    } catch (error) {
      console.error('Schedule generation failed:', error)

      if (error instanceof Error) {
        if (error.message.includes('AI service error')) {
          return reply.status(503).send({
            error: 'AI scheduling service temporarily unavailable. Please try again.'
          })
        }
        if (error.message.includes('No active staff') || error.message.includes('No active patients')) {
          return reply.status(400).send({ error: error.message })
        }
      }

      return reply.status(500).send({
        error: 'Failed to generate schedule. Please try again.'
      })
    }
  })

  // Publish schedule
  fastify.post('/:id/publish', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const schedule = await scheduleRepository.publish(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    await logAudit(ctx.userId, 'publish', 'schedule', id, organizationId)

    return { data: schedule }
  })

  // Archive schedule
  fastify.post('/:id/archive', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const schedule = await scheduleRepository.archive(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    await logAudit(ctx.userId, 'archive', 'schedule', id, organizationId)

    return { data: schedule }
  })

  // Create draft copy of a published schedule
  fastify.post('/:id/create-draft', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Get the source schedule first to validate it exists and is published
    const sourceSchedule = await scheduleRepository.findById(id, organizationId)
    if (!sourceSchedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    if (sourceSchedule.status !== 'published') {
      return reply.status(400).send({
        error: 'Only published schedules can be copied to a new draft. This schedule is already a draft.'
      })
    }

    // Create the draft copy
    const newSchedule = await scheduleRepository.createDraftCopy(id, organizationId, ctx.userId)
    if (!newSchedule) {
      return reply.status(500).send({ error: 'Failed to create draft copy' })
    }

    await logAudit(ctx.userId, 'create', 'schedule', newSchedule.id, organizationId, {
      action: 'create_draft_copy',
      sourceScheduleId: id,
      sourceVersion: sourceSchedule.version,
      newVersion: newSchedule.version
    })

    return reply.status(201).send({
      data: newSchedule,
      meta: {
        message: `Created draft copy (version ${newSchedule.version}) from published schedule`,
        sourceScheduleId: id
      }
    })
  })

  // Add session to schedule
  fastify.post('/:id/sessions', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Verify schedule exists and belongs to organization
    const schedule = await scheduleRepository.findById(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    const body = request.body as {
      staffId: string
      patientId: string
      roomId?: string
      date: string
      startTime: string
      endTime: string
      notes?: string
    }

    // SECURITY: Validate that referenced entities belong to this organization
    const validation = await validateSessionEntities(organizationId, {
      staffId: body.staffId,
      patientId: body.patientId,
      roomId: body.roomId
    })

    if (!validation.valid) {
      return reply.status(400).send({
        error: 'Invalid session entities',
        details: validation.errors
      })
    }

    const session = await sessionRepository.create({
      scheduleId: id,
      therapistId: body.staffId,
      patientId: body.patientId,
      roomId: body.roomId || null,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes
    })

    await logAudit(ctx.userId, 'create', 'session', session.id, organizationId, body)

    return reply.status(201).send({ data: session })
  })

  // Update session within schedule
  fastify.put('/:scheduleId/sessions/:sessionId', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { scheduleId, sessionId } = request.params as { scheduleId: string; sessionId: string }
    const body = updateSessionSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Verify schedule exists and belongs to organization
    const schedule = await scheduleRepository.findById(scheduleId, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // SECURITY: Validate any entity IDs being updated belong to this organization
    // Only validate fields that are actually being changed
    const entitiesToValidate: { staffId?: string; patientId?: string; roomId?: string | null } = {}

    if (body.staffId !== undefined) {
      entitiesToValidate.staffId = body.staffId
    }
    if (body.patientId !== undefined) {
      entitiesToValidate.patientId = body.patientId
    }
    // roomId can be explicitly set to null to remove room assignment
    // We only validate if a non-null value is provided
    if (body.roomId) {
      entitiesToValidate.roomId = body.roomId
    }

    // Only run validation if there are entity IDs to check
    if (Object.keys(entitiesToValidate).length > 0) {
      const validation = await validateSessionEntities(organizationId, entitiesToValidate)

      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Invalid session entities',
          details: validation.errors
        })
      }
    }

    const session = await sessionRepository.update(sessionId, scheduleId, {
      ...body,
      date: body.date ? new Date(body.date) : undefined
    })

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    await logAudit(ctx.userId, 'update', 'session', sessionId, organizationId, body)

    return { data: session }
  })

  // Delete session from schedule
  fastify.delete('/:scheduleId/sessions/:sessionId', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { scheduleId, sessionId } = request.params as { scheduleId: string; sessionId: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Verify schedule exists and belongs to organization
    const schedule = await scheduleRepository.findById(scheduleId, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // SECURITY: Pass organizationId to ensure session belongs to org-owned schedule
    const deleted = await sessionRepository.delete(sessionId, scheduleId, organizationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    await logAudit(ctx.userId, 'delete', 'session', sessionId, organizationId)

    return reply.status(204).send()
  })

  // Modify schedule via voice command (move, cancel sessions)
  fastify.post('/:id/modify-voice', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = voiceModifySchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Verify schedule exists and belongs to organization
    const schedule = await scheduleRepository.findByIdWithSessions(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // Only allow modifications on draft schedules
    if (schedule.status !== 'draft') {
      return reply.status(400).send({
        error: 'Cannot modify a published schedule. Please unpublish it first.'
      })
    }

    // Find matching session(s) based on the voice command criteria
    const matchingResults = await findMatchingSessions({
      scheduleId: id,
      therapistName: body.therapistName,
      patientName: body.patientName,
      dayOfWeek: body.currentDayOfWeek,
      startTime: body.currentStartTime
    })

    if (matchingResults.length === 0) {
      let searchCriteria = []
      if (body.therapistName) searchCriteria.push(`therapist "${body.therapistName}"`)
      if (body.patientName) searchCriteria.push(`patient "${body.patientName}"`)
      if (body.currentDayOfWeek) searchCriteria.push(`on ${body.currentDayOfWeek}`)
      if (body.currentStartTime) searchCriteria.push(`at ${body.currentStartTime}`)

      return reply.status(404).send({
        error: `Could not find a session matching: ${searchCriteria.join(', ')}`
      })
    }

    // Handle different actions
    switch (body.action) {
      case 'cancel': {
        // Cancel (delete) the matching session(s)
        const session = matchingResults[0].session
        // SECURITY: Pass organizationId to ensure session belongs to org-owned schedule
        const deleted = await sessionRepository.delete(session.id, id, organizationId)

        if (!deleted) {
          return reply.status(500).send({ error: 'Failed to cancel session' })
        }

        await logAudit(ctx.userId, 'delete', 'session', session.id, organizationId, {
          action: 'voice_cancel',
          therapistName: session.therapistName,
          patientName: session.patientName
        })

        return {
          data: {
            action: 'cancelled',
            session: session,
            message: `Cancelled ${session.therapistName || 'therapist'}'s session with ${session.patientName || 'patient'} at ${session.startTime}`
          }
        }
      }

      case 'move': {
        const session = matchingResults[0].session

        // Calculate new date if dayOfWeek provided
        let newDate: Date | undefined
        if (body.newDayOfWeek) {
          newDate = getDateForDayOfWeek(schedule.weekStartDate, body.newDayOfWeek)
        } else if (body.newDate) {
          newDate = new Date(body.newDate)
        } else {
          // Keep the same date, just changing time
          newDate = new Date(session.date)
        }

        const newStartTime = body.newStartTime || session.startTime
        const newEndTime = body.newEndTime || calculateNewEndTime(newStartTime)

        // Check for conflicts at the new time
        const conflicts = await checkForConflicts({
          scheduleId: id,
          therapistId: session.therapistId,
          patientId: session.patientId,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          excludeSessionId: session.id
        })

        if (conflicts.length > 0) {
          const conflict = conflicts[0]
          return reply.status(409).send({
            error: `Time conflict: ${conflict.therapistName || 'Therapist'} already has a session with ${conflict.patientName || 'patient'} at ${conflict.startTime}`,
            conflictWith: conflict
          })
        }

        // Update the session
        const updatedSession = await sessionRepository.update(session.id, id, {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime
        })

        if (!updatedSession) {
          return reply.status(500).send({ error: 'Failed to move session' })
        }

        await logAudit(ctx.userId, 'update', 'session', session.id, organizationId, {
          action: 'voice_move',
          from: { date: session.date, startTime: session.startTime },
          to: { date: newDate, startTime: newStartTime }
        })

        return {
          data: {
            action: 'moved',
            session: updatedSession,
            from: {
              date: session.date,
              startTime: session.startTime
            },
            to: {
              date: newDate,
              startTime: newStartTime
            },
            message: `Moved ${session.therapistName || 'therapist'}'s session from ${session.startTime} to ${newStartTime}`
          }
        }
      }

      case 'swap': {
        // Swap requires two sessions - not fully implemented yet
        return reply.status(501).send({
          error: 'Session swap is not yet implemented. Please use move to reschedule sessions individually.'
        })
      }

      case 'create': {
        // Create action should redirect to regular session creation
        return reply.status(400).send({
          error: 'To create a new session, use the regular add session endpoint.'
        })
      }

      default:
        return reply.status(400).send({ error: 'Invalid action' })
    }
  })

  // Export schedule as PDF
  fastify.get('/:id/export/pdf', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Fetch schedule with sessions
    const schedule = await scheduleRepository.findByIdWithSessions(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // Fetch organization for branding
    const organization = await organizationRepository.findById(organizationId)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    try {
      // Generate PDF with branding
      const pdfBuffer = await generateSchedulePdf({
        schedule,
        organization
      })

      // Format filename with week date
      const weekStart = new Date(schedule.weekStartDate)
      const dateStr = weekStart.toISOString().split('T')[0]
      const filename = `schedule-${dateStr}.pdf`

      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      reply.header('Content-Length', pdfBuffer.length)

      return reply.send(pdfBuffer)
    } catch (error) {
      console.error('PDF generation failed:', error)
      return reply.status(500).send({ error: 'Failed to generate PDF' })
    }
  })
}
