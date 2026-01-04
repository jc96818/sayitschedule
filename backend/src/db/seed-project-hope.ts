import 'dotenv/config'
import { PrismaClient, MedicalSpecialty, Gender } from '@prisma/client'
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

async function seedProjectHopeOrg() {
  console.log('🏥 Seeding Project Hope Demo Organization...\n')

  // Check if organization already exists
  const existingOrg = await prisma.organization.findUnique({
    where: { subdomain: 'projecthope' }
  })

  if (existingOrg) {
    console.log('⚠️  Organization "projecthope" already exists. Cleaning up...')
    // Delete in order to respect foreign key constraints
    await prisma.patientSessionSpec.deleteMany({ where: { patient: { organizationId: existingOrg.id } } })
    await prisma.session.deleteMany({ where: { schedule: { organizationId: existingOrg.id } } })
    await prisma.schedule.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.staffAvailability.deleteMany({ where: { staff: { organizationId: existingOrg.id } } })
    await prisma.rule.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.patient.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.staff.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.room.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.user.deleteMany({ where: { organizationId: existingOrg.id } })
    await prisma.organization.delete({ where: { id: existingOrg.id } })
    console.log('✅ Cleaned up existing organization\n')
  }

  // Get ABA template
  const abaTemplate = await prisma.businessTypeTemplate.findFirst({
    where: { name: 'ABA Therapy' }
  })

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Project Hope Demo',
      subdomain: 'projecthope',
      primaryColor: '#7c3aed',
      secondaryColor: '#5b21b6',
      status: 'active',
      requiresHipaa: true,
      medicalSpecialty: MedicalSpecialty.PRIMARYCARE,
      businessTypeTemplateId: abaTemplate?.id
    }
  })
  console.log(`✅ Created organization: ${org.name} (${org.subdomain})`)

  // Create admin user
  const adminPassword = await bcrypt.hash('sayitadmin2025', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@projecthope.sayitschedule.com',
      passwordHash: adminPassword,
      name: 'Dr. Maria Santos',
      role: 'admin',
      organizationId: org.id
    }
  })
  console.log(`✅ Created admin: ${admin.email}`)

  // Create admin assistant
  const assistant = await prisma.user.create({
    data: {
      email: 'assistant@projecthope.sayitschedule.com',
      passwordHash: adminPassword,
      name: 'Carlos Rivera',
      role: 'admin_assistant',
      organizationId: org.id
    }
  })
  console.log(`✅ Created admin assistant: ${assistant.email}`)

  // Create 6 treatment rooms with various capabilities
  const roomsData = [
    { name: 'Hope Room 1', capabilities: ['sensory_equipment', 'therapy_swing', 'quiet_space'], description: 'Sensory integration room with calming environment' },
    { name: 'Hope Room 2', capabilities: ['sensory_equipment', 'observation_mirror', 'reward_station'], description: 'Active therapy room with observation capabilities' },
    { name: 'Discovery Room', capabilities: ['large_space', 'gym_equipment', 'wheelchair_accessible'], description: 'Large motor skills and physical therapy room' },
    { name: 'Quiet Corner A', capabilities: ['quiet_space', 'natural_lighting', 'computer_station'], description: 'Focused learning environment' },
    { name: 'Quiet Corner B', capabilities: ['quiet_space', 'observation_mirror'], description: 'Individual therapy space' },
    { name: 'Family Room', capabilities: ['large_space', 'wheelchair_accessible', 'natural_lighting'], description: 'Family involvement and group sessions' }
  ]

  const rooms = await Promise.all(
    roomsData.map(room =>
      prisma.room.create({
        data: {
          organizationId: org.id,
          name: room.name,
          capabilities: room.capabilities,
          description: room.description,
          status: 'active'
        }
      })
    )
  )
  console.log(`✅ Created ${rooms.length} rooms`)

  // Create 8 staff members with varied certifications and schedules
  const staffData = [
    // BCBA supervisors
    { name: 'Dr. Angela Reyes', gender: 'female' as const, email: 'angela@projecthope.sayitschedule.com', certifications: ['BCBA', 'BCBA-D', 'ABA', 'Pediatrics'], hours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '14:00' } } },
    { name: 'Dr. Robert Chang', gender: 'male' as const, email: 'robert@projecthope.sayitschedule.com', certifications: ['BCBA', 'ABA', 'Autism Specialist'], hours: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '15:00' } } },
    // BCaBA mid-level
    { name: 'Jennifer Nguyen', gender: 'female' as const, email: 'jennifer@projecthope.sayitschedule.com', certifications: ['BCaBA', 'ABA', 'Pediatrics'], hours: { monday: { start: '08:30', end: '16:30' }, tuesday: { start: '08:30', end: '16:30' }, wednesday: { start: '08:30', end: '16:30' }, thursday: { start: '08:30', end: '16:30' }, friday: { start: '08:30', end: '14:30' } } },
    { name: 'Marcus Johnson', gender: 'male' as const, email: 'marcus@projecthope.sayitschedule.com', certifications: ['BCaBA', 'ABA', 'Behavioral'], hours: { monday: { start: '10:00', end: '18:00' }, tuesday: { start: '10:00', end: '18:00' }, wednesday: { start: '10:00', end: '18:00' }, thursday: { start: '10:00', end: '18:00' }, friday: { start: '10:00', end: '16:00' } } },
    // RBT therapists
    { name: 'Sophia Williams', gender: 'female' as const, email: 'sophia@projecthope.sayitschedule.com', certifications: ['RBT', 'ABA'], hours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '14:00' } } },
    { name: 'Daniel Kim', gender: 'male' as const, email: 'daniel@projecthope.sayitschedule.com', certifications: ['RBT', 'ABA', 'Pediatrics'], hours: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '15:00' } } },
    { name: 'Amanda Foster', gender: 'female' as const, email: 'amanda@projecthope.sayitschedule.com', certifications: ['RBT', 'ABA', 'Autism Specialist'], hours: { monday: { start: '08:30', end: '16:30' }, tuesday: { start: '08:30', end: '16:30' }, wednesday: { start: '08:30', end: '16:30' }, thursday: { start: '08:30', end: '16:30' }, friday: { start: '08:30', end: '14:30' } } },
    { name: 'Tyler Brooks', gender: 'male' as const, email: 'tyler@projecthope.sayitschedule.com', certifications: ['RBT', 'ABA', 'Behavioral'], hours: { monday: { start: '10:00', end: '18:00' }, tuesday: { start: '10:00', end: '18:00' }, wednesday: { start: '10:00', end: '18:00' }, thursday: { start: '10:00', end: '18:00' }, friday: { start: '10:00', end: '16:00' } } }
  ]

  const staff = await Promise.all(
    staffData.map(s =>
      prisma.staff.create({
        data: {
          organizationId: org.id,
          name: s.name,
          gender: s.gender,
          email: s.email,
          certifications: s.certifications,
          defaultHours: s.hours,
          status: 'active',
          hireDate: new Date('2024-03-01')
        }
      })
    )
  )
  console.log(`✅ Created ${staff.length} staff members`)

  // Create 20 patients with varied requirements
  const patientsData = [
    // Patients requiring BCBA-level care
    { name: 'Lucas Rivera', gender: 'male' as const, frequency: 4, certs: ['BCBA', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: rooms[0].id, defaultDuration: 90, genderPref: null as Gender | null },
    { name: 'Emma Thompson', gender: 'female' as const, frequency: 4, certs: ['BCBA', 'ABA', 'Autism Specialist'], capabilities: ['quiet_space'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: 'female' as Gender },
    { name: 'Noah Patel', gender: 'male' as const, frequency: 3, certs: ['BCBA', 'ABA'], capabilities: ['therapy_swing'], preferredRoom: rooms[0].id, defaultDuration: 90, genderPref: null as Gender | null },

    // Patients okay with BCaBA
    { name: 'Ava Mitchell', gender: 'female' as const, frequency: 3, certs: ['BCaBA', 'ABA'], capabilities: ['observation_mirror'], preferredRoom: rooms[1].id, defaultDuration: 60, genderPref: 'female' as Gender },
    { name: 'Liam O\'Brien', gender: 'male' as const, frequency: 3, certs: ['BCaBA', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: null as Gender | null },
    { name: 'Mia Jackson', gender: 'female' as const, frequency: 2, certs: ['BCaBA', 'ABA'], capabilities: ['quiet_space'], preferredRoom: rooms[4].id, defaultDuration: 45, genderPref: null as Gender | null },
    { name: 'Ethan Wright', gender: 'male' as const, frequency: 3, certs: ['BCaBA', 'Behavioral'], capabilities: ['large_space'], preferredRoom: rooms[2].id, defaultDuration: 60, genderPref: 'male' as Gender },

    // Patients okay with RBT (most common)
    { name: 'Olivia Chen', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: rooms[0].id, defaultDuration: 60, genderPref: null as Gender | null },
    { name: 'William Davis', gender: 'male' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['quiet_space'], preferredRoom: null, defaultDuration: 45, genderPref: null as Gender | null },
    { name: 'Sophia Rodriguez', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['therapy_swing'], preferredRoom: rooms[0].id, defaultDuration: 60, genderPref: 'female' as Gender },
    { name: 'James Wilson', gender: 'male' as const, frequency: 2, certs: ['RBT', 'Pediatrics'], capabilities: ['observation_mirror'], preferredRoom: null, defaultDuration: 60, genderPref: null as Gender | null },
    { name: 'Isabella Martinez', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['large_space', 'wheelchair_accessible'], preferredRoom: rooms[2].id, defaultDuration: 90, genderPref: null as Gender | null },
    { name: 'Benjamin Lee', gender: 'male' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 45, genderPref: null as Gender | null },
    { name: 'Charlotte Brown', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA', 'Autism Specialist'], capabilities: ['quiet_space'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: 'female' as Gender },
    { name: 'Alexander Scott', gender: 'male' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['reward_station'], preferredRoom: rooms[1].id, defaultDuration: 45, genderPref: null as Gender | null },
    { name: 'Amelia Turner', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: null as Gender | null },
    { name: 'Henry Garcia', gender: 'male' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['quiet_space'], preferredRoom: rooms[4].id, defaultDuration: 60, genderPref: 'male' as Gender },
    { name: 'Evelyn Adams', gender: 'female' as const, frequency: 3, certs: ['RBT', 'Behavioral'], capabilities: ['large_space'], preferredRoom: rooms[5].id, defaultDuration: 60, genderPref: null as Gender | null },
    { name: 'Sebastian Hall', gender: 'male' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 45, genderPref: null as Gender | null },
    { name: 'Aria Nelson', gender: 'female' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['natural_lighting'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: null as Gender | null }
  ]

  const patients = await Promise.all(
    patientsData.map(p =>
      prisma.patient.create({
        data: {
          organizationId: org.id,
          name: p.name,
          gender: p.gender,
          sessionFrequency: p.frequency,
          requiredCertifications: p.certs,
          requiredRoomCapabilities: p.capabilities,
          preferredRoomId: p.preferredRoom,
          defaultSessionDuration: p.defaultDuration,
          genderPreference: p.genderPref,
          preferredTimes: ['Morning', 'Afternoon'],
          status: 'active',
          sessionSpecs: {
            create: [
              {
                name: 'Core Therapy',
                sessionsPerWeek: p.frequency,
                durationMinutes: p.defaultDuration,
                preferredTimes: ['Morning', 'Afternoon'],
                requiredCertifications: p.certs,
                preferredRoomId: p.preferredRoom,
                requiredRoomCapabilities: p.capabilities,
                isActive: true
              }
            ]
          }
        }
      })
    )
  )
  console.log(`✅ Created ${patients.length} patients`)

  // Create scheduling rules
  const rulesData = [
    // GENDER PAIRING RULES
    {
      category: 'gender_pairing' as const,
      description: 'Female clients with female gender preference must be paired with female therapists',
      ruleLogic: { patientGender: 'female', preferredTherapistGender: 'female', priority: 'required', enforcePreference: true },
      priority: 1
    },
    {
      category: 'gender_pairing' as const,
      description: 'Male clients with male gender preference should be paired with male therapists when possible',
      ruleLogic: { patientGender: 'male', preferredTherapistGender: 'male', priority: 'preferred', enforcePreference: true },
      priority: 2
    },
    {
      category: 'gender_pairing' as const,
      description: 'Default: female clients should be paired with female therapists when available',
      ruleLogic: { patientGender: 'female', preferredTherapistGender: 'female', priority: 'preferred' },
      priority: 3
    },

    // CERTIFICATION RULES
    {
      category: 'certification' as const,
      description: 'Therapists must have all required certifications for each client',
      ruleLogic: { enforceRequired: true, strictMatch: true },
      priority: 1
    },
    {
      category: 'certification' as const,
      description: 'BCBA-level clients require BCBA or BCBA-D certified therapists only',
      ruleLogic: { patientRequires: ['BCBA'], therapistMustHave: ['BCBA', 'BCBA-D'], enforceExact: true },
      priority: 2
    },

    // SESSION TIMING RULES
    {
      category: 'session' as const,
      description: 'Minimum 15 minutes gap between sessions for therapist transition',
      ruleLogic: { minGapMinutes: 15, applies: 'therapist' },
      priority: 1
    },
    {
      category: 'session' as const,
      description: 'Maximum 6 sessions per day per therapist to prevent burnout',
      ruleLogic: { maxSessionsPerDay: 6, applies: 'therapist' },
      priority: 2
    },
    {
      category: 'session' as const,
      description: 'Sessions should start at quarter-hour intervals (00, 15, 30, 45)',
      ruleLogic: { startTimeIntervals: [0, 15, 30, 45] },
      priority: 3
    },

    // AVAILABILITY RULES
    {
      category: 'availability' as const,
      description: 'Sessions only during business hours (8:00 AM - 6:00 PM)',
      ruleLogic: { type: 'time_window', startTime: '08:00', endTime: '18:00' },
      priority: 1
    },
    {
      category: 'availability' as const,
      description: 'Friday sessions end by 4:00 PM',
      ruleLogic: { type: 'day_restriction', dayOfWeek: 'friday', endTime: '16:00' },
      priority: 2
    },

    // SPECIFIC PAIRING RULES
    {
      category: 'specific_pairing' as const,
      description: 'Maintain therapist consistency - prefer same therapist for repeat sessions',
      ruleLogic: { type: 'maintain_consistency', priority: 'preferred', lookbackWeeks: 4 },
      priority: 1
    },
    {
      category: 'specific_pairing' as const,
      description: 'Wheelchair-accessible room required for clients needing wheelchair access',
      ruleLogic: { type: 'room_requirement', capability: 'wheelchair_accessible', required: true },
      priority: 2
    }
  ]

  await prisma.rule.createMany({
    data: rulesData.map(rule => ({
      organizationId: org.id,
      category: rule.category,
      description: rule.description,
      ruleLogic: rule.ruleLogic,
      priority: rule.priority,
      isActive: true,
      createdById: admin.id
    }))
  })
  console.log(`✅ Created ${rulesData.length} scheduling rules`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('🎉 PROJECT HOPE DEMO ORGANIZATION SEED COMPLETED!')
  console.log('='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Organization: ${org.name}`)
  console.log(`   Subdomain: ${org.subdomain}`)
  console.log(`   Rooms: ${rooms.length}`)
  console.log(`   Staff: ${staff.length}`)
  console.log(`   Patients: ${patients.length}`)
  console.log(`   Rules: ${rulesData.length}`)
  console.log('\n🔐 Test Accounts:')
  console.log(`   Admin Email: ${admin.email}`)
  console.log(`   Assistant Email: ${assistant.email}`)
  console.log('   Password: sayitadmin2025')
  console.log(`   URL: http://projecthope.localhost:5173`)
  console.log('\n📋 Staff Summary:')
  console.log('   BCBA/BCBA-D: 2 (supervisors)')
  console.log('   BCaBA: 2 (mid-level)')
  console.log('   RBT: 4 (registered behavior technicians)')
  console.log('\n📋 Patient Summary:')
  console.log('   Requiring BCBA: 3')
  console.log('   Okay with BCaBA: 4')
  console.log('   Okay with RBT: 13')
  console.log('\n')

  await prisma.$disconnect()
}

seedProjectHopeOrg().catch(async (err) => {
  console.error('❌ Seed failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
