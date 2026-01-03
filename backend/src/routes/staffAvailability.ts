import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import { staffAvailabilityRepository } from '../repositories/staffAvailability.js'
import { staffRepository } from '../repositories/staff.js'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
import { logAudit } from '../repositories/audit.js'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/timezone.js'

// Zod schemas for validation
const createAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  available: z.boolean().default(false),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
  reason: z.string().max(500).optional()
})

const updateAvailabilitySchema = createAvailabilitySchema.partial()

const reviewRequestSchema = z.object({
  notes: z.string().max(500).optional()
})

const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional()
})

export async function staffAvailabilityRoutes(fastify: FastifyInstance) {
  // ============================
  // Staff-specific availability routes (nested under /api/staff/:staffId/availability)
  // ============================

  // GET /api/staff/:staffId/availability - List availability for a staff member
  fastify.get(
    '/:staffId/availability',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId } = request.params as { staffId: string }
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      // Staff users can only view their own availability
      if (user.role === 'staff') {
        const userStaff = await staffRepository.findByUserId(user.userId)
        if (!userStaff || userStaff.id !== staffId) {
          return reply.status(403).send({ error: 'You can only view your own availability' })
        }
      }

      const query = dateRangeQuerySchema.parse(request.query)

      // Fetch organization timezone for date parsing
      const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
      const timezone = orgSettings.timezone || 'America/New_York'

      const result = await staffAvailabilityRepository.findByStaffId(staffId, {
        startDate: query.startDate ? parseLocalDateStart(query.startDate, timezone) : undefined,
        endDate: query.endDate ? parseLocalDateEnd(query.endDate, timezone) : undefined,
        status: query.status
      })

      return { data: result }
    }
  )

  // POST /api/staff/:staffId/availability - Create availability/time-off request
  fastify.post(
    '/:staffId/availability',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId } = request.params as { staffId: string }
      const body = createAvailabilitySchema.parse(request.body)
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      // Determine if this is a staff user creating for themselves
      const isStaffRole = user.role === 'staff'
      const isOwnRequest = isStaffRole && staffMember.userId === user.userId

      // Staff users can only create requests for themselves
      if (isStaffRole && !isOwnRequest) {
        return reply.status(403).send({ error: 'You can only create time-off requests for yourself' })
      }

      // Staff creates pending requests; admin/assistant creates approved records directly
      const status = isStaffRole ? 'pending' : 'approved'

      // Fetch organization timezone for date parsing
      const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
      const timezone = orgSettings.timezone || 'America/New_York'

      const availability = await staffAvailabilityRepository.create({
        staffId,
        date: parseLocalDateStart(body.date, timezone),
        available: body.available,
        startTime: body.startTime,
        endTime: body.endTime,
        reason: body.reason,
        status,
        requestedAt: isStaffRole ? new Date() : undefined,
        requestedById: isStaffRole ? user.userId : undefined
      })

      await logAudit(user.userId, 'create', 'staff_availability', availability.id, organizationId, {
        ...body,
        status
      })

      return reply.status(201).send({ data: availability })
    }
  )

  // PUT /api/staff/:staffId/availability/:id - Update an availability record
  fastify.put(
    '/:staffId/availability/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId, id } = request.params as { staffId: string; id: string }
      const body = updateAvailabilitySchema.parse(request.body)
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      // Get existing record
      const existing = await staffAvailabilityRepository.findById(id, staffId)
      if (!existing) {
        return reply.status(404).send({ error: 'Availability record not found' })
      }

      // Staff users can only edit their own pending requests
      if (user.role === 'staff') {
        if (staffMember.userId !== user.userId) {
          return reply.status(403).send({ error: 'You can only edit your own requests' })
        }
        if (existing.status !== 'pending') {
          return reply.status(403).send({ error: 'You can only edit pending requests' })
        }
      }

      // Fetch organization timezone for date parsing
      const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
      const timezone = orgSettings.timezone || 'America/New_York'

      const updated = await staffAvailabilityRepository.update(id, staffId, {
        date: body.date ? parseLocalDateStart(body.date, timezone) : undefined,
        available: body.available,
        startTime: body.startTime,
        endTime: body.endTime,
        reason: body.reason
      })

      if (!updated) {
        return reply.status(404).send({ error: 'Availability record not found' })
      }

      await logAudit(user.userId, 'update', 'staff_availability', id, organizationId, body)

      return { data: updated }
    }
  )

  // DELETE /api/staff/:staffId/availability/:id - Delete an availability record
  fastify.delete(
    '/:staffId/availability/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId, id } = request.params as { staffId: string; id: string }
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      // Get existing record
      const existing = await staffAvailabilityRepository.findById(id, staffId)
      if (!existing) {
        return reply.status(404).send({ error: 'Availability record not found' })
      }

      // Staff users can only delete their own pending requests
      if (user.role === 'staff') {
        if (staffMember.userId !== user.userId) {
          return reply.status(403).send({ error: 'You can only delete your own requests' })
        }
        if (existing.status !== 'pending') {
          return reply.status(403).send({ error: 'You can only delete pending requests' })
        }
      }

      const deleted = await staffAvailabilityRepository.delete(id, staffId)
      if (!deleted) {
        return reply.status(404).send({ error: 'Availability record not found' })
      }

      await logAudit(user.userId, 'delete', 'staff_availability', id, organizationId)

      return reply.status(204).send()
    }
  )

  // POST /api/staff/:staffId/availability/:id/approve - Approve a pending request
  fastify.post(
    '/:staffId/availability/:id/approve',
    { preHandler: requireAdminOrAssistant() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId, id } = request.params as { staffId: string; id: string }
      const body = reviewRequestSchema.parse(request.body || {})
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      const approved = await staffAvailabilityRepository.approve(
        id,
        organizationId,
        user.userId,
        body.notes
      )

      if (!approved) {
        return reply.status(404).send({ error: 'Pending request not found' })
      }

      await logAudit(user.userId, 'approve', 'staff_availability', id, organizationId, {
        notes: body.notes
      })

      return { data: approved }
    }
  )

  // POST /api/staff/:staffId/availability/:id/reject - Reject a pending request
  fastify.post(
    '/:staffId/availability/:id/reject',
    { preHandler: requireAdminOrAssistant() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { staffId, id } = request.params as { staffId: string; id: string }
      const body = reviewRequestSchema.parse(request.body || {})
      const organizationId = request.ctx.organizationId
      const user = request.ctx.user!

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      // Verify staff member belongs to this organization
      const staffMember = await staffRepository.findById(staffId, organizationId)
      if (!staffMember) {
        return reply.status(404).send({ error: 'Staff member not found' })
      }

      const rejected = await staffAvailabilityRepository.reject(
        id,
        organizationId,
        user.userId,
        body.notes
      )

      if (!rejected) {
        return reply.status(404).send({ error: 'Pending request not found' })
      }

      await logAudit(user.userId, 'reject', 'staff_availability', id, organizationId, {
        notes: body.notes
      })

      return { data: rejected }
    }
  )
}

