/**
 * Portal Routes
 *
 * Patient/caregiver-facing portal endpoints.
 * These use a separate auth system from staff endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { portalAuthService } from '../services/portalAuth.js'
import { portalAuthenticate, requirePatientPortalEnabled, getPortalUser } from '../middleware/portalAuth.js'
import { prisma } from '../repositories/base.js'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
import { auditRepository } from '../repositories/audit.js'

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LoginRequestBody {
  identifier: string // email or phone
  channel: 'email' | 'sms'
}

interface VerifyBody {
  token: string
}

interface SessionIdParams {
  sessionId: string
}

interface CancelBody {
  reason?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export async function portalRoutes(fastify: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH ROUTES (Unauthenticated)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /portal/auth/request
   * Request a login code/link
   */
  fastify.post<{ Body: LoginRequestBody }>(
    '/auth/request',
    async (request: FastifyRequest<{ Body: LoginRequestBody }>, reply: FastifyReply) => {
      const { identifier, channel } = request.body

      if (!identifier || !channel) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'identifier and channel are required'
        })
      }

      if (channel !== 'email' && channel !== 'sms') {
        return reply.code(400).send({
          error: 'Invalid channel',
          message: 'channel must be "email" or "sms"'
        })
      }

      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await portalAuthService.requestLogin(
        identifier,
        channel,
        ipAddress,
        userAgent
      )

      // Always return 200 to prevent enumeration attacks
      return reply.send(result)
    }
  )

  /**
   * POST /portal/auth/verify
   * Verify a login code/token and get a session
   */
  fastify.post<{ Body: VerifyBody }>(
    '/auth/verify',
    async (request: FastifyRequest<{ Body: VerifyBody }>, reply: FastifyReply) => {
      const { token } = request.body

      if (!token) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'token is required'
        })
      }

      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await portalAuthService.verifyToken(token, ipAddress, userAgent)

      if (!result.success) {
        return reply.code(401).send({
          error: 'Verification failed',
          message: result.message
        })
      }

      return reply.send({
        message: result.message,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: {
          name: result.contact?.name,
          email: result.contact?.email,
          phone: result.contact?.phone
        }
      })
    }
  )

  /**
   * POST /portal/auth/logout
   * End the current session
   */
  fastify.post(
    '/auth/logout',
    { preHandler: [portalAuthenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization
      const token = authHeader?.substring(7)

      if (token) {
        await portalAuthService.logout(token)
      }

      return reply.send({ message: 'Logged out successfully' })
    }
  )

  /**
   * GET /portal/me
   * Get current user info
   */
  fastify.get(
    '/me',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getPortalUser(request)

      // Get additional patient info
      const contact = await prisma.patientContact.findUnique({
        where: { id: user.contactId },
        include: {
          patient: {
            include: {
              organization: {
                select: { id: true, name: true }
              }
            }
          }
        }
      })

      if (!contact) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'User not found'
        })
      }

      return reply.send({
        contactId: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        relationship: contact.relationship,
        patient: {
          id: contact.patient.id,
          name: contact.patient.name
        },
        organization: contact.patient.organization
      })
    }
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // APPOINTMENT ROUTES (Authenticated)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /portal/appointments
   * Get upcoming appointments for the patient
   */
  fastify.get(
    '/appointments',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getPortalUser(request)

      const sessions = await prisma.session.findMany({
        where: {
          patientId: user.patientId,
          date: { gte: new Date() },
          status: { notIn: ['cancelled', 'late_cancel'] },
          schedule: {
            organizationId: user.organizationId,
            status: 'published'
          }
        },
        include: {
          therapist: {
            select: { id: true, name: true }
          },
          room: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { date: 'asc' },
          { startTime: 'asc' }
        ]
      })

      return reply.send({
        appointments: sessions.map(s => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          therapist: s.therapist,
          room: s.room,
          notes: s.notes,
          confirmedAt: s.confirmedAt
        }))
      })
    }
  )

  /**
   * GET /portal/appointments/:sessionId
   * Get details of a specific appointment
   */
  fastify.get<{ Params: SessionIdParams }>(
    '/appointments/:sessionId',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (
      request: FastifyRequest<{ Params: SessionIdParams }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { sessionId } = request.params

      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          patientId: user.patientId,
          schedule: {
            organizationId: user.organizationId,
            status: 'published'
          }
        },
        include: {
          therapist: {
            select: { id: true, name: true }
          },
          room: {
            select: { id: true, name: true }
          }
        }
      })

      if (!session) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Appointment not found'
        })
      }

      return reply.send({
        id: session.id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        therapist: session.therapist,
        room: session.room,
        notes: session.notes,
        confirmedAt: session.confirmedAt,
        cancelledAt: session.cancelledAt,
        cancellationReason: session.cancellationReason
      })
    }
  )

  /**
   * POST /portal/appointments/:sessionId/confirm
   * Confirm an appointment
   */
  fastify.post<{ Params: SessionIdParams }>(
    '/appointments/:sessionId/confirm',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (
      request: FastifyRequest<{ Params: SessionIdParams }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { sessionId } = request.params

      // Find the session
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          patientId: user.patientId,
          status: 'scheduled',
          schedule: {
            organizationId: user.organizationId,
            status: 'published'
          }
        }
      })

      if (!session) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Appointment not found or cannot be confirmed'
        })
      }

      // Update to confirmed
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          statusUpdatedAt: new Date()
          // Note: confirmedById is for staff users, portal confirmations use the contact
        }
      })

      // Audit log (using system user since portal users aren't in users table)
      await auditRepository.log(
        null,
        'session.confirmed_by_patient',
        'session',
        sessionId,
        user.organizationId,
        { contactId: user.contactId, patientId: user.patientId }
      )

      return reply.send({
        message: 'Appointment confirmed',
        confirmedAt: updated.confirmedAt
      })
    }
  )

  /**
   * POST /portal/appointments/:sessionId/cancel
   * Cancel an appointment
   */
  fastify.post<{ Params: SessionIdParams; Body: CancelBody }>(
    '/appointments/:sessionId/cancel',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (
      request: FastifyRequest<{ Params: SessionIdParams; Body: CancelBody }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { sessionId } = request.params
      const { reason } = request.body || {}

      const contact = await prisma.patientContact.findUnique({
        where: { id: user.contactId },
        select: { relationship: true }
      })
      const cancellationReason: 'patient_request' | 'caregiver_request' = contact?.relationship && contact.relationship !== 'self'
        ? 'caregiver_request'
        : 'patient_request'

      // Find the session
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          patientId: user.patientId,
          status: { in: ['scheduled', 'confirmed'] },
          schedule: {
            organizationId: user.organizationId,
            status: 'published'
          }
        },
        include: {
          schedule: true
        }
      })

      if (!session) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Appointment not found or cannot be cancelled'
        })
      }

      // Check if this is a late cancellation
      const settings = await organizationSettingsRepository.findByOrganizationId(
        user.organizationId
      )

      const sessionDateTime = new Date(session.date)
      const [hours, minutes] = session.startTime.split(':').map(Number)
      sessionDateTime.setHours(hours, minutes, 0, 0)

      const hoursUntilSession =
        (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
      const isLateCancel = hoursUntilSession < settings.lateCancelWindowHours

      // Update status
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: isLateCancel ? 'late_cancel' : 'cancelled',
          cancellationReason,
          cancellationNotes: reason,
          cancelledAt: new Date(),
          statusUpdatedAt: new Date()
        }
      })

      // Audit log
      await auditRepository.log(
        null,
        isLateCancel ? 'session.late_cancelled_by_patient' : 'session.cancelled_by_patient',
        'session',
        sessionId,
        user.organizationId,
        {
          contactId: user.contactId,
          patientId: user.patientId,
          isLateCancel,
          cancellationReason,
          reason
        }
      )

      return reply.send({
        message: isLateCancel
          ? 'Appointment cancelled (late cancellation policy applies)'
          : 'Appointment cancelled',
        status: updated.status,
        isLateCancel
      })
    }
  )

  /**
   * GET /portal/appointments/history
   * Get past appointments
   */
  fastify.get(
    '/appointments/history',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getPortalUser(request)

      const sessions = await prisma.session.findMany({
        where: {
          patientId: user.patientId,
          OR: [
            { date: { lt: new Date() } },
            { status: { in: ['completed', 'cancelled', 'late_cancel', 'no_show'] } }
          ],
          schedule: {
            organizationId: user.organizationId,
            status: 'published'
          }
        },
        include: {
          therapist: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { date: 'desc' },
          { startTime: 'desc' }
        ],
        take: 50 // Limit to recent history
      })

      return reply.send({
        appointments: sessions.map(s => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          therapist: s.therapist
        }))
      })
    }
  )
}

export default portalRoutes
