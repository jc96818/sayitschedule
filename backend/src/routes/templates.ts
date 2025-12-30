import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin } from '../middleware/auth.js'
import { templateRepository } from '../repositories/templates.js'
import { logAudit } from '../repositories/audit.js'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  staffLabel: z.string().min(1).max(50).optional(),
  staffLabelSingular: z.string().min(1).max(50).optional(),
  patientLabel: z.string().min(1).max(50).optional(),
  patientLabelSingular: z.string().min(1).max(50).optional(),
  roomLabel: z.string().min(1).max(50).optional(),
  roomLabelSingular: z.string().min(1).max(50).optional(),
  certificationLabel: z.string().min(1).max(50).optional(),
  equipmentLabel: z.string().min(1).max(50).optional(),
  suggestedCertifications: z.array(z.string().max(100)).max(50).optional(),
  suggestedRoomEquipment: z.array(z.string().max(100)).max(50).optional()
})

const updateTemplateSchema = createTemplateSchema.partial().extend({
  isActive: z.boolean().optional()
})

export async function templateRoutes(fastify: FastifyInstance) {
  // List all templates (super admin only, but could be opened to admins for selection)
  fastify.get('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest) => {
    const { page, limit, search, isActive } = request.query as {
      page?: string
      limit?: string
      search?: string
      isActive?: string
    }

    const result = await templateRepository.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    })

    // Add organization count for each template
    const dataWithCounts = await Promise.all(
      result.data.map(async (template) => {
        const organizationCount = await templateRepository.getOrganizationCount(template.id)
        return {
          ...template,
          organizationCount
        }
      })
    )

    return {
      ...result,
      data: dataWithCounts
    }
  })

  // Get active templates (for org creation dropdown - super admin only)
  fastify.get('/active', { preHandler: requireSuperAdmin() }, async () => {
    const result = await templateRepository.findAll({
      page: 1,
      limit: 100,
      isActive: true
    })

    return { data: result.data }
  })

  // Get single template
  fastify.get('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const template = await templateRepository.findById(id)
    if (!template) {
      return reply.status(404).send({ error: 'Template not found' })
    }

    const organizationCount = await templateRepository.getOrganizationCount(id)

    return {
      data: {
        ...template,
        organizationCount
      }
    }
  })

  // Create template (super admin only)
  fastify.post('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createTemplateSchema.parse(request.body)
      const ctx = request.ctx.user!

      const template = await templateRepository.create(body)

      await logAudit(ctx.userId, 'create', 'business_type_template', template.id, null, body)

      return reply.status(201).send({ data: template })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        })
      }
      throw error
    }
  })

  // Update template (super admin only)
  fastify.put('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const body = updateTemplateSchema.parse(request.body)
      const ctx = request.ctx.user!

      const template = await templateRepository.update(id, body)
      if (!template) {
        return reply.status(404).send({ error: 'Template not found' })
      }

      await logAudit(ctx.userId, 'update', 'business_type_template', id, null, body)

      return { data: template }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        })
      }
      throw error
    }
  })

  // Delete template (soft delete - super admin only)
  fastify.delete('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    // Check if template has organizations using it
    const orgCount = await templateRepository.getOrganizationCount(id)
    if (orgCount > 0) {
      return reply.status(400).send({
        error: 'Cannot delete template with active organizations',
        detail: `This template is used by ${orgCount} organization(s). Please reassign them first.`
      })
    }

    const success = await templateRepository.delete(id)
    if (!success) {
      return reply.status(404).send({ error: 'Template not found' })
    }

    await logAudit(ctx.userId, 'delete', 'business_type_template', id, null, {})

    return { success: true }
  })
}
