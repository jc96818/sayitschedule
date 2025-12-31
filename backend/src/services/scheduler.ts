import { staffRepository } from '../repositories/staff.js'
import { patientRepository } from '../repositories/patients.js'
import { ruleRepository } from '../repositories/rules.js'
import { roomRepository } from '../repositories/rooms.js'
import { staffAvailabilityRepository, type StaffAvailability } from '../repositories/staffAvailability.js'
import {
  generateScheduleWithAI,
  chatCompletion,
  isProviderConfigured,
  type StaffForScheduling,
  type PatientForScheduling,
  type RuleForScheduling,
  type RoomForScheduling,
  type GeneratedSession
} from './aiProvider.js'
import type { SessionWithDetails, ScheduleWithSessions } from '../repositories/schedules.js'

// Map of staff ID to their unavailability records for a date range
export type UnavailabilityMap = Map<string, StaffAvailability[]>

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
  rooms: RoomForScheduling[] = [],
  unavailabilityMap?: UnavailabilityMap
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

      // Check staff availability overrides (approved time-off)
      if (unavailabilityMap) {
        const staffUnavail = unavailabilityMap.get(session.therapistId)
        if (staffUnavail) {
          for (const unavail of staffUnavail) {
            // Compare dates (normalize to YYYY-MM-DD)
            const unavailDate = unavail.date.toISOString().split('T')[0]
            if (unavailDate === session.date) {
              if (!unavail.available) {
                // Staff is completely unavailable this day
                const reason = unavail.reason ? ` (${unavail.reason})` : ''
                sessionErrors.push(
                  `${therapist.name} is not available on ${session.date}${reason}`
                )
              } else if (unavail.startTime && unavail.endTime) {
                // Partial availability - staff is only available during specific hours
                // Check if session falls within their available window
                const sessionStart = timeToMinutes(session.startTime)
                const sessionEnd = timeToMinutes(session.endTime)
                const availStart = timeToMinutes(unavail.startTime)
                const availEnd = timeToMinutes(unavail.endTime)

                if (sessionStart < availStart || sessionEnd > availEnd) {
                  sessionErrors.push(
                    `${therapist.name} is only available ${unavail.startTime}-${unavail.endTime} on ${session.date}`
                  )
                }
              }
            }
          }
        }
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
  // Calculate week end date (7 days from start)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  // Fetch all required data
  const [staffResult, patientsResult, rules, roomsResult, unavailabilityResult] = await Promise.all([
    staffRepository.findByOrganization(organizationId, 'active'),
    patientRepository.findByOrganization(organizationId, 'active'),
    ruleRepository.findActiveByOrganization(organizationId),
    roomRepository.findByOrganization(organizationId, 'active'),
    staffAvailabilityRepository.getApprovedUnavailability(organizationId, weekStartDate, weekEndDate)
  ])

  // Build unavailability map for quick lookup
  const unavailabilityMap: UnavailabilityMap = new Map()
  for (const record of unavailabilityResult) {
    if (!unavailabilityMap.has(record.staffId)) {
      unavailabilityMap.set(record.staffId, [])
    }
    unavailabilityMap.get(record.staffId)!.push(record)
  }

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

  // Validate the generated sessions (including staff availability)
  const { valid, errors, warnings } = validateSessions(aiResult.sessions, staff, patients, rooms, unavailabilityMap)

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

// Helper function to format date as YYYY-MM-DD string
function formatDateToString(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]
  }
  return String(date).split('T')[0]
}

// Types for copy validation
export interface RegenerateSessionResult {
  success: boolean
  newSession?: SessionCreate
  reason?: string
}

export interface SessionModification {
  original: {
    therapistName?: string
    patientName?: string
    date: string
    startTime: string
  }
  replacement?: {
    therapistName?: string
    patientName?: string
    date: string
    startTime: string
  }
  reason: string
}

export interface CopyValidationResult {
  validSessions: SessionCreate[]
  modifications: {
    regenerated: SessionModification[]
    removed: SessionModification[]
  }
  warnings: string[]
}

/**
 * Regenerate a single session that violates rules using AI
 */
