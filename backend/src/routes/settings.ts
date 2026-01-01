import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { organizationSettingsRepository, type BusinessHours } from '../repositories/organizationSettings.js'
import { organizationFeaturesRepository, FEATURE_TIERS, type FeatureTier } from '../repositories/organizationFeatures.js'
import { getFeatureStatuses } from '../middleware/featureGuard.js'
import { logAudit } from '../repositories/audit.js'

const businessHoursDaySchema = z.object({
  open: z.boolean(),
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
})

const updateSettingsSchema = z.object({
  businessHours: z.object({
    monday: businessHoursDaySchema,
    tuesday: businessHoursDaySchema,
    wednesday: businessHoursDaySchema,
    thursday: businessHoursDaySchema,
    friday: businessHoursDaySchema,
    saturday: businessHoursDaySchema,
    sunday: businessHoursDaySchema
  }).optional(),
  timezone: z.string().optional(),
  defaultSessionDuration: z.number().min(15).max(480).optional(),
  slotInterval: z.number().min(5).max(60).optional(),
  lateCancelWindowHours: z.number().min(0).max(168).optional()
})

const updateFeaturesSchema = z.object({
  emailRemindersEnabled: z.boolean().optional(),
  smsRemindersEnabled: z.boolean().optional(),
  reminderHours: z.array(z.number().min(0).max(168)).optional(),
  patientPortalEnabled: z.boolean().optional(),
  portalAllowCancel: z.boolean().optional(),
  portalAllowReschedule: z.boolean().optional(),
  portalRequireConfirmation: z.boolean().optional(),
  selfBookingEnabled: z.boolean().optional(),
  selfBookingLeadTimeHours: z.number().int().min(0).max(168).optional(),
  selfBookingMaxFutureDays: z.number().int().min(0).max(365).optional(),
  selfBookingRequiresApproval: z.boolean().optional(),
  portalWelcomeTitle: z.string().min(1).max(100).optional(),
  portalWelcomeMessage: z.string().min(1).max(500).optional(),
  portalPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  portalSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  portalLogoUrl: z.string().url().max(500).nullable().optional(),
  portalBackgroundUrl: z.string().url().max(500).nullable().optional(),
  portalShowOrgName: z.boolean().optional(),
  portalContactEmail: z.string().email().max(255).nullable().optional(),
  portalContactPhone: z.string().max(20).nullable().optional(),
  portalFooterText: z.string().max(500).nullable().optional(),
  portalTermsUrl: z.string().url().max(500).nullable().optional(),
  portalPrivacyUrl: z.string().url().max(500).nullable().optional(),
  advancedReportsEnabled: z.boolean().optional(),
  reportExportEnabled: z.boolean().optional(),
  voiceCommandsEnabled: z.boolean().optional(),
  medicalTranscribeEnabled: z.boolean().optional(),
  apiAccessEnabled: z.boolean().optional(),
  webhooksEnabled: z.boolean().optional()
})

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get organization settings
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const settings = await organizationSettingsRepository.findByOrganizationId(organizationId)

    return { data: settings }
  })

  // Update organization settings (admin only)
  fastify.put('/', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = updateSettingsSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const settings = await organizationSettingsRepository.update(organizationId, body as {
      businessHours?: BusinessHours
      timezone?: string
      defaultSessionDuration?: number
      slotInterval?: number
      lateCancelWindowHours?: number
    })

    await logAudit(ctx.userId, 'update', 'organization_settings', settings.id, organizationId, body)

    return { data: settings }
  })

  // Get business hours only
  fastify.get('/business-hours', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const businessHours = await organizationSettingsRepository.getBusinessHours(organizationId)

    return { data: businessHours }
  })

  // Update business hours only (admin only)
  fastify.put('/business-hours', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      monday: businessHoursDaySchema,
      tuesday: businessHoursDaySchema,
      wednesday: businessHoursDaySchema,
      thursday: businessHoursDaySchema,
      friday: businessHoursDaySchema,
      saturday: businessHoursDaySchema,
      sunday: businessHoursDaySchema
    }).parse(request.body)

    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const settings = await organizationSettingsRepository.updateBusinessHours(organizationId, body)

    await logAudit(ctx.userId, 'update', 'organization_settings', settings.id, organizationId, {
      action: 'update_business_hours',
      businessHours: body
    })

    return { data: settings }
  })

  // Get organization features
  fastify.get('/features', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)

    return { data: features }
  })

  // Get feature statuses (simplified view for frontend)
  fastify.get('/features/status', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const statuses = await getFeatureStatuses(organizationId)

    return { data: statuses }
  })

  // Update organization features (admin only)
  fastify.put('/features', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = updateFeaturesSchema.parse(request.body)
    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const features = await organizationFeaturesRepository.update(organizationId, body)

    await logAudit(ctx.userId, 'update', 'organization_features', features.id, organizationId, body)

    return { data: features }
  })

  // Get available feature tiers
  fastify.get('/features/tiers', { preHandler: authenticate }, async () => {
    return {
      data: {
        basic: FEATURE_TIERS.basic,
        professional: FEATURE_TIERS.professional,
        enterprise: FEATURE_TIERS.enterprise
      }
    }
  })

  // Apply a feature tier (super admin only for now, can be adjusted for self-service upgrade later)
  fastify.post('/features/apply-tier', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tier } = z.object({
      tier: z.enum(['basic', 'professional', 'enterprise'])
    }).parse(request.body)

    const organizationId = request.ctx.organizationId
    const ctx = request.ctx.user!

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // For now, only super admin can change tiers (billing integration would change this)
    if (ctx.role !== 'super_admin') {
      return reply.status(403).send({
        error: 'Only super administrators can change feature tiers',
        message: 'Contact support to upgrade your plan'
      })
    }

    const features = await organizationFeaturesRepository.applyTier(organizationId, tier as FeatureTier)

    await logAudit(ctx.userId, 'update', 'organization_features', features.id, organizationId, {
      action: 'apply_tier',
      tier
    })

    return {
      data: features,
      meta: {
        tier,
        message: `Applied ${tier} tier features successfully`
      }
    }
  })

  // Get portal configuration
  fastify.get('/features/portal', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const portalConfig = await organizationFeaturesRepository.getPortalConfig(organizationId)

    return { data: portalConfig }
  })
}
