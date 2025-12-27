import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildTestApp } from './testApp.js'
import type { FastifyInstance } from 'fastify'

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  requireRole: vi.fn(() => async () => {}),
  requireSuperAdmin: vi.fn(() => async () => {}),
  requireAdmin: vi.fn(() => async () => {}),
  requireAdminOrAssistant: vi.fn(() => async () => {})
}))

// Mock the voice parser service
vi.mock('../../services/voiceParser.js', () => ({
  parseVoiceCommand: vi.fn(),
  parsePatientCommand: vi.fn(),
  parseStaffCommand: vi.fn(),
  parseRuleCommand: vi.fn(),
  parseScheduleCommand: vi.fn(),
  parseScheduleModifyCommand: vi.fn(),
  parseScheduleGenerateCommand: vi.fn()
}))

// Import mocked modules
import {
  parseVoiceCommand,
  parsePatientCommand,
  parseStaffCommand,
  parseRuleCommand,
  parseScheduleModifyCommand,
  parseScheduleGenerateCommand
} from '../../services/voiceParser.js'

describe('Voice Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/voice/parse', () => {
    it('parses a general voice command successfully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseVoiceCommand).mockResolvedValue({
        commandType: 'create_patient',
        confidence: 0.95,
        data: {
          name: 'Emily Carter',
          gender: 'female'
        },
        warnings: [],
        originalTranscript: 'Add a new patient named Emily Carter, female'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Add a new patient named Emily Carter, female',
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('create_patient')
      expect(body.data.confidence).toBe(0.95)
      expect(body.meta.context).toBe('general')
    })

    it('uses context-specific parser for patient context', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parsePatientCommand).mockResolvedValue({
        commandType: 'create_patient',
        confidence: 0.98,
        data: {
          name: 'Michael Brown',
          gender: 'male',
          sessionFrequency: 3
        },
        warnings: [],
        originalTranscript: 'New patient Michael Brown, male, needs 3 sessions per week'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'New patient Michael Brown, male, needs 3 sessions per week',
          context: 'patient'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      expect(parsePatientCommand).toHaveBeenCalledWith(
        'New patient Michael Brown, male, needs 3 sessions per week'
      )
      const body = JSON.parse(response.payload)
      expect(body.data.data.sessionFrequency).toBe(3)
    })

    it('uses context-specific parser for staff context', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseStaffCommand).mockResolvedValue({
        commandType: 'create_staff',
        confidence: 0.92,
        data: {
          name: 'Sarah Johnson',
          gender: 'female',
          certifications: ['ABA', 'Speech']
        },
        warnings: [],
        originalTranscript: 'Add therapist Sarah Johnson, female, certified in ABA and Speech'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Add therapist Sarah Johnson, female, certified in ABA and Speech',
          context: 'staff'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      expect(parseStaffCommand).toHaveBeenCalled()
      const body = JSON.parse(response.payload)
      expect(body.data.data.certifications).toContain('ABA')
    })

    it('uses context-specific parser for rule context', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseRuleCommand).mockResolvedValue({
        commandType: 'create_rule',
        confidence: 0.88,
        data: {
          category: 'gender_pairing',
          description: 'Male therapists can only work with male patients'
        },
        warnings: [],
        originalTranscript: 'Male therapists can only work with male patients'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Male therapists can only work with male patients',
          context: 'rule'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      expect(parseRuleCommand).toHaveBeenCalled()
    })

    it('returns 503 when OpenAI API key is not configured', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Add a new patient',
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('not configured')
    })

    it('returns 400 when organization context is missing', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: null })

      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Add a new patient',
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toBe('Organization context required')
    })

    it('returns 500 when voice parsing fails', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseVoiceCommand).mockRejectedValue(new Error('Unexpected error'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Some voice command',
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('Failed to parse')
    })

    it('returns 503 when voice service is unavailable', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseVoiceCommand).mockRejectedValue(
        new Error('Voice parsing service error: timeout')
      )

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          transcript: 'Some voice command',
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('temporarily unavailable')
    })

    it('returns error when transcript is missing', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse',
        payload: {
          context: 'general'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      // Zod validation throws which results in 500 (unhandled by route)
      // In production you'd want error handling middleware to return 400
      expect(response.statusCode).toBe(500)
    })
  })

  describe('POST /api/voice/parse/patient', () => {
    it('parses patient command successfully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parsePatientCommand).mockResolvedValue({
        commandType: 'create_patient',
        confidence: 0.95,
        data: {
          name: 'Lisa Wong',
          requiredCertifications: ['ABA']
        },
        warnings: [],
        originalTranscript: 'Add patient Lisa Wong who requires an ABA certified therapist'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/patient',
        payload: {
          transcript: 'Add patient Lisa Wong who requires an ABA certified therapist'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('create_patient')
    })
  })

  describe('POST /api/voice/parse/staff', () => {
    it('parses staff command successfully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseStaffCommand).mockResolvedValue({
        commandType: 'create_staff',
        confidence: 0.93,
        data: {
          name: 'Adam Smith',
          gender: 'male',
          certifications: ['ABA']
        },
        warnings: [],
        originalTranscript: 'New staff member Adam Smith, male, certified in ABA therapy'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/staff',
        payload: {
          transcript: 'New staff member Adam Smith, male, certified in ABA therapy'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('create_staff')
    })
  })

  describe('POST /api/voice/parse/rule', () => {
    it('parses rule command successfully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseRuleCommand).mockResolvedValue({
        commandType: 'create_rule',
        confidence: 0.90,
        data: {
          category: 'session',
          description: 'Maximum 2 sessions per therapist per day',
          ruleLogic: { maxSessions: 2, per: 'day' }
        },
        warnings: [],
        originalTranscript: 'Maximum 2 sessions per therapist per day'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/rule',
        payload: {
          transcript: 'Maximum 2 sessions per therapist per day'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('create_rule')
    })
  })

  describe('POST /api/voice/parse/schedule', () => {
    it('parses schedule modification command successfully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleModifyCommand).mockResolvedValue({
        commandType: 'modify_session',
        confidence: 0.87,
        data: {
          action: 'move',
          therapistName: 'Sarah',
          currentDayOfWeek: 'monday',
          newDayOfWeek: 'tuesday',
          newStartTime: '14:00'
        },
        warnings: [],
        originalTranscript: "Move Sarah's Monday session to Tuesday at 2pm"
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule',
        payload: {
          transcript: 'Move Sarah\'s Monday session to Tuesday at 2pm'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.data.action).toBe('move')
    })

    it('parses cancel command', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleModifyCommand).mockResolvedValue({
        commandType: 'cancel_session',
        confidence: 0.92,
        data: {
          action: 'cancel',
          therapistName: 'John',
          patientName: 'Emily',
          currentDayOfWeek: 'friday'
        },
        warnings: [],
        originalTranscript: "Cancel John's session with Emily on Friday"
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule',
        payload: {
          transcript: 'Cancel John\'s session with Emily on Friday'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.data.action).toBe('cancel')
    })
  })

  describe('POST /api/voice/parse/schedule-generate', () => {
    it('parses schedule generation command for next week', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleGenerateCommand).mockResolvedValue({
        commandType: 'generate_schedule',
        confidence: 0.95,
        data: {
          weekReference: 'next week',
          weekStartDate: '2025-01-06'
        },
        warnings: [],
        originalTranscript: 'Generate a schedule for next week'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Generate a schedule for next week'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('generate_schedule')
      expect(body.data.data.weekStartDate).toBe('2025-01-06')
      expect(body.data.data.weekReference).toBe('next week')
    })

    it('parses schedule generation command for this week', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleGenerateCommand).mockResolvedValue({
        commandType: 'generate_schedule',
        confidence: 0.92,
        data: {
          weekReference: 'this week',
          weekStartDate: '2024-12-30'
        },
        warnings: [],
        originalTranscript: 'Create a schedule for this week'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Create a schedule for this week'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('generate_schedule')
      expect(body.data.data.weekReference).toBe('this week')
    })

    it('parses schedule generation command with specific date', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleGenerateCommand).mockResolvedValue({
        commandType: 'generate_schedule',
        confidence: 0.88,
        data: {
          weekReference: 'week of January 13th',
          weekStartDate: '2025-01-13'
        },
        warnings: ['Inferred Monday of the week containing January 13th'],
        originalTranscript: 'Generate the schedule for the week of January 13th'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Generate the schedule for the week of January 13th'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.commandType).toBe('generate_schedule')
      expect(body.data.data.weekStartDate).toBe('2025-01-13')
      expect(body.data.warnings).toContain('Inferred Monday of the week containing January 13th')
    })

    it('returns 503 when OpenAI API key is not configured', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Generate a schedule for next week'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('not configured')
    })

    it('returns 500 when voice parsing fails', async () => {
      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(parseScheduleGenerateCommand).mockRejectedValue(new Error('Unexpected error'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Generate a schedule for next week'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('Failed to parse schedule generation command')
    })

    it('returns 400 when organization context is missing', async () => {
      await app.close()
      app = await buildTestApp({ mockUser: null })

      const originalEnv = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key'

      const response = await app.inject({
        method: 'POST',
        url: '/api/voice/parse/schedule-generate',
        payload: {
          transcript: 'Generate a schedule for next week'
        }
      })

      process.env.OPENAI_API_KEY = originalEnv

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toBe('Organization context required')
    })
  })
})
