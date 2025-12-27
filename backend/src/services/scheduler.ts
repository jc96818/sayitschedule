import { staffRepository } from '../repositories/staff.js'
import { patientRepository } from '../repositories/patients.js'
import { ruleRepository } from '../repositories/rules.js'
import { roomRepository } from '../repositories/rooms.js'
import {
  generateScheduleWithAI,
  type StaffForScheduling,
  type PatientForScheduling,
  type RuleForScheduling,
  type RoomForScheduling,
  type GeneratedSession
} from './openai.js'

export interface SessionCreate {
  scheduleId: string
  therapistId: string
  patientId: string
  roomId?: string | null
  date: Date
  startTime: string
  endTime: string
  notes?: string | null
}

export interface ScheduleGenerationOutput {
  sessions: SessionCreate[]
  warnings: string[]
  stats: {
    totalSessions: number
    patientsScheduled: number
    therapistsUsed: number
  }
}

export interface ValidationError {
  session: GeneratedSession
  errors: string[]
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function sessionsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)

  return s1 < e2 && s2 < e1
}

export function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

export function validateSessions(
  sessions: GeneratedSession[],
  staff: StaffForScheduling[],
  patients: PatientForScheduling[],
  rooms: RoomForScheduling[] = []
): { valid: SessionCreate[]; errors: ValidationError[]; warnings: string[] } {
  const valid: SessionCreate[] = []
  const errors: ValidationError[] = []
  const warnings: string[] = []

  const staffMap = new Map(staff.map(s => [s.id, s]))
  const patientMap = new Map(patients.map(p => [p.id, p]))
  const roomMap = new Map(rooms.map(r => [r.id, r]))

  // Track scheduled sessions for overlap detection
  const therapistSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()
  const patientSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()
  const roomSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()

  for (const session of sessions) {
    const sessionErrors: string[] = []

    // Check if therapist exists
    const therapist = staffMap.get(session.therapistId)
    if (!therapist) {
      sessionErrors.push(`Therapist ${session.therapistId} not found`)
    }

    // Check if patient exists
    const patient = patientMap.get(session.patientId)
    if (!patient) {
      sessionErrors.push(`Patient ${session.patientId} not found`)
    }

    if (therapist && patient) {
      // Check certification requirements
      const missingCerts = patient.requiredCertifications.filter(
        cert => !therapist.certifications.includes(cert)
      )
      if (missingCerts.length > 0) {
        sessionErrors.push(
          `Therapist ${therapist.name} missing certifications: ${missingCerts.join(', ')}`
        )
      }

      // Check therapist working hours
      const dayOfWeek = getDayOfWeek(session.date)
      const workHours = therapist.defaultHours[dayOfWeek]
      if (workHours) {
        const sessionStart = timeToMinutes(session.startTime)
        const sessionEnd = timeToMinutes(session.endTime)
        const workStart = timeToMinutes(workHours.start)
        const workEnd = timeToMinutes(workHours.end)

        if (sessionStart < workStart || sessionEnd > workEnd) {
          sessionErrors.push(
            `Session time ${session.startTime}-${session.endTime} outside ${therapist.name}'s hours (${workHours.start}-${workHours.end})`
          )
        }
      } else if (!workHours) {
        // Therapist doesn't work on this day
        warnings.push(
          `${therapist.name} doesn't have scheduled hours on ${dayOfWeek}, but was assigned a session`
        )
      }

      // Check for therapist time conflicts
      const existingTherapistSessions = therapistSessions.get(session.therapistId) || []
      for (const existing of existingTherapistSessions) {
        if (
          existing.date === session.date &&
          sessionsOverlap(existing.start, existing.end, session.startTime, session.endTime)
        ) {
          sessionErrors.push(
            `Therapist ${therapist.name} has overlapping sessions on ${session.date}`
          )
          break
        }
      }

      // Check for patient time conflicts
      const existingPatientSessions = patientSessions.get(session.patientId) || []
      for (const existing of existingPatientSessions) {
        if (
          existing.date === session.date &&
          sessionsOverlap(existing.start, existing.end, session.startTime, session.endTime)
        ) {
          sessionErrors.push(
            `Patient ${patient.name} has overlapping sessions on ${session.date}`
          )
          break
        }
      }

      // Check room assignment if provided
      if (session.roomId) {
        const room = roomMap.get(session.roomId)
        if (!room) {
          sessionErrors.push(`Room ${session.roomId} not found`)
        } else {
          // Check for room time conflicts
          const existingRoomSessions = roomSessions.get(session.roomId) || []
          for (const existing of existingRoomSessions) {
            if (
              existing.date === session.date &&
              sessionsOverlap(existing.start, existing.end, session.startTime, session.endTime)
            ) {
              sessionErrors.push(
                `Room ${room.name} has overlapping sessions on ${session.date}`
              )
              break
            }
          }

          // Check if room has required capabilities for patient
          if (patient.requiredRoomCapabilities && patient.requiredRoomCapabilities.length > 0) {
            const missingCapabilities = patient.requiredRoomCapabilities.filter(
              cap => !room.capabilities.includes(cap)
            )
            if (missingCapabilities.length > 0) {
              sessionErrors.push(
                `Room ${room.name} missing required capabilities: ${missingCapabilities.join(', ')}`
              )
            }
          }
        }
      } else if (patient.requiredRoomCapabilities && patient.requiredRoomCapabilities.length > 0) {
        // Patient requires room capabilities but no room assigned
        warnings.push(
          `Patient ${patient.name} requires room capabilities (${patient.requiredRoomCapabilities.join(', ')}) but no room was assigned to this session`
        )
      }
    }

    if (sessionErrors.length > 0) {
      errors.push({ session, errors: sessionErrors })
    } else {
      // Session is valid - add to tracking maps and results
      if (!therapistSessions.has(session.therapistId)) {
        therapistSessions.set(session.therapistId, [])
      }
      therapistSessions.get(session.therapistId)!.push({
        date: session.date,
        start: session.startTime,
        end: session.endTime
      })

      if (!patientSessions.has(session.patientId)) {
        patientSessions.set(session.patientId, [])
      }
      patientSessions.get(session.patientId)!.push({
        date: session.date,
        start: session.startTime,
        end: session.endTime
      })

      // Track room session if room assigned
      if (session.roomId) {
        if (!roomSessions.has(session.roomId)) {
          roomSessions.set(session.roomId, [])
        }
        roomSessions.get(session.roomId)!.push({
          date: session.date,
          start: session.startTime,
          end: session.endTime
        })
      }

      valid.push({
        scheduleId: '', // Will be set by caller
        therapistId: session.therapistId,
        patientId: session.patientId,
        roomId: session.roomId || null,
        date: new Date(session.date),
        startTime: session.startTime,
        endTime: session.endTime,
        notes: session.notes || null
      })
    }
  }

  // Check if all patients got their required sessions
  for (const patient of patients) {
    const scheduledCount = patientSessions.get(patient.id)?.length || 0
    if (scheduledCount < patient.sessionFrequency) {
      const displayId = patient.identifier || patient.id
      warnings.push(
        `Patient ${patient.name} (ID: ${displayId}) is scheduled for ${scheduledCount} sessions instead of the requested ${patient.sessionFrequency}.`
      )
    }
  }

  return { valid, errors, warnings }
}

