import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { ruleRepository } from '../repositories/rules.js'
import { logAudit } from '../repositories/audit.js'

const createRuleSchema = z.object({
  category: z.enum(['gender_pairing', 'session', 'availability', 'specific_pairing', 'certification']),
  description: z.string().min(1),
  ruleLogic: z.record(z.unknown()),
  priority: z.number().optional()
})

const updateRuleSchema = createRuleSchema.partial().extend({
  isActive: z.boolean().optional()
})

export async function ruleRoutes(fastify: FastifyInstance) {
  // List all rules
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, category, isActive } = request.query as {
      page?: string
      limit?: string
      category?: string
      isActive?: string
    }

    const result = await ruleRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    })

    return result
  })

  // Get single rule
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const rule = await ruleRepository.findById(id, organizationId)
    if (!rule) {
      return reply.status(404).send({ error: 'Rule not found' })
    }

    return { data: rule }
  })

  // Create rule
  fastify.post('/', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createRuleSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const rule = await ruleRepository.create({
      organizationId,
      category: body.category,
      description: body.description,
      ruleLogic: body.ruleLogic,
      priority: body.priority,
      createdBy: ctx.userId
    })

    await logAudit(ctx.userId, 'create', 'rule', rule.id, organizationId, body)

    return reply.status(201).send({ data: rule })
  })

  // Update rule
  fastify.put('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateRuleSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const rule = await ruleRepository.update(id, organizationId, body)
    if (!rule) {
      return reply.status(404).send({ error: 'Rule not found' })
    }

    await logAudit(ctx.userId, 'update', 'rule', id, organizationId, body)

    return { data: rule }
  })

  // Toggle rule active status
  fastify.post('/:id/toggle', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const rule = await ruleRepository.toggleActive(id, organizationId)
    if (!rule) {
      return reply.status(404).send({ error: 'Rule not found' })
    }

    await logAudit(ctx.userId, 'toggle', 'rule', id, organizationId, { isActive: rule.isActive })

    return { data: rule }
  })

  // Delete rule
  fastify.delete('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const deleted = await ruleRepository.delete(id, organizationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Rule not found' })
    }

    await logAudit(ctx.userId, 'delete', 'rule', id, organizationId)

    return reply.status(204).send()
  })

  // Parse voice input for rule creation
  fastify.post('/parse-voice', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest) => {
    const { transcript } = request.body as { transcript: string }

    // TODO: Send to AI service for parsing
    // For now, return mock interpretation
    const lowerTranscript = transcript.toLowerCase()

    let category: 'gender_pairing' | 'session' | 'availability' | 'specific_pairing' | 'certification' = 'session'
    let ruleLogic: Record<string, unknown> = {}

    if (lowerTranscript.includes('male') || lowerTranscript.includes('female') || lowerTranscript.includes('gender')) {
      category = 'gender_pairing'
      ruleLogic = {
        type: 'gender_match',
        therapistGender: lowerTranscript.includes('male therapist') ? 'male' : 'female',
        patientGender: lowerTranscript.includes('male patient') ? 'male' : 'any'
      }
    } else if (lowerTranscript.includes('always pair') || lowerTranscript.includes('never pair')) {
      category = 'specific_pairing'
      ruleLogic = {
        type: lowerTranscript.includes('always') ? 'force_pair' : 'prevent_pair'
      }
    } else if (lowerTranscript.includes('holiday') || lowerTranscript.includes('exclude')) {
      category = 'availability'
      ruleLogic = {
        type: 'exclude_dates',
        excludeFederalHolidays: true
      }
    } else if (lowerTranscript.includes('certification') || lowerTranscript.includes('certified')) {
      category = 'certification'
      ruleLogic = {
        type: 'require_certification'
      }
    }

    return {
      data: {
        rule: {
          category,
          description: transcript,
          ruleLogic
        },
        confidence: 0.85
      }
    }
  })
}
