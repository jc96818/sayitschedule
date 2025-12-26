import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { patientRepository } from '../repositories/patients.js'
import { logAudit } from '../repositories/audit.js'

const createPatientSchema = z.object({
  name: z.string().min(1),
  identifier: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']),
  sessionFrequency: z.number().min(1).max(10),
  preferredTimes: z.array(z.string()).optional(),
  requiredCertifications: z.array(z.string()).optional(),
  notes: z.string().optional()
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
}
