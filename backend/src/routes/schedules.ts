import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { scheduleRepository, sessionRepository } from '../repositories/schedules.js'
import { organizationRepository } from '../repositories/organizations.js'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
import { logAudit } from '../repositories/audit.js'
import { generateSchedule, validateAndRegenerateCopiedSchedule, type SessionModification } from '../services/scheduler.js'
import { generateSchedulePdf } from '../services/pdfGenerator.js'
import {
  findMatchingSessions,
  checkForConflicts,
  calculateNewEndTime,
  getDateForDayOfWeek
} from '../services/sessionLookup.js'
import { validateSessionEntities } from '../services/sessionValidation.js'
import { isProviderConfigured, getActiveProvider } from '../services/aiProvider.js'
import { RuleReviewRequiredError } from '../services/ruleReview.js'
import { parseLocalDateStart, formatLocalDate } from '../utils/timezone.js'

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
  status: z.enum(['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'late_cancel', 'no_show']).optional(),
  notes: z.string().optional(),
  cancellationReason: z.enum(['patient_request', 'caregiver_request', 'therapist_unavailable', 'weather', 'illness', 'scheduling_conflict', 'rescheduled', 'other']).nullish(),
  cancellationNotes: z.string().nullish()
})

const voiceModifySchema = z.object({
  action: z.enum(['move', 'cancel', 'swap', 'create', 'reassign_therapist', 'reassign_room']),
  therapistName: z.string().optional(),
  patientName: z.string().optional(),
  currentDate: z.string().optional(),
  currentDayOfWeek: z.string().optional(),
  currentStartTime: z.string().optional(),
  newDate: z.string().optional(),
  newDayOfWeek: z.string().optional(),
  newStartTime: z.string().optional(),
  newEndTime: z.string().optional(),
  newTherapistName: z.string().optional(),  // For reassign_therapist action
  newRoomName: z.string().optional(),        // For reassign_room action
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

  // Get schedule summaries for a date range (for calendar view)
  fastify.get('/summaries', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string }

    if (!startDate || !endDate) {
      return reply.status(400).send({ error: 'startDate and endDate query parameters required' })
    }

    // Fetch organization settings to get timezone
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    // Parse the date strings in the organization's timezone
    const parsedStartDate = parseLocalDateStart(startDate, timezone)
    const parsedEndDate = parseLocalDateStart(endDate, timezone)

    const summaries = await scheduleRepository.findSummariesByDateRange(
      organizationId,
      parsedStartDate,
      parsedEndDate
    )

    return { data: summaries }
  })

  // Get schedule by week start date
  fastify.get('/by-week', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { weekStartDate } = request.query as { weekStartDate?: string }

    if (!weekStartDate) {
      return reply.status(400).send({ error: 'weekStartDate query parameter required' })
    }

    // Fetch organization settings to get timezone
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    // Parse the date string in the organization's timezone
    const parsedDate = parseLocalDateStart(weekStartDate, timezone)

    const schedule = await scheduleRepository.findByWeekStart(organizationId, parsedDate)
    if (!schedule) {
      return reply.status(404).send({ error: 'No schedule found for this week' })
    }

    // Get sessions for this schedule
    const sessions = await sessionRepository.findBySchedule(schedule.id)

    return {
      data: {
        ...schedule,
        sessions
      }
    }
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

    // Fetch organization settings to get timezone
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    // Parse the date string in the organization's timezone
    const weekStartDate = parseLocalDateStart(body.weekStartDate, timezone)

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
        if (error instanceof RuleReviewRequiredError) {
          return reply.status(409).send({
            error: 'Rules require review before schedule generation.',
            data: {
              rulesNeedingReview: error.results
            }
          })
        }
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

  // Create draft copy of a published schedule with rule validation
  fastify.post('/:id/create-draft', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Get the source schedule with sessions to validate
    const sourceSchedule = await scheduleRepository.findByIdWithSessions(id, organizationId)
    if (!sourceSchedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    if (sourceSchedule.status !== 'published') {
      return reply.status(400).send({
        error: 'Only published schedules can be copied to a new draft. This schedule is already a draft.'
      })
    }

    try {
      // Validate and regenerate sessions against current rules
      console.log(`Validating ${sourceSchedule.sessions.length} sessions against current rules...`)
      const validationResult = await validateAndRegenerateCopiedSchedule(
        organizationId,
        sourceSchedule
      )

      // Set schedule ID on validated sessions
      const sessionsWithScheduleId = validationResult.validSessions.map(s => ({
        ...s,
        scheduleId: '' // Will be set by repository
      }))

      // Create the draft copy with validated sessions
      const newSchedule = await scheduleRepository.createDraftCopyWithValidation(
        id,
        organizationId,
        ctx.userId,
        sessionsWithScheduleId
      )

      if (!newSchedule) {
        return reply.status(500).send({ error: 'Failed to create draft copy' })
      }

      // Prepare modifications summary for response
      const modifications: {
        regenerated: SessionModification[]
        removed: SessionModification[]
        warnings: string[]
      } = {
        regenerated: validationResult.modifications.regenerated,
        removed: validationResult.modifications.removed,
        warnings: validationResult.warnings
      }

      const hasModifications = modifications.regenerated.length > 0 || modifications.removed.length > 0

      await logAudit(ctx.userId, 'create', 'schedule', newSchedule.id, organizationId, {
        action: 'create_draft_copy_with_validation',
        sourceScheduleId: id,
        sourceVersion: sourceSchedule.version,
        newVersion: newSchedule.version,
        originalSessionCount: sourceSchedule.sessions.length,
        validatedSessionCount: newSchedule.sessions.length,
        sessionsRegenerated: modifications.regenerated.length,
        sessionsRemoved: modifications.removed.length
      })

      const message = hasModifications
        ? `Created draft copy (version ${newSchedule.version}) with ${modifications.regenerated.length} session(s) rescheduled and ${modifications.removed.length} session(s) removed due to rule violations.`
        : `Created draft copy (version ${newSchedule.version}) from published schedule. All sessions passed validation.`

      return reply.status(201).send({
        data: newSchedule,
        meta: {
          message,
          sourceScheduleId: id,
          modifications: hasModifications ? modifications : undefined
        }
      })
    } catch (error) {
      console.error('Error creating draft copy with validation:', error)

      // Fall back to simple copy if validation fails
      const newSchedule = await scheduleRepository.createDraftCopy(id, organizationId, ctx.userId)
      if (!newSchedule) {
        return reply.status(500).send({ error: 'Failed to create draft copy' })
      }

      await logAudit(ctx.userId, 'create', 'schedule', newSchedule.id, organizationId, {
        action: 'create_draft_copy_fallback',
        sourceScheduleId: id,
        sourceVersion: sourceSchedule.version,
        newVersion: newSchedule.version,
        fallbackReason: error instanceof Error ? error.message : 'Unknown error'
      })

      return reply.status(201).send({
        data: newSchedule,
        meta: {
          message: `Created draft copy (version ${newSchedule.version}) from published schedule. Validation was skipped due to an error.`,
          sourceScheduleId: id,
          modifications: {
            regenerated: [],
            removed: [],
            warnings: ['Rule validation was skipped due to an error. Please review the schedule manually.']
          }
        }
      })
    }
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

    // Fetch organization settings to get timezone for date parsing
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    const session = await sessionRepository.create({
      scheduleId: id,
      therapistId: body.staffId,
      patientId: body.patientId,
      roomId: body.roomId || null,
      date: parseLocalDateStart(body.date, timezone),
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

    // Fetch organization settings to get timezone for date parsing
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    // Build update data, adding cancellation metadata if status is being set to cancelled/late_cancel
    const updateData: Record<string, unknown> = {
      ...body,
      date: body.date ? parseLocalDateStart(body.date, timezone) : undefined
    }

    // Set cancellation timestamp and user when cancelling
    if (body.status === 'cancelled' || body.status === 'late_cancel') {
      updateData.cancelledAt = new Date()
      updateData.cancelledById = ctx.userId
    }

    const session = await sessionRepository.update(sessionId, scheduleId, updateData)

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

    // Fetch organization settings to get timezone
    const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = orgSettings.timezone || 'America/New_York'

    // For create action, skip session lookup (we're creating new, not modifying existing)
    // For other actions, find matching session(s) based on the voice command criteria
    let matchingResults: Awaited<ReturnType<typeof findMatchingSessions>> = []

    if (body.action !== 'create') {
      matchingResults = await findMatchingSessions({
        scheduleId: id,
        therapistName: body.therapistName,
        patientName: body.patientName,
        dayOfWeek: body.currentDayOfWeek,
        startTime: body.currentStartTime,
        timezone
      })

      if (matchingResults.length === 0) {
        const searchCriteria = []
        if (body.therapistName) searchCriteria.push(`therapist "${body.therapistName}"`)
        if (body.patientName) searchCriteria.push(`patient "${body.patientName}"`)
        if (body.currentDayOfWeek) searchCriteria.push(`on ${body.currentDayOfWeek}`)
        if (body.currentStartTime) searchCriteria.push(`at ${body.currentStartTime}`)

        return reply.status(404).send({
          error: `Could not find a session matching: ${searchCriteria.join(', ')}`
        })
      }
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
          newDate = getDateForDayOfWeek(schedule.weekStartDate, body.newDayOfWeek, timezone)
        } else if (body.newDate) {
          newDate = parseLocalDateStart(body.newDate, timezone)
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
          excludeSessionId: session.id,
          timezone
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
        // Create a new session via voice command
        if (!body.therapistName && !body.patientName) {
          return reply.status(400).send({
            error: 'To create a session, please specify the therapist or patient name.'
          })
        }

        if (!body.newStartTime) {
          return reply.status(400).send({
            error: 'Please specify the time for the new session.'
          })
        }

        // Look up the therapist by name
        let therapist = null
        if (body.therapistName) {
          const { staffRepository } = await import('../repositories/staff.js')
          const staffResult = await staffRepository.findAll(organizationId, {
            search: body.therapistName,
            page: 1,
            limit: 10
          })
          const matchingStaff = staffResult.data.filter(s =>
            s.name.toLowerCase().includes(body.therapistName!.toLowerCase())
          )
          if (matchingStaff.length === 0) {
            return reply.status(404).send({
              error: `Could not find ${body.therapistName} in the staff directory.`
            })
          }
          if (matchingStaff.length > 1) {
            return reply.status(400).send({
              error: `Multiple staff members match "${body.therapistName}". Please be more specific.`
            })
          }
          therapist = matchingStaff[0]
        }

        // Look up the patient by name
        let patient = null
        if (body.patientName) {
          const { patientRepository } = await import('../repositories/patients.js')
          const patientResult = await patientRepository.findAll(organizationId, {
            search: body.patientName,
            page: 1,
            limit: 10
          })
          const matchingPatients = patientResult.data.filter(p =>
            p.name.toLowerCase().includes(body.patientName!.toLowerCase())
          )
          if (matchingPatients.length === 0) {
            return reply.status(404).send({
              error: `Could not find patient "${body.patientName}".`
            })
          }
          if (matchingPatients.length > 1) {
            return reply.status(400).send({
              error: `Multiple patients match "${body.patientName}". Please be more specific.`
            })
          }
          patient = matchingPatients[0]
        }

        // We need both a therapist and patient to create a session
        if (!therapist || !patient) {
          return reply.status(400).send({
            error: 'Please specify both the therapist and patient for the new session.'
          })
        }

        // Calculate the date
        let sessionDate: Date
        if (body.newDayOfWeek) {
          sessionDate = getDateForDayOfWeek(schedule.weekStartDate, body.newDayOfWeek, timezone)
        } else if (body.newDate) {
          sessionDate = parseLocalDateStart(body.newDate, timezone)
        } else {
          // Default to the first day of the schedule week
          sessionDate = new Date(schedule.weekStartDate)
        }

        const startTime = body.newStartTime
        const endTime = body.newEndTime || calculateNewEndTime(startTime)

        // Check for conflicts at the requested time
        const conflicts = await checkForConflicts({
          scheduleId: id,
          therapistId: therapist.id,
          patientId: patient.id,
          date: sessionDate,
          startTime: startTime,
          endTime: endTime,
          timezone
        })

        if (conflicts.length > 0) {
          const conflict = conflicts[0]
          return reply.status(409).send({
            error: `Time conflict: ${conflict.therapistName || 'Therapist'} already has a session with ${conflict.patientName || 'patient'} at ${conflict.startTime}`,
            conflictWith: conflict
          })
        }

        // Create the session
        const newSession = await sessionRepository.create({
          scheduleId: id,
          therapistId: therapist.id,
          patientId: patient.id,
          date: sessionDate,
          startTime: startTime,
          endTime: endTime,
          notes: body.notes
        })

        await logAudit(ctx.userId, 'create', 'session', newSession.id, organizationId, {
          action: 'voice_create',
          therapistName: therapist.name,
          patientName: patient.name,
          date: sessionDate,
          startTime: startTime
        })

        return {
          data: {
            action: 'created',
            session: {
              ...newSession,
              therapistName: therapist.name,
              patientName: patient.name
            },
            message: `Created session for ${patient.name} with ${therapist.name} at ${startTime}`
          }
        }
      }

      case 'reassign_therapist': {
        // Reassign session to a different therapist
        const session = matchingResults[0].session

        if (!body.newTherapistName) {
          return reply.status(400).send({
            error: 'Please specify the new therapist name.'
          })
        }

        // Look up the new therapist by name
        const { staffRepository } = await import('../repositories/staff.js')
        const staffResult = await staffRepository.findAll(organizationId, {
          search: body.newTherapistName,
          page: 1,
          limit: 10
        })
        const matchingStaff = staffResult.data.filter(s =>
          s.name.toLowerCase().includes(body.newTherapistName!.toLowerCase())
        )

        if (matchingStaff.length === 0) {
          return reply.status(404).send({
            error: `Could not find staff member "${body.newTherapistName}".`
          })
        }
        if (matchingStaff.length > 1) {
          return reply.status(400).send({
            error: `Multiple staff members match "${body.newTherapistName}". Please be more specific.`
          })
        }

        const newTherapist = matchingStaff[0]

        // Check for conflicts with the new therapist
        const conflicts = await checkForConflicts({
          scheduleId: id,
          therapistId: newTherapist.id,
          patientId: session.patientId,
          date: new Date(session.date),
          startTime: session.startTime,
          endTime: session.endTime,
          excludeSessionId: session.id,
          timezone
        })

        if (conflicts.length > 0) {
          const conflict = conflicts[0]
          return reply.status(409).send({
            error: `Time conflict: ${newTherapist.name} already has a session with ${conflict.patientName || 'patient'} at ${conflict.startTime}`,
            conflictWith: conflict
          })
        }

        // Update the session with new therapist
        const updatedSession = await sessionRepository.update(session.id, id, {
          therapistId: newTherapist.id
        })

        if (!updatedSession) {
          return reply.status(500).send({ error: 'Failed to reassign therapist' })
        }

        await logAudit(ctx.userId, 'update', 'session', session.id, organizationId, {
          action: 'voice_reassign_therapist',
          from: { therapistId: session.therapistId, therapistName: session.therapistName },
          to: { therapistId: newTherapist.id, therapistName: newTherapist.name }
        })

        return {
          data: {
            action: 'reassigned_therapist',
            session: {
              ...updatedSession,
              therapistName: newTherapist.name,
              patientName: session.patientName,
              roomName: session.roomName
            },
            from: { therapistName: session.therapistName },
            to: { therapistName: newTherapist.name },
            message: `Reassigned session from ${session.therapistName || 'previous therapist'} to ${newTherapist.name}`
          }
        }
      }

      case 'reassign_room': {
        // Reassign session to a different room
        const session = matchingResults[0].session

        if (!body.newRoomName) {
          return reply.status(400).send({
            error: 'Please specify the new room name.'
          })
        }

        // Look up the new room by name
        const { roomRepository } = await import('../repositories/rooms.js')
        const roomResult = await roomRepository.findAll(organizationId, {
          search: body.newRoomName,
          page: 1,
          limit: 10
        })
        const matchingRooms = roomResult.data.filter(r =>
          r.name.toLowerCase().includes(body.newRoomName!.toLowerCase())
        )

        if (matchingRooms.length === 0) {
          return reply.status(404).send({
            error: `Could not find room "${body.newRoomName}".`
          })
        }
        if (matchingRooms.length > 1) {
          return reply.status(400).send({
            error: `Multiple rooms match "${body.newRoomName}". Please be more specific.`
          })
        }

        const newRoom = matchingRooms[0]

        // Update the session with new room
        const updatedSession = await sessionRepository.update(session.id, id, {
          roomId: newRoom.id
        })

        if (!updatedSession) {
          return reply.status(500).send({ error: 'Failed to reassign room' })
        }

        await logAudit(ctx.userId, 'update', 'session', session.id, organizationId, {
          action: 'voice_reassign_room',
          from: { roomId: session.roomId, roomName: session.roomName },
          to: { roomId: newRoom.id, roomName: newRoom.name }
        })

        return {
          data: {
            action: 'reassigned_room',
            session: {
              ...updatedSession,
              therapistName: session.therapistName,
              patientName: session.patientName,
              roomName: newRoom.name
            },
            from: { roomName: session.roomName },
            to: { roomName: newRoom.name },
            message: `Moved session to ${newRoom.name}`
          }
        }
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
      // Get timezone for proper date display
      const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
      const timezone = orgSettings.timezone || 'America/New_York'

      // Generate PDF with branding and timezone
      const pdfBuffer = await generateSchedulePdf({
        schedule,
        organization,
        timezone
      })

      // Format filename with week date
      const weekStart = new Date(schedule.weekStartDate)
      const dateStr = formatLocalDate(weekStart, timezone)
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
