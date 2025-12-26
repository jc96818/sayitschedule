import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcrypt'
import * as schema from './schema.js'

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  console.log('Connecting to database...')
  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client, { schema })

  console.log('Seeding database...')

  // Create demo organization
  const [demoOrg] = await db.insert(schema.organizations).values({
    name: 'Demo Therapy Center',
    subdomain: 'demo',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    status: 'active'
  }).returning()

  console.log('Created demo organization:', demoOrg.id)

  // Create super admin (no organization)
  const superAdminPassword = await bcrypt.hash('admin123', 10)
  const [superAdmin] = await db.insert(schema.users).values({
    email: 'superadmin@sayitschedule.com',
    passwordHash: superAdminPassword,
    name: 'Super Admin',
    role: 'super_admin',
    organizationId: null
  }).returning()

  console.log('Created super admin:', superAdmin.email)

  // Create admin for demo org
  const adminPassword = await bcrypt.hash('admin123', 10)
  const [admin] = await db.insert(schema.users).values({
    email: 'admin@demo.sayitschedule.com',
    passwordHash: adminPassword,
    name: 'Jane Connor',
    role: 'admin',
    organizationId: demoOrg.id
  }).returning()

  console.log('Created admin:', admin.email)

  // Create admin assistant
  const [assistant] = await db.insert(schema.users).values({
    email: 'assistant@demo.sayitschedule.com',
    passwordHash: adminPassword,
    name: 'Bob Smith',
    role: 'admin_assistant',
    organizationId: demoOrg.id
  }).returning()

  console.log('Created admin assistant:', assistant.email)

  // Create staff members
  const staffMembers = [
    { name: 'Sarah Martinez', gender: 'female' as const, email: 'sarah@demo.sayitschedule.com', certifications: ['ABA', 'Pediatrics'] },
    { name: 'Michael Chen', gender: 'male' as const, email: 'michael@demo.sayitschedule.com', certifications: ['ABA', 'Behavioral'] },
    { name: 'Emily Johnson', gender: 'female' as const, email: 'emily@demo.sayitschedule.com', certifications: ['Speech', 'ABA'] },
    { name: 'David Wilson', gender: 'male' as const, email: 'david@demo.sayitschedule.com', certifications: ['Occupational', 'ABA'] },
    { name: 'Jessica Brown', gender: 'female' as const, email: 'jessica@demo.sayitschedule.com', certifications: ['Physical', 'Pediatrics'] }
  ]

  for (const staffData of staffMembers) {
    await db.insert(schema.staff).values({
      organizationId: demoOrg.id,
      name: staffData.name,
      gender: staffData.gender,
      email: staffData.email,
      certifications: staffData.certifications,
      defaultHours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '15:00' }
      },
      status: 'active',
      hireDate: new Date('2023-01-15')
    })
  }

  console.log('Created 5 staff members')

  // Create patients
  const patientData = [
    { name: 'Alex Thompson', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA'] },
    { name: 'Emma Davis', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['ABA', 'Pediatrics'] },
    { name: 'Noah Garcia', gender: 'male' as const, sessionFrequency: 4, requiredCertifications: ['ABA'] },
    { name: 'Olivia Martinez', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Speech'] },
    { name: 'Liam Anderson', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA', 'Behavioral'] },
    { name: 'Sophia Taylor', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Occupational'] },
    { name: 'Mason Lee', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA'] },
    { name: 'Isabella Harris', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Physical', 'Pediatrics'] }
  ]

  for (const patient of patientData) {
    await db.insert(schema.patients).values({
      organizationId: demoOrg.id,
      name: patient.name,
      gender: patient.gender,
      sessionFrequency: patient.sessionFrequency,
      requiredCertifications: patient.requiredCertifications,
      preferredTimes: ['Morning', 'Afternoon'],
      status: 'active'
    })
  }

  console.log('Created 8 patients')

  // Create some rules
  await db.insert(schema.rules).values([
    {
      organizationId: demoOrg.id,
      category: 'gender_pairing',
      description: 'Female patients should be paired with female therapists when possible',
      ruleLogic: { patientGender: 'female', preferredTherapistGender: 'female', priority: 'preferred' },
      priority: 1,
      isActive: true,
      createdBy: admin.id
    },
    {
      organizationId: demoOrg.id,
      category: 'session',
      description: 'Sessions should be at least 1 hour apart for each therapist',
      ruleLogic: { minGapMinutes: 60 },
      priority: 2,
      isActive: true,
      createdBy: admin.id
    },
    {
      organizationId: demoOrg.id,
      category: 'certification',
      description: 'Therapists must have required certifications for each patient',
      ruleLogic: { enforceRequired: true },
      priority: 3,
      isActive: true,
      createdBy: admin.id
    }
  ])

  console.log('Created 3 rules')

  console.log('\n=== Seed completed successfully! ===')
  console.log('\nTest accounts:')
  console.log('Super Admin: superadmin@sayitschedule.com / admin123')
  console.log('Admin: admin@demo.sayitschedule.com / admin123')
  console.log('Assistant: assistant@demo.sayitschedule.com / admin123')

  await client.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
