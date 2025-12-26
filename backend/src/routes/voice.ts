import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdminOrAssistant } from '../middleware/auth.js'
import {
  parseVoiceCommand,
  parsePatientCommand,
  parseStaffCommand,
  parseRuleCommand,
  parseScheduleCommand,
  type VoiceContext,
  type ParsedVoiceCommand
} from '../services/voiceParser.js'

const parseVoiceSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  context: z.enum(['patient', 'staff', 'rule', 'schedule', 'general']).optional().default('general')
})

export async function voiceRoutes(fastify: FastifyInstance) {
  // Parse voice command
  fastify.post('/parse', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    // Check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured. Please set OPENAI_API_KEY.'
      })
    }

    const body = parseVoiceSchema.parse(request.body)
    const { transcript, context } = body

    try {
      console.log(`Parsing voice command: "${transcript}" (context: ${context})`)

      let result: ParsedVoiceCommand

      // Use context-specific parsers for better results
      switch (context) {
        case 'patient':
          result = await parsePatientCommand(transcript)
          break
        case 'staff':
          result = await parseStaffCommand(transcript)
          break
        case 'rule':
          result = await parseRuleCommand(transcript)
          break
        case 'schedule':
          result = await parseScheduleCommand(transcript)
          break
        default:
          result = await parseVoiceCommand(transcript, context as VoiceContext)
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

    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const result = await parsePatientCommand(transcript)
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

    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const result = await parseStaffCommand(transcript)
      return { data: result }
    } catch (error) {
      console.error('Staff voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse staff command.' })
    }
  })

  // Parse rule voice command (convenience endpoint)
  fastify.post('/parse/rule', { preHandler: requireAdminOrAssistant() }, async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.organizationId

    if (!organizationId) {
      return reply.status(400).send({ error: 'Organization context required' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: 'Voice parsing service not configured.'
      })
    }

    const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body)

    try {
      const result = await parseRuleCommand(transcript)
      return { data: result }
    } catch (error) {
      console.error('Rule voice parsing failed:', error)
      return reply.status(500).send({ error: 'Failed to parse rule command.' })
    }
  })
}
