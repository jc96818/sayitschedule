import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

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

const rawConnectionString = process.env.DATABASE_URL || ''
const connectionString =
  process.env.NODE_ENV === 'production'
    ? withSslModeNoVerify(rawConnectionString)
    : rawConnectionString

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function seed() {
  console.log('Seeding database...')

  // Check if business type templates already exist (created by migration)
  const existingTemplates = await prisma.businessTypeTemplate.count()
  if (existingTemplates > 0) {
    console.log(`Found ${existingTemplates} business type templates (created by migration)`)
  } else {
    // Create templates if they don't exist (for backwards compatibility)
    const templates = await Promise.all([
      prisma.businessTypeTemplate.create({
        data: {
          id: 'tmpl_aba_therapy',
          name: 'ABA Therapy',
          description: 'Applied Behavior Analysis therapy practices',
          isDefault: true,
          isActive: true,
          staffLabel: 'Therapists',
          staffLabelSingular: 'Therapist',
          patientLabel: 'Clients',
          patientLabelSingular: 'Client',
          roomLabel: 'Treatment Rooms',
          roomLabelSingular: 'Treatment Room',
          certificationLabel: 'Certifications',
          equipmentLabel: 'Equipment',
          suggestedCertifications: ['BCBA', 'BCaBA', 'RBT', 'BCBA-D', 'ABA', 'Pediatrics'],
          suggestedRoomEquipment: ['sensory_equipment', 'therapy_swing', 'quiet_space', 'observation_mirror', 'reward_station']
        }
      }),
      prisma.businessTypeTemplate.create({
        data: {
          id: 'tmpl_speech_therapy',
          name: 'Speech Therapy',
          description: 'Speech-Language Pathology practices',
          isDefault: false,
          isActive: true,
          staffLabel: 'Clinicians',
          staffLabelSingular: 'Clinician',
          patientLabel: 'Clients',
          patientLabelSingular: 'Client',
          roomLabel: 'Treatment Rooms',
          roomLabelSingular: 'Treatment Room',
          certificationLabel: 'Credentials',
          equipmentLabel: 'Equipment',
          suggestedCertifications: ['CCC-SLP', 'CF-SLP', 'SLPA', 'AAC Specialist', 'Feeding Specialist'],
          suggestedRoomEquipment: ['sound_booth', 'mirror_wall', 'computer_station', 'therapy_materials', 'articulation_tools']
        }
      }),
      prisma.businessTypeTemplate.create({
        data: {
          id: 'tmpl_occupational_therapy',
          name: 'Occupational Therapy',
          description: 'Occupational therapy practices',
          isDefault: false,
          isActive: true,
          staffLabel: 'Therapists',
          staffLabelSingular: 'Therapist',
          patientLabel: 'Clients',
          patientLabelSingular: 'Client',
          roomLabel: 'Therapy Spaces',
          roomLabelSingular: 'Therapy Space',
          certificationLabel: 'Certifications',
          equipmentLabel: 'Features',
          suggestedCertifications: ['OTR/L', 'COTA/L', 'CHT', 'Sensory Integration', 'Pediatric OT'],
          suggestedRoomEquipment: ['sensory_equipment', 'therapy_swing', 'fine_motor_station', 'large_space', 'wheelchair_accessible']
        }
      }),
      prisma.businessTypeTemplate.create({
        data: {
          id: 'tmpl_physical_therapy',
          name: 'Physical Therapy',
          description: 'Physical therapy practices',
          isDefault: false,
          isActive: true,
          staffLabel: 'Therapists',
          staffLabelSingular: 'Therapist',
          patientLabel: 'Patients',
          patientLabelSingular: 'Patient',
          roomLabel: 'Treatment Areas',
          roomLabelSingular: 'Treatment Area',
          certificationLabel: 'Specializations',
          equipmentLabel: 'Equipment',
          suggestedCertifications: ['DPT', 'PTA', 'OCS', 'NCS', 'Pediatric PT', 'Sports PT'],
          suggestedRoomEquipment: ['treatment_table', 'exercise_equipment', 'parallel_bars', 'wheelchair_accessible', 'gait_training']
        }
      }),
      prisma.businessTypeTemplate.create({
        data: {
          id: 'tmpl_general_therapy',
          name: 'General Therapy Practice',
          description: 'Multi-discipline therapy practices',
          isDefault: false,
          isActive: true,
          staffLabel: 'Staff',
          staffLabelSingular: 'Staff Member',
          patientLabel: 'Clients',
          patientLabelSingular: 'Client',
          roomLabel: 'Rooms',
          roomLabelSingular: 'Room',
          certificationLabel: 'Certifications',
          equipmentLabel: 'Capabilities',
          suggestedCertifications: [],
          suggestedRoomEquipment: ['wheelchair_accessible', 'quiet_space', 'computer_station']
        }
      })
    ])
    console.log(`Created ${templates.length} business type templates`)
  }

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
  const superAdminPassword = await bcrypt.hash('sayitadmin2025', 10)
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
  const adminPassword = await bcrypt.hash('sayitadmin2025', 10)
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
        sessionSpecs: {
          create: [
            {
              name: 'Core Therapy',
              sessionsPerWeek: patient.sessionFrequency,
              durationMinutes: 60,
              preferredTimes: ['Morning', 'Afternoon'],
              requiredCertifications: patient.requiredCertifications,
              preferredRoomId: patient.preferredRoomId,
              requiredRoomCapabilities: patient.requiredRoomCapabilities || [],
              isActive: true
            }
          ]
        },
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
  console.log('Super Admin: superadmin@sayitschedule.com / sayitadmin2025')
  console.log('Admin: admin@demo.sayitschedule.com / sayitadmin2025')
  console.log('Assistant: assistant@demo.sayitschedule.com / sayitadmin2025')

  await prisma.$disconnect()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('Seed failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
