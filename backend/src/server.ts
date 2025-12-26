import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import { authRoutes } from './routes/auth.js'
import { organizationRoutes } from './routes/organizations.js'
import { staffRoutes } from './routes/staff.js'
import { patientRoutes } from './routes/patients.js'
import { ruleRoutes } from './routes/rules.js'
import { scheduleRoutes } from './routes/schedules.js'
import { userRoutes } from './routes/users.js'
import { voiceRoutes } from './routes/voice.js'
import { organizationMiddleware } from './middleware/organization.js'
import { checkDbHealth } from './db/index.js'

const server = Fastify({
  logger: true
})

async function start() {
  // Register plugins
  await server.register(cors, {
    origin: true,
    credentials: true
  })

  await server.register(cookie)

  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production'
  })

  // Add organization context middleware
  server.addHook('onRequest', organizationMiddleware)

  // Register routes
  await server.register(authRoutes, { prefix: '/api/auth' })
  await server.register(organizationRoutes, { prefix: '/api/organizations' })
  await server.register(staffRoutes, { prefix: '/api/staff' })
  await server.register(patientRoutes, { prefix: '/api/patients' })
  await server.register(ruleRoutes, { prefix: '/api/rules' })
  await server.register(scheduleRoutes, { prefix: '/api/schedules' })
  await server.register(userRoutes, { prefix: '/api/users' })
  await server.register(voiceRoutes, { prefix: '/api/voice' })

  // Health check - basic (for load balancer)
  server.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Deep health check - includes database connectivity
  server.get('/api/health/deep', async (_request, reply) => {
    const dbHealth = await checkDbHealth()

    const health = {
      status: dbHealth.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: dbHealth.connected ? 'ok' : 'error',
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error
        }
      }
    }

    // Return 503 if database is down
    if (!dbHealth.connected) {
      reply.code(503)
    }

    return health
  })

  // Serve static frontend files in production
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const publicPath = path.join(__dirname, '..', 'public')

  if (fs.existsSync(publicPath)) {
    await server.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      decorateReply: false
    })

    // SPA fallback - serve index.html for non-API routes
    server.setNotFoundHandler(async (request, reply) => {
      // Don't handle API routes
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ message: `Route ${request.method}:${request.url} not found`, error: 'Not Found', statusCode: 404 })
      }
      // Serve index.html for SPA routing
      return reply.sendFile('index.html')
    })
  }

  const port = parseInt(process.env.PORT || '3000', 10)
  const host = process.env.HOST || '0.0.0.0'

  try {
    await server.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
