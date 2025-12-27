import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

// Build connection string with SSL for AWS RDS
let connectionString = process.env.DATABASE_URL || ''
if (process.env.NODE_ENV === 'production' && connectionString && !connectionString.includes('sslmode=')) {
  const separator = connectionString.includes('?') ? '&' : '?'
  connectionString = `${connectionString}${separator}sslmode=no-verify`
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function seed() {
  console.log('Seeding database...')

  // Create demo organization
  const demoOrg = await prisma.organization.create({
    data: {
      name: 'Demo Therapy Center',
      subdomain: 'demo',
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      status: 'active'
    }
  })

  console.log('Created demo organization:', demoOrg.id)

  // Create super admin (no organization)
  const superAdminPassword = await bcrypt.hash('admin123', 10)
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@sayitschedule.com',
      passwordHash: superAdminPassword,
      name: 'Super Admin',
      role: 'super_admin',
      organizationId: null
    }
  })

  console.log('Created super admin:', superAdmin.email)

  // Create admin for demo org
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.sayitschedule.com',
      passwordHash: adminPassword,
      name: 'Jane Connor',
      role: 'admin',
      organizationId: demoOrg.id
    }
  })

  console.log('Created admin:', admin.email)

  // Create admin assistant
  const assistant = await prisma.user.create({
    data: {
      email: 'assistant@demo.sayitschedule.com',
      passwordHash: adminPassword,
      name: 'Bob Smith',
      role: 'admin_assistant',
      organizationId: demoOrg.id
    }
  })

  console.log('Created admin assistant:', assistant.email)

  // Create rooms
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        organizationId: demoOrg.id,
        name: 'Room A',
        capabilities: ['sensory_equipment', 'wheelchair_accessible'],
        description: 'Main therapy room with sensory equipment',
        status: 'active'
      }
    }),
    prisma.room.create({
      data: {
        organizationId: demoOrg.id,
        name: 'Room B',
        capabilities: ['quiet_space', 'natural_lighting'],
        description: 'Quiet room for focused sessions',
        status: 'active'
      }
    }),
    prisma.room.create({
      data: {
        organizationId: demoOrg.id,
        name: 'Room C',
        capabilities: ['large_space', 'gym_equipment'],
        description: 'Physical therapy room',
        status: 'active'
      }
    })
  ])

  console.log('Created 3 rooms')

  // Create staff members
  const staffMembers = [
    { name: 'Sarah Martinez', gender: 'female' as const, email: 'sarah@demo.sayitschedule.com', certifications: ['ABA', 'Pediatrics'] },
    { name: 'Michael Chen', gender: 'male' as const, email: 'michael@demo.sayitschedule.com', certifications: ['ABA', 'Behavioral'] },
    { name: 'Emily Johnson', gender: 'female' as const, email: 'emily@demo.sayitschedule.com', certifications: ['Speech', 'ABA'] },
    { name: 'David Wilson', gender: 'male' as const, email: 'david@demo.sayitschedule.com', certifications: ['Occupational', 'ABA'] },
    { name: 'Jessica Brown', gender: 'female' as const, email: 'jessica@demo.sayitschedule.com', certifications: ['Physical', 'Pediatrics'] }
  ]

  for (const staffData of staffMembers) {
    await prisma.staff.create({
      data: {
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
      }
    })
  }

  console.log('Created 5 staff members')

  // Create patients
  const patientData = [
    { name: 'Alex Thompson', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA'], preferredRoomId: rooms[0].id },
    { name: 'Emma Davis', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['ABA', 'Pediatrics'] },
    { name: 'Noah Garcia', gender: 'male' as const, sessionFrequency: 4, requiredCertifications: ['ABA'] },
    { name: 'Olivia Martinez', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Speech'] },
    { name: 'Liam Anderson', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA', 'Behavioral'], requiredRoomCapabilities: ['wheelchair_accessible'] },
    { name: 'Sophia Taylor', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Occupational'] },
    { name: 'Mason Lee', gender: 'male' as const, sessionFrequency: 3, requiredCertifications: ['ABA'] },
    { name: 'Isabella Harris', gender: 'female' as const, sessionFrequency: 2, requiredCertifications: ['Physical', 'Pediatrics'], preferredRoomId: rooms[2].id }
  ]

  for (const patient of patientData) {
    await prisma.patient.create({
      data: {
        organizationId: demoOrg.id,
        name: patient.name,
        gender: patient.gender,
        sessionFrequency: patient.sessionFrequency,
        requiredCertifications: patient.requiredCertifications,
        preferredTimes: ['Morning', 'Afternoon'],
        preferredRoomId: patient.preferredRoomId,
        requiredRoomCapabilities: patient.requiredRoomCapabilities || [],
        status: 'active'
      }
    })
  }

  console.log('Created 8 patients')

  // Create some rules
  await prisma.rule.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        category: 'gender_pairing',
        description: 'Female patients should be paired with female therapists when possible',
        ruleLogic: { patientGender: 'female', preferredTherapistGender: 'female', priority: 'preferred' },
        priority: 1,
        isActive: true,
        createdById: admin.id
      },
      {
        organizationId: demoOrg.id,
        category: 'session',
        description: 'Sessions should be at least 1 hour apart for each therapist',
        ruleLogic: { minGapMinutes: 60 },
        priority: 2,
        isActive: true,
        createdById: admin.id
      },
      {
        organizationId: demoOrg.id,
        category: 'certification',
        description: 'Therapists must have required certifications for each patient',
        ruleLogic: { enforceRequired: true },
        priority: 3,
        isActive: true,
        createdById: admin.id
      }
    ]
  })

  console.log('Created 3 rules')

  console.log('\n=== Seed completed successfully! ===')
  console.log('\nTest accounts:')
  console.log('Super Admin: superadmin@sayitschedule.com / admin123')
  console.log('Admin: admin@demo.sayitschedule.com / admin123')
  console.log('Assistant: assistant@demo.sayitschedule.com / admin123')

  await prisma.$disconnect()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('Seed failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
