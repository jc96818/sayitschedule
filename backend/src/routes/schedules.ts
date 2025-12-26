import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { scheduleRepository, sessionRepository } from '../repositories/schedules.js'
import { logAudit } from '../repositories/audit.js'
import { generateSchedule } from '../services/scheduler.js'

const generateScheduleSchema = z.object({
  weekStartDate: z.string()
})

const updateSessionSchema = z.object({
  staffId: z.string().optional(),
  patientId: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
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

    // Check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: 'AI scheduling service not configured. Please set OPENAI_API_KEY.'
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
      date: string
      startTime: string
      endTime: string
      notes?: string
    }

    const session = await sessionRepository.create({
      scheduleId: id,
      therapistId: body.staffId,
      patientId: body.patientId,
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

    const deleted = await sessionRepository.delete(sessionId, scheduleId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    await logAudit(ctx.userId, 'delete', 'session', sessionId, organizationId)

    return reply.status(204).send()
  })

  // Export schedule as PDF
  fastify.get('/:id/export/pdf', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const schedule = await scheduleRepository.findById(id, organizationId)
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' })
    }

    // TODO: Generate PDF using a library like pdfkit or puppeteer
    // For now, return a placeholder
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="schedule-${id}.pdf"`)

    return reply.send(Buffer.from('PDF content placeholder'))
  })
}