// Separate routes for organization-wide availability management
export async function availabilityAdminRoutes(fastify: FastifyInstance) {
  // GET /api/availability/pending - List all pending requests for the organization
  fastify.get(
    '/pending',
    { preHandler: requireAdminOrAssistant() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      const { page, limit } = request.query as { page?: string; limit?: string }

      const result = await staffAvailabilityRepository.findPendingByOrganization(organizationId, {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20
      })

      return result
    }
  )

  // GET /api/availability/count - Get count of pending requests
  fastify.get(
    '/count',
    { preHandler: requireAdminOrAssistant() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      const count = await staffAvailabilityRepository.countPending(organizationId)

      return { data: { pendingCount: count } }
    }
  )

  // GET /api/availability - List all availability for the organization (admin view)
  fastify.get(
    '/',
    { preHandler: requireAdminOrAssistant() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      const query = dateRangeQuerySchema.parse(request.query)

      // Fetch organization timezone for date parsing
      const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
      const timezone = orgSettings.timezone || 'America/New_York'

      const result = await staffAvailabilityRepository.findByOrganization(organizationId, {
        startDate: query.startDate ? parseLocalDateStart(query.startDate, timezone) : undefined,
        endDate: query.endDate ? parseLocalDateEnd(query.endDate, timezone) : undefined,
        status: query.status
      })

      return { data: result }
    }
  )
}