async function regenerateViolatingSession(
  originalSession: SessionWithDetails,
  validationError: string,
  weekStartDate: Date,
  existingSessions: SessionCreate[],
  staff: StaffForScheduling[],
  patients: PatientForScheduling[],
  rules: RuleForScheduling[],
  rooms: RoomForScheduling[],
  unavailabilityMap: UnavailabilityMap
): Promise<RegenerateSessionResult> {
  // Find the patient for this session
  const patient = patients.find(p => p.id === originalSession.patientId)
  if (!patient) {
    return {
      success: false,
      reason: `Patient ${originalSession.patientId} no longer exists or is inactive`
    }
  }

  // Calculate week dates
  const weekDates: string[] = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStartDate)
    date.setDate(date.getDate() + i)
    weekDates.push(date.toISOString().split('T')[0])
  }

  // Format existing sessions for the prompt (to avoid conflicts)
  const existingSessionsForPrompt = existingSessions.map(s => {
    const therapist = staff.find(st => st.id === s.therapistId)
    const sessionPatient = patients.find(p => p.id === s.patientId)
    const dateStr = s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date
    return `- ${therapist?.name || s.therapistId} with ${sessionPatient?.name || s.patientId} on ${dateStr} at ${s.startTime}-${s.endTime}`
  }).join('\n')

  // Format staff availability
  const staffAvailability = staff.map(s => {
    const hours = Object.entries(s.defaultHours || {})
      .filter(([_, h]) => h !== null)
      .map(([day, h]) => `${day}: ${h!.start}-${h!.end}`)
      .join(', ')

    // Check for unavailability overrides
    const unavail = unavailabilityMap.get(s.id) || []
    const unavailDates = unavail
      .filter(u => !u.available)
      .map(u => u.date.toISOString().split('T')[0])

    return `- ${s.name} (ID: ${s.id})
    Gender: ${s.gender}
    Certifications: [${s.certifications.join(', ')}]
    Working Hours: ${hours || 'Not specified'}
    Unavailable Dates: ${unavailDates.length > 0 ? unavailDates.join(', ') : 'None'}`
  }).join('\n')

  // Format rules
  const rulesForPrompt = rules.map((r, i) => {
    return `${i + 1}. [${r.category}] ${r.description}`
  }).join('\n')

  // Format rooms
  const roomsForPrompt = rooms.length > 0
    ? rooms.map(r => `- ${r.name} (ID: ${r.id}): capabilities [${r.capabilities.join(', ')}]`).join('\n')
    : 'No rooms configured.'

  const systemPrompt = `You are a therapy scheduling assistant. Your task is to find a new valid time slot for a single patient session that was invalidated.

CRITICAL RULES:
1. The new session must NOT conflict with any existing scheduled sessions
2. The therapist must be available (working hours and no unavailability)
3. The therapist must have ALL required certifications for the patient
4. Honor gender pairing rules when specified
5. Standard session duration is 60 minutes

You must return ONLY a valid JSON object with no additional text.`

  const userPrompt = `A therapy session needs to be rescheduled for patient "${patient.name}" during the week of ${weekDates[0]} to ${weekDates[4]}.

ORIGINAL SESSION:
- Therapist: ${originalSession.therapistName || originalSession.therapistId}
- Patient: ${originalSession.patientName || originalSession.patientId}
- Date: ${formatDateToString(originalSession.date)}
- Time: ${originalSession.startTime}

REASON FOR INVALIDATION:
${validationError}

PATIENT REQUIREMENTS:
- Required Certifications: [${patient.requiredCertifications.join(', ')}]
- Required Room Capabilities: [${(patient.requiredRoomCapabilities || []).join(', ')}]
- Preferred Times: [${(patient.preferredTimes || []).join(', ')}]

AVAILABLE STAFF:
${staffAvailability}

AVAILABLE ROOMS:
${roomsForPrompt}

SCHEDULING RULES:
${rulesForPrompt || 'No specific rules defined.'}

ALREADY SCHEDULED SESSIONS (avoid conflicts with these):
${existingSessionsForPrompt || 'No sessions scheduled yet.'}

Find a new valid time slot for this patient. You may use a different therapist if the original therapist is unavailable or doesn't meet requirements.

Return a JSON object with this exact structure:
{
  "success": true/false,
  "session": {
    "therapistId": "<staff UUID>",
    "patientId": "${patient.id}",
    "roomId": "<room UUID or null>",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm"
  },
  "reason": "explanation if success is false"
}

If no valid slot can be found, return: { "success": false, "session": null, "reason": "explanation" }`

  try {
    const content = await chatCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: 1024
    })

    const result = JSON.parse(content) as {
      success: boolean
      session?: GeneratedSession
      reason?: string
    }

    if (result.success && result.session) {
      return {
        success: true,
        newSession: {
          scheduleId: '', // Will be set by caller
          therapistId: result.session.therapistId,
          patientId: result.session.patientId,
          roomId: result.session.roomId || null,
          date: new Date(result.session.date),
          startTime: result.session.startTime,
          endTime: result.session.endTime,
          notes: `Rescheduled from ${originalSession.startTime} on ${formatDateToString(originalSession.date)}`
        }
      }
    } else {
      return {
        success: false,
        reason: result.reason || 'AI could not find a valid time slot'
      }
    }
  } catch (error) {
    console.error('Error regenerating session:', error)
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'AI service error'
    }
  }
}

