import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate, requireSuperAdmin, requireAdmin } from '../middleware/auth.js'
import { baaAgreementRepository } from '../repositories/baa.js'
import { baaService, BAA_TEMPLATE_CONFIG, BAA_STATUS_INFO } from '../services/baa.js'
import { logAudit } from '../repositories/audit.js'
import type { BaaStatus } from '@prisma/client'

// Request validation schemas
const signBaaSchema = z.object({
  signerName: z.string().min(1, 'Signer name is required'),
  signerTitle: z.string().min(1, 'Signer title is required'),
  signerEmail: z.string().email('Valid email is required'),
  consent: z.boolean().refine(val => val === true, {
    message: 'You must consent to electronic signature'
  }),
  organizationAddress: z.string().optional()
})

const countersignBaaSchema = z.object({
  signerName: z.string().min(1, 'Signer name is required'),
  signerTitle: z.string().min(1, 'Signer title is required')
})

/**
 * Get client IP address from request
 */
function getClientIp(request: FastifyRequest): string {
  // Check common proxy headers first
  const forwardedFor = request.headers['x-forwarded-for']
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, first one is the client
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
    return ips.split(',')[0].trim()
  }

  const realIp = request.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  return request.ip || 'unknown'
}

/**
 * Get user agent from request
 */
function getUserAgent(request: FastifyRequest): string {
  const ua = request.headers['user-agent']
  if (!ua) return 'unknown'
  // Truncate if too long
  return ua.substring(0, 500)
}

