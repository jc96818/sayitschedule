import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { patientRepository } from '../repositories/patients.js'
import { logAudit } from '../repositories/audit.js'
import { prisma } from '../repositories/base.js'
import { ContactRelationship } from '@prisma/client'

const createPatientSchema = z.object({
  name: z.string().min(1),
  identifier: z.string().nullish(),
  gender: z.enum(['male', 'female', 'other']),
  sessionFrequency: z.number().min(1).max(10),
  preferredTimes: z.array(z.string()).nullish(),
  requiredCertifications: z.array(z.string()).optional(),
  preferredRoomId: z.string().uuid().nullish(),
  requiredRoomCapabilities: z.array(z.string()).optional(),
  notes: z.string().nullish()
})

const updatePatientSchema = createPatientSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export async function patientRoutes(fastify: FastifyInstance) {
  // List all patients
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, search, status, gender } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
      gender?: string
    }

    const result = await patientRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      gender
    })

    return result
  })

  // Get single patient
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const patient = await patientRepository.findById(id, organizationId)
    if (!patient) {
      return reply.status(404).send({ error: 'Patient not found' })
    }

    return { data: patient }
  })

  // Create patient
  fastify.post('/', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPatientSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const patient = await patientRepository.create({
      organizationId,
      name: body.name,
      identifier: body.identifier,
      gender: body.gender,
      sessionFrequency: body.sessionFrequency,
      preferredTimes: body.preferredTimes,
      requiredCertifications: body.requiredCertifications,
      preferredRoomId: body.preferredRoomId,
      requiredRoomCapabilities: body.requiredRoomCapabilities,
      notes: body.notes
    })

    await logAudit(ctx.userId, 'create', 'patient', patient.id, organizationId, body)

    return reply.status(201).send({ data: patient })
  })

  // Update patient
  fastify.put('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updatePatientSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const patient = await patientRepository.update(id, organizationId, body)
    if (!patient) {
      return reply.status(404).send({ error: 'Patient not found' })
    }

    await logAudit(ctx.userId, 'update', 'patient', id, organizationId, body)

    return { data: patient }
  })

  // Delete patient
  fastify.delete('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const deleted = await patientRepository.delete(id, organizationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Patient not found' })
    }

    await logAudit(ctx.userId, 'delete', 'patient', id, organizationId)

    return reply.status(204).send()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // PATIENT CONTACT ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  const createContactSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().nullish(),
    phone: z.string().nullish(),
    relationship: z.nativeEnum(ContactRelationship).default('self'),
    canAccessPortal: z.boolean().default(false),
    isPrimaryContact: z.boolean().default(false),
    emailOptIn: z.boolean().default(true),
    smsOptIn: z.boolean().default(true)
  })

  const updateContactSchema = createContactSchema.partial()

  /**
   * GET /patients/:id/contacts
   * List all contacts for a patient
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/contacts',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      const contacts = await prisma.patientContact.findMany({
        where: { patientId: id },
        orderBy: [
          { isPrimaryContact: 'desc' },
          { name: 'asc' }
        ]
      })

      return { data: contacts }
    }
  )

  /**
   * GET /patients/:id/contacts/:contactId
   * Get a specific contact
   */
  fastify.get<{ Params: { id: string; contactId: string } }>(
    '/:id/contacts/:contactId',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, contactId } = request.params
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      const contact = await prisma.patientContact.findFirst({
        where: {
          id: contactId,
          patientId: id
        }
      })

      if (!contact) {
        return reply.status(404).send({ error: 'Contact not found' })
      }

      return { data: contact }
    }
  )

  /**
   * POST /patients/:id/contacts
   * Add a contact to a patient
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/contacts',
    { preHandler: [requireAdminOrAssistant()] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params
      const body = createContactSchema.parse(request.body)
      const organizationId = request.ctx.organizationId
      const ctx = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      // If this is marked as primary, unmark others
      if (body.isPrimaryContact) {
        await prisma.patientContact.updateMany({
          where: { patientId: id, isPrimaryContact: true },
          data: { isPrimaryContact: false }
        })
      }

      const contact = await prisma.patientContact.create({
        data: {
          patientId: id,
          name: body.name,
          email: body.email,
          phone: body.phone,
          relationship: body.relationship,
          canAccessPortal: body.canAccessPortal,
          isPrimaryContact: body.isPrimaryContact,
          emailOptIn: body.emailOptIn,
          smsOptIn: body.smsOptIn
        }
      })

      await logAudit(ctx.userId, 'create', 'patient_contact', contact.id, organizationId, {
        patientId: id,
        ...body
      })

      return reply.status(201).send({ data: contact })
    }
  )

  /**
   * PUT /patients/:id/contacts/:contactId
   * Update a contact
   */
  fastify.put<{ Params: { id: string; contactId: string } }>(
    '/:id/contacts/:contactId',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, contactId } = request.params
      const body = updateContactSchema.parse(request.body)
      const organizationId = request.ctx.organizationId
      const ctx = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      // Check contact exists
      const existing = await prisma.patientContact.findFirst({
        where: { id: contactId, patientId: id }
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Contact not found' })
      }

      // If marking as primary, unmark others
      if (body.isPrimaryContact) {
        await prisma.patientContact.updateMany({
          where: { patientId: id, isPrimaryContact: true, id: { not: contactId } },
          data: { isPrimaryContact: false }
        })
      }

      const contact = await prisma.patientContact.update({
        where: { id: contactId },
        data: body
      })

      await logAudit(ctx.userId, 'update', 'patient_contact', contactId, organizationId, {
        patientId: id,
        ...body
      })

      return { data: contact }
    }
  )

  /**
   * DELETE /patients/:id/contacts/:contactId
   * Remove a contact
   */
  fastify.delete<{ Params: { id: string; contactId: string } }>(
    '/:id/contacts/:contactId',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, contactId } = request.params
      const organizationId = request.ctx.organizationId
      const ctx = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      // Check contact exists
      const existing = await prisma.patientContact.findFirst({
        where: { id: contactId, patientId: id }
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Contact not found' })
      }

      await prisma.patientContact.delete({
        where: { id: contactId }
      })

      await logAudit(ctx.userId, 'delete', 'patient_contact', contactId, organizationId, {
        patientId: id
      })

      return reply.status(204).send()
    }
  )

  /**
   * POST /patients/:id/contacts/:contactId/grant-portal-access
   * Quick action to enable portal access for a contact
   */
  fastify.post<{ Params: { id: string; contactId: string } }>(
    '/:id/contacts/:contactId/grant-portal-access',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, contactId } = request.params
      const organizationId = request.ctx.organizationId
      const ctx = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      // Check contact exists
      const existing = await prisma.patientContact.findFirst({
        where: { id: contactId, patientId: id }
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Contact not found' })
      }

      // Must have email or phone to access portal
      if (!existing.email && !existing.phone) {
        return reply.status(400).send({
          error: 'Contact must have email or phone to access the portal'
        })
      }

      const contact = await prisma.patientContact.update({
        where: { id: contactId },
        data: { canAccessPortal: true }
      })

      await logAudit(ctx.userId, 'grant_portal_access', 'patient_contact', contactId, organizationId, {
        patientId: id
      })

      return {
        data: contact,
        message: 'Portal access granted. Contact can now log in using their email or phone number.'
      }
    }
  )

  /**
   * POST /patients/:id/contacts/:contactId/revoke-portal-access
   * Quick action to disable portal access for a contact
   */
  fastify.post<{ Params: { id: string; contactId: string } }>(
    '/:id/contacts/:contactId/revoke-portal-access',
    { preHandler: [requireAdminOrAssistant()] },
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, contactId } = request.params
      const organizationId = request.ctx.organizationId
      const ctx = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify patient belongs to organization
      const patient = await patientRepository.findById(id, organizationId)
      if (!patient) {
        return reply.status(404).send({ error: 'Patient not found' })
      }

      // Check contact exists
      const existing = await prisma.patientContact.findFirst({
        where: { id: contactId, patientId: id }
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Contact not found' })
      }

      const contact = await prisma.patientContact.update({
        where: { id: contactId },
        data: { canAccessPortal: false }
      })

      // Also revoke any active sessions
      await prisma.portalSession.updateMany({
        where: { contactId, revokedAt: null },
        data: { revokedAt: new Date() }
      })

      await logAudit(ctx.userId, 'revoke_portal_access', 'patient_contact', contactId, organizationId, {
        patientId: id
      })

      return {
        data: contact,
        message: 'Portal access revoked. Any active sessions have been terminated.'
      }
    }
  )
}