export async function generateSchedule(
  organizationId: string,
  weekStartDate: Date
): Promise<ScheduleGenerationOutput> {
  // Fetch all required data
  const [staffResult, patientsResult, rules, roomsResult] = await Promise.all([
    staffRepository.findByOrganization(organizationId, 'active'),
    patientRepository.findByOrganization(organizationId, 'active'),
    ruleRepository.findActiveByOrganization(organizationId),
    roomRepository.findByOrganization(organizationId, 'active')
  ])

  const staff = staffResult as StaffForScheduling[]
  const patients = patientsResult as PatientForScheduling[]
  const rooms: RoomForScheduling[] = roomsResult.map(r => ({
    id: r.id,
    name: r.name,
    capabilities: (r.capabilities as string[]) || []
  }))

  if (staff.length === 0) {
    throw new Error('No active staff members found')
  }

  if (patients.length === 0) {
    throw new Error('No active patients found')
  }

  // Format rules for AI
  const rulesForAI: RuleForScheduling[] = rules.map(r => ({
    id: r.id,
    category: r.category,
    description: r.description,
    ruleLogic: r.ruleLogic as Record<string, unknown>,
    priority: r.priority
  }))

  // Call OpenAI to generate schedule
  console.log(`Generating schedule for ${staff.length} staff, ${patients.length} patients, and ${rooms.length} rooms...`)
  const aiResult = await generateScheduleWithAI(weekStartDate, staff, patients, rulesForAI, rooms)
  console.log(`AI generated ${aiResult.sessions.length} sessions`)

  // Validate the generated sessions
  const { valid, errors, warnings } = validateSessions(aiResult.sessions, staff, patients, rooms)

  // Log validation errors for debugging
  if (errors.length > 0) {
    console.warn(`Validation rejected ${errors.length} sessions:`)
    for (const error of errors) {
      console.warn(`  - ${error.errors.join(', ')}`)
    }
  }

  // Combine AI warnings with validation warnings
  const allWarnings = [...aiResult.warnings, ...warnings]

  // Calculate stats
  const uniquePatients = new Set(valid.map(s => s.patientId))
  const uniqueTherapists = new Set(valid.map(s => s.therapistId))

  return {
    sessions: valid,
    warnings: allWarnings,
    stats: {
      totalSessions: valid.length,
      patientsScheduled: uniquePatients.size,
      therapistsUsed: uniqueTherapists.size
    }
  }
}
