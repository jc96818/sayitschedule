import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin, authenticate } from '../middleware/auth.js'
import { organizationRepository } from '../repositories/organizations.js'
import { logAudit } from '../repositories/audit.js'

const createOrgSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1).regex(/^[a-z0-9-]+$/),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  requiresHipaa: z.boolean().optional(),
  businessTypeTemplateId: z.string().nullable().optional()
})

const updateOrgSchema = createOrgSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
  requiresHipaa: z.boolean().optional()
})

export async function organizationRoutes(fastify: FastifyInstance) {
  // List all organizations (super admin only)
  fastify.get('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest) => {
    const { page, limit, search, status } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
    }

    const result = await organizationRepository.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status
    })

    // Get stats for each organization
    const dataWithStats = await Promise.all(
      result.data.map(async (org) => {
        const stats = await organizationRepository.getStats(org.id)
        return {
          ...org,
          users: stats.users,
          staff: stats.staff,
          patients: stats.patients
        }
      })
    )

    return {
      ...result,
      data: dataWithStats
    }
  })

  // Get single organization
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    // Non-super admins can only view their own organization
    if (ctx.role !== 'super_admin' && ctx.organizationId !== id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const organization = await organizationRepository.findById(id)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    const stats = await organizationRepository.getStats(id)

    return {
      data: {
        ...organization,
        users: stats.users,
        staff: stats.staff,
        patients: stats.patients
      }
    }
  })

  // Create organization (super admin only)
  fastify.post('/', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createOrgSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if subdomain is already taken
    const existing = await organizationRepository.findBySubdomain(body.subdomain)
    if (existing) {
      return reply.status(400).send({ error: 'Subdomain already in use' })
    }

    const organization = await organizationRepository.create(body)

    await logAudit(ctx.userId, 'create', 'organization', organization.id, null, body)

    return reply.status(201).send({ data: organization })
  })

  // Update organization
  fastify.put('/:id', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateOrgSchema.parse(request.body)
    const ctx = request.ctx.user!

    // Check if subdomain is already taken by another org
    if (body.subdomain) {
      const existing = await organizationRepository.findBySubdomain(body.subdomain)
      if (existing && existing.id !== id) {
        return reply.status(400).send({ error: 'Subdomain already in use' })
      }
    }

    const organization = await organizationRepository.update(id, body)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    await logAudit(ctx.userId, 'update', 'organization', id, null, body)

    return { data: organization }
  })

  // Update own organization branding (admin only)
  fastify.put(
    '/current/branding',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.ctx.user!

      // Only admins can update branding
      if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Admin role required' })
      }

      const brandingSchema = z.object({
        name: z.string().min(1).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        logoUrl: z.string().url().nullable().optional(),
        organizationId: z.string().uuid().optional()
      })

      const body = brandingSchema.parse(request.body)

      // Super admins can specify an organization ID, regular admins use their own
      let targetOrgId: string | undefined
      if (ctx.role === 'super_admin' && body.organizationId) {
        targetOrgId = body.organizationId
      } else if (ctx.organizationId) {
        targetOrgId = ctx.organizationId
      }

      if (!targetOrgId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Remove organizationId from the update payload
      const { organizationId: _, ...updateData } = body

      const organization = await organizationRepository.update(targetOrgId, updateData)
      if (!organization) {
        return reply.status(404).send({ error: 'Organization not found' })
      }

      await logAudit(ctx.userId, 'update_branding', 'organization', targetOrgId, null, updateData)

      return { data: organization }
    }
  )

  // Switch organization context (super admin only)
  // Issues a new JWT with the target organization's ID for use on org subdomains
  fastify.post('/:id/switch', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const ctx = request.ctx.user!

    const organization = await organizationRepository.findById(id)
    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' })
    }

    if (organization.status !== 'active') {
      return reply.status(400).send({ error: 'Organization is inactive' })
    }

    // Issue a new JWT with the target organization's ID
    // This allows the superadmin to operate within the org's context on their subdomain
    const token = fastify.jwt.sign({
      userId: ctx.userId,
      email: ctx.email,
      role: ctx.role,
      organizationId: id // Include the target org's ID in the JWT
    })

    await logAudit(ctx.userId, 'switch_context', 'organization', id, null, { targetOrgId: id })

    return { success: true, organization, token }
  })

  // Get transcription settings for current organization
  fastify.get(
    '/current/transcription',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.ctx.user!

      // Get organization ID from JWT or subdomain context (for super_admin on org subdomain)
      const organizationId = ctx.organizationId || (ctx.role === 'super_admin' ? request.ctx.organizationId : null)
      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      const settings = await organizationRepository.getTranscriptionSettings(organizationId)
      if (!settings) {
        return reply.status(404).send({ error: 'Organization not found' })
      }

      return { data: settings }
    }
  )

  // Update transcription settings for current organization (admin only)
  fastify.put(
    '/current/transcription',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.ctx.user!

      // Only admins can update transcription settings
      if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Admin role required' })
      }

      const transcriptionSchema = z.object({
        transcriptionProvider: z.enum(['aws_medical', 'aws_standard']).optional(),
        medicalSpecialty: z.enum(['PRIMARYCARE', 'CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'RADIOLOGY', 'UROLOGY']).optional(),
        organizationId: z.string().optional()
      })

      const parseResult = transcriptionSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid transcription settings', details: parseResult.error.issues })
      }
      const body = parseResult.data

      // Determine target organization:
      // - If super_admin specifies organizationId in request body, use that
      // - Otherwise use JWT organizationId (for regular admins)
      // - For super_admin on org subdomain, use subdomain context
      let targetOrgId: string | undefined
      if (ctx.role === 'super_admin' && body.organizationId) {
        targetOrgId = body.organizationId
      } else if (ctx.organizationId) {
        targetOrgId = ctx.organizationId
      } else if (ctx.role === 'super_admin' && request.ctx.organizationId) {
        targetOrgId = request.ctx.organizationId
      }

      if (!targetOrgId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Remove organizationId from the update payload
      const { organizationId: _, ...updateData } = body

      const organization = await organizationRepository.update(targetOrgId, updateData)
      if (!organization) {
        return reply.status(404).send({ error: 'Organization not found' })
      }

      await logAudit(ctx.userId, 'update_transcription_settings', 'organization', targetOrgId, null, updateData)

      return {
        data: {
          transcriptionProvider: organization.transcriptionProvider,
          medicalSpecialty: organization.medicalSpecialty
        }
      }
    }
  )

  // Get labels for current organization
  fastify.get(
    '/current/labels',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.ctx.user!

      // Get organization ID from JWT or subdomain context (for super_admin on org subdomain)
      const organizationId = ctx.organizationId || (ctx.role === 'super_admin' ? request.ctx.organizationId : null)
      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      const labels = await organizationRepository.getLabels(organizationId)
      if (!labels) {
        return reply.status(404).send({ error: 'Organization not found' })
      }

      return { data: labels }
    }
  )

  // Update labels for current organization (admin only)
  fastify.put(
    '/current/labels',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.ctx.user!

      // Only admins can update labels
      if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Admin role required' })
      }

      const labelsSchema = z.object({
        staffLabel: z.string().min(1).max(50).optional(),
        staffLabelSingular: z.string().min(1).max(50).optional(),
        patientLabel: z.string().min(1).max(50).optional(),
        patientLabelSingular: z.string().min(1).max(50).optional(),
        roomLabel: z.string().min(1).max(50).optional(),
        roomLabelSingular: z.string().min(1).max(50).optional(),
        certificationLabel: z.string().min(1).max(50).optional(),
        equipmentLabel: z.string().min(1).max(50).optional(),
        suggestedCertifications: z.array(z.string().max(100)).max(50).optional(),
        suggestedRoomEquipment: z.array(z.string().max(100)).max(50).optional(),
        organizationId: z.string().optional()
      })

      const parseResult = labelsSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid label data', details: parseResult.error.issues })
      }
      const body = parseResult.data

      // Determine target organization
      let targetOrgId: string | undefined
      if (ctx.role === 'super_admin' && body.organizationId) {
        targetOrgId = body.organizationId
      } else if (ctx.organizationId) {
        targetOrgId = ctx.organizationId
      } else if (ctx.role === 'super_admin' && request.ctx.organizationId) {
        targetOrgId = request.ctx.organizationId
      }

      if (!targetOrgId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Remove organizationId from the update payload
      const { organizationId: _, ...updateData } = body

      const organization = await organizationRepository.updateLabels(targetOrgId, updateData)
      if (!organization) {
        return reply.status(404).send({ error: 'Organization not found' })
      }

      await logAudit(ctx.userId, 'update_labels', 'organization', targetOrgId, null, updateData)

      return {
        data: {
          staffLabel: organization.staffLabel,
          staffLabelSingular: organization.staffLabelSingular,
          patientLabel: organization.patientLabel,
          patientLabelSingular: organization.patientLabelSingular,
          roomLabel: organization.roomLabel,
          roomLabelSingular: organization.roomLabelSingular,
          certificationLabel: organization.certificationLabel,
          equipmentLabel: organization.equipmentLabel,
          suggestedCertifications: organization.suggestedCertifications,
          suggestedRoomEquipment: organization.suggestedRoomEquipment
        }
      }
    }
  )
}