export async function baaRoutes(fastify: FastifyInstance) {
  // =========================================================================
  // ORGANIZATION-SCOPED ROUTES
  // =========================================================================

  /**
   * GET /api/baa/current
   * Get the current BAA status for the authenticated user's organization
   */
  fastify.get('/current', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    // Get organization ID from context
    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const status = await baaService.getStatus(organizationId)

    return {
      data: {
        ...status,
        templateConfig: {
          name: BAA_TEMPLATE_CONFIG.name,
          version: BAA_TEMPLATE_CONFIG.version,
          vendor: BAA_TEMPLATE_CONFIG.vendor
        }
      }
    }
  })

  /**
   * GET /api/baa/current/preview
   * Get a preview of the BAA document with organization name filled in
   */
  fastify.get('/current/preview', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const preview = await baaService.generateBaaPreview(organizationId)

    return {
      data: {
        content: preview,
        templateVersion: BAA_TEMPLATE_CONFIG.version,
        contentType: 'text/plain'
      }
    }
  })

  /**
   * POST /api/baa/current/initialize
   * Initialize a BAA for the organization (moves to awaiting_org_signature)
   * Admin only
   */
  fastify.post('/current/initialize', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    try {
      const baa = await baaService.initializeBaa(organizationId)

      await logAudit(ctx.userId, 'initialize', 'baa_agreement', baa.id, organizationId, {
        templateName: baa.templateName,
        templateVersion: baa.templateVersion
      })

      return reply.status(201).send({
        data: baa,
        statusInfo: BAA_STATUS_INFO[baa.status]
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize BAA'
      return reply.status(400).send({ error: message })
    }
  })

  /**
   * POST /api/baa/current/sign
   * Sign the BAA as the organization administrator
   * Admin only
   */
  fastify.post('/current/sign', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Validate request body
    const parseResult = signBaaSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.issues
      })
    }

    const { signerName, signerTitle, signerEmail, consent, organizationAddress } = parseResult.data

    try {
      const baa = await baaService.signAsOrganization(
        organizationId,
        ctx.userId,
        { signerName, signerTitle, signerEmail, consent, organizationAddress },
        getClientIp(request),
        getUserAgent(request)
      )

      // Log the signature event (with minimal PII in the audit log)
      await logAudit(ctx.userId, 'sign', 'baa_agreement', baa.id, organizationId, {
        signerEmail,
        signedAt: baa.orgSignedAt?.toISOString()
      })

      return {
        data: baa,
        statusInfo: BAA_STATUS_INFO[baa.status],
        message: 'BAA signed successfully. Awaiting vendor countersignature.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign BAA'
      return reply.status(400).send({ error: message })
    }
  })

  /**
   * GET /api/baa/current/download
   * Download the executed BAA document
   */
  fastify.get('/current/download', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Get the current BAA
    const baa = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)
    if (!baa) {
      return reply.status(404).send({ error: 'No BAA found for this organization' })
    }

    if (baa.status !== 'executed') {
      return reply.status(400).send({
        error: 'BAA has not been executed yet',
        currentStatus: baa.status
      })
    }

    try {
      const { content, filename } = await baaService.getExecutedBaaContent(baa.id)

      reply.header('Content-Type', 'text/plain')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)

      return reply.send(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download BAA'
      return reply.status(500).send({ error: message })
    }
  })

  /**
   * GET /api/baa/current/history
   * Get BAA history for the organization (all versions including superseded)
   * Admin only
   */
  fastify.get('/current/history', { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.ctx.user!

    const organizationId = ctx.organizationId || request.ctx.organizationId
    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    const history = await baaAgreementRepository.findAllByOrganizationId(organizationId)

    return {
      data: history.map(baa => ({
        ...baa,
        statusInfo: BAA_STATUS_INFO[baa.status]
      }))
    }
  })

  // =========================================================================
  // SUPERADMIN ROUTES
  // =========================================================================

  /**
   * GET /api/baa/admin/list
   * List all BAA agreements across all organizations
   * Superadmin only
   */
  fastify.get('/admin/list', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest) => {
    const { page, limit, search, status } = request.query as {
      page?: string
      limit?: string
      search?: string
      status?: string
    }

    const result = await baaAgreementRepository.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status: status as BaaStatus | undefined
    })

    return {
      ...result,
      data: result.data.map(baa => ({
        ...baa,
        statusInfo: BAA_STATUS_INFO[baa.status]
      }))
    }
  })

  /**
   * GET /api/baa/admin/stats
   * Get BAA statistics for the superadmin dashboard
   * Superadmin only
   */
  fastify.get('/admin/stats', { preHandler: requireSuperAdmin() }, async () => {
    const stats = await baaService.getStats()

    return {
      data: {
        ...stats,
        statusOptions: Object.entries(BAA_STATUS_INFO).map(([value, info]) => ({
          value,
          ...info
        }))
      }
    }
  })

  /**
   * GET /api/baa/admin/:organizationId
   * Get BAA details for a specific organization
   * Superadmin only
   */
  fastify.get('/admin/:organizationId', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.params as { organizationId: string }

    const baa = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)

    if (!baa) {
      return reply.status(404).send({
        error: 'No BAA found for this organization',
        canInitialize: true
      })
    }

    // Get history too
    const history = await baaAgreementRepository.findAllByOrganizationId(organizationId)

    return {
      data: {
        current: {
          ...baa,
          statusInfo: BAA_STATUS_INFO[baa.status]
        },
        history: history.map(b => ({
          ...b,
          statusInfo: BAA_STATUS_INFO[b.status]
        })),
        canCountersign: baa.status === 'awaiting_vendor_signature'
      }
    }
  })

  /**
   * POST /api/baa/admin/:organizationId/countersign
   * Countersign a BAA as the vendor (Say It Schedule)
   * Superadmin only
   */
  fastify.post('/admin/:organizationId/countersign', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.params as { organizationId: string }
    const ctx = request.ctx.user!

    // Validate request body
    const parseResult = countersignBaaSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.issues
      })
    }

    const { signerName, signerTitle } = parseResult.data

    // Get the current BAA
    const baa = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)
    if (!baa) {
      return reply.status(404).send({ error: 'No BAA found for this organization' })
    }

    if (baa.status !== 'awaiting_vendor_signature') {
      return reply.status(400).send({
        error: `Cannot countersign BAA in current state: ${baa.status}`,
        currentStatus: baa.status
      })
    }

    try {
      const updated = await baaService.countersignAsVendor(
        baa.id,
        ctx.userId,
        signerName,
        signerTitle
      )

      await logAudit(ctx.userId, 'countersign', 'baa_agreement', baa.id, organizationId, {
        signerName,
        signedAt: updated.vendorSignedAt?.toISOString()
      })

      return {
        data: {
          ...updated,
          statusInfo: BAA_STATUS_INFO[updated.status]
        },
        message: 'BAA countersigned successfully. Agreement is now fully executed.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to countersign BAA'
      return reply.status(400).send({ error: message })
    }
  })

  /**
   * POST /api/baa/admin/:organizationId/void
   * Void a BAA (superadmin only)
   */
  fastify.post('/admin/:organizationId/void', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.params as { organizationId: string }
    const ctx = request.ctx.user!

    const reasonSchema = z.object({
      reason: z.string().min(1, 'Reason is required')
    })

    const parseResult = reasonSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.issues
      })
    }

    const { reason } = parseResult.data

    // Get the current BAA
    const baa = await baaAgreementRepository.findCurrentByOrganizationId(organizationId)
    if (!baa) {
      return reply.status(404).send({ error: 'No BAA found for this organization' })
    }

    try {
      const updated = await baaService.voidBaa(baa.id, reason)

      await logAudit(ctx.userId, 'void', 'baa_agreement', baa.id, organizationId, {
        reason,
        previousStatus: baa.status
      })

      return {
        data: {
          ...updated,
          statusInfo: BAA_STATUS_INFO[updated.status]
        },
        message: 'BAA voided successfully.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to void BAA'
      return reply.status(400).send({ error: message })
    }
  })

  /**
   * GET /api/baa/admin/:baaId/download
   * Download an executed BAA document (superadmin)
   */
  fastify.get('/admin/:baaId/download', { preHandler: requireSuperAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { baaId } = request.params as { baaId: string }

    const baa = await baaAgreementRepository.findById(baaId)
    if (!baa) {
      return reply.status(404).send({ error: 'BAA not found' })
    }

    if (baa.status !== 'executed') {
      return reply.status(400).send({
        error: 'BAA has not been executed yet',
        currentStatus: baa.status
      })
    }

    try {
      const { content, filename } = await baaService.getExecutedBaaContent(baaId)

      reply.header('Content-Type', 'text/plain')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)

      return reply.send(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download BAA'
      return reply.status(500).send({ error: message })
    }
  })
}
