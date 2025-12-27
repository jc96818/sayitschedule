import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { roomRepository } from '../repositories/rooms.js'
import { logAudit } from '../repositories/audit.js'

const createRoomSchema = z.object({
  name: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  description: z.string().optional()
})

const updateRoomSchema = createRoomSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export async function roomRoutes(fastify: FastifyInstance) {
  // List all rooms
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const { page, limit, search, status } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
    }

    const result = await roomRepository.findAll(organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status
    })

    return result
  })

  // Get single room
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const room = await roomRepository.findById(id, organizationId)
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' })
    }

    return { data: room }
  })

  // Create room
  fastify.post('/', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createRoomSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const room = await roomRepository.create({
      organizationId,
      name: body.name,
      capabilities: body.capabilities,
      description: body.description
    })

    await logAudit(ctx.userId, 'create', 'room', room.id, organizationId, body)

    return reply.status(201).send({ data: room })
  })

  // Update room
  fastify.put('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = updateRoomSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const room = await roomRepository.update(id, organizationId, body)

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' })
    }

    await logAudit(ctx.userId, 'update', 'room', id, organizationId, body)

    return { data: room }
  })

  // Delete room
  fastify.delete('/:id', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const deleted = await roomRepository.delete(id, organizationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Room not found' })
    }

    await logAudit(ctx.userId, 'delete', 'room', id, organizationId)

    return reply.status(204).send()
  })
}
