import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate, requireAdminOrAssistant } from '../middleware/auth.js'
import {
  exportData,
  parseImportFile,
  previewImport,
  executeImport,
  type ExportEntityType,
  type ExportFormat
} from '../services/dataExporter.js'

const VALID_ENTITY_TYPES = ['staff', 'patients', 'rooms', 'rules'] as const
const VALID_FORMATS = ['json', 'csv'] as const

function isValidEntityType(value: string): value is ExportEntityType {
  return VALID_ENTITY_TYPES.includes(value as ExportEntityType)
}

function isValidFormat(value: string): value is ExportFormat {
  return VALID_FORMATS.includes(value as ExportFormat)
}

export async function dataManagementRoutes(fastify: FastifyInstance) {
  // Export endpoint - GET /export/:entityType/:format
  fastify.get(
    '/export/:entityType/:format',
    { preHandler: [authenticate, requireAdminOrAssistant()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { entityType, format } = request.params as { entityType: string; format: string }
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      if (!isValidEntityType(entityType)) {
        return reply.status(400).send({
          error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
        })
      }

      if (!isValidFormat(format)) {
        return reply.status(400).send({
          error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`
        })
      }

      try {
        const result = await exportData(organizationId, entityType, format)

        reply.header('Content-Type', result.contentType)
        reply.header('Content-Disposition', `attachment; filename="${result.filename}"`)
        reply.header('Content-Length', result.data.length)

        return reply.send(result.data)
      } catch (error) {
        console.error('Export failed:', error)
        return reply.status(500).send({ error: 'Export failed' })
      }
    }
  )

  // Import preview endpoint - POST /import/preview
  fastify.post(
    '/import/preview',
    { preHandler: [authenticate, requireAdminOrAssistant()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      try {
        // Handle multipart file upload
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({ error: 'No file provided' })
        }

        // Get entity type and format from fields
        const fields = data.fields as Record<string, { value: string } | undefined>
        const entityType = fields['entityType']?.value
        const format = fields['format']?.value

        if (!entityType || !isValidEntityType(entityType)) {
          return reply.status(400).send({
            error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
          })
        }

        if (!format || !isValidFormat(format)) {
          return reply.status(400).send({
            error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`
          })
        }

        const buffer = await data.toBuffer()

        // Parse the file
        let records: Record<string, unknown>[]
        try {
          records = parseImportFile(buffer, entityType, format)
        } catch (parseError) {
          return reply.status(400).send({
            error: `Failed to parse file: ${parseError instanceof Error ? parseError.message : 'Invalid file format'}`
          })
        }

        if (records.length === 0) {
          return reply.status(400).send({ error: 'File contains no records' })
        }

        // Preview the import
        const preview = await previewImport(organizationId, records, entityType)

        return reply.send({
          data: preview
        })
      } catch (error) {
        console.error('Import preview failed:', error)
        return reply.status(500).send({ error: 'Import preview failed' })
      }
    }
  )

  // Execute import endpoint - POST /import/execute
  fastify.post(
    '/import/execute',
    { preHandler: [authenticate, requireAdminOrAssistant()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const organizationId = request.ctx.organizationId
      const userId = request.ctx.user?.userId

      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization context required' })
      }

      if (!userId) {
        return reply.status(401).send({ error: 'User context required' })
      }

      const body = request.body as {
        entityType?: string
        records?: Record<string, unknown>[]
      }

      const { entityType, records } = body

      if (!entityType || !isValidEntityType(entityType)) {
        return reply.status(400).send({
          error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
        })
      }

      if (!records || !Array.isArray(records) || records.length === 0) {
        return reply.status(400).send({ error: 'No records provided' })
      }

      try {
        const result = await executeImport(organizationId, records, entityType, userId)

        return reply.send({
          data: result
        })
      } catch (error) {
        console.error('Import execution failed:', error)
        return reply.status(500).send({ error: 'Import execution failed' })
      }
    }
  )
}
