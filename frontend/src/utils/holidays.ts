/**
 * Federal holiday utilities for checking if a date falls on a US federal holiday
 */

interface Holiday {
  name: string
  getDate: (year: number) => Date
}

/**
 * Get the nth occurrence of a weekday in a month
 * @param year - The year
 * @param month - The month (0-indexed)
 * @param weekday - The day of the week (0 = Sunday, 1 = Monday, etc.)
 * @param n - Which occurrence (1 = first, 2 = second, etc., -1 = last)
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  if (n === -1) {
    // Last occurrence - start from end of month
    const lastDay = new Date(year, month + 1, 0)
    let date = lastDay.getDate()
    while (lastDay.getDay() !== weekday) {
      lastDay.setDate(--date)
    }
    return lastDay
  }

  // Find nth occurrence from start
  let count = 0
  let date = 1

  while (count < n) {
    const day = new Date(year, month, date)
    if (day.getDay() === weekday) {
      count++
      if (count === n) {
        return day
      }
    }
    date++
  }

  return new Date(year, month, date - 1)
}

/**
 * Federal holidays list with date calculation functions
 */
const federalHolidays: Holiday[] = [
  {
    name: "New Year's Day",
    getDate: (year) => new Date(year, 0, 1) // January 1
  },
  {
    name: 'Martin Luther King Jr. Day',
    getDate: (year) => getNthWeekdayOfMonth(year, 0, 1, 3) // 3rd Monday of January
  },
  {
    name: "Presidents' Day",
    getDate: (year) => getNthWeekdayOfMonth(year, 1, 1, 3) // 3rd Monday of February
  },
  {
    name: 'Memorial Day',
    getDate: (year) => getNthWeekdayOfMonth(year, 4, 1, -1) // Last Monday of May
  },
  {
    name: 'Juneteenth',
    getDate: (year) => new Date(year, 5, 19) // June 19
  },
  {
    name: 'Independence Day',
    getDate: (year) => new Date(year, 6, 4) // July 4
  },
  {
    name: 'Labor Day',
    getDate: (year) => getNthWeekdayOfMonth(year, 8, 1, 1) // 1st Monday of September
  },
  {
    name: 'Columbus Day',
    getDate: (year) => getNthWeekdayOfMonth(year, 9, 1, 2) // 2nd Monday of October
  },
  {
    name: 'Veterans Day',
    getDate: (year) => new Date(year, 10, 11) // November 11
  },
  {
    name: 'Thanksgiving',
    getDate: (year) => getNthWeekdayOfMonth(year, 10, 4, 4) // 4th Thursday of November
  },
  {
    name: 'Christmas Day',
    getDate: (year) => new Date(year, 11, 25) // December 25
  }
]

/**
 * Check if a date is a federal holiday
 * @param date - The date to check
 * @returns The holiday name if it's a holiday, null otherwise
 */
export function getFederalHoliday(date: Date): string | null {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  for (const holiday of federalHolidays) {
    const holidayDate = holiday.getDate(year)
    if (holidayDate.getMonth() === month && holidayDate.getDate() === day) {
      return holiday.name
    }
  }

  return null
}

/**
 * Check if a date is a federal holiday (boolean version)
 * @param date - The date to check
 * @returns true if the date is a federal holiday
 */
export function isFederalHoliday(date: Date): boolean {
  return getFederalHoliday(date) !== null
}

/**
 * Get all federal holidays for a given year
 * @param year - The year to get holidays for
 * @returns Array of holiday objects with name and date
 */
export function getFederalHolidaysForYear(
  year: number
): { name: string; date: Date }[] {
  return federalHolidays.map((holiday) => ({
    name: holiday.name,
    date: holiday.getDate(year)
  }))
}
