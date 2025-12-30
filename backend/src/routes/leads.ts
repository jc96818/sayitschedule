import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin } from '../middleware/auth.js'
import { getClientIp, rateLimit } from '../middleware/rateLimit.js'
import { leadRepository } from '../repositories/leads.js'
import { emailService } from '../services/email.js'
import type { LeadStatus } from '@prisma/client'

// Validation schemas
const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address').max(255),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
  message: z.string().max(2000).optional()
})

const updateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'closed']).optional(),
  notes: z.string().max(2000).nullable().optional()
})

const listLeadsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'closed']).optional()
})

export async function leadRoutes(fastify: FastifyInstance) {
  // Rate limiter for lead submission (prevent spam)
  // 5 submissions per IP per 15 minutes
  const leadSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    key: (request) => getClientIp(request)
  })

  // PUBLIC: Submit a lead (no authentication required)
  fastify.post(
    '/submit',
    { preHandler: leadSubmitLimiter },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createLeadSchema.parse(request.body)

        // Check for existing lead with same email
        const existingLead = await leadRepository.findByEmail(body.email)
        if (existingLead) {
          // Don't create duplicate - just return success to avoid information disclosure
          console.log(`[Lead] Duplicate submission for email: ${body.email}`)
          return {
            success: true,
            message: 'Thank you for your interest! We will be in touch soon.'
          }
        }

        // Create the lead
        const lead = await leadRepository.create({
          name: body.name,
          email: body.email,
          company: body.company || null,
          phone: body.phone || null,
          role: body.role || null,
          message: body.message || null,
          source: 'landing_page'
        })

        console.log(`[Lead] New lead created: ${lead.id} - ${lead.name} (${lead.email})`)

        // Send notification email to sales team (async, don't wait)
        emailService.sendLeadNotification(lead).catch((err) => {
          console.error('[Lead] Failed to send notification email:', err)
        })

        return {
          success: true,
          message: 'Thank you for your interest! We will be in touch soon.'
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
          })
        }
        throw error
      }
    }
  )

  // SUPER ADMIN: List all leads
  fastify.get(
    '/',
    { preHandler: requireSuperAdmin() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = listLeadsSchema.parse(request.query)

        const result = await leadRepository.findAll({
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status as LeadStatus | undefined
        })

        return result
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid query parameters' })
        }
        throw error
      }
    }
  )

  // SUPER ADMIN: Get lead by ID
  fastify.get(
    '/:id',
    { preHandler: requireSuperAdmin() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const lead = await leadRepository.findById(id)
      if (!lead) {
        return reply.status(404).send({ error: 'Lead not found' })
      }

      return { data: lead }
    }
  )

  // SUPER ADMIN: Update lead (status, notes)
  fastify.put(
    '/:id',
    { preHandler: requireSuperAdmin() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      try {
        const body = updateLeadSchema.parse(request.body)

        // Check lead exists
        const existingLead = await leadRepository.findById(id)
        if (!existingLead) {
          return reply.status(404).send({ error: 'Lead not found' })
        }

        // Set convertedAt if status is changing to converted
        const updateData: {
          status?: LeadStatus
          notes?: string | null
          convertedAt?: Date | null
        } = { ...body }

        if (body.status === 'converted' && existingLead.status !== 'converted') {
          updateData.convertedAt = new Date()
        } else if (body.status && body.status !== 'converted') {
          updateData.convertedAt = null
        }

        const lead = await leadRepository.update(id, updateData)
        if (!lead) {
          return reply.status(500).send({ error: 'Failed to update lead' })
        }

        return { data: lead }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors
          })
        }
        throw error
      }
    }
  )

  // SUPER ADMIN: Delete lead
  fastify.delete(
    '/:id',
    { preHandler: requireSuperAdmin() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const success = await leadRepository.delete(id)
      if (!success) {
        return reply.status(404).send({ error: 'Lead not found' })
      }

      return { success: true }
    }
  )

  // SUPER ADMIN: Get lead statistics
  fastify.get(
    '/stats/counts',
    { preHandler: requireSuperAdmin() },
    async () => {
      const counts = await leadRepository.countByStatus()
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

      return {
        data: {
          total,
          byStatus: counts
        }
      }
    }
  )
}
