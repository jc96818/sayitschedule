import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

import { authRoutes } from './routes/auth.js'
import { organizationRoutes } from './routes/organizations.js'
import { staffRoutes } from './routes/staff.js'
import { patientRoutes } from './routes/patients.js'
import { ruleRoutes } from './routes/rules.js'
import { scheduleRoutes } from './routes/schedules.js'
import { userRoutes } from './routes/users.js'
import { voiceRoutes } from './routes/voice.js'
import { organizationMiddleware } from './middleware/organization.js'

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

  // Health check
  server.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

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
