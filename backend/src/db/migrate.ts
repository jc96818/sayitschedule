import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema.js'

async function runMigration() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  console.log('Connecting to database...')
  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client, { schema })

  console.log('Creating schema...')

  // Create enums
  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'admin_assistant', 'staff');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE gender AS ENUM ('male', 'female', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE status AS ENUM ('active', 'inactive');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE schedule_status AS ENUM ('draft', 'published');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await client.unsafe(`
    DO $$ BEGIN
      CREATE TYPE rule_category AS ENUM ('gender_pairing', 'session', 'availability', 'specific_pairing', 'certification');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Create tables
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(63) NOT NULL UNIQUE,
      logo_url TEXT,
      primary_color VARCHAR(7) DEFAULT '#2563eb',
      secondary_color VARCHAR(7) DEFAULT '#1e40af',
      status status DEFAULT 'active' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role user_role NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      last_login TIMESTAMP
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) NOT NULL,
      user_id UUID REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      gender gender NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(20),
      certifications JSONB DEFAULT '[]',
      default_hours JSONB,
      status status DEFAULT 'active' NOT NULL,
      hire_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) NOT NULL,
      name VARCHAR(255) NOT NULL,
      identifier VARCHAR(50),
      gender gender NOT NULL,
      session_frequency INTEGER DEFAULT 2 NOT NULL,
      preferred_times JSONB,
      required_certifications JSONB DEFAULT '[]',
      notes TEXT,
      status status DEFAULT 'active' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) NOT NULL,
      category rule_category NOT NULL,
      description TEXT NOT NULL,
      rule_logic JSONB NOT NULL,
      priority INTEGER DEFAULT 0 NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_by UUID REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) NOT NULL,
      week_start_date TIMESTAMP NOT NULL,
      status schedule_status DEFAULT 'draft' NOT NULL,
      created_by UUID REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      published_at TIMESTAMP,
      version INTEGER DEFAULT 1 NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_id UUID REFERENCES schedules(id) NOT NULL,
      therapist_id UUID REFERENCES staff(id) NOT NULL,
      patient_id UUID REFERENCES patients(id) NOT NULL,
      date TIMESTAMP NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_availability (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID REFERENCES staff(id) NOT NULL,
      date TIMESTAMP NOT NULL,
      available BOOLEAN DEFAULT true NOT NULL,
      start_time VARCHAR(5),
      end_time VARCHAR(5),
      reason TEXT
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id),
      user_id UUID REFERENCES users(id) NOT NULL,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      changes JSONB,
      timestamp TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS federal_holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      year INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      date TIMESTAMP NOT NULL
    );
  `)

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS custom_holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) NOT NULL,
      name VARCHAR(100) NOT NULL,
      date TIMESTAMP NOT NULL,
      reason TEXT
    );
  `)

  console.log('Migration completed successfully!')

  await client.end()
  process.exit(0)
}

runMigration().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
