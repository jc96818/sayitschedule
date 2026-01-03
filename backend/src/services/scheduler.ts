import { staffRepository } from '../repositories/staff.js'
import { patientRepository } from '../repositories/patients.js'
import { ruleRepository } from '../repositories/rules.js'
import { roomRepository } from '../repositories/rooms.js'
import { staffAvailabilityRepository, type StaffAvailability } from '../repositories/staffAvailability.js'
import { organizationSettingsRepository } from '../repositories/organizationSettings.js'
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
import { evaluateRulesForReview, RuleReviewRequiredError } from './ruleReview.js'
import type { SessionWithDetails, ScheduleWithSessions } from '../repositories/schedules.js'
import {
  getLocalDayOfWeek,
  parseLocalDateStart,
  formatLocalDate,
  addDaysToLocalDate
} from '../utils/timezone.js'

// Map of staff ID to their unavailability records for a date range
export type UnavailabilityMap = Map<string, StaffAvailability[]>

export interface SessionCreate {
  scheduleId: string
  therapistId: string
  patientId: string
  sessionSpecId: string
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

export function getDayOfWeek(dateStr: string, timezone: string = 'UTC'): string {
  return getLocalDayOfWeek(dateStr, timezone)
}

export function validateSessions(
  sessions: GeneratedSession[],
  staff: StaffForScheduling[],
  patients: PatientForScheduling[],
  rooms: RoomForScheduling[] = [],
  unavailabilityMap?: UnavailabilityMap,
  timezone: string = 'UTC'
): { valid: SessionCreate[]; errors: ValidationError[]; warnings: string[] } {
  const valid: SessionCreate[] = []
  const errors: ValidationError[] = []
  const warnings: string[] = []

  const staffMap = new Map(staff.map(s => [s.id, s]))
  const patientMap = new Map(patients.map(p => [p.id, p]))
  const roomMap = new Map(rooms.map(r => [r.id, r]))
  const sessionSpecMap = new Map(
    patients.flatMap(patient => patient.sessionSpecs.map(spec => [spec.id, { patient, spec }] as const))
  )

  // Track scheduled sessions for overlap detection
  const therapistSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()
  const patientSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()
  const roomSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()
  const sessionSpecSessions: Map<string, { date: string; start: string; end: string }[]> = new Map()

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

    if (!session.sessionSpecId) {
      sessionErrors.push('Session is missing sessionSpecId')
    }

    const sessionSpecEntry = session.sessionSpecId ? sessionSpecMap.get(session.sessionSpecId) : undefined
    if (session.sessionSpecId && !sessionSpecEntry) {
      sessionErrors.push(`Session spec ${session.sessionSpecId} not found`)
    } else if (sessionSpecEntry && sessionSpecEntry.patient.id !== session.patientId) {
      sessionErrors.push(`Session spec ${session.sessionSpecId} does not belong to patient ${session.patientId}`)
    }

    if (therapist && patient && sessionSpecEntry) {
      // Check certification requirements
      const missingCerts = sessionSpecEntry.spec.requiredCertifications.filter(
        cert => !therapist.certifications.includes(cert)
      )
      if (missingCerts.length > 0) {
        sessionErrors.push(
          `Therapist ${therapist.name} missing certifications: ${missingCerts.join(', ')}`
        )
      }

      // Check therapist working hours
      const dayOfWeek = getDayOfWeek(session.date, timezone)
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
            // Compare dates using timezone-aware formatting
            const unavailDate = formatLocalDate(unavail.date, timezone)
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

          // Check if room has required capabilities for session spec
          if (sessionSpecEntry.spec.requiredRoomCapabilities && sessionSpecEntry.spec.requiredRoomCapabilities.length > 0) {
            const missingCapabilities = sessionSpecEntry.spec.requiredRoomCapabilities.filter(
              cap => !room.capabilities.includes(cap)
            )
            if (missingCapabilities.length > 0) {
              sessionErrors.push(
                `Room ${room.name} missing required capabilities: ${missingCapabilities.join(', ')}`
              )
            }
          }
        }
      } else if (sessionSpecEntry.spec.requiredRoomCapabilities && sessionSpecEntry.spec.requiredRoomCapabilities.length > 0) {
        // Session spec requires room capabilities but no room assigned
        warnings.push(
          `Patient ${patient.name} (${sessionSpecEntry.spec.name}) requires room capabilities (${sessionSpecEntry.spec.requiredRoomCapabilities.join(', ')}) but no room was assigned to this session`
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

      if (!sessionSpecSessions.has(session.sessionSpecId)) {
        sessionSpecSessions.set(session.sessionSpecId, [])
      }
      sessionSpecSessions.get(session.sessionSpecId)!.push({
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
        sessionSpecId: session.sessionSpecId,
        roomId: session.roomId || null,
        date: parseLocalDateStart(session.date, timezone),
        startTime: session.startTime,
        endTime: session.endTime,
        notes: session.notes || null
      })
    }
  }

