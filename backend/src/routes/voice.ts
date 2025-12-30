import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdminOrAssistant } from '../middleware/auth.js'
import {
  parseVoiceCommand,
  parsePatientCommand,
  parseStaffCommand,
  parseRuleCommand,
  parseMultipleRulesCommand,
  parseRoomCommand,
  parseScheduleCommand,
  parseScheduleModifyCommand,
  parseScheduleGenerateCommand,
  isProviderConfigured,
  getActiveProvider,
  type VoiceContext,
  type ParsedVoiceCommand,
  type OrganizationLabels
} from '../services/voiceParser.js'
import { organizationRepository } from '../repositories/organizations.js'

const parseVoiceSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  context: z.enum(['patient', 'staff', 'rule', 'room', 'schedule', 'general']).optional().default('general')
})

// Helper to fetch organization labels for voice parsing
async function getOrganizationLabels(organizationId: string): Promise<Partial<OrganizationLabels>> {
  const labels = await organizationRepository.getLabels(organizationId)
  if (!labels) return {}

  // Only include defined labels to let defaults apply for undefined ones
  const result: Partial<OrganizationLabels> = {}
  if (labels.staffLabel) result.staffLabel = labels.staffLabel
  if (labels.staffLabelSingular) result.staffLabelSingular = labels.staffLabelSingular
  if (labels.patientLabel) result.patientLabel = labels.patientLabel
  if (labels.patientLabelSingular) result.patientLabelSingular = labels.patientLabelSingular
  if (labels.roomLabel) result.roomLabel = labels.roomLabel
  if (labels.roomLabelSingular) result.roomLabelSingular = labels.roomLabelSingular
  if (labels.certificationLabel) result.certificationLabel = labels.certificationLabel
  if (labels.equipmentLabel) result.equipmentLabel = labels.equipmentLabel

  return result
}

export async function voiceRoutes(fastify: FastifyInstance) {
  // Parse voice command
  fastify.post('/parse', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Check if AI provider is configured
    if (!isProviderConfigured()) {
      const provider = getActiveProvider()
      const configHint = provider === 'openai'
        ? 'Please set OPENAI_API_KEY.'
        : 'Please configure AWS credentials.'
      return reply.status(503).send({
        error: `Voice parsing service not configured. ${configHint}`
      })
    }

    const body = parseVoiceSchema.parse(request.body)
    const { transcript, context } = body

    try {
      // NOTE: Do not log transcript - it contains PII (patient/staff names)

      // Fetch organization-specific labels for voice parsing
      const labels = await getOrganizationLabels(organizationId)

      let result: ParsedVoiceCommand

      // Use context-specific parsers for better results
      switch (context) {
        case 'patient':
          result = await parsePatientCommand(transcript, labels)
          break
        case 'staff':
          result = await parseStaffCommand(transcript, labels)
          break
        case 'rule':
          result = await parseRuleCommand(transcript, labels)
          break
        case 'room':
          result = await parseRoomCommand(transcript, labels)
          break
        case 'schedule':
          result = await parseScheduleCommand(transcript, labels)
          break
        default:
          result = await parseVoiceCommand(transcript, context as VoiceContext, labels)
      }

      console.log(`Parsed result: ${result.commandType} (confidence: ${result.confidence})`)

      return {
        data: result,
        meta: {
          context,
          processingTime: Date.now()
        }
      }
    } catch (error) {
      console.error('Voice parsing failed:', error)

      if (error instanceof Error) {
        if (error.message.includes('Voice parsing service error')) {
          return reply.status(503).send({
            error: 'Voice parsing service temporarily unavailable. Please try again.'
          })
        }
      }

      return reply.status(500).send({
        error: 'Failed to parse voice command. Please try again.'
      })
    }
  })

  // Parse patient voice command (convenience endpoint)
  fastify.post('/parse/patient', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parsePatientCommand(transcript, labels)
      return { data: result }
    } catch (error) {
      console.error('Patient voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse patient command.' })
    }
  })

  // Parse staff voice command (convenience endpoint)
  fastify.post('/parse/staff', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parseStaffCommand(transcript, labels)
      return { data: result }
    } catch (error) {
      console.error('Staff voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse staff command.' })
    }
  })

  // Parse rule voice command (supports multiple rules from single transcript)
  fastify.post('/parse/rule', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parseMultipleRulesCommand(transcript, labels)
      console.log(`Parsed ${result.rules.length} rule(s) (overall confidence: ${result.overallConfidence})`)
      return {
        data: result,
        meta: {
          rulesCount: result.rules.length
        }
      }
    } catch (error) {
      console.error('Rule voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse rule command.' })
    }
  })

  // Parse room voice command (convenience endpoint)
  fastify.post('/parse/room', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parseRoomCommand(transcript, labels)
      return { data: result }
    } catch (error) {
      console.error('Room voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse room command.' })
    }
  })

  // Parse schedule modification voice command (move, cancel, swap sessions)
  fastify.post('/parse/schedule', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parseScheduleModifyCommand(transcript, labels)
      return { data: result }
    } catch (error) {
      console.error('Schedule voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse schedule command.' })
    }
  })

  // Parse schedule generation voice command (generate a new weekly schedule)
  fastify.post('/parse/schedule-generate', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!isProviderConfigured()) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const labels = await getOrganizationLabels(organizationId)
      const result = await parseScheduleGenerateCommand(transcript, labels)
      return { data: result }
    } catch (error) {
      console.error('Schedule generation voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse schedule generation command.' })
    }
  })
}
