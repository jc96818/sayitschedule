/**
 * Availability Calculation Service
 *
 * This service provides deterministic availability calculation for the booking engine.
 * It computes available time slots based on:
 * - Staff default working hours
 * - Staff time-off/availability overrides
 * - Organization business hours
 * - Existing sessions
 * - Active appointment holds
 * - Room conflicts (optional)
 *
 * TIMEZONE HANDLING:
 * All date/time calculations are performed in the organization's configured timezone.
 * The database stores dates in UTC, but business logic (business hours, availability)
 * operates in local time. The timezone utilities handle the conversion.
 */

import { prisma } from '../repositories/base.js'
import { staffRepository } from '../repositories/staff.js'
import { staffAvailabilityRepository } from '../repositories/staffAvailability.js'
import {
  organizationSettingsRepository,
  type BusinessHours,
  type BusinessHoursDay
} from '../repositories/organizationSettings.js'
import { sessionsOverlap } from './scheduler.js'
import {
  formatLocalDate,
  getLocalDayOfWeek,
  getLocalDateRange,
  timeToMinutes
} from '../utils/timezone.js'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TimeSlot {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
}

export interface AvailableSlot extends TimeSlot {
  date: string // YYYY-MM-DD format
  staffId?: string
  staffName?: string
  roomId?: string
  roomName?: string
}

export interface AvailabilityQuery {
  organizationId: string
  dateFrom: Date
  dateTo: Date
  durationMinutes?: number // Desired appointment duration
  staffId?: string // Filter to specific staff member
  roomId?: string // Filter to specific room
  patientId?: string // For checking patient conflicts
}

export interface AvailabilityResult {
  slots: AvailableSlot[]
  query: {
    dateRange: { from: string; to: string }
    duration: number
    staffFilter?: string
    roomFilter?: string
  }
}