  // Check if all session specs got their required sessions
  for (const patient of patients) {
    const displayId = patient.identifier || patient.id
    for (const spec of patient.sessionSpecs) {
      const scheduledCount = sessionSpecSessions.get(spec.id)?.length || 0
      if (scheduledCount < spec.sessionsPerWeek) {
        warnings.push(
          `Patient ${patient.name} (ID: ${displayId}) session spec "${spec.name}" is scheduled for ${scheduledCount} sessions instead of the requested ${spec.sessionsPerWeek}.`
        )
      }
    }
  }

  return { valid, errors, warnings }
}

export async function generateSchedule(
  organizationId: string,
  weekStartDate: Date
): Promise<ScheduleGenerationOutput> {
  // Fetch organization settings to get timezone
  const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
  const timezone = orgSettings.timezone || 'America/New_York'

  // Format the week start date as a local date string for timezone-aware operations
  const weekStartDateStr = formatLocalDate(weekStartDate, timezone)

  // Calculate week end date (6 days after start)
  const weekEndDateStr = addDaysToLocalDate(weekStartDateStr, 6, timezone)
  const weekEndDate = parseLocalDateStart(weekEndDateStr, timezone)

  // Fetch all required data
  const [staffResult, patientsResult, rules, roomsResult, unavailabilityResult] = await Promise.all([
    staffRepository.findByOrganization(organizationId, 'active'),
    patientRepository.findByOrganizationWithSessionSpecs(organizationId, 'active'),
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
  const patients: PatientForScheduling[] = (patientsResult || []).map(p => ({
    id: p.id,
    identifier: p.identifier,
    name: p.name,
    gender: p.gender,
    sessionSpecs: (p.sessionSpecs || []).map(spec => ({
      id: spec.id,
      name: spec.name,
      sessionsPerWeek: spec.sessionsPerWeek,
      durationMinutes: spec.durationMinutes ?? null,
      requiredCertifications: (spec.requiredCertifications as string[]) || [],
      preferredTimes: (spec.preferredTimes as string[]) || [],
      preferredRoomId: spec.preferredRoomId ?? null,
      requiredRoomCapabilities: (spec.requiredRoomCapabilities as string[]) || []
    }))
  }))
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
  if (patients.some(p => p.sessionSpecs.length === 0)) {
    throw new Error('One or more patients have no active session specs')
  }

  // Format rules for AI
  const rulesForAI: RuleForScheduling[] = rules.map(r => ({
    id: r.id,
    category: r.category,
    description: r.description,
    ruleLogic: r.ruleLogic as Record<string, unknown>,
    priority: r.priority
  }))

  const reviewResults = evaluateRulesForReview(
    rulesForAI.map(r => ({ id: r.id, description: r.description, ruleLogic: r.ruleLogic })),
    {
      staff: staff.map(s => ({ id: s.id, name: s.name })),
      patients: patients.map(p => ({ id: p.id, name: p.name }))
    }
  ).filter(r => r.status === 'needs_review')

  if (reviewResults.length > 0) {
    throw new RuleReviewRequiredError(reviewResults)
  }

  // Call OpenAI to generate schedule
  console.log(`Generating schedule for ${staff.length} staff, ${patients.length} patients, and ${rooms.length} rooms...`)
  const aiResult = await generateScheduleWithAI(weekStartDate, staff, patients, rulesForAI, rooms, timezone)
  console.log(`AI generated ${aiResult.sessions.length} sessions`)

  // Validate the generated sessions (including staff availability)
  const { valid, errors, warnings } = validateSessions(aiResult.sessions, staff, patients, rooms, unavailabilityMap, timezone)

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
  unavailabilityMap: UnavailabilityMap,
  timezone: string = 'UTC'
): Promise<RegenerateSessionResult> {
  // Find the patient for this session
  const patient = patients.find(p => p.id === originalSession.patientId)
  if (!patient) {
    return {
      success: false,
      reason: `Patient ${originalSession.patientId} no longer exists or is inactive`
    }
  }

  const sessionSpecId =
    originalSession.sessionSpecId ||
    (patient.sessionSpecs.length === 1 ? patient.sessionSpecs[0].id : null)

  if (!sessionSpecId) {
    return {
      success: false,
      reason: `Session ${originalSession.id} is missing sessionSpecId and the patient has multiple session specs`
    }
  }

  const sessionSpec = patient.sessionSpecs.find(s => s.id === sessionSpecId)
  if (!sessionSpec) {
    return {
      success: false,
      reason: `Session spec ${sessionSpecId} no longer exists or is inactive`
    }
  }

  // Calculate week dates using timezone-aware date handling
  const weekStartDateStr = formatLocalDate(weekStartDate, timezone)
  const weekDates: string[] = []
  for (let i = 0; i < 5; i++) {
    weekDates.push(addDaysToLocalDate(weekStartDateStr, i, timezone))
  }

  // Format existing sessions for the prompt (to avoid conflicts)
  const existingSessionsForPrompt = existingSessions.map(s => {
    const dateStr = s.date instanceof Date ? formatLocalDate(s.date, timezone) : s.date
    return `- therapistId=${s.therapistId} patientId=${s.patientId} sessionSpecId=${s.sessionSpecId} on ${dateStr} at ${s.startTime}-${s.endTime}`
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
      .map(u => formatLocalDate(u.date, timezone))

    return `- Staff ID: ${s.id}
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
3. The therapist must have ALL required certifications for the session spec
4. Honor gender pairing rules when specified
5. Standard session duration is 60 minutes

You must return ONLY a valid JSON object with no additional text.`

  const userPrompt = `A therapy session needs to be rescheduled for patientId="${patient.id}" during the week of ${weekDates[0]} to ${weekDates[4]}.

ORIGINAL SESSION:
- Therapist ID: ${originalSession.therapistId}
- Patient ID: ${originalSession.patientId}
- Session Spec ID: ${sessionSpec.id}
- Date: ${formatDateToString(originalSession.date)}
- Time: ${originalSession.startTime}

REASON FOR INVALIDATION:
${validationError}

SESSION SPEC REQUIREMENTS:
- Session Spec: ${sessionSpec.name} (ID: ${sessionSpec.id})
- Required Certifications: [${sessionSpec.requiredCertifications.join(', ')}]
- Required Room Capabilities: [${(sessionSpec.requiredRoomCapabilities || []).join(', ')}]
- Preferred Times: [${(sessionSpec.preferredTimes || []).join(', ')}]

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
    "sessionSpecId": "${sessionSpec.id}",
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
          sessionSpecId: result.session.sessionSpecId,
          roomId: result.session.roomId || null,
          date: parseLocalDateStart(result.session.date, timezone),
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
  // Fetch organization settings to get timezone
  const orgSettings = await organizationSettingsRepository.findByOrganizationId(organizationId)
  const timezone = orgSettings.timezone || 'America/New_York'

  const weekStartDate = new Date(sourceSchedule.weekStartDate)
  const weekStartDateStr = formatLocalDate(weekStartDate, timezone)

  // Calculate week end date using timezone-aware date handling
  const weekEndDateStr = addDaysToLocalDate(weekStartDateStr, 6, timezone)
  const weekEndDate = parseLocalDateStart(weekEndDateStr, timezone)

  // Fetch all required data
  const [staffResult, patientsResult, rules, roomsResult, unavailabilityResult] = await Promise.all([
    staffRepository.findByOrganization(organizationId, 'active'),
    patientRepository.findByOrganizationWithSessionSpecs(organizationId, 'active'),
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
  const patients: PatientForScheduling[] = (patientsResult || []).map(p => ({
    id: p.id,
    identifier: p.identifier,
    name: p.name,
    gender: p.gender,
    sessionSpecs: (p.sessionSpecs || []).map(spec => ({
      id: spec.id,
      name: spec.name,
      sessionsPerWeek: spec.sessionsPerWeek,
      durationMinutes: spec.durationMinutes ?? null,
      requiredCertifications: (spec.requiredCertifications as string[]) || [],
      preferredTimes: (spec.preferredTimes as string[]) || [],
      preferredRoomId: spec.preferredRoomId ?? null,
      requiredRoomCapabilities: (spec.requiredRoomCapabilities as string[]) || []
    }))
  }))
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
    sessionSpecId: s.sessionSpecId || '',
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
    unavailabilityMap,
    timezone
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
             (!error.session.sessionSpecId || s.sessionSpecId === error.session.sessionSpecId) &&
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
           (!error.session.sessionSpecId || s.sessionSpecId === error.session.sessionSpecId) &&
           s.startTime === error.session.startTime
    )

    if (!originalSession) {
      continue
    }

    console.log(`Regenerating session for patientId=${originalSession.patientId} (was: ${error.errors.join('; ')})`)

    const regenerateResult = await regenerateViolatingSession(
      originalSession,
      error.errors.join('; '),
      weekStartDate,
      validSessions,
      staff,
      patients,
      rulesForAI,
      rooms,
      unavailabilityMap,
      timezone
    )

    if (regenerateResult.success && regenerateResult.newSession) {
      // Validate the regenerated session to ensure it's actually valid
      const newSessionAsGenerated: GeneratedSession = {
        therapistId: regenerateResult.newSession.therapistId,
        patientId: regenerateResult.newSession.patientId,
        sessionSpecId: regenerateResult.newSession.sessionSpecId,
        roomId: regenerateResult.newSession.roomId || undefined,
        date: regenerateResult.newSession.date instanceof Date
          ? formatLocalDate(regenerateResult.newSession.date, timezone)
          : regenerateResult.newSession.date,
        startTime: regenerateResult.newSession.startTime,
        endTime: regenerateResult.newSession.endTime
      }

      // Check existing valid sessions to avoid conflicts
      const allCurrentSessions = validSessions.map(s => ({
        therapistId: s.therapistId,
        patientId: s.patientId,
        sessionSpecId: s.sessionSpecId,
        roomId: s.roomId || undefined,
        date: s.date instanceof Date ? formatLocalDate(s.date, timezone) : String(s.date),
        startTime: s.startTime,
        endTime: s.endTime
      }))

      const revalidation = validateSessions(
        [...allCurrentSessions, newSessionAsGenerated],
        staff,
        patients,
        rooms,
        unavailabilityMap,
        timezone
      )

      // Check if the new session passed validation (it should be the last one)
      const newSessionValid = revalidation.valid.length > validSessions.length

      if (newSessionValid) {
        validSessions.push(regenerateResult.newSession)

        const newTherapist = staff.find(s => s.id === regenerateResult.newSession!.therapistId)
        const newDateStr = regenerateResult.newSession.date instanceof Date
          ? formatLocalDate(regenerateResult.newSession.date, timezone)
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
