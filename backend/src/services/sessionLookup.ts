import { prisma } from '../db/index.js'
import type { SessionWithDetails } from '../repositories/schedules.js'
import { formatLocalDate, getLocalDayOfWeek, addDaysToLocalDate } from '../utils/timezone.js'

export interface SessionLookupParams {
  scheduleId: string
  therapistName?: string
  patientName?: string
  dayOfWeek?: string
  startTime?: string
  timezone?: string
}

export interface SessionLookupResult {
  session: SessionWithDetails
  matchScore: number
  matchDetails: string[]
}

export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function getDayOfWeekFromDate(date: Date, timezone: string = 'UTC'): string {
  const dateStr = formatLocalDate(date, timezone)
  return getLocalDayOfWeek(dateStr, timezone)
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim()
}

export function fuzzyNameMatch(searchName: string, actualName: string): boolean {
  const search = normalizeName(searchName)
  const actual = normalizeName(actualName)

  // Exact match
  if (actual === search) return true

  // Check if search is contained in actual (e.g., "John" matches "John Smith")
  if (actual.includes(search)) return true

  // Check if actual contains the first name
  const searchParts = search.split(' ')
  const actualParts = actual.split(' ')

  // First name match
  if (searchParts[0] && actualParts[0] === searchParts[0]) return true

  // Last name match
  if (searchParts.length > 1 && actualParts.length > 1) {
    if (actualParts[actualParts.length - 1] === searchParts[searchParts.length - 1]) return true
  }

  return false
}

export async function findMatchingSessions(params: SessionLookupParams): Promise<SessionLookupResult[]> {
  // Get all sessions for this schedule with names
  const sessionData = await prisma.session.findMany({
    where: { scheduleId: params.scheduleId },
    include: {
      therapist: { select: { name: true } },
      patient: { select: { name: true } }
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
  })

  const results: SessionLookupResult[] = []

  for (const row of sessionData) {
    const sessionWithDetails: SessionWithDetails = {
      ...row,
      therapistName: row.therapist?.name || undefined,
      patientName: row.patient?.name || undefined
    }

    let matchScore = 0
    const matchDetails: string[] = []

    // Check therapist name match
    if (params.therapistName && row.therapist?.name) {
      if (fuzzyNameMatch(params.therapistName, row.therapist.name)) {
        matchScore += 40
        matchDetails.push(`Therapist: ${row.therapist.name}`)
      }
    }

    // Check patient name match
    if (params.patientName && row.patient?.name) {
      if (fuzzyNameMatch(params.patientName, row.patient.name)) {
        matchScore += 40
        matchDetails.push(`Patient: ${row.patient.name}`)
      }
    }

    // Check day of week match
    if (params.dayOfWeek) {
      const timezone = params.timezone || 'UTC'
      const sessionDay = getDayOfWeekFromDate(new Date(row.date), timezone)
      if (sessionDay === params.dayOfWeek.toLowerCase()) {
        matchScore += 30
        matchDetails.push(`Day: ${sessionDay}`)
      }
    }

    // Check time match
    if (params.startTime) {
      const sessionTime = row.startTime
      if (sessionTime === params.startTime) {
        matchScore += 30
        matchDetails.push(`Time: ${sessionTime}`)
      }
    }

    // Only include if we have at least one match
    if (matchScore > 0) {
      results.push({
        session: sessionWithDetails,
        matchScore,
        matchDetails
      })
    }
  }

  // Sort by match score descending
  return results.sort((a, b) => b.matchScore - a.matchScore)
}

export async function findBestMatchingSession(params: SessionLookupParams): Promise<SessionWithDetails | null> {
  const results = await findMatchingSessions(params)

  // Return the highest scoring match if it's above threshold
  if (results.length > 0 && results[0].matchScore >= 40) {
    return results[0].session
  }

  return null
}

export async function findSessionsByTherapistName(
  scheduleId: string,
  therapistName: string
): Promise<SessionWithDetails[]> {
  const results = await findMatchingSessions({ scheduleId, therapistName })
  return results.map(r => r.session)
}

export async function findSessionsByPatientName(
  scheduleId: string,
  patientName: string
): Promise<SessionWithDetails[]> {
  const results = await findMatchingSessions({ scheduleId, patientName })
  return results.map(r => r.session)
}

export async function findSessionsByDayOfWeek(
  scheduleId: string,
  dayOfWeek: string,
  timezone: string = 'UTC'
): Promise<SessionWithDetails[]> {
  // Get all sessions and filter by day
  const sessionData = await prisma.session.findMany({
    where: { scheduleId },
    include: {
      therapist: { select: { name: true } },
      patient: { select: { name: true } }
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
  })

  return sessionData
    .filter(row => getDayOfWeekFromDate(new Date(row.date), timezone) === dayOfWeek.toLowerCase())
    .map(row => ({
      ...row,
      therapistName: row.therapist?.name || undefined,
      patientName: row.patient?.name || undefined
    }))
}

export interface ConflictCheckParams {
  scheduleId: string
  therapistId?: string
  patientId?: string
  date: Date
  startTime: string
  endTime: string
  excludeSessionId?: string
  timezone?: string
}

export async function checkForConflicts(params: ConflictCheckParams): Promise<SessionWithDetails[]> {
  const sessionData = await prisma.session.findMany({
    where: { scheduleId: params.scheduleId },
    include: {
      therapist: { select: { name: true } },
      patient: { select: { name: true } }
    }
  })

  const conflicts: SessionWithDetails[] = []
  const timezone = params.timezone || 'UTC'
  const paramDate = formatLocalDate(params.date, timezone)

  for (const row of sessionData) {
    // Skip the session we're updating
    if (params.excludeSessionId && row.id === params.excludeSessionId) {
      continue
    }

    const sessionDate = formatLocalDate(new Date(row.date), timezone)

    // Check if same date
    if (sessionDate !== paramDate) {
      continue
    }

    // Check for time overlap
    const sessionStart = row.startTime
    const sessionEnd = row.endTime
    const newStart = params.startTime
    const newEnd = params.endTime

    // Simple overlap check (assuming HH:mm format)
    const hasOverlap = newStart < sessionEnd && newEnd > sessionStart

    if (!hasOverlap) {
      continue
    }

    // Check if it's a conflict for therapist or patient
    const isTherapistConflict = params.therapistId && row.therapistId === params.therapistId
    const isPatientConflict = params.patientId && row.patientId === params.patientId

    if (isTherapistConflict || isPatientConflict) {
      conflicts.push({
        ...row,
        therapistName: row.therapist?.name || undefined,
        patientName: row.patient?.name || undefined
      })
    }
  }

  return conflicts
}

export function calculateNewEndTime(startTime: string, durationMinutes: number = 60): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMinutes = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
}

export function getDateForDayOfWeek(weekStartDate: Date, targetDayOfWeek: string, timezone: string = 'UTC'): Date {
  const targetIndex = DAYS_OF_WEEK.indexOf(targetDayOfWeek.toLowerCase())
  if (targetIndex === -1) {
    throw new Error(`Invalid day of week: ${targetDayOfWeek}`)
  }

  // Get the week start date in the target timezone
  const weekStartStr = formatLocalDate(weekStartDate, timezone)
  const currentDay = DAYS_OF_WEEK.indexOf(getLocalDayOfWeek(weekStartStr, timezone))
  const daysToAdd = targetIndex - currentDay

  // Use timezone-aware date addition
  const resultDateStr = addDaysToLocalDate(weekStartStr, daysToAdd, timezone)

  // Parse the result date string as a local date (noon to avoid DST issues)
  const [year, month, day] = resultDateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}
