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
import { SessionStatus } from '@prisma/client'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
import { organizationFeaturesRepository } from '../repositories/organizationFeatures.js'
import { auditRepository } from '../repositories/audit.js'
import { availabilityService } from '../services/availability.js'
import { bookingRepository } from '../repositories/booking.js'

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

interface HistoryQuery {
  page?: string | number
  limit?: string | number
}

interface AvailabilityQuery {
  dateFrom: string
  dateTo: string
  staffId?: string
  duration?: string
}

interface CreateHoldBody {
  staffId: string
  roomId?: string
  date: string
  startTime: string
  endTime: string
}

interface BookFromHoldBody {
  holdId: string
  notes?: string
}

interface HoldIdParams {
  holdId: string
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function buildLocalDateTime(dateStr: string, timeStr: string): Date | null {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  date.setHours(h, m, 0, 0)
  return date
}

function buildDateTimeFromDate(date: Date, timeStr: string): Date | null {
  const dt = new Date(date)
  if (isNaN(dt.getTime())) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  dt.setHours(h, m, 0, 0)
  return dt
}

function mapPortalSession(
  session: {
    id: string
    date: Date
    startTime: string
    endTime: string
    status: string
    notes: string | null
    confirmedAt: Date | null
    therapist: { name: string }
    room: { name: string } | null
  },
  options: { portalAllowCancel: boolean; portalRequireConfirmation: boolean }
) {
  const canCancelByStatus = ['pending', 'scheduled', 'confirmed'].includes(session.status)
  const canConfirmByStatus = session.status === 'scheduled' && !session.confirmedAt

  return {
    id: session.id,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    therapistName: session.therapist.name,
    roomName: session.room?.name ?? null,
    status: session.status,
    notes: session.notes,
    confirmedAt: session.confirmedAt,
    canCancel: options.portalAllowCancel && canCancelByStatus,
    canConfirm: options.portalRequireConfirmation && canConfirmByStatus
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export async function portalRoutes(fastify: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC ROUTES (No authentication required)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /portal/branding
   * Get portal branding/customization for the current organization.
   * This is a public endpoint used to display the portal login page with
   * organization-specific branding before the user authenticates.
   */
  fastify.get(
    '/branding',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.code(404).send({
          error: 'Organization not found',
          message: 'Unable to determine organization from request'
        })
      }

      // Get organization basic info
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          subdomain: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          staffLabel: true,
          staffLabelSingular: true,
          patientLabelSingular: true,
          patientLabel: true,
          roomLabel: true,
          roomLabelSingular: true,
          equipmentLabel: true
        }
      })

      if (!organization) {
        return reply.code(404).send({
          error: 'Organization not found'
        })
      }

