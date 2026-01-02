import { PrismaClient, MedicalSpecialty } from '@prisma/client'
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

async function seedAbaTestOrg() {
  console.log('🏥 Seeding ABA Test Organization...\n')

  // Check if organization already exists
  const existingOrg = await prisma.organization.findUnique({
    where: { subdomain: 'abatest' }
  })

  if (existingOrg) {
    console.log('⚠️  Organization "abatest" already exists. Cleaning up...')
    // Delete in order to respect foreign key constraints
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
      name: 'Bright Horizons ABA Center',
      subdomain: 'abatest',
      primaryColor: '#059669',
      secondaryColor: '#047857',
      status: 'active',
      requiresHipaa: true,
      medicalSpecialty: MedicalSpecialty.PRIMARYCARE,
      businessTypeTemplateId: abaTemplate?.id
    }
  })
  console.log(`✅ Created organization: ${org.name} (${org.subdomain})`)

  // Create admin user
  const adminPassword = await bcrypt.hash('abatest2025', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@abatest.sayitschedule.com',
      passwordHash: adminPassword,
      name: 'Dr. Amanda Sterling',
      role: 'admin',
      organizationId: org.id
    }
  })
  console.log(`✅ Created admin: ${admin.email}`)

  // Create 5 treatment rooms with various capabilities
  const roomsData = [
    { name: 'Sensory Suite A', capabilities: ['sensory_equipment', 'therapy_swing', 'quiet_space', 'observation_mirror'], description: 'Full sensory integration room with swing and quiet zone' },
    { name: 'Sensory Suite B', capabilities: ['sensory_equipment', 'therapy_swing', 'reward_station'], description: 'Sensory room with focus on positive reinforcement' },
    { name: 'Motor Skills Room', capabilities: ['large_space', 'gym_equipment', 'wheelchair_accessible'], description: 'Large room for gross motor activities' },
    { name: 'Focus Room 1', capabilities: ['quiet_space', 'observation_mirror', 'natural_lighting'], description: 'Quiet environment for focused 1:1 sessions' },
    { name: 'Focus Room 2', capabilities: ['quiet_space', 'reward_station', 'computer_station'], description: 'Technology-equipped quiet room' }
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

  // Create 10 staff members with varied certifications and schedules
  const staffData = [
    // BCBA supervisors (can supervise RBTs)
    { name: 'Dr. Marcus Webb', gender: 'male' as const, email: 'marcus@abatest.sayitschedule.com', certifications: ['BCBA', 'BCBA-D', 'ABA', 'Pediatrics'], hours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '14:00' } } },
    { name: 'Dr. Lisa Chen', gender: 'female' as const, email: 'lisa@abatest.sayitschedule.com', certifications: ['BCBA', 'ABA', 'Pediatrics', 'Autism Specialist'], hours: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '15:00' } } },
    // BCaBA mid-level
    { name: 'Rachel Thompson', gender: 'female' as const, email: 'rachel@abatest.sayitschedule.com', certifications: ['BCaBA', 'ABA', 'Pediatrics'], hours: { monday: { start: '08:30', end: '16:30' }, tuesday: { start: '08:30', end: '16:30' }, wednesday: { start: '08:30', end: '16:30' }, thursday: { start: '08:30', end: '16:30' }, friday: { start: '08:30', end: '14:30' } } },
    { name: 'James Rodriguez', gender: 'male' as const, email: 'james@abatest.sayitschedule.com', certifications: ['BCaBA', 'ABA', 'Behavioral'], hours: { monday: { start: '10:00', end: '18:00' }, tuesday: { start: '10:00', end: '18:00' }, wednesday: { start: '10:00', end: '18:00' }, thursday: { start: '10:00', end: '18:00' }, friday: { start: '10:00', end: '16:00' } } },
    // RBT therapists
    { name: 'Emily Watson', gender: 'female' as const, email: 'emily@abatest.sayitschedule.com', certifications: ['RBT', 'ABA'], hours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '14:00' } } },
    { name: 'Michael Foster', gender: 'male' as const, email: 'michael@abatest.sayitschedule.com', certifications: ['RBT', 'ABA', 'Behavioral'], hours: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '15:00' } } },
    { name: 'Sarah Kim', gender: 'female' as const, email: 'sarah@abatest.sayitschedule.com', certifications: ['RBT', 'ABA', 'Pediatrics'], hours: { monday: { start: '08:30', end: '16:30' }, tuesday: { start: '08:30', end: '16:30' }, wednesday: { start: '08:30', end: '16:30' }, thursday: { start: '08:30', end: '16:30' }, friday: { start: '08:30', end: '14:30' } } },
    { name: 'David Park', gender: 'male' as const, email: 'david@abatest.sayitschedule.com', certifications: ['RBT', 'ABA'], hours: { monday: { start: '10:00', end: '18:00' }, tuesday: { start: '10:00', end: '18:00' }, wednesday: { start: '10:00', end: '18:00' }, thursday: { start: '10:00', end: '18:00' }, friday: { start: '10:00', end: '16:00' } } },
    { name: 'Jessica Martinez', gender: 'female' as const, email: 'jessica@abatest.sayitschedule.com', certifications: ['RBT', 'ABA', 'Autism Specialist'], hours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '14:00' } } },
    { name: 'Chris Anderson', gender: 'male' as const, email: 'chris@abatest.sayitschedule.com', certifications: ['RBT', 'ABA', 'Behavioral'], hours: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '15:00' } } }
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
          hireDate: new Date('2024-01-15')
        }
      })
    )
  )
  console.log(`✅ Created ${staff.length} staff members`)

  // Create 30 patients with varied requirements
  const patientsData = [
    // Patients requiring BCBA-level care
    { name: 'Aiden Johnson', gender: 'male' as const, frequency: 4, certs: ['BCBA', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: rooms[0].id, defaultDuration: 90, genderPref: null },
    { name: 'Bella Williams', gender: 'female' as const, frequency: 4, certs: ['BCBA', 'ABA', 'Autism Specialist'], capabilities: ['quiet_space'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: 'female' },
    { name: 'Carter Brown', gender: 'male' as const, frequency: 3, certs: ['BCBA', 'ABA'], capabilities: ['therapy_swing'], preferredRoom: rooms[1].id, defaultDuration: 90, genderPref: null },
    { name: 'Diana Garcia', gender: 'female' as const, frequency: 3, certs: ['BCBA', 'Pediatrics'], capabilities: ['observation_mirror'], preferredRoom: rooms[0].id, defaultDuration: 60, genderPref: 'female' },

    // Patients okay with BCaBA
    { name: 'Ethan Miller', gender: 'male' as const, frequency: 3, certs: ['BCaBA', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Faith Davis', gender: 'female' as const, frequency: 2, certs: ['BCaBA', 'ABA'], capabilities: ['quiet_space'], preferredRoom: rooms[4].id, defaultDuration: 45, genderPref: 'female' },
    { name: 'Gabriel Rodriguez', gender: 'male' as const, frequency: 3, certs: ['BCaBA', 'Behavioral'], capabilities: ['large_space'], preferredRoom: rooms[2].id, defaultDuration: 60, genderPref: 'male' },
    { name: 'Hannah Wilson', gender: 'female' as const, frequency: 2, certs: ['BCaBA', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 60, genderPref: null },

    // Patients okay with RBT (most common)
    { name: 'Isaac Moore', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: rooms[0].id, defaultDuration: 60, genderPref: null },
    { name: 'Julia Taylor', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['quiet_space'], preferredRoom: null, defaultDuration: 45, genderPref: 'female' },
    { name: 'Kevin Anderson', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['therapy_swing'], preferredRoom: rooms[1].id, defaultDuration: 60, genderPref: null },
    { name: 'Lily Thomas', gender: 'female' as const, frequency: 2, certs: ['RBT', 'Pediatrics'], capabilities: ['observation_mirror'], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Mason Jackson', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['large_space'], preferredRoom: rooms[2].id, defaultDuration: 90, genderPref: 'male' },
    { name: 'Natalie White', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 45, genderPref: null },
    { name: 'Oliver Harris', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['reward_station'], preferredRoom: rooms[1].id, defaultDuration: 60, genderPref: null },
    { name: 'Penelope Martin', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA', 'Autism Specialist'], capabilities: ['quiet_space'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: 'female' },
    { name: 'Quinn Thompson', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Rose Garcia', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 45, genderPref: null },
    { name: 'Samuel Martinez', gender: 'male' as const, frequency: 4, certs: ['RBT', 'Behavioral'], capabilities: ['large_space', 'wheelchair_accessible'], preferredRoom: rooms[2].id, defaultDuration: 90, genderPref: null },
    { name: 'Tiffany Robinson', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['computer_station'], preferredRoom: rooms[4].id, defaultDuration: 45, genderPref: null },
    { name: 'Ulysses Clark', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: 'male' },
    { name: 'Victoria Lewis', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['quiet_space'], preferredRoom: rooms[3].id, defaultDuration: 60, genderPref: null },
    { name: 'William Walker', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['therapy_swing'], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Xena Hall', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 45, genderPref: 'female' },
    { name: 'Yosef Allen', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['reward_station'], preferredRoom: rooms[1].id, defaultDuration: 60, genderPref: null },
    { name: 'Zoe Young', gender: 'female' as const, frequency: 2, certs: ['RBT', 'Pediatrics'], capabilities: ['observation_mirror'], preferredRoom: rooms[0].id, defaultDuration: 60, genderPref: null },
    { name: 'Adam King', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: ['sensory_equipment'], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Brianna Scott', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['quiet_space'], preferredRoom: null, defaultDuration: 45, genderPref: null },
    { name: 'Caleb Green', gender: 'male' as const, frequency: 3, certs: ['RBT', 'ABA'], capabilities: [], preferredRoom: null, defaultDuration: 60, genderPref: null },
    { name: 'Daisy Baker', gender: 'female' as const, frequency: 2, certs: ['RBT', 'ABA'], capabilities: ['natural_lighting'], preferredRoom: rooms[3].id, defaultDuration: 45, genderPref: null }
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
          status: 'active'
        }
      })
    )
  )
  console.log(`✅ Created ${patients.length} patients`)

  // Create 20 comprehensive scheduling rules
  const rulesData = [
    // GENDER PAIRING RULES (3)
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

    // CERTIFICATION RULES (4)
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
    {
      category: 'certification' as const,
      description: 'Autism Specialist certification preferred for clients with autism-specific needs',
      ruleLogic: { preferCertification: 'Autism Specialist', priority: 'preferred' },
      priority: 3
    },
    {
      category: 'certification' as const,
      description: 'Pediatrics certification preferred for clients under 10',
      ruleLogic: { preferCertification: 'Pediatrics', ageGroup: 'under10', priority: 'preferred' },
      priority: 4
    },

    // SESSION TIMING RULES (5)
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
      description: 'No more than 3 consecutive hours of sessions without a 30 minute break',
      ruleLogic: { maxConsecutiveMinutes: 180, requiredBreakMinutes: 30 },
      priority: 3
    },
    {
      category: 'session' as const,
      description: 'Sessions should start at quarter-hour intervals (00, 15, 30, 45)',
      ruleLogic: { startTimeIntervals: [0, 15, 30, 45] },
      priority: 4
    },
    {
      category: 'session' as const,
      description: 'High-frequency clients (4+ sessions/week) should have sessions spread across different days',
      ruleLogic: { frequencyThreshold: 4, spreadAcrossDays: true, minDayGap: 1 },
      priority: 5
    },

    // AVAILABILITY RULES (4)
    {
      category: 'availability' as const,
      description: 'Exclude federal holidays from scheduling',
      ruleLogic: { type: 'exclude_dates', excludeFederalHolidays: true },
      priority: 1
    },
    {
      category: 'availability' as const,
      description: 'Sessions only during business hours (8:00 AM - 6:00 PM)',
      ruleLogic: { type: 'time_window', startTime: '08:00', endTime: '18:00' },
      priority: 2
    },
    {
      category: 'availability' as const,
      description: 'Friday sessions end by 4:00 PM',
      ruleLogic: { type: 'day_restriction', dayOfWeek: 'friday', endTime: '16:00' },
      priority: 3
    },
    {
      category: 'availability' as const,
      description: 'Morning clients (preferred morning) should be scheduled before 12:00 PM',
      ruleLogic: { preferredTime: 'Morning', endTime: '12:00', priority: 'preferred' },
      priority: 4
    },

    // SPECIFIC PAIRING RULES (4)
    {
      category: 'specific_pairing' as const,
      description: 'Maintain therapist consistency - prefer same therapist for repeat sessions',
      ruleLogic: { type: 'maintain_consistency', priority: 'preferred', lookbackWeeks: 4 },
      priority: 1
    },
    {
      category: 'specific_pairing' as const,
      description: 'BCBA supervisors should not be scheduled more than 2 sessions consecutively with same client',
      ruleLogic: { type: 'limit_consecutive', maxConsecutive: 2, therapistCertification: 'BCBA' },
      priority: 2
    },
    {
      category: 'specific_pairing' as const,
      description: 'New clients (first 2 weeks) should be paired with senior therapists (BCBA or BCaBA)',
      ruleLogic: { type: 'new_client', newClientWeeks: 2, preferCertifications: ['BCBA', 'BCBA-D', 'BCaBA'] },
      priority: 3
    },
    {
      category: 'specific_pairing' as const,
      description: 'Wheelchair-accessible room required for clients needing wheelchair access',
      ruleLogic: { type: 'room_requirement', capability: 'wheelchair_accessible', required: true },
      priority: 4
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
  console.log('🎉 ABA TEST ORGANIZATION SEED COMPLETED!')
  console.log('='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Organization: ${org.name}`)
  console.log(`   Subdomain: ${org.subdomain}`)
  console.log(`   Rooms: ${rooms.length}`)
  console.log(`   Staff: ${staff.length}`)
  console.log(`   Patients: ${patients.length}`)
  console.log(`   Rules: ${rulesData.length}`)
  console.log('\n🔐 Test Account:')
  console.log(`   Email: ${admin.email}`)
  console.log('   Password: abatest2025')
  console.log(`   URL: http://abatest.localhost:5173`)
  console.log('\n📋 Staff Summary:')
  console.log('   BCBA/BCBA-D: 2 (supervisors)')
  console.log('   BCaBA: 2 (mid-level)')
  console.log('   RBT: 6 (registered behavior technicians)')
  console.log('\n📋 Patient Summary:')
  console.log('   Requiring BCBA: 4')
  console.log('   Okay with BCaBA: 4')
  console.log('   Okay with RBT: 22')
  console.log('\n📋 Rule Categories:')
  console.log('   Gender Pairing: 3')
  console.log('   Certification: 4')
  console.log('   Session Timing: 5')
  console.log('   Availability: 4')
  console.log('   Specific Pairing: 4')
  console.log('\n')

  await prisma.$disconnect()
}

seedAbaTestOrg().catch(async (err) => {
  console.error('❌ Seed failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
