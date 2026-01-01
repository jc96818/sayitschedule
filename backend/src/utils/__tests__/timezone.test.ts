/**
 * Timezone Utilities Tests
 *
 * Tests timezone-aware date/time handling for the booking system.
 */

import { describe, it, expect } from 'vitest'
import {
  isValidTimezone,
  getValidTimezone,
  formatLocalDate,
  formatLocalTime,
  formatLocalDateTime,
  parseLocalDateTime,
  parseLocalDateStart,
  parseLocalDateEnd,
  getLocalDayOfWeek,
  addDaysToLocalDate,
  getLocalDateRange,
  timeToMinutes,
  minutesToTime,
  hoursUntilLocalDateTime,
  getUtcRangeForLocalDate,
  isOnLocalDate
} from '../timezone.js'

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    it('should return true for valid IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true)
      expect(isValidTimezone('America/Los_Angeles')).toBe(true)
      expect(isValidTimezone('Europe/London')).toBe(true)
      expect(isValidTimezone('Asia/Tokyo')).toBe(true)
      expect(isValidTimezone('UTC')).toBe(true)
    })

    it('should return false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false)
      expect(isValidTimezone('Not_A_Timezone')).toBe(false)
      expect(isValidTimezone('')).toBe(false)
    })
  })

  describe('getValidTimezone', () => {
    it('should return the timezone if valid', () => {
      expect(getValidTimezone('America/New_York')).toBe('America/New_York')
      expect(getValidTimezone('UTC')).toBe('UTC')
    })

    it('should return UTC for invalid or missing timezones', () => {
      expect(getValidTimezone('Invalid/Timezone')).toBe('UTC')
      expect(getValidTimezone('')).toBe('UTC')
      expect(getValidTimezone(null)).toBe('UTC')
      expect(getValidTimezone(undefined)).toBe('UTC')
    })
  })

  describe('formatLocalDate', () => {
    it('should format UTC dates to local date strings', () => {
      // Create a known UTC date: Jan 15, 2024 at 10:00 UTC
      const utcDate = new Date(Date.UTC(2024, 0, 15, 10, 0, 0))

      // In UTC, this should be 2024-01-15
      expect(formatLocalDate(utcDate, 'UTC')).toBe('2024-01-15')
    })

    it('should handle timezone offset correctly', () => {
      // Jan 1, 2024 at 03:00 UTC is still Dec 31, 2023 in New York (EST = UTC-5)
      const utcDate = new Date(Date.UTC(2024, 0, 1, 3, 0, 0))

      // In New York (during EST), 03:00 UTC is 22:00 (10 PM) on Dec 31, 2023
      expect(formatLocalDate(utcDate, 'America/New_York')).toBe('2023-12-31')
    })

    it('should handle date correctly for LA timezone', () => {
      // Jan 15, 2024 at 06:00 UTC is still Jan 14 in LA (PST = UTC-8)
      const utcDate = new Date(Date.UTC(2024, 0, 15, 6, 0, 0))
      expect(formatLocalDate(utcDate, 'America/Los_Angeles')).toBe('2024-01-14')
    })
  })

  describe('formatLocalTime', () => {
    it('should format UTC dates to local time strings', () => {
      // 14:30 UTC
      const utcDate = new Date(Date.UTC(2024, 0, 15, 14, 30, 0))

      expect(formatLocalTime(utcDate, 'UTC')).toBe('14:30')
    })

    it('should apply timezone offset', () => {
      // 14:30 UTC should be 09:30 in New York (EST = UTC-5)
      const utcDate = new Date(Date.UTC(2024, 0, 15, 14, 30, 0))
      expect(formatLocalTime(utcDate, 'America/New_York')).toBe('09:30')
    })
  })

  describe('formatLocalDateTime', () => {
    it('should return both date and time', () => {
      const utcDate = new Date(Date.UTC(2024, 0, 15, 14, 30, 0))
      const result = formatLocalDateTime(utcDate, 'UTC')

      expect(result).toEqual({
        date: '2024-01-15',
        time: '14:30'
      })
    })
  })

  describe('parseLocalDateTime', () => {
    it('should parse local date/time to UTC', () => {
      // 2024-01-15 at 09:30 in New York should be 14:30 UTC (EST = UTC-5)
      const result = parseLocalDateTime('2024-01-15', '09:30', 'America/New_York')

      expect(result.getUTCHours()).toBe(14)
      expect(result.getUTCMinutes()).toBe(30)
      expect(result.getUTCDate()).toBe(15)
      expect(result.getUTCMonth()).toBe(0) // January
      expect(result.getUTCFullYear()).toBe(2024)
    })

    it('should handle date boundary correctly', () => {
      // 23:00 in New York on Jan 15 should be 04:00 UTC on Jan 16
      const result = parseLocalDateTime('2024-01-15', '23:00', 'America/New_York')

      expect(result.getUTCHours()).toBe(4)
      expect(result.getUTCDate()).toBe(16)
    })

    it('should throw for invalid date format', () => {
      expect(() => parseLocalDateTime('invalid', '09:30', 'UTC')).toThrow()
      expect(() => parseLocalDateTime('2024-01-15', 'invalid', 'UTC')).toThrow()
    })
  })

  describe('parseLocalDateStart and parseLocalDateEnd', () => {
    it('should parse to start of day in timezone', () => {
      // Start of Jan 15 in New York (00:00 EST) should be 05:00 UTC
      const result = parseLocalDateStart('2024-01-15', 'America/New_York')

      expect(result.getUTCHours()).toBe(5)
      expect(result.getUTCMinutes()).toBe(0)
      expect(result.getUTCDate()).toBe(15)
    })

    it('should parse to end of day in timezone', () => {
      // End of Jan 15 in New York (23:59 EST) should be 04:59 UTC on Jan 16
      const result = parseLocalDateEnd('2024-01-15', 'America/New_York')

      expect(result.getUTCHours()).toBe(4)
      expect(result.getUTCMinutes()).toBe(59)
      expect(result.getUTCDate()).toBe(16)
    })
  })

  describe('getLocalDayOfWeek', () => {
    it('should return the correct day of week', () => {
      // 2024-01-15 is a Monday
      expect(getLocalDayOfWeek('2024-01-15', 'UTC')).toBe('monday')
      expect(getLocalDayOfWeek('2024-01-16', 'UTC')).toBe('tuesday')
      expect(getLocalDayOfWeek('2024-01-21', 'UTC')).toBe('sunday')
    })

    it('should handle different timezones correctly', () => {
      // The same date string should give the same day regardless of timezone
      // because the date string is interpreted in that timezone
      expect(getLocalDayOfWeek('2024-01-15', 'America/New_York')).toBe('monday')
      expect(getLocalDayOfWeek('2024-01-15', 'America/Los_Angeles')).toBe('monday')
      expect(getLocalDayOfWeek('2024-01-15', 'Asia/Tokyo')).toBe('monday')
    })
  })

  describe('addDaysToLocalDate', () => {
    it('should add days correctly', () => {
      expect(addDaysToLocalDate('2024-01-15', 1, 'UTC')).toBe('2024-01-16')
      expect(addDaysToLocalDate('2024-01-15', 7, 'UTC')).toBe('2024-01-22')
      expect(addDaysToLocalDate('2024-01-15', 30, 'UTC')).toBe('2024-02-14')
    })

    it('should handle month and year boundaries', () => {
      expect(addDaysToLocalDate('2024-01-31', 1, 'UTC')).toBe('2024-02-01')
      expect(addDaysToLocalDate('2024-12-31', 1, 'UTC')).toBe('2025-01-01')
    })

    it('should handle negative days', () => {
      expect(addDaysToLocalDate('2024-01-15', -1, 'UTC')).toBe('2024-01-14')
      expect(addDaysToLocalDate('2024-01-01', -1, 'UTC')).toBe('2023-12-31')
    })
  })

  describe('getLocalDateRange', () => {
    it('should generate a range of dates', () => {
      const result = getLocalDateRange('2024-01-15', '2024-01-18', 'UTC')

      expect(result).toEqual([
        '2024-01-15',
        '2024-01-16',
        '2024-01-17',
        '2024-01-18'
      ])
    })

    it('should handle single day range', () => {
      const result = getLocalDateRange('2024-01-15', '2024-01-15', 'UTC')
      expect(result).toEqual(['2024-01-15'])
    })

    it('should handle inverted range (return empty)', () => {
      const result = getLocalDateRange('2024-01-18', '2024-01-15', 'UTC')
      expect(result).toEqual([])
    })
  })

  describe('timeToMinutes and minutesToTime', () => {
    it('should convert time to minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0)
      expect(timeToMinutes('01:00')).toBe(60)
      expect(timeToMinutes('12:30')).toBe(750)
      expect(timeToMinutes('23:59')).toBe(1439)
    })

    it('should convert minutes to time', () => {
      expect(minutesToTime(0)).toBe('00:00')
      expect(minutesToTime(60)).toBe('01:00')
      expect(minutesToTime(750)).toBe('12:30')
      expect(minutesToTime(1439)).toBe('23:59')
    })

    it('should be reversible', () => {
      const times = ['00:00', '09:30', '12:00', '18:45', '23:59']
      for (const time of times) {
        expect(minutesToTime(timeToMinutes(time))).toBe(time)
      }
    })
  })

  describe('hoursUntilLocalDateTime', () => {
    it('should calculate hours until a future time', () => {
      // This test is time-sensitive, so we use a relative approach
      const futureDate = new Date()
      futureDate.setTime(futureDate.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

      const futureDateStr = formatLocalDate(futureDate, 'UTC')
      const futureTimeStr = formatLocalTime(futureDate, 'UTC')

      const hours = hoursUntilLocalDateTime(futureDateStr, futureTimeStr, 'UTC')

      // Should be approximately 24 hours (allow for small timing differences)
      expect(hours).toBeGreaterThan(23.9)
      expect(hours).toBeLessThan(24.1)
    })

    it('should return negative for past times', () => {
      const pastDate = new Date()
      pastDate.setTime(pastDate.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

      const pastDateStr = formatLocalDate(pastDate, 'UTC')
      const pastTimeStr = formatLocalTime(pastDate, 'UTC')

      const hours = hoursUntilLocalDateTime(pastDateStr, pastTimeStr, 'UTC')

      expect(hours).toBeLessThan(-23.9)
    })
  })

  describe('getUtcRangeForLocalDate', () => {
    it('should return UTC range covering a full local day', () => {
      const range = getUtcRangeForLocalDate('2024-01-15', 'America/New_York')

      // Start should be 05:00 UTC (00:00 EST)
      expect(range.start.getUTCHours()).toBe(5)
      expect(range.start.getUTCDate()).toBe(15)

      // End should be 04:59 UTC next day (23:59 EST)
      expect(range.end.getUTCHours()).toBe(4)
      expect(range.end.getUTCMinutes()).toBe(59)
      expect(range.end.getUTCDate()).toBe(16)
    })
  })

  describe('isOnLocalDate', () => {
    it('should correctly identify if a UTC date falls on a local date', () => {
      // 10:00 UTC on Jan 15 should be on Jan 15 in New York (05:00 EST)
      const utcDate = new Date(Date.UTC(2024, 0, 15, 10, 0, 0))

      expect(isOnLocalDate(utcDate, '2024-01-15', 'America/New_York')).toBe(true)
      expect(isOnLocalDate(utcDate, '2024-01-14', 'America/New_York')).toBe(false)
    })

    it('should handle date boundary crossing', () => {
      // 03:00 UTC on Jan 15 is 22:00 EST on Jan 14
      const utcDate = new Date(Date.UTC(2024, 0, 15, 3, 0, 0))

      expect(isOnLocalDate(utcDate, '2024-01-14', 'America/New_York')).toBe(true)
      expect(isOnLocalDate(utcDate, '2024-01-15', 'America/New_York')).toBe(false)
    })
  })

  describe('DST handling', () => {
    it('should handle times during DST correctly', () => {
      // During summer (DST), New York is UTC-4 (EDT)
      // July 15, 2024 at 10:00 AM EDT should be 14:00 UTC
      const summerDate = parseLocalDateTime('2024-07-15', '10:00', 'America/New_York')
      expect(summerDate.getUTCHours()).toBe(14) // 10:00 EDT = 14:00 UTC
    })

    it('should handle times outside DST correctly', () => {
      // During winter (no DST), New York is UTC-5 (EST)
      // January 15, 2024 at 10:00 AM EST should be 15:00 UTC
      const winterDate = parseLocalDateTime('2024-01-15', '10:00', 'America/New_York')
      expect(winterDate.getUTCHours()).toBe(15) // 10:00 EST = 15:00 UTC
    })

    it('should handle the DST transition day', () => {
      // March 10, 2024 is when DST starts in New York
      // At 2:00 AM EST, clocks spring forward to 3:00 AM EDT

      // 01:30 AM on March 10 (before DST transition at 2 AM) - EST (UTC-5)
      const beforeDST = parseLocalDateTime('2024-03-10', '01:30', 'America/New_York')
      expect(beforeDST.getUTCHours()).toBe(6) // 01:30 EST = 06:30 UTC
      expect(beforeDST.getUTCMinutes()).toBe(30)

      // 10:00 AM on March 10 (after DST transition) - EDT (UTC-4)
      // This is well after the transition so it's unambiguous
      const afterDST = parseLocalDateTime('2024-03-10', '10:00', 'America/New_York')
      expect(afterDST.getUTCHours()).toBe(14) // 10:00 EDT = 14:00 UTC
      expect(afterDST.getUTCMinutes()).toBe(0)
    })

    it('should handle DST end correctly', () => {
      // November 3, 2024 is when DST ends in New York
      // At 2:00 AM EDT, clocks fall back to 1:00 AM EST

      // 10:00 AM on November 3 (after transition) - EST (UTC-5)
      const afterFallback = parseLocalDateTime('2024-11-03', '10:00', 'America/New_York')
      expect(afterFallback.getUTCHours()).toBe(15) // 10:00 EST = 15:00 UTC
    })
  })
})
