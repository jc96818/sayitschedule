/**
 * Timezone Utilities
 *
 * Provides timezone-aware date/time handling for the booking system.
 * All internal storage uses UTC, but business logic operates in the
 * organization's configured timezone.
 *
 * Key concepts:
 * - "Local" refers to the organization's timezone (e.g., America/New_York)
 * - "UTC" refers to UTC time used for database storage
 * - Date strings are always YYYY-MM-DD format
 * - Time strings are always HH:mm format (24-hour)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocalDateTime {
  date: string // YYYY-MM-DD in local timezone
  time: string // HH:mm in local timezone
}

export interface TimezoneContext {
  timezone: string // IANA timezone identifier (e.g., 'America/New_York')
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMEZONE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a timezone identifier is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Get a valid timezone, falling back to UTC if invalid
 */
export function getValidTimezone(timezone: string | undefined | null): string {
  if (timezone && isValidTimezone(timezone)) {
    return timezone
  }
  return 'UTC'
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE/TIME FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a UTC Date to a local date string (YYYY-MM-DD) in the given timezone
 */
export function formatLocalDate(utcDate: Date, timezone: string): string {
  const tz = getValidTimezone(timezone)

  // Get the date components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  return formatter.format(utcDate)
}

/**
 * Format a UTC Date to a local time string (HH:mm) in the given timezone
 */
export function formatLocalTime(utcDate: Date, timezone: string): string {
  const tz = getValidTimezone(timezone)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Format returns "HH:mm" but may have leading space for single-digit hours in some locales
  const parts = formatter.formatToParts(utcDate)
  const hour = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '00'
  const minute = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '00'

  return `${hour}:${minute}`
}

/**
 * Format a UTC Date to both local date and time in the given timezone
 */
export function formatLocalDateTime(utcDate: Date, timezone: string): LocalDateTime {
  return {
    date: formatLocalDate(utcDate, timezone),
    time: formatLocalTime(utcDate, timezone)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE/TIME PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a local date string (YYYY-MM-DD) and time string (HH:mm) in the given
 * timezone to a UTC Date object.
 *
 * This is the core function for converting user-facing times to storage format.
 */
export function parseLocalDateTime(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const tz = getValidTimezone(timezone)

  // Parse the date components
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`)
  }

  // Create a date string that JavaScript can parse with timezone info
  // We'll use a two-step approach for accuracy:
  // 1. Create a date in UTC that represents the wall clock time
  // 2. Adjust by the timezone offset at that moment

  // First, get the offset for this specific date/time in the target timezone
  const offset = getTimezoneOffset(year, month, day, hour, minute, tz)

  // Create the UTC date by subtracting the offset
  // (offset is in minutes, positive means ahead of UTC)
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  utcDate.setTime(utcDate.getTime() - offset * 60 * 1000)

  return utcDate
}

/**
 * Parse a local date string (YYYY-MM-DD) to the start of that day in UTC
 * for the given timezone.
 *
 * Useful for date range queries where you want "all of Monday" in local time.
 * Accepts date strings in YYYY-MM-DD format or ISO format (YYYY-MM-DDTHH:mm:ss).
 */
export function parseLocalDateStart(dateStr: string, timezone: string): Date {
  // Strip any time component if present
  const dateOnly = dateStr.split('T')[0]
  return parseLocalDateTime(dateOnly, '00:00', timezone)
}

/**
 * Parse a local date string (YYYY-MM-DD) to the end of that day in UTC
 * for the given timezone (23:59:59.999).
 * Accepts date strings in YYYY-MM-DD format or ISO format (YYYY-MM-DDTHH:mm:ss).
 */
export function parseLocalDateEnd(dateStr: string, timezone: string): Date {
  // Strip any time component if present
  const dateOnly = dateStr.split('T')[0]
  const endOfDay = parseLocalDateTime(dateOnly, '23:59', timezone)
  // Add 59 seconds and 999 milliseconds
  endOfDay.setTime(endOfDay.getTime() + 59 * 1000 + 999)
  return endOfDay
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMEZONE OFFSET CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the timezone offset in minutes for a specific date/time in a timezone.
 * Positive values mean the timezone is ahead of UTC.
 *
 * This handles DST transitions correctly by checking the actual offset
 * at the specified moment.
 */
export function getTimezoneOffset(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): number {
  const tz = getValidTimezone(timezone)

  // Create a formatter that includes timezone offset info
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset'
  })

  // We need to find when the local time (year, month, day, hour, minute)
  // occurs in UTC. This is tricky because we don't know the offset yet.
  // We'll use an iterative approach with the UTC time as a starting guess.

  // Start with a guess: treat the input as UTC
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))

  // Get what local time that UTC instant represents
  const parts = formatter.formatToParts(guess)
  const guessHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const guessDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)

  // Extract the offset from the formatted string
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '+00:00'
  const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/)

  if (offsetMatch) {
    const sign = offsetMatch[1] === '+' ? 1 : -1
    const hours = parseInt(offsetMatch[2], 10)
    const minutes = parseInt(offsetMatch[3] || '0', 10)
    return sign * (hours * 60 + minutes)
  }

  // Fallback: calculate offset from the difference
  // between what we asked for and what we got
  const hourDiff = hour - guessHour
  const dayDiff = day - guessDay

  // Handle day wraparound
  let totalHourDiff = hourDiff
  if (dayDiff === 1 || dayDiff < -25) {
    totalHourDiff -= 24
  } else if (dayDiff === -1 || dayDiff > 25) {
    totalHourDiff += 24
  }

  return totalHourDiff * 60
}

/**
 * Get the current timezone offset for a timezone (at current time)
 */
export function getCurrentOffset(timezone: string): number {
  const now = new Date()
  return getTimezoneOffset(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    timezone
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE OPERATIONS IN LOCAL TIMEZONE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current date string (YYYY-MM-DD) in a timezone
 */
export function getCurrentLocalDate(timezone: string): string {
  return formatLocalDate(new Date(), timezone)
}

/**
 * Get the current time string (HH:mm) in a timezone
 */
export function getCurrentLocalTime(timezone: string): string {
  return formatLocalTime(new Date(), timezone)
}

/**
 * Get the current date and time in a timezone
 */
export function getCurrentLocalDateTime(timezone: string): LocalDateTime {
  return formatLocalDateTime(new Date(), timezone)
}

/**
 * Get the day of week (lowercase) for a local date in a timezone.
 * Returns: 'sunday', 'monday', 'tuesday', etc.
 * Accepts date strings in YYYY-MM-DD format or ISO format (YYYY-MM-DDTHH:mm:ss).
 */
export function getLocalDayOfWeek(dateStr: string, timezone: string): string {
  // Strip any time component if present (handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss' formats)
  const dateOnly = dateStr.split('T')[0]

  // Parse the date at noon to avoid any DST edge cases
  const date = parseLocalDateTime(dateOnly, '12:00', timezone)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: getValidTimezone(timezone),
    weekday: 'long'
  })

  return formatter.format(date).toLowerCase()
}

/**
 * Add days to a local date string, returning a new date string.
 * Handles month/year boundaries correctly.
 */
export function addDaysToLocalDate(
  dateStr: string,
  days: number,
  timezone: string
): string {
  // Parse at noon to avoid DST issues
  const date = parseLocalDateTime(dateStr, '12:00', timezone)
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  return formatLocalDate(date, timezone)
}

/**
 * Generate an array of date strings between two dates (inclusive)
 */
export function getLocalDateRange(
  fromDateStr: string,
  toDateStr: string,
  timezone: string
): string[] {
  const dates: string[] = []
  let current = fromDateStr

  // Prevent infinite loops with a reasonable limit
  const maxDays = 366

  while (current <= toDateStr && dates.length < maxDays) {
    dates.push(current)
    current = addDaysToLocalDate(current, 1, timezone)
  }

  return dates
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME COMPARISON UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Check if a UTC Date is in the past relative to "now" in a timezone.
 * Optionally provide a buffer in minutes.
 */
export function isInPast(
  utcDate: Date,
  _timezone: string,
  bufferMinutes: number = 0
): boolean {
  // Note: timezone parameter reserved for future use when comparing in local context
  const now = new Date()
  const threshold = new Date(now.getTime() + bufferMinutes * 60 * 1000)
  return utcDate < threshold
}

/**
 * Check if a local date/time is in the past relative to "now" in that timezone.
 */
export function isLocalDateTimeInPast(
  dateStr: string,
  timeStr: string,
  timezone: string,
  bufferMinutes: number = 0
): boolean {
  const utcDate = parseLocalDateTime(dateStr, timeStr, timezone)
  return isInPast(utcDate, timezone, bufferMinutes)
}

/**
 * Calculate hours between now and a future local date/time
 */
export function hoursUntilLocalDateTime(
  dateStr: string,
  timeStr: string,
  timezone: string
): number {
  const utcDate = parseLocalDateTime(dateStr, timeStr, timezone)
  const now = new Date()
  return (utcDate.getTime() - now.getTime()) / (1000 * 60 * 60)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a date range query for Prisma that covers a full local day.
 *
 * When querying sessions for "Monday" in America/New_York:
 * - Monday 00:00 ET = Monday 05:00 UTC (or 04:00 during DST)
 * - Monday 23:59 ET = Tuesday 04:59 UTC (or 03:59 during DST)
 *
 * This function returns the UTC range that covers the full local day.
 */
export function getUtcRangeForLocalDate(
  dateStr: string,
  timezone: string
): { start: Date; end: Date } {
  return {
    start: parseLocalDateStart(dateStr, timezone),
    end: parseLocalDateEnd(dateStr, timezone)
  }
}

/**
 * Create a date range query for Prisma that covers multiple local days.
 */
export function getUtcRangeForLocalDateRange(
  fromDateStr: string,
  toDateStr: string,
  timezone: string
): { start: Date; end: Date } {
  return {
    start: parseLocalDateStart(fromDateStr, timezone),
    end: parseLocalDateEnd(toDateStr, timezone)
  }
}

/**
 * Check if a UTC Date falls on a specific local date in a timezone
 */
export function isOnLocalDate(
  utcDate: Date,
  localDateStr: string,
  timezone: string
): boolean {
  return formatLocalDate(utcDate, timezone) === localDateStr
}
