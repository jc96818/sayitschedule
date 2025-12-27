import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Global Prisma client instance
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Prisma 7 requires a driver adapter for database connections
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || ''

  // Configure pool with SSL for AWS RDS (self-signed certificate)
  const poolConfig = {
    connectionString,
    // In production, accept self-signed certificates from AWS RDS
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined
  }

  const adapter = new PrismaPg(poolConfig)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// For backwards compatibility with existing code
export function getDb() {
  return prisma
}

export async function closeDb() {
  await prisma.$disconnect()
}

// Health check for database connectivity
export async function checkDbHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
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

// Re-export Prisma types for convenience
export type {
  Organization,
  User,
  Staff,
  Patient,
  Room,
  Rule,
  Schedule,
  Session,
  StaffAvailability,
  AuditLog,
  FederalHoliday,
  CustomHoliday,
  Gender,
  Status,
  UserRole,
  ScheduleStatus,
  RuleCategory
} from '@prisma/client'
