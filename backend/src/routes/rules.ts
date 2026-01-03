import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { ruleRepository } from '../repositories/rules.js'
import { staffRepository } from '../repositories/staff.js'
import { patientRepository } from '../repositories/patients.js'
import { roomRepository } from '../repositories/rooms.js'
import { logAudit } from '../repositories/audit.js'
import { analyzeRulesWithAI } from '../services/aiProvider.js'
import { evaluateRuleForReview, evaluateRulesForReview } from '../services/ruleReview.js'
import { getEntityBindings, mergeEntityBindings, type EntityBinding } from '../services/ruleBindings.js'

const createRuleSchema = z.object({
  category: z.enum(['gender_pairing', 'session', 'availability', 'specific_pairing', 'certification']),
  description: z.string().min(1),
  ruleLogic: z.record(z.unknown()),
  priority: z.number().optional()
})

const updateRuleSchema = createRuleSchema.partial().extend({
  isActive: z.boolean().optional()
})

const resolveRuleMentionsSchema = z.object({
  resolutions: z.array(z.object({
    mention: z.string().min(1),
    entityType: z.enum(['staff', 'patient']),
    entityId: z.string().min(1)
  })).min(1)
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

  // Evaluate rules for ambiguity and other review blockers
  fastify.get('/review', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const [rules, staff, patients] = await Promise.all([
      ruleRepository.findActiveByOrganization(organizationId),
      staffRepository.findByOrganization(organizationId, 'active'),
      patientRepository.findByOrganization(organizationId, 'active')
    ])

    const results = evaluateRulesForReview(
      rules.map(r => ({
        id: r.id,
        description: r.description,
        ruleLogic: r.ruleLogic as Record<string, unknown>
      })),
      {
        staff: staff.map(s => ({ id: s.id, name: s.name })),
        patients: patients.map(p => ({ id: p.id, name: p.name }))
      }
    )

    const reviewedAt = new Date()
    await Promise.all(
      results.map(r =>
        ruleRepository.update(r.ruleId, organizationId, {
          reviewStatus: r.status,
          reviewIssues: [],
          reviewedAt
        })
      )
    )

    const needsReview = results.filter(r => r.status === 'needs_review')

    return {
      data: {
        status: needsReview.length > 0 ? 'needs_review' : 'ok',
        needsReviewCount: needsReview.length,
        results
      }
    }
  })

  // Resolve ambiguous rule mentions by persisting entityBindings in ruleLogic
  fastify.post('/:id/resolve', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = resolveRuleMentionsSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const rule = await ruleRepository.findById(id, organizationId)
    if (!rule) {
      return reply.status(404).send({ error: 'Rule not found' })
    }

    // Validate target entities exist in this org, and build bindings.
    const bindingsToAdd: EntityBinding[] = []
    for (const r of body.resolutions) {
      if (r.entityType === 'staff') {
        const staff = await staffRepository.findById(r.entityId, organizationId)
        if (!staff) return reply.status(404).send({ error: `Staff ${r.entityId} not found` })
      } else {
        const patient = await patientRepository.findById(r.entityId, organizationId)
        if (!patient) return reply.status(404).send({ error: `Patient ${r.entityId} not found` })
      }
      bindingsToAdd.push({ mention: r.mention, entityType: r.entityType, entityId: r.entityId })
    }

    const currentLogic = (rule.ruleLogic as Record<string, unknown>) || {}
    const existingBindings = getEntityBindings(currentLogic)
    const mergedBindings = mergeEntityBindings(existingBindings, bindingsToAdd)

    const nextLogic: Record<string, unknown> = {
      ...currentLogic,
      entityBindings: mergedBindings
    }

    const [staff, patients] = await Promise.all([
      staffRepository.findByOrganization(organizationId, 'active'),
      patientRepository.findByOrganization(organizationId, 'active')
    ])

    const review = evaluateRuleForReview(
      { id: rule.id, description: rule.description, ruleLogic: nextLogic },
      {
        staff: staff.map(s => ({ id: s.id, name: s.name })),
        patients: patients.map(p => ({ id: p.id, name: p.name }))
      }
    )

    const reviewedAt = new Date()
    const updated = await ruleRepository.update(rule.id, organizationId, {
      ruleLogic: nextLogic,
      reviewStatus: review.status,
      reviewIssues: [],
      reviewedAt
    })

    await logAudit(ctx.userId, 'update', 'rule', rule.id, organizationId, {
      action: 'resolve_rule_mentions',
      resolutions: body.resolutions
    })

    return reply.status(200).send({
      data: updated || rule,
      meta: { review }
    })
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
      createdById: ctx.userId
    })

    const [staff, patients] = await Promise.all([
      staffRepository.findByOrganization(organizationId, 'active'),
      patientRepository.findByOrganization(organizationId, 'active')
    ])

    const review = evaluateRuleForReview(
      { id: rule.id, description: rule.description, ruleLogic: rule.ruleLogic as Record<string, unknown> },
      {
        staff: staff.map(s => ({ id: s.id, name: s.name })),
        patients: patients.map(p => ({ id: p.id, name: p.name }))
      }
    )

    const reviewedAt = new Date()
    const updatedRule = await ruleRepository.update(rule.id, organizationId, {
      reviewStatus: review.status,
      reviewIssues: [],
      reviewedAt
    })

    await logAudit(ctx.userId, 'create', 'rule', rule.id, organizationId, body)

    return reply.status(201).send({
      data: updatedRule || rule,
      meta: {
        review
      }
    })
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

    const [staff, patients] = await Promise.all([
      staffRepository.findByOrganization(organizationId, 'active'),
      patientRepository.findByOrganization(organizationId, 'active')
    ])

    const review = evaluateRuleForReview(
      { id: rule.id, description: rule.description, ruleLogic: rule.ruleLogic as Record<string, unknown> },
      {
        staff: staff.map(s => ({ id: s.id, name: s.name })),
        patients: patients.map(p => ({ id: p.id, name: p.name }))
      }
    )

    const reviewedAt = new Date()
    const updatedRule = await ruleRepository.update(rule.id, organizationId, {
      reviewStatus: review.status,
      reviewIssues: [],
      reviewedAt
    })

    await logAudit(ctx.userId, 'update', 'rule', id, organizationId, body)

    return {
      data: updatedRule || rule,
      meta: {
        review
      }
    }
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

  // Analyze rules with AI
  fastify.post('/analyze', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Fetch active rules
    const activeRules = await ruleRepository.findActiveByOrganization(organizationId)

    if (activeRules.length === 0) {
      return {
        data: {
          conflicts: [],
          duplicates: [],
          enhancements: [],
          summary: {
            totalRulesAnalyzed: 0,
            conflictsFound: 0,
            duplicatesFound: 0,
            enhancementsSuggested: 0
          }
        }
      }
    }

    // Fetch entity names for context
    const [staff, patients, rooms] = await Promise.all([
      staffRepository.findByOrganization(organizationId, 'active'),
      patientRepository.findByOrganization(organizationId, 'active'),
      roomRepository.findByOrganization(organizationId, 'active')
    ])

    const context = {
      staffNames: staff.map(s => s.name),
      patientNames: patients.map(p => p.name),
      roomNames: rooms.map(r => r.name)
    }

    // Format rules for AI analysis
    const rulesForAnalysis = activeRules.map(rule => ({
      id: rule.id,
      category: rule.category,
      description: rule.description,
      ruleLogic: rule.ruleLogic as Record<string, unknown>,
      priority: rule.priority
    }))

    const result = await analyzeRulesWithAI(rulesForAnalysis, context)

    return { data: result }
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