      // Get portal customization from organization features
      const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)

      // Check if portal is enabled
      if (!features.patientPortalEnabled) {
        return reply.code(403).send({
          error: 'Portal not enabled',
          message: 'The patient portal is not enabled for this organization'
        })
      }

      return reply.send({
        data: {
          // Organization info
          organizationName: organization.name,
          organizationSubdomain: organization.subdomain,

          // Branding (portal-specific overrides fall back to org defaults)
          logoUrl: features.portalLogoUrl || organization.logoUrl,
          primaryColor: features.portalPrimaryColor || organization.primaryColor,
          secondaryColor: features.portalSecondaryColor || organization.secondaryColor,
          backgroundUrl: features.portalBackgroundUrl,
          showOrgName: features.portalShowOrgName,

          // Welcome text
          welcomeTitle: features.portalWelcomeTitle,
          welcomeMessage: features.portalWelcomeMessage,

          // Contact info
          contactEmail: features.portalContactEmail,
          contactPhone: features.portalContactPhone,

          // Footer
          footerText: features.portalFooterText,
          termsUrl: features.portalTermsUrl,
          privacyUrl: features.portalPrivacyUrl,

          // Labels (for display consistency)
          staffLabel: organization.staffLabel,
          staffLabelSingular: organization.staffLabelSingular,
          patientLabel: organization.patientLabel,
          patientLabelSingular: organization.patientLabelSingular,
          roomLabel: organization.roomLabel,
          roomLabelSingular: organization.roomLabelSingular,
          equipmentLabel: organization.equipmentLabel,

          // Feature flags (for UI behavior)
          selfBookingEnabled: features.selfBookingEnabled,
          portalAllowCancel: features.portalAllowCancel,
          portalAllowReschedule: features.portalAllowReschedule,
          portalRequireConfirmation: features.portalRequireConfirmation
        }
      })
    }
  )

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
      const organizationId = request.ctx.organizationId
      if (!organizationId) {
        return reply.code(404).send({
          error: 'Organization not found',
          message: 'Unable to determine organization from request'
        })
      }

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
        userAgent,
        organizationId
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
      const organizationId = request.ctx.organizationId
      if (!organizationId) {
        return reply.code(404).send({
          error: 'Organization not found',
          message: 'Unable to determine organization from request'
        })
      }

      const { token } = request.body

      if (!token) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'token is required'
        })
      }

      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await portalAuthService.verifyToken(token, ipAddress, userAgent, organizationId)

      if (!result.success) {
        return reply.code(401).send({
          error: 'Verification failed',
          message: result.message
        })
      }

      if (!result.contact || !result.sessionToken || !result.expiresAt) {
        return reply.code(500).send({
          error: 'Verification failed',
          message: 'Login succeeded but session could not be created. Please try again.'
        })
      }

      return reply.send({
        message: result.message,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: {
          contactId: result.contact.id,
          patientId: result.contact.patientId,
          organizationId: result.contact.patient.organizationId,
          name: result.contact.name,
          email: result.contact.email,
          phone: result.contact.phone
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
      return reply.send({ data: user })
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
      const features = await organizationFeaturesRepository.findByOrganizationId(user.organizationId)

      const sessions = await prisma.session.findMany({
        where: {
          patientId: user.patientId,
          date: { gte: new Date() },
          status: { notIn: ['cancelled', 'late_cancel'] },
          schedule: {
            organizationId: user.organizationId
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
        data: sessions.map(s => mapPortalSession(
          {
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
            notes: s.notes,
            confirmedAt: s.confirmedAt,
            therapist: { name: s.therapist.name },
            room: s.room ? { name: s.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        ))
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
      const features = await organizationFeaturesRepository.findByOrganizationId(user.organizationId)

      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          patientId: user.patientId,
          schedule: {
            organizationId: user.organizationId
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
        data: mapPortalSession(
          {
            id: session.id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            notes: session.notes,
            confirmedAt: session.confirmedAt,
            therapist: { name: session.therapist.name },
            room: session.room ? { name: session.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        )
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
            organizationId: user.organizationId
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
      await prisma.session.update({
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

      const features = await organizationFeaturesRepository.findByOrganizationId(user.organizationId)
      const sessionWithDetails = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          therapist: { select: { name: true } },
          room: { select: { name: true } }
        }
      })

      return reply.send({
        message: 'Appointment confirmed',
        data: sessionWithDetails ? mapPortalSession(
          {
            id: sessionWithDetails.id,
            date: sessionWithDetails.date,
            startTime: sessionWithDetails.startTime,
            endTime: sessionWithDetails.endTime,
            status: sessionWithDetails.status,
            notes: sessionWithDetails.notes,
            confirmedAt: sessionWithDetails.confirmedAt,
            therapist: { name: sessionWithDetails.therapist.name },
            room: sessionWithDetails.room ? { name: sessionWithDetails.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        ) : null
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
            organizationId: user.organizationId
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
      await prisma.session.update({
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

      const features = await organizationFeaturesRepository.findByOrganizationId(user.organizationId)
      const sessionWithDetails = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          therapist: { select: { name: true } },
          room: { select: { name: true } }
        }
      })

      return reply.send({
        message: isLateCancel
          ? 'Appointment cancelled (late cancellation policy applies)'
          : 'Appointment cancelled',
        meta: { isLateCancel },
        data: sessionWithDetails ? mapPortalSession(
          {
            id: sessionWithDetails.id,
            date: sessionWithDetails.date,
            startTime: sessionWithDetails.startTime,
            endTime: sessionWithDetails.endTime,
            status: sessionWithDetails.status,
            notes: sessionWithDetails.notes,
            confirmedAt: sessionWithDetails.confirmedAt,
            therapist: { name: sessionWithDetails.therapist.name },
            room: sessionWithDetails.room ? { name: sessionWithDetails.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        ) : null
      })
    }
  )

  /**
   * GET /portal/appointments/history
   * Get past appointments
   */
  fastify.get<{ Querystring: HistoryQuery }>(
    '/appointments/history',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply) => {
      const user = getPortalUser(request)
      const page = parsePositiveInt(request.query.page, 1)
      const limit = Math.min(parsePositiveInt(request.query.limit, 10), 50)
      const skip = (page - 1) * limit
      const features = await organizationFeaturesRepository.findByOrganizationId(user.organizationId)

      const where = {
        patientId: user.patientId,
        OR: [
          { date: { lt: new Date() } },
          { status: { in: [SessionStatus.completed, SessionStatus.cancelled, SessionStatus.late_cancel, SessionStatus.no_show] } }
        ],
        schedule: { organizationId: user.organizationId }
      }

      const [total, sessions] = await prisma.$transaction([
        prisma.session.count({ where }),
        prisma.session.findMany({
          where,
          include: {
            therapist: true,
            room: true
          },
          orderBy: [
            { date: 'desc' },
            { startTime: 'desc' }
          ],
          skip,
          take: limit
        })
      ])

      return reply.send({
        data: sessions.map(s => mapPortalSession(
          {
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
            notes: s.notes,
            confirmedAt: s.confirmedAt,
            therapist: { name: s.therapist?.name || 'Unknown' },
            room: s.room ? { name: s.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        )),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      })
    }
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SELF-BOOKING ROUTES (Authenticated, requires self-booking enabled)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Helper middleware to require self-booking enabled
   */
  async function requireSelfBookingEnabled(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = getPortalUser(request)
    const features = await organizationFeaturesRepository.findByOrganizationId(
      user.organizationId
    )

    if (!features.selfBookingEnabled) {
      return reply.code(403).send({
        error: 'Feature Not Available',
        message: 'Self-booking is not enabled for this organization.',
        feature: 'selfBooking'
      })
    }
  }

  /**
   * GET /portal/booking/availability
   * Get available time slots for the patient to book
   */
  fastify.get<{ Querystring: AvailabilityQuery }>(
    '/booking/availability',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled, requireSelfBookingEnabled] },
    async (
      request: FastifyRequest<{ Querystring: AvailabilityQuery }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { dateFrom, dateTo, staffId, duration } = request.query

      if (!dateFrom || !dateTo) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'dateFrom and dateTo are required (YYYY-MM-DD format)'
        })
      }

      // Get self-booking settings for constraints
      const features = await organizationFeaturesRepository.findByOrganizationId(
        user.organizationId
      )
      const settings = await organizationSettingsRepository.findByOrganizationId(
        user.organizationId
      )

      // Validate date constraints
      const fromDate = new Date(dateFrom)
      const toDate = new Date(dateTo)
      const now = new Date()

      // Enforce lead time
      const minBookingDateTime = new Date(now)
      minBookingDateTime.setHours(minBookingDateTime.getHours() + features.selfBookingLeadTimeHours)

      if (fromDate < minBookingDateTime) {
        fromDate.setTime(minBookingDateTime.getTime())
      }

      // Enforce max future days
      const maxBookingDateTime = new Date(now)
      maxBookingDateTime.setDate(maxBookingDateTime.getDate() + features.selfBookingMaxFutureDays)
      maxBookingDateTime.setHours(23, 59, 59, 999)

      if (toDate > maxBookingDateTime) {
        toDate.setTime(maxBookingDateTime.getTime())
      }

      // If the range is now invalid, return empty
      if (fromDate > toDate) {
        return reply.send({
          data: [],
          meta: {
            leadTimeHours: features.selfBookingLeadTimeHours,
            maxFutureDays: features.selfBookingMaxFutureDays,
            earliestDate: minBookingDateTime.toISOString().split('T')[0],
            latestDate: maxBookingDateTime.toISOString().split('T')[0]
          }
        })
      }

      // Get available slots
      const result = await availabilityService.getAvailableSlots({
        organizationId: user.organizationId,
        dateFrom: fromDate,
        dateTo: toDate,
        durationMinutes: duration ? parseInt(duration) : settings.defaultSessionDuration,
        staffId
      })

      const filteredSlots = result.slots.filter((slot) => {
        if (!slot.staffId || !slot.staffName) return false
        const slotStart = buildLocalDateTime(slot.date, slot.startTime)
        if (!slotStart) return false
        return slotStart >= minBookingDateTime
      })

      return reply.send({
        data: filteredSlots.map(slot => ({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          staffId: slot.staffId!,
          staffName: slot.staffName!,
          roomId: null,
          roomName: null
        })),
        meta: {
          leadTimeHours: features.selfBookingLeadTimeHours,
          maxFutureDays: features.selfBookingMaxFutureDays,
          earliestDate: minBookingDateTime.toISOString().split('T')[0],
          latestDate: maxBookingDateTime.toISOString().split('T')[0]
        }
      })
    }
  )

  /**
   * GET /portal/booking/therapists
   * Get list of available therapists for booking
   */
  fastify.get(
    '/booking/therapists',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled, requireSelfBookingEnabled] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getPortalUser(request)

      // Get active staff members who can take appointments
      const staff = await prisma.staff.findMany({
        where: {
          organizationId: user.organizationId,
          status: 'active'
        },
        select: {
          id: true,
          name: true
        },
        orderBy: { name: 'asc' }
      })

      return reply.send({ data: staff })
    }
  )

  /**
   * POST /portal/booking/hold
   * Create a temporary hold on a time slot
   */
  fastify.post<{ Body: CreateHoldBody }>(
    '/booking/hold',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled, requireSelfBookingEnabled] },
    async (
      request: FastifyRequest<{ Body: CreateHoldBody }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { staffId, roomId, date, startTime, endTime } = request.body

      if (!staffId || !date || !startTime || !endTime) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'staffId, date, startTime, and endTime are required'
        })
      }

      const slotStart = buildLocalDateTime(date, startTime)
      if (!slotStart) {
        return reply.code(400).send({
          error: 'Invalid date/time',
          message: 'date must be YYYY-MM-DD and startTime must be HH:mm'
        })
      }

      // Validate against self-booking constraints
      const features = await organizationFeaturesRepository.findByOrganizationId(
        user.organizationId
      )

      const now = new Date()

      // Check lead time
      const minBookingDateTime = new Date(now)
      minBookingDateTime.setHours(minBookingDateTime.getHours() + features.selfBookingLeadTimeHours)

      if (slotStart < minBookingDateTime) {
        return reply.code(400).send({
          error: 'Booking too soon',
          message: `Appointments must be booked at least ${features.selfBookingLeadTimeHours} hours in advance`
        })
      }

      // Check max future days
      const maxBookingDateTime = new Date(now)
      maxBookingDateTime.setDate(maxBookingDateTime.getDate() + features.selfBookingMaxFutureDays)
      maxBookingDateTime.setHours(23, 59, 59, 999)

      if (slotStart > maxBookingDateTime) {
        return reply.code(400).send({
          error: 'Booking too far ahead',
          message: `Appointments can only be booked up to ${features.selfBookingMaxFutureDays} days in advance`
        })
      }

      const staff = await prisma.staff.findFirst({
        where: { id: staffId, organizationId: user.organizationId, status: 'active' },
        select: { id: true, name: true }
      })

      if (!staff) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Staff member not found'
        })
      }

      const room = roomId ? await prisma.room.findFirst({
        where: { id: roomId, organizationId: user.organizationId, status: 'active' },
        select: { id: true, name: true }
      }) : null

      if (roomId && !room) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Room not found'
        })
      }

      // Create the hold
      const result = await bookingRepository.createHold({
        organizationId: user.organizationId,
        staffId,
        roomId,
        date: new Date(date),
        startTime,
        endTime,
        createdByContactId: user.contactId,
        holdDurationMinutes: 10 // Give portal users a bit more time
      })

      if (!result.success) {
        return reply.code(409).send({
          error: 'Hold failed',
          message: result.error
        })
      }

      return reply.code(201).send({
        message: 'Time slot held. Complete your booking before the hold expires.',
        data: {
          id: result.hold!.id,
          staffId: staff.id,
          staffName: staff.name,
          roomId: room?.id ?? null,
          roomName: room?.name ?? null,
          date,
          startTime,
          endTime,
          expiresAt: result.hold!.expiresAt
        }
      })
    }
  )

  /**
   * DELETE /portal/booking/hold/:holdId
   * Release a hold without booking
   */
  fastify.delete<{ Params: HoldIdParams }>(
    '/booking/hold/:holdId',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (
      request: FastifyRequest<{ Params: HoldIdParams }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { holdId } = request.params

      // Verify the hold belongs to this contact
      const hold = await prisma.appointmentHold.findFirst({
        where: {
          id: holdId,
          createdByContactId: user.contactId,
          organizationId: user.organizationId
        }
      })

      if (!hold) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Hold not found'
        })
      }

      const released = await bookingRepository.releaseHold(holdId)

      if (!released) {
        return reply.code(400).send({
          error: 'Release failed',
          message: 'Hold could not be released (may already be released or converted)'
        })
      }

      return reply.send({ success: true })
    }
  )

  /**
   * POST /portal/booking/book
   * Convert a hold into a booked appointment
   */
  fastify.post<{ Body: BookFromHoldBody }>(
    '/booking/book',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled, requireSelfBookingEnabled] },
    async (
      request: FastifyRequest<{ Body: BookFromHoldBody }>,
      reply: FastifyReply
    ) => {
      const user = getPortalUser(request)
      const { holdId, notes } = request.body

      if (!holdId) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'holdId is required'
        })
      }

      // Verify the hold belongs to this contact
      const hold = await prisma.appointmentHold.findFirst({
        where: {
          id: holdId,
          createdByContactId: user.contactId,
          organizationId: user.organizationId,
          expiresAt: { gt: new Date() },
          releasedAt: null,
          convertedToSessionId: null
        }
      })

      if (!hold) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Hold not found or has expired'
        })
      }

      // Check if this needs approval
      const features = await organizationFeaturesRepository.findByOrganizationId(
        user.organizationId
      )

      const slotStart = buildDateTimeFromDate(hold.date, hold.startTime)
      if (!slotStart) {
        return reply.code(400).send({
          error: 'Invalid hold',
          message: 'Hold has invalid date/time'
        })
      }

      const now = new Date()
      const minBookingDateTime = new Date(now)
      minBookingDateTime.setHours(minBookingDateTime.getHours() + features.selfBookingLeadTimeHours)

      if (slotStart < minBookingDateTime) {
        return reply.code(400).send({
          error: 'Booking too soon',
          message: `Appointments must be booked at least ${features.selfBookingLeadTimeHours} hours in advance`
        })
      }

      const maxBookingDateTime = new Date(now)
      maxBookingDateTime.setDate(maxBookingDateTime.getDate() + features.selfBookingMaxFutureDays)
      maxBookingDateTime.setHours(23, 59, 59, 999)

      if (slotStart > maxBookingDateTime) {
        return reply.code(400).send({
          error: 'Booking too far ahead',
          message: `Appointments can only be booked up to ${features.selfBookingMaxFutureDays} days in advance`
        })
      }

      // Book the appointment
      const result = await bookingRepository.bookFromHold({
        holdId,
        organizationId: user.organizationId,
        patientId: user.patientId,
        notes,
        bookedVia: 'portal',
        bookedByContactId: user.contactId
      })

      if (!result.success) {
        return reply.code(409).send({
          error: 'Booking failed',
          message: result.error
        })
      }

      // If approval is required, update the session status
      if (features.selfBookingRequiresApproval) {
        await prisma.session.update({
          where: { id: result.sessionId },
          data: {
            status: 'pending',
            statusUpdatedAt: new Date()
          }
        })
      }

      // Audit log
      await auditRepository.log(
        null,
        'session.booked_by_patient',
        'session',
        result.sessionId!,
        user.organizationId,
        {
          contactId: user.contactId,
          patientId: user.patientId,
          holdId,
          requiresApproval: features.selfBookingRequiresApproval
        }
      )

      // Get the created session details
      const session = await prisma.session.findUnique({
        where: { id: result.sessionId },
        include: {
          therapist: { select: { name: true } },
          room: { select: { name: true } }
        }
      })

      return reply.code(201).send({
        message: features.selfBookingRequiresApproval
          ? 'Appointment requested. You will be notified once it is confirmed.'
          : 'Appointment booked successfully.',
        meta: { requiresApproval: features.selfBookingRequiresApproval },
        data: session ? mapPortalSession(
          {
            id: session.id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            notes: session.notes,
            confirmedAt: session.confirmedAt,
            therapist: { name: session.therapist.name },
            room: session.room ? { name: session.room.name } : null
          },
          {
            portalAllowCancel: features.portalAllowCancel,
            portalRequireConfirmation: features.portalRequireConfirmation
          }
        ) : null
      })
    }
  )

  /**
   * GET /portal/booking/settings
   * Get self-booking configuration for the portal UI
   */
  fastify.get(
    '/booking/settings',
    { preHandler: [portalAuthenticate, requirePatientPortalEnabled] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getPortalUser(request)

      const features = await organizationFeaturesRepository.findByOrganizationId(
        user.organizationId
      )
      const settings = await organizationSettingsRepository.findByOrganizationId(
        user.organizationId
      )

      const now = new Date()
      const minBookingDate = new Date(now)
      minBookingDate.setHours(minBookingDate.getHours() + features.selfBookingLeadTimeHours)

      const maxBookingDate = new Date(now)
      maxBookingDate.setDate(maxBookingDate.getDate() + features.selfBookingMaxFutureDays)

      return reply.send({
        data: {
          selfBookingEnabled: features.selfBookingEnabled,
          leadTimeHours: features.selfBookingLeadTimeHours,
          maxFutureDays: features.selfBookingMaxFutureDays,
          requiresApproval: features.selfBookingRequiresApproval,
          defaultSessionDuration: settings.defaultSessionDuration,
          slotInterval: settings.slotInterval,
          earliestBookingDate: minBookingDate.toISOString().split('T')[0],
          latestBookingDate: maxBookingDate.toISOString().split('T')[0]
        }
      })
    }
  )

}

export default portalRoutes
