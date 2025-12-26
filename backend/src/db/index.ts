import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema.js'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let client: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    client = postgres(connectionString)
    db = drizzle(client, { schema })
  }
  return db
}

export async function closeDb() {
  if (client) {
    await client.end()
    client = null
    db = null
  }
}

// For backwards compatibility
export { getDb as db }

// Health check for database connectivity
export async function checkDbHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  try {
    const database = getDb()
    // Execute a simple query to check connectivity
    await database.execute(sql`SELECT 1`)
    return {
      connected: true,
      latencyMs: Date.now() - start
    }
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown database error'
    }
  }
}

export * from './schema.js'
