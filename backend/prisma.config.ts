import { defineConfig } from 'prisma/config'

// Declare process for TypeScript (Node.js global)
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use process.env directly to avoid error when DATABASE_URL is not set
    // (e.g., during prisma generate in Docker build)
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
