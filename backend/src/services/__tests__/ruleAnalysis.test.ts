import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI before importing the module
vi.mock('openai', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    })),
    APIError: class APIError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'APIError'
      }
    }
  }
})

import OpenAI from 'openai'
import { analyzeRulesWithAI, type RuleForScheduling, type EntityNamesContext } from '../openai.js'

describe('analyzeRulesWithAI', () => {
  const mockCreate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'

    // Reset the mock implementation
    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }) as any)
  })

  const sampleRules: RuleForScheduling[] = [
    {
      id: 'rule-1',
      category: 'gender_pairing',
      description: 'Male therapists can only see male patients',
      ruleLogic: { therapistGender: 'male', patientGender: 'male' },
      priority: 10
    },
    {
      id: 'rule-2',
      category: 'session',
      description: 'Maximum 2 sessions per therapist per day',
      ruleLogic: { maxSessions: 2, per: 'day' },
      priority: 5
    }
  ]

  const sampleContext: EntityNamesContext = {
    staffNames: ['John Smith', 'Jane Doe'],
    patientNames: ['Patient A', 'Patient B'],
    roomNames: ['Room 101', 'Room 102']
  }

  it('returns empty result when no rules provided', async () => {
    const result = await analyzeRulesWithAI([], sampleContext)

    expect(result).toEqual({
      conflicts: [],
      duplicates: [],
      enhancements: [],
      summary: {
        totalRulesAnalyzed: 0,
        conflictsFound: 0,
        duplicatesFound: 0,
        enhancementsSuggested: 0
      }
    })

    // OpenAI should not be called
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls OpenAI with correct prompt structure', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            conflicts: [],
            duplicates: [],
            enhancements: [],
            summary: {
              totalRulesAnalyzed: 2,
              conflictsFound: 0,
              duplicatesFound: 0,
              enhancementsSuggested: 0
            }
          })
        }
      }]
    })

    await analyzeRulesWithAI(sampleRules, sampleContext)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]

    // Verify model and settings
    expect(callArgs.model).toBe('gpt-5.1')
    expect(callArgs.response_format).toEqual({ type: 'json_object' })

    // Verify system prompt mentions the key analysis types
    expect(callArgs.messages[0].content).toContain('CONFLICTS')
    expect(callArgs.messages[0].content).toContain('DUPLICATES')
    expect(callArgs.messages[0].content).toContain('ENHANCEMENTS')

    // Verify user prompt contains rules and context
    expect(callArgs.messages[1].content).toContain('rule-1')
    expect(callArgs.messages[1].content).toContain('gender_pairing')
    expect(callArgs.messages[1].content).toContain('John Smith')
    expect(callArgs.messages[1].content).toContain('Patient A')
  })

  it('parses and returns analysis results correctly', async () => {
    const mockResponse = {
      conflicts: [{
        ruleIds: ['rule-1', 'rule-2'],
        description: 'Test conflict',
        severity: 'high',
        suggestion: 'Fix it'
      }],
      duplicates: [{
        ruleIds: ['rule-3', 'rule-4'],
        description: 'Duplicate rules',
        recommendation: 'Remove one'
      }],
      enhancements: [{
        relatedRuleIds: ['rule-1'],
        suggestion: 'Add more coverage',
        rationale: 'Better scheduling',
        priority: 'medium'
      }],
      summary: {
        totalRulesAnalyzed: 2,
        conflictsFound: 1,
        duplicatesFound: 1,
        enhancementsSuggested: 1
      }
    }

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify(mockResponse)
        }
      }]
    })

    const result = await analyzeRulesWithAI(sampleRules, sampleContext)

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].severity).toBe('high')
    expect(result.duplicates).toHaveLength(1)
    expect(result.enhancements).toHaveLength(1)
    expect(result.summary.conflictsFound).toBe(1)
  })

  it('handles missing arrays in response by defaulting to empty', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: {
              totalRulesAnalyzed: 2,
              conflictsFound: 0,
              duplicatesFound: 0,
              enhancementsSuggested: 0
            }
          })
        }
      }]
    })

    const result = await analyzeRulesWithAI(sampleRules, sampleContext)

    expect(result.conflicts).toEqual([])
    expect(result.duplicates).toEqual([])
    expect(result.enhancements).toEqual([])
  })

  it('handles missing summary by computing from arrays', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            conflicts: [{ ruleIds: ['1'], description: 'x', severity: 'low', suggestion: 'y' }],
            duplicates: [],
            enhancements: []
          })
        }
      }]
    })

    const result = await analyzeRulesWithAI(sampleRules, sampleContext)

    expect(result.summary.totalRulesAnalyzed).toBe(2)
    expect(result.summary.conflictsFound).toBe(1)
    expect(result.summary.duplicatesFound).toBe(0)
    expect(result.summary.enhancementsSuggested).toBe(0)
  })

  it('handles empty context gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            conflicts: [],
            duplicates: [],
            enhancements: [],
            summary: {
              totalRulesAnalyzed: 2,
              conflictsFound: 0,
              duplicatesFound: 0,
              enhancementsSuggested: 0
            }
          })
        }
      }]
    })

    const emptyContext: EntityNamesContext = {
      staffNames: [],
      patientNames: [],
      roomNames: []
    }

    await analyzeRulesWithAI(sampleRules, emptyContext)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[1].content).toContain('None defined')
  })

  it('throws error when OpenAI returns no content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: null
        }
      }]
    })

    // The function should throw when there's no content
    await expect(analyzeRulesWithAI(sampleRules, sampleContext))
      .rejects.toThrow()
  })

  it('throws error when OpenAI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'not valid json'
        }
      }]
    })

    await expect(analyzeRulesWithAI(sampleRules, sampleContext))
      .rejects.toThrow()
  })
})
