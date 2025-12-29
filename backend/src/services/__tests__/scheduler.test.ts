import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  sessionsOverlap,
  getDayOfWeek,
  validateSessions
} from '../scheduler.js'
import type { StaffForScheduling, PatientForScheduling, GeneratedSession } from '../aiProvider.js'

describe('Scheduler Helper Functions', () => {
  describe('timeToMinutes', () => {
    it('converts 09:00 to 540 minutes', () => {
      expect(timeToMinutes('09:00')).toBe(540)
    })

    it('converts 14:30 to 870 minutes', () => {
      expect(timeToMinutes('14:30')).toBe(870)
    })

    it('converts 00:00 to 0 minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0)
    })

    it('converts 23:59 to 1439 minutes', () => {
      expect(timeToMinutes('23:59')).toBe(1439)
    })
  })

  describe('sessionsOverlap', () => {
    it('returns true for overlapping sessions', () => {
      expect(sessionsOverlap('09:00', '10:00', '09:30', '10:30')).toBe(true)
    })

    it('returns true for fully contained session', () => {
      expect(sessionsOverlap('09:00', '11:00', '09:30', '10:30')).toBe(true)
    })

    it('returns false for adjacent sessions (no gap)', () => {
      expect(sessionsOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false)
    })

    it('returns false for non-overlapping sessions', () => {
      expect(sessionsOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false)
    })

    it('returns true for identical time slots', () => {
      expect(sessionsOverlap('09:00', '10:00', '09:00', '10:00')).toBe(true)
    })
  })

  describe('getDayOfWeek', () => {
    // Note: getDayOfWeek uses new Date() which interprets YYYY-MM-DD as UTC midnight
    // This can shift days depending on timezone. Using full ISO strings for consistency.
    it('returns monday for a Monday date', () => {
      expect(getDayOfWeek('2025-01-06T12:00:00')).toBe('monday')
    })

    it('returns friday for a Friday date', () => {
      expect(getDayOfWeek('2025-01-10T12:00:00')).toBe('friday')
    })

    it('returns sunday for a Sunday date', () => {
      expect(getDayOfWeek('2025-01-05T12:00:00')).toBe('sunday')
    })
  })
})

