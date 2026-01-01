import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { helpRepository } from '../repositories/help.js'

const categoryParamSchema = z.object({
  category: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)
})

const articleParamSchema = categoryParamSchema.extend({
  article: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/)
})

const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional()
})

export async function helpRoutes(fastify: FastifyInstance) {
  // List categories (with published article summaries)
  fastify.get('/categories', { preHandler: authenticate }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    const data = await helpRepository.listCategories()
    return { data }
  })

  // Get an article by category + slug segment
  fastify.get('/articles/:category/:article', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { category, article } = articleParamSchema.parse(request.params)
    const slug = `/help/${category}/${article}`

    const found = await helpRepository.findPublishedArticleBySlug(slug)
    if (!found) {
      return reply.status(404).send({ error: 'Help article not found' })
    }

    return { data: found }
  })

  // Full-text search
  fastify.get('/search', { preHandler: authenticate }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { q, limit } = searchQuerySchema.parse(request.query)
    const data = await helpRepository.searchPublishedArticles(q, { limit })
    return { data }
  })
}

