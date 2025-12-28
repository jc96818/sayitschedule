import type { FastifyRequest, FastifyReply } from 'fastify'

export function getClientIp(request: FastifyRequest): string {
  const forwardedFor = request.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  return request.ip
}

type RateLimitOptions = {
  windowMs: number
  max: number
  key: (request: FastifyRequest) => string
}

export function rateLimit({ windowMs, max, key }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>()

  return async function rateLimitPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const now = Date.now()

    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k)
      }
    }

    const k = key(request)
    if (!k) return

    const existing = hits.get(k)
    if (!existing || existing.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs })
      return
    }

    existing.count += 1
    if (existing.count <= max) return

    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    reply.header('Retry-After', retryAfterSeconds)
    return reply.status(429).send({ error: 'Too many requests' })
  }
}