/**
 * Validate copied sessions against current rules and regenerate invalid ones
 */
export async function validateAndRegenerateCopiedSchedule(
  organizationId: string,
  sourceSchedule: ScheduleWithSessions
): Promise<CopyValidationResult> {
  const weekStartDate = new Date(sourceSchedule.weekStartDate)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  // Fetch all required data
  const [staffResult, patientsResult, rules, roomsResult, unavailabilityResult] = await Promise.all([
    staffRepository.findByOrganization(organizationId, 'active'),
    patientRepository.findByOrganization(organizationId, 'active'),
    ruleRepository.findActiveByOrganization(organizationId),
    roomRepository.findByOrganization(organizationId, 'active'),
    staffAvailabilityRepository.getApprovedUnavailability(organizationId, weekStartDate, weekEndDate)
  ])

  // Build unavailability map
  const unavailabilityMap: UnavailabilityMap = new Map()
  for (const record of unavailabilityResult) {
    if (!unavailabilityMap.has(record.staffId)) {
      unavailabilityMap.set(record.staffId, [])
    }
    unavailabilityMap.get(record.staffId)!.push(record)
  }

  const staff = staffResult as StaffForScheduling[]
  const patients = patientsResult as PatientForScheduling[]
  const rooms: RoomForScheduling[] = roomsResult.map(r => ({
    id: r.id,
    name: r.name,
    capabilities: (r.capabilities as string[]) || []
  }))

  const rulesForAI: RuleForScheduling[] = rules.map(r => ({
    id: r.id,
    category: r.category,
    description: r.description,
    ruleLogic: r.ruleLogic as Record<string, unknown>,
    priority: r.priority
  }))

  // Convert source sessions to GeneratedSession format for validation
  const sessionsToValidate: GeneratedSession[] = sourceSchedule.sessions.map(s => ({
    therapistId: s.therapistId,
    patientId: s.patientId,
    roomId: s.roomId || undefined,
    date: formatDateToString(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    notes: s.notes || undefined
  }))

  // First pass: validate all sessions
  const { valid: initialValid, errors } = validateSessions(
    sessionsToValidate,
    staff,
    patients,
    rooms,
    unavailabilityMap
  )

  const validSessions: SessionCreate[] = [...initialValid]
  const modifications: CopyValidationResult['modifications'] = {
    regenerated: [],
    removed: []
  }
  const warnings: string[] = []

  // If no errors, return early
  if (errors.length === 0) {
    return {
      validSessions,
      modifications,
      warnings: ['All sessions passed validation - no modifications needed.']
    }
  }

  // Check if AI is available for regeneration
  const aiAvailable = isProviderConfigured()
  if (!aiAvailable) {
    // Fall back to removing invalid sessions
    for (const error of errors) {
      const originalSession = sourceSchedule.sessions.find(
        s => s.therapistId === error.session.therapistId &&
             s.patientId === error.session.patientId &&
             s.startTime === error.session.startTime
      )

      modifications.removed.push({
        original: {
          therapistName: originalSession?.therapistName,
          patientName: originalSession?.patientName,
          date: error.session.date,
          startTime: error.session.startTime
        },
        reason: error.errors.join('; ')
      })
    }
    warnings.push('AI service unavailable - invalid sessions were removed instead of regenerated.')
    return { validSessions, modifications, warnings }
  }

  // Regenerate invalid sessions one by one
  for (const error of errors) {
    const originalSession = sourceSchedule.sessions.find(
      s => s.therapistId === error.session.therapistId &&
           s.patientId === error.session.patientId &&
           s.startTime === error.session.startTime
    )

    if (!originalSession) {
      continue
    }

    console.log(`Regenerating session for ${originalSession.patientName} (was: ${error.errors.join('; ')})`)

    const regenerateResult = await regenerateViolatingSession(
      originalSession,
      error.errors.join('; '),
      weekStartDate,
      validSessions,
      staff,
      patients,
      rulesForAI,
      rooms,
      unavailabilityMap
    )

    if (regenerateResult.success && regenerateResult.newSession) {
      // Validate the regenerated session to ensure it's actually valid
      const newSessionAsGenerated: GeneratedSession = {
        therapistId: regenerateResult.newSession.therapistId,
        patientId: regenerateResult.newSession.patientId,
        roomId: regenerateResult.newSession.roomId || undefined,
        date: regenerateResult.newSession.date instanceof Date
          ? regenerateResult.newSession.date.toISOString().split('T')[0]
          : regenerateResult.newSession.date,
        startTime: regenerateResult.newSession.startTime,
        endTime: regenerateResult.newSession.endTime
      }

      // Check existing valid sessions to avoid conflicts
      const allCurrentSessions = validSessions.map(s => ({
        therapistId: s.therapistId,
        patientId: s.patientId,
        roomId: s.roomId || undefined,
        date: s.date instanceof Date ? s.date.toISOString().split('T')[0] : String(s.date),
        startTime: s.startTime,
        endTime: s.endTime
      }))

      const revalidation = validateSessions(
        [...allCurrentSessions, newSessionAsGenerated],
        staff,
        patients,
        rooms,
        unavailabilityMap
      )

      // Check if the new session passed validation (it should be the last one)
      const newSessionValid = revalidation.valid.length > validSessions.length

      if (newSessionValid) {
        validSessions.push(regenerateResult.newSession)

        const newTherapist = staff.find(s => s.id === regenerateResult.newSession!.therapistId)
        const newDateStr = regenerateResult.newSession.date instanceof Date
          ? regenerateResult.newSession.date.toISOString().split('T')[0]
          : regenerateResult.newSession.date

        modifications.regenerated.push({
          original: {
            therapistName: originalSession.therapistName,
            patientName: originalSession.patientName,
            date: formatDateToString(originalSession.date),
            startTime: originalSession.startTime
          },
          replacement: {
            therapistName: newTherapist?.name,
            patientName: originalSession.patientName,
            date: newDateStr,
            startTime: regenerateResult.newSession.startTime
          },
          reason: error.errors.join('; ')
        })
      } else {
        // Regenerated session also invalid, mark as removed
        modifications.removed.push({
          original: {
            therapistName: originalSession.therapistName,
            patientName: originalSession.patientName,
            date: formatDateToString(originalSession.date),
            startTime: originalSession.startTime
          },
          reason: `Original error: ${error.errors.join('; ')}. Regeneration failed validation.`
        })
      }
    } else {
      // Could not regenerate, mark as removed
      modifications.removed.push({
        original: {
          therapistName: originalSession.therapistName,
          patientName: originalSession.patientName,
          date: formatDateToString(originalSession.date),
          startTime: originalSession.startTime
        },
        reason: regenerateResult.reason || error.errors.join('; ')
      })
    }
  }

  // Add summary warnings
  if (modifications.regenerated.length > 0) {
    warnings.push(`${modifications.regenerated.length} session(s) were rescheduled to comply with current rules.`)
  }
  if (modifications.removed.length > 0) {
    warnings.push(`${modifications.removed.length} session(s) could not be scheduled and were removed.`)
  }

  return { validSessions, modifications, warnings }
}
