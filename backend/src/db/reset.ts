import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function withSslModeNoVerify(connectionString: string): string {
  if (!connectionString) return connectionString

  try {
    const url = new URL(connectionString)
    url.searchParams.set('sslmode', 'no-verify')
    return url.toString()
  } catch {
    if (connectionString.match(/([?&])sslmode=[^&]*/)) {
      return connectionString.replace(/([?&])sslmode=[^&]*/, '$1sslmode=no-verify')
    }
    return connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify'
  }
}

function isConfirmed(): boolean {
  if (process.env.CONFIRM_DB_RESET === 'true') return true
  if (process.env.CONFIRM_DB_RESET === 'yes') return true
  return process.argv.includes('--confirm')
}

async function reset() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset database in production')
  }
  if (!isConfirmed()) {
    throw new Error('DB reset not confirmed. Re-run with `--confirm` or set `CONFIRM_DB_RESET=true`.')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const connectionString =
    process.env.NODE_ENV === 'production'
      ? withSslModeNoVerify(process.env.DATABASE_URL)
      : process.env.DATABASE_URL

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  try {
    // Clean-slate reset for org-scoped demo/dev data. Keeps global lookup tables
    // (e.g. business_type_templates, help content, federal holidays).
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "organizations" CASCADE;')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "leads" CASCADE;')

    console.log('Database reset complete.')
  } finally {
    await prisma.$disconnect()
  }
}

reset().catch(err => {
  console.error('Database reset failed:', err)
  process.exit(1)
})
