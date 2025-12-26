import { drizzle } from 'drizzle-orm/postgres-js'
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

export * from './schema.js'
