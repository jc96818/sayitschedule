import { describe, it, expect } from 'vitest'
import {
  DAYS_OF_WEEK,
  getDayOfWeekFromDate,
  normalizeName,
  fuzzyNameMatch,
  calculateNewEndTime,
  getDateForDayOfWeek
} from '../sessionLookup.js'

describe('SessionLookup Helper Functions', () => {
  describe('DAYS_OF_WEEK', () => {
    it('has all seven days', () => {
      expect(DAYS_OF_WEEK).toHaveLength(7)
    })

    it('starts with sunday at index 0', () => {
      expect(DAYS_OF_WEEK[0]).toBe('sunday')
    })

    it('ends with saturday at index 6', () => {
      expect(DAYS_OF_WEEK[6]).toBe('saturday')
    })
  })

  describe('getDayOfWeekFromDate', () => {
    it('returns monday for a Monday date', () => {
      // January 6, 2025 is a Monday
      const date = new Date('2025-01-06T12:00:00')
      expect(getDayOfWeekFromDate(date)).toBe('monday')
    })

    it('returns friday for a Friday date', () => {
      // January 10, 2025 is a Friday
      const date = new Date('2025-01-10T12:00:00')
      expect(getDayOfWeekFromDate(date)).toBe('friday')
    })

    it('returns sunday for a Sunday date', () => {
      // January 5, 2025 is a Sunday
      const date = new Date('2025-01-05T12:00:00')
      expect(getDayOfWeekFromDate(date)).toBe('sunday')
    })

    it('returns saturday for a Saturday date', () => {
      // January 11, 2025 is a Saturday
      const date = new Date('2025-01-11T12:00:00')
      expect(getDayOfWeekFromDate(date)).toBe('saturday')
    })
  })

  describe('normalizeName', () => {
    it('converts to lowercase', () => {
      expect(normalizeName('JOHN SMITH')).toBe('john smith')
    })

    it('trims whitespace', () => {
      expect(normalizeName('  John Smith  ')).toBe('john smith')
    })

    it('handles mixed case', () => {
      expect(normalizeName('JoHn SmItH')).toBe('john smith')
    })

    it('handles single name', () => {
      expect(normalizeName('Sarah')).toBe('sarah')
    })

    it('handles empty string', () => {
      expect(normalizeName('')).toBe('')
    })
  })

  describe('fuzzyNameMatch', () => {
    describe('exact matches', () => {
      it('matches identical names', () => {
        expect(fuzzyNameMatch('John Smith', 'John Smith')).toBe(true)
      })

      it('matches case-insensitively', () => {
        expect(fuzzyNameMatch('john smith', 'JOHN SMITH')).toBe(true)
      })
    })

    describe('partial matches', () => {
      it('matches first name only', () => {
        expect(fuzzyNameMatch('John', 'John Smith')).toBe(true)
      })

      it('matches last name only', () => {
        expect(fuzzyNameMatch('Smith', 'John Smith')).toBe(true)
      })

      it('matches when search is contained in full name', () => {
        expect(fuzzyNameMatch('ohn', 'John Smith')).toBe(true)
      })
    })

    describe('first name matching', () => {
      it('matches when first names are identical', () => {
        expect(fuzzyNameMatch('John Doe', 'John Smith')).toBe(true)
      })
    })

    describe('last name matching', () => {
      it('matches when last names are identical', () => {
        expect(fuzzyNameMatch('Jane Smith', 'John Smith')).toBe(true)
      })
    })

    describe('non-matches', () => {
      it('does not match completely different names', () => {
        expect(fuzzyNameMatch('Michael Brown', 'John Smith')).toBe(false)
      })

      it('does not match partial overlap that is not a substring', () => {
        expect(fuzzyNameMatch('Johnny', 'John Smith')).toBe(false)
      })
    })
  })

  describe('calculateNewEndTime', () => {
    it('adds 60 minutes by default', () => {
      expect(calculateNewEndTime('09:00')).toBe('10:00')
    })

    it('adds custom duration', () => {
      expect(calculateNewEndTime('09:00', 90)).toBe('10:30')
    })

    it('handles crossing hour boundary', () => {
      expect(calculateNewEndTime('09:45', 30)).toBe('10:15')
    })

    it('handles midnight crossover', () => {
      expect(calculateNewEndTime('23:30', 60)).toBe('00:30')
    })

    it('handles 30 minute sessions', () => {
      expect(calculateNewEndTime('14:00', 30)).toBe('14:30')
    })

    it('handles 2 hour sessions', () => {
      expect(calculateNewEndTime('10:00', 120)).toBe('12:00')
    })

    it('maintains correct formatting with leading zeros', () => {
      expect(calculateNewEndTime('08:00', 60)).toBe('09:00')
    })

    it('handles session starting at midnight', () => {
      expect(calculateNewEndTime('00:00', 60)).toBe('01:00')
    })
  })

  describe('getDateForDayOfWeek', () => {
    // Using January 6, 2025 (Monday) as week start
    const mondayStart = new Date('2025-01-06T12:00:00')

    it('returns same date for matching day (Monday start, Monday target)', () => {
      const result = getDateForDayOfWeek(mondayStart, 'monday')
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(6)
    })

    it('returns correct date for Tuesday', () => {
      const result = getDateForDayOfWeek(mondayStart, 'tuesday')
      expect(result.getDay()).toBe(2)
      expect(result.getDate()).toBe(7)
    })

    it('returns correct date for Wednesday', () => {
      const result = getDateForDayOfWeek(mondayStart, 'wednesday')
      expect(result.getDay()).toBe(3)
      expect(result.getDate()).toBe(8)
    })

    it('returns correct date for Friday', () => {
      const result = getDateForDayOfWeek(mondayStart, 'friday')
      expect(result.getDay()).toBe(5)
      expect(result.getDate()).toBe(10)
    })

    it('handles case-insensitive day names', () => {
      const result = getDateForDayOfWeek(mondayStart, 'TUESDAY')
      expect(result.getDay()).toBe(2)
    })

    it('returns previous Sunday when starting from Monday', () => {
      const result = getDateForDayOfWeek(mondayStart, 'sunday')
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(5) // January 5, 2025
    })

    it('throws for invalid day of week', () => {
      expect(() => getDateForDayOfWeek(mondayStart, 'funday')).toThrow('Invalid day of week: funday')
    })

    // Test with Sunday as week start
    const sundayStart = new Date('2025-01-05T12:00:00')

    it('returns correct date when week starts on Sunday', () => {
      const result = getDateForDayOfWeek(sundayStart, 'wednesday')
      expect(result.getDay()).toBe(3)
      expect(result.getDate()).toBe(8)
    })

    it('returns same date when Sunday start and Sunday target', () => {
      const result = getDateForDayOfWeek(sundayStart, 'sunday')
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(5)
    })
  })
})
