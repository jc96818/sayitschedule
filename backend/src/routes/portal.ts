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
          patientLabelSingular: true,
          patientLabel: true
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
          patientLabel: organization.patientLabel,
          patientLabelSingular: organization.patientLabelSingular,

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
      const minBookingDate = new Date(now)
      minBookingDate.setHours(minBookingDate.getHours() + features.selfBookingLeadTimeHours)

      if (fromDate < minBookingDate) {
        fromDate.setTime(minBookingDate.getTime())
      }

      // Enforce max future days
      const maxBookingDate = new Date(now)
      maxBookingDate.setDate(maxBookingDate.getDate() + features.selfBookingMaxFutureDays)

      if (toDate > maxBookingDate) {
        toDate.setTime(maxBookingDate.getTime())
      }

      // If the range is now invalid, return empty
      if (fromDate > toDate) {
        return reply.send({
          slots: [],
          constraints: {
            leadTimeHours: features.selfBookingLeadTimeHours,
            maxFutureDays: features.selfBookingMaxFutureDays,
            earliestDate: minBookingDate.toISOString().split('T')[0],
            latestDate: maxBookingDate.toISOString().split('T')[0]
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

      return reply.send({
        slots: result.slots,
        constraints: {
          leadTimeHours: features.selfBookingLeadTimeHours,
          maxFutureDays: features.selfBookingMaxFutureDays,
          earliestDate: minBookingDate.toISOString().split('T')[0],
          latestDate: maxBookingDate.toISOString().split('T')[0]
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

      return reply.send({ therapists: staff })
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

      // Validate against self-booking constraints
      const features = await organizationFeaturesRepository.findByOrganizationId(
        user.organizationId
      )

      const bookingDate = new Date(date)
      const now = new Date()

      // Check lead time
      const minBookingDate = new Date(now)
      minBookingDate.setHours(minBookingDate.getHours() + features.selfBookingLeadTimeHours)
      minBookingDate.setHours(0, 0, 0, 0)
      bookingDate.setHours(0, 0, 0, 0)

      if (bookingDate < minBookingDate) {
        return reply.code(400).send({
          error: 'Booking too soon',
          message: `Appointments must be booked at least ${features.selfBookingLeadTimeHours} hours in advance`
        })
      }

      // Check max future days
      const maxBookingDate = new Date(now)
      maxBookingDate.setDate(maxBookingDate.getDate() + features.selfBookingMaxFutureDays)

      if (bookingDate > maxBookingDate) {
        return reply.code(400).send({
          error: 'Booking too far ahead',
          message: `Appointments can only be booked up to ${features.selfBookingMaxFutureDays} days in advance`
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
        holdId: result.hold!.id,
        expiresAt: result.hold!.expiresAt,
        message: 'Time slot held. Complete your booking before the hold expires.'
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

      return reply.send({ message: 'Hold released successfully' })
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
          therapist: { select: { id: true, name: true } },
          room: { select: { id: true, name: true } }
        }
      })

      return reply.code(201).send({
        message: features.selfBookingRequiresApproval
          ? 'Appointment requested. You will be notified once it is confirmed.'
          : 'Appointment booked successfully.',
        appointment: session ? {
          id: session.id,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          therapist: session.therapist,
          room: session.room
        } : null,
        requiresApproval: features.selfBookingRequiresApproval
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
        selfBookingEnabled: features.selfBookingEnabled,
        leadTimeHours: features.selfBookingLeadTimeHours,
        maxFutureDays: features.selfBookingMaxFutureDays,
        requiresApproval: features.selfBookingRequiresApproval,
        defaultSessionDuration: settings.defaultSessionDuration,
        slotInterval: settings.slotInterval,
        earliestBookingDate: minBookingDate.toISOString().split('T')[0],
        latestBookingDate: maxBookingDate.toISOString().split('T')[0]
      })
    }
  )
}

export default portalRoutes