export interface StaffDayAvailability {
  staffId: string
  staffName: string
  date: string
  isAvailable: boolean
  workingHours?: TimeSlot
  blockedSlots: TimeSlot[]
  availableSlots: TimeSlot[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert minutes since midnight to HH:mm format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Merge overlapping time slots into contiguous blocks
 */
function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return []

  // Sort by start time
  const sorted = [...slots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  const merged: TimeSlot[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    const lastEnd = timeToMinutes(last.endTime)
    const currentStart = timeToMinutes(current.startTime)

    if (currentStart <= lastEnd) {
      // Overlapping or adjacent - extend the last slot
      const currentEnd = timeToMinutes(current.endTime)
      if (currentEnd > lastEnd) {
        last.endTime = current.endTime
      }
    } else {
      // Gap - add new slot
      merged.push(current)
    }
  }

  return merged
}

/**
 * Subtract blocked slots from available time range to get free slots
 */
function subtractBlockedSlots(
  availableRange: TimeSlot,
  blockedSlots: TimeSlot[]
): TimeSlot[] {
  const merged = mergeOverlappingSlots(blockedSlots)
  const result: TimeSlot[] = []

  let currentStart = timeToMinutes(availableRange.startTime)
  const rangeEnd = timeToMinutes(availableRange.endTime)

  for (const blocked of merged) {
    const blockedStart = timeToMinutes(blocked.startTime)
    const blockedEnd = timeToMinutes(blocked.endTime)

    // If there's free time before this blocked slot
    if (blockedStart > currentStart && currentStart < rangeEnd) {
      result.push({
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(Math.min(blockedStart, rangeEnd))
      })
    }

    // Move current start past the blocked slot
    currentStart = Math.max(currentStart, blockedEnd)
  }

  // Add any remaining time after all blocked slots
  if (currentStart < rangeEnd) {
    result.push({
      startTime: minutesToTime(currentStart),
      endTime: minutesToTime(rangeEnd)
    })
  }

  return result
}

/**
 * Generate time slots of a specific duration within available ranges
 */
function generateTimeSlots(
  freeRanges: TimeSlot[],
  durationMinutes: number,
  slotInterval: number
): TimeSlot[] {
  const slots: TimeSlot[] = []

  for (const range of freeRanges) {
    const rangeStart = timeToMinutes(range.startTime)
    const rangeEnd = timeToMinutes(range.endTime)

    // Generate slots at each interval that fits the duration
    let slotStart = rangeStart
    while (slotStart + durationMinutes <= rangeEnd) {
      slots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotStart + durationMinutes)
      })
      slotStart += slotInterval
    }
  }

  return slots
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class AvailabilityService {
  /**
   * Get available time slots for booking
   *
   * TIMEZONE: All date comparisons use the organization's configured timezone.
   * Input dates are expected in UTC but represent the local date range the user wants.
   */
  async getAvailableSlots(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const {
      organizationId,
      dateFrom,
      dateTo,
      durationMinutes,
      staffId,
      roomId,
      patientId
    } = query

    // Get organization settings for defaults and timezone
    const settings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const duration = durationMinutes || settings.defaultSessionDuration
    const slotInterval = settings.slotInterval
    const businessHours = settings.businessHours as unknown as BusinessHours
    const timezone = settings.timezone

    // Convert UTC dates to local date strings for iteration
    const fromDateStr = formatLocalDate(dateFrom, timezone)
    const toDateStr = formatLocalDate(dateTo, timezone)

    // Get all local dates in the range
    const dateStrings = getLocalDateRange(fromDateStr, toDateStr, timezone)

    // Get staff members (filtered if staffId provided)
    const staffMembers = staffId
      ? [await prisma.staff.findFirst({ where: { id: staffId, organizationId, status: 'active' } })]
      : await staffRepository.findByOrganization(organizationId, 'active')

    const activeStaff = staffMembers.filter(Boolean) as NonNullable<typeof staffMembers[0]>[]

    if (activeStaff.length === 0) {
      return {
        slots: [],
        query: {
          dateRange: { from: fromDateStr, to: toDateStr },
          duration,
          staffFilter: staffId,
          roomFilter: roomId
        }
      }
    }

    // Get staff availability overrides for the date range
    const availabilityOverrides = await staffAvailabilityRepository.getApprovedUnavailability(
      organizationId,
      dateFrom,
      dateTo
    )

    // Build a map of staff ID -> date -> availability override
    // Use timezone-aware date formatting for the map keys
    const overrideMap = new Map<string, Map<string, typeof availabilityOverrides[0]>>()
    for (const override of availabilityOverrides) {
      if (!overrideMap.has(override.staffId)) {
        overrideMap.set(override.staffId, new Map())
      }
      const overrideDateStr = formatLocalDate(override.date, timezone)
      overrideMap.get(override.staffId)!.set(overrideDateStr, override)
    }

    // Get existing sessions for the date range
    const existingSessions = await prisma.session.findMany({
      where: {
        schedule: { organizationId },
        date: { gte: dateFrom, lte: dateTo },
        status: { notIn: ['cancelled', 'late_cancel'] }
      },
      include: {
        schedule: true
      }
    })

    // Build session map: staffId -> date -> sessions
    // Use timezone-aware date formatting for the map keys
    const sessionMap = new Map<string, Map<string, typeof existingSessions>>()
    for (const session of existingSessions) {
      if (!sessionMap.has(session.therapistId)) {
        sessionMap.set(session.therapistId, new Map())
      }
      const sessionDateStr = formatLocalDate(session.date, timezone)
      if (!sessionMap.get(session.therapistId)!.has(sessionDateStr)) {
        sessionMap.get(session.therapistId)!.set(sessionDateStr, [])
      }
      sessionMap.get(session.therapistId)!.get(sessionDateStr)!.push(session)
    }

    // Get active appointment holds
    const activeHolds = await prisma.appointmentHold.findMany({
      where: {
        organizationId,
        date: { gte: dateFrom, lte: dateTo },
        expiresAt: { gt: new Date() },
        releasedAt: null,
        convertedToSessionId: null
      }
    })

    // Build holds map: staffId -> date -> holds
    // Use timezone-aware date formatting for the map keys
    const holdMap = new Map<string, Map<string, typeof activeHolds>>()
    for (const hold of activeHolds) {
      if (hold.staffId) {
        if (!holdMap.has(hold.staffId)) {
          holdMap.set(hold.staffId, new Map())
        }
        const holdDateStr = formatLocalDate(hold.date, timezone)
        if (!holdMap.get(hold.staffId)!.has(holdDateStr)) {
          holdMap.get(hold.staffId)!.set(holdDateStr, [])
        }
        holdMap.get(hold.staffId)!.get(holdDateStr)!.push(hold)
      }
    }

    // Check for patient's existing sessions if patientId provided
    let patientSessions: typeof existingSessions = []
    if (patientId) {
      patientSessions = existingSessions.filter(s => s.patientId === patientId)
    }

    // Calculate available slots for each staff member on each date
    const allSlots: AvailableSlot[] = []

    for (const staff of activeStaff) {
      const defaultHours = staff.defaultHours as Record<string, { start: string; end: string } | null> | null

      for (const dateStr of dateStrings) {
        // Use timezone-aware day of week calculation
        const dayOfWeek = getLocalDayOfWeek(dateStr, timezone)

        // Check organization business hours for this day
        const bizHoursDay = businessHours[dayOfWeek as keyof BusinessHours] as BusinessHoursDay
        if (!bizHoursDay?.open) {
          continue // Organization is closed this day
        }

        // Check staff availability override for this day
        const override = overrideMap.get(staff.id)?.get(dateStr)
        if (override && !override.available) {
          continue // Staff is completely unavailable this day
        }

        // Determine working hours
        let workingHours: TimeSlot | null = null

        if (override && override.available && override.startTime && override.endTime) {
          // Staff has custom hours this day
          workingHours = { startTime: override.startTime, endTime: override.endTime }
        } else if (defaultHours && defaultHours[dayOfWeek]) {
          // Use staff's default hours
          const staffHours = defaultHours[dayOfWeek]!
          workingHours = { startTime: staffHours.start, endTime: staffHours.end }
        }

        if (!workingHours) {
          continue // Staff doesn't work this day
        }

        // Constrain to business hours
        const bizStart = timeToMinutes(bizHoursDay.start)
        const bizEnd = timeToMinutes(bizHoursDay.end)
        const staffStart = timeToMinutes(workingHours.startTime)
        const staffEnd = timeToMinutes(workingHours.endTime)

        const effectiveStart = Math.max(bizStart, staffStart)
        const effectiveEnd = Math.min(bizEnd, staffEnd)

        if (effectiveStart >= effectiveEnd) {
          continue // No overlap between business hours and staff hours
        }

        const effectiveHours: TimeSlot = {
          startTime: minutesToTime(effectiveStart),
          endTime: minutesToTime(effectiveEnd)
        }

        // Collect blocked slots (existing sessions + holds)
        const blockedSlots: TimeSlot[] = []

        // Add existing sessions
        const staffSessions = sessionMap.get(staff.id)?.get(dateStr) || []
        for (const session of staffSessions) {
          blockedSlots.push({
            startTime: session.startTime,
            endTime: session.endTime
          })
        }

        // Add active holds
        const staffHolds = holdMap.get(staff.id)?.get(dateStr) || []
        for (const hold of staffHolds) {
          blockedSlots.push({
            startTime: hold.startTime,
            endTime: hold.endTime
          })
        }

        // Add patient's other sessions if checking patient availability
        if (patientId) {
          const patientSessionsOnDate = patientSessions.filter(
            s => formatLocalDate(s.date, timezone) === dateStr
          )
          for (const session of patientSessionsOnDate) {
            blockedSlots.push({
              startTime: session.startTime,
              endTime: session.endTime
            })
          }
        }

        // Calculate free slots
        const freeRanges = subtractBlockedSlots(effectiveHours, blockedSlots)
        const slots = generateTimeSlots(freeRanges, duration, slotInterval)

        // Add to results with staff info
        for (const slot of slots) {
          allSlots.push({
            ...slot,
            date: dateStr,
            staffId: staff.id,
            staffName: staff.name
          })
        }
      }
    }

    // Sort by date, then time, then staff name
    allSlots.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      const timeCompare = a.startTime.localeCompare(b.startTime)
      if (timeCompare !== 0) return timeCompare
      return (a.staffName || '').localeCompare(b.staffName || '')
    })

    return {
      slots: allSlots,
      query: {
        dateRange: { from: fromDateStr, to: toDateStr },
        duration,
        staffFilter: staffId,
        roomFilter: roomId
      }
    }
  }

  /**
   * Get detailed availability for a single staff member on a single day
   *
   * TIMEZONE: Uses the organization's configured timezone for day-of-week
   * and business hours calculations.
   */
  async getStaffDayAvailability(
    organizationId: string,
    staffId: string,
    date: Date
  ): Promise<StaffDayAvailability | null> {
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId, status: 'active' }
    })

    if (!staff) {
      return null
    }

    // Get settings including timezone
    const settings = await organizationSettingsRepository.findByOrganizationId(organizationId)
    const timezone = settings.timezone
    const businessHours = settings.businessHours as unknown as BusinessHours

    // Use timezone-aware date formatting
    const dateStr = formatLocalDate(date, timezone)
    const dayOfWeek = getLocalDayOfWeek(dateStr, timezone)

    const bizHoursDay = businessHours[dayOfWeek as keyof BusinessHours] as BusinessHoursDay

    // Get availability override
    const overrides = await staffAvailabilityRepository.getApprovedUnavailability(
      organizationId,
      date,
      date
    )
    const override = overrides.find(o => o.staffId === staffId)

    // Check if staff is available at all
    if (!bizHoursDay?.open) {
      return {
        staffId,
        staffName: staff.name,
        date: dateStr,
        isAvailable: false,
        blockedSlots: [],
        availableSlots: []
      }
    }

    if (override && !override.available) {
      return {
        staffId,
        staffName: staff.name,
        date: dateStr,
        isAvailable: false,
        blockedSlots: [],
        availableSlots: []
      }
    }

    // Determine working hours
    const defaultHours = staff.defaultHours as Record<string, { start: string; end: string } | null> | null
    let workingHours: TimeSlot | undefined

    if (override && override.available && override.startTime && override.endTime) {
      workingHours = { startTime: override.startTime, endTime: override.endTime }
    } else if (defaultHours && defaultHours[dayOfWeek]) {
      const staffHours = defaultHours[dayOfWeek]!
      workingHours = { startTime: staffHours.start, endTime: staffHours.end }
    }

    if (!workingHours) {
      return {
        staffId,
        staffName: staff.name,
        date: dateStr,
        isAvailable: false,
        blockedSlots: [],
        availableSlots: []
      }
    }

    // Constrain to business hours
    const bizStart = timeToMinutes(bizHoursDay.start)
    const bizEnd = timeToMinutes(bizHoursDay.end)
    const staffStart = timeToMinutes(workingHours.startTime)
    const staffEnd = timeToMinutes(workingHours.endTime)

    const effectiveStart = Math.max(bizStart, staffStart)
    const effectiveEnd = Math.min(bizEnd, staffEnd)

    if (effectiveStart >= effectiveEnd) {
      return {
        staffId,
        staffName: staff.name,
        date: dateStr,
        isAvailable: false,
        blockedSlots: [],
        availableSlots: []
      }
    }

    const effectiveHours: TimeSlot = {
      startTime: minutesToTime(effectiveStart),
      endTime: minutesToTime(effectiveEnd)
    }

    // Get existing sessions
    const sessions = await prisma.session.findMany({
      where: {
        therapistId: staffId,
        date: date,
        status: { notIn: ['cancelled', 'late_cancel'] }
      }
    })

    // Get active holds
    const holds = await prisma.appointmentHold.findMany({
      where: {
        staffId,
        date: date,
        expiresAt: { gt: new Date() },
        releasedAt: null,
        convertedToSessionId: null
      }
    })

    const blockedSlots: TimeSlot[] = [
      ...sessions.map(s => ({ startTime: s.startTime, endTime: s.endTime })),
      ...holds.map(h => ({ startTime: h.startTime, endTime: h.endTime }))
    ]

    const freeRanges = subtractBlockedSlots(effectiveHours, blockedSlots)

    return {
      staffId,
      staffName: staff.name,
      date: dateStr,
      isAvailable: true,
      workingHours: effectiveHours,
      blockedSlots: mergeOverlappingSlots(blockedSlots),
      availableSlots: freeRanges
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async isSlotAvailable(
    organizationId: string,
    staffId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeSessionId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    const dayAvailability = await this.getStaffDayAvailability(organizationId, staffId, date)

    if (!dayAvailability?.isAvailable) {
      return {
        available: false,
        reason: 'Staff member is not available on this day'
      }
    }

    const slotStart = timeToMinutes(startTime)
    const slotEnd = timeToMinutes(endTime)

    // Check if slot is within working hours
    if (dayAvailability.workingHours) {
      const workStart = timeToMinutes(dayAvailability.workingHours.startTime)
      const workEnd = timeToMinutes(dayAvailability.workingHours.endTime)

      if (slotStart < workStart || slotEnd > workEnd) {
        return {
          available: false,
          reason: `Time is outside working hours (${dayAvailability.workingHours.startTime}-${dayAvailability.workingHours.endTime})`
        }
      }
    }

    // Check for conflicts with existing bookings
    const sessions = await prisma.session.findMany({
      where: {
        therapistId: staffId,
        date: date,
        status: { notIn: ['cancelled', 'late_cancel'] },
        id: excludeSessionId ? { not: excludeSessionId } : undefined
      }
    })

    for (const session of sessions) {
      if (sessionsOverlap(startTime, endTime, session.startTime, session.endTime)) {
        return {
          available: false,
          reason: `Conflicts with existing session at ${session.startTime}-${session.endTime}`
        }
      }
    }

    // Check for conflicts with holds
    const holds = await prisma.appointmentHold.findMany({
      where: {
        staffId,
        date: date,
        expiresAt: { gt: new Date() },
        releasedAt: null,
        convertedToSessionId: null
      }
    })

    for (const hold of holds) {
      if (sessionsOverlap(startTime, endTime, hold.startTime, hold.endTime)) {
        return {
          available: false,
          reason: 'Time slot is currently on hold for another booking'
        }
      }
    }

    return { available: true }
  }
}

export const availabilityService = new AvailabilityService()