describe('validateSessions', () => {
  const baseStaff: StaffForScheduling[] = [
    {
      id: 'staff-1',
      name: 'Sarah Johnson',
      gender: 'female',
      certifications: ['ABA', 'Speech'],
      defaultHours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      }
    },
    {
      id: 'staff-2',
      name: 'John Smith',
      gender: 'male',
      certifications: ['Physical'],
      defaultHours: {
        monday: { start: '08:00', end: '16:00' },
        wednesday: { start: '08:00', end: '16:00' },
        friday: { start: '08:00', end: '16:00' }
      }
    }
  ]

  const basePatients: PatientForScheduling[] = [
    {
      id: 'patient-1',
      identifier: 'EC-001',
      name: 'Emily Carter',
      gender: 'female',
      sessionFrequency: 2,
      requiredCertifications: ['ABA'],
      preferredTimes: []
    },
    {
      id: 'patient-2',
      identifier: 'MB-002',
      name: 'Michael Brown',
      gender: 'male',
      sessionFrequency: 3,
      requiredCertifications: [],
      preferredTimes: []
    }
  ]

  describe('valid sessions', () => {
    it('accepts a valid session with matching therapist and patient', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06T12:00:00', // Monday
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
      expect(result.valid[0].therapistId).toBe('staff-1')
      expect(result.valid[0].patientId).toBe('patient-1')
    })

    it('accepts multiple non-overlapping sessions for the same therapist', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06T12:00:00',
          startTime: '09:00',
          endTime: '10:00'
        },
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('invalid sessions - unknown entities', () => {
    it('rejects session with unknown therapist', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'unknown-staff',
          patientId: 'patient-1',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors).toContain('Therapist unknown-staff not found')
    })

    it('rejects session with unknown patient', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'unknown-patient',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors).toContain('Patient unknown-patient not found')
    })
  })

  describe('invalid sessions - certification requirements', () => {
    it('rejects session when therapist lacks required certification', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-2', // John only has Physical cert
          patientId: 'patient-1', // Emily requires ABA
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors[0]).toContain('missing certifications: ABA')
    })

    it('accepts session when therapist has all required certifications', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1', // Sarah has ABA and Speech
          patientId: 'patient-1', // Emily requires ABA
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('invalid sessions - working hours', () => {
    it('rejects session outside therapist working hours', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00', // Monday
          startTime: '07:00', // Before 09:00 start
          endTime: '08:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors[0]).toContain('outside')
    })

    it('generates warning when therapist has no hours for that day', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-2', // John doesn't work Tuesday
          patientId: 'patient-2',
          date: '2025-01-07T12:00:00', // Tuesday
          startTime: '10:00',
          endTime: '11:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      // Session is still valid but generates a warning
      expect(result.valid).toHaveLength(1)
      expect(result.warnings).toContain(
        "John Smith doesn't have scheduled hours on tuesday, but was assigned a session"
      )
    })
  })

  describe('invalid sessions - time conflicts', () => {
    it('rejects overlapping sessions for the same therapist', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        },
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00',
          startTime: '10:30', // Overlaps with first session
          endTime: '11:30'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(1) // First session is valid
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors[0]).toContain('overlapping sessions')
    })

    it('rejects overlapping sessions for the same patient', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        },
        {
          therapistId: 'staff-2',
          patientId: 'patient-2', // Same patient
          date: '2025-01-06T12:00:00',
          startTime: '10:30', // Overlaps
          endTime: '11:30'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errors[0]).toContain('Patient Michael Brown has overlapping sessions')
    })
  })

  describe('session frequency warnings', () => {
    it('warns when patient does not get required session frequency', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-2', // Michael needs 3 sessions
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
        // Only 1 session scheduled, needs 3
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(1)
      expect(result.warnings).toContain('Patient Michael Brown (ID: MB-002) is scheduled for 1 sessions instead of the requested 3.')
    })

    it('warns for patient with zero sessions scheduled', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        }
        // patient-1 (Emily) has no sessions
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.warnings).toContain('Patient Emily Carter (ID: EC-001) is scheduled for 0 sessions instead of the requested 2.')
    })

    it('no warning when patient gets required sessions', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-1', // Emily needs 2 sessions
          date: '2025-01-06T12:00:00',
          startTime: '09:00',
          endTime: '10:00'
        },
        {
          therapistId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-07T12:00:00',
          startTime: '09:00',
          endTime: '10:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(2)
      // Should not have warning about Emily
      const emilyWarning = result.warnings.find(w => w.includes('Emily Carter'))
      expect(emilyWarning).toBeUndefined()
    })
  })

  describe('stats calculation', () => {
    it('correctly counts unique patients and therapists', () => {
      const sessions: GeneratedSession[] = [
        {
          therapistId: 'staff-1',
          patientId: 'patient-1',
          date: '2025-01-06T12:00:00',
          startTime: '09:00',
          endTime: '10:00'
        },
        {
          therapistId: 'staff-1',
          patientId: 'patient-2',
          date: '2025-01-06T12:00:00',
          startTime: '10:00',
          endTime: '11:00'
        },
        {
          therapistId: 'staff-2',
          patientId: 'patient-2',
          date: '2025-01-08T12:00:00', // Wednesday (John works)
          startTime: '09:00',
          endTime: '10:00'
        }
      ]

      const result = validateSessions(sessions, baseStaff, basePatients)

      expect(result.valid).toHaveLength(3)
      // We can count unique IDs from valid sessions
      const uniquePatients = new Set(result.valid.map(s => s.patientId))
      const uniqueTherapists = new Set(result.valid.map(s => s.therapistId))
      expect(uniquePatients.size).toBe(2)
      expect(uniqueTherapists.size).toBe(2)
    })
  })
})
