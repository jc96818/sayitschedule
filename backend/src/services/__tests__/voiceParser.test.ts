import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI provider to prevent actual API calls
vi.mock('../aiProvider.js', () => ({
  chatCompletion: vi.fn(),
  isProviderConfigured: vi.fn(() => true),
  getActiveProvider: vi.fn(() => 'openai')
}))

import { chatCompletion } from '../aiProvider.js'
import {
  parseVoiceCommand,
  parsePatientCommand,
  parseStaffCommand,
  parseRuleCommand,
  parseRoomCommand,
  parseMultipleRulesCommand,
  type OrganizationLabels
} from '../voiceParser.js'

describe('VoiceParser Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dynamic Label Substitution', () => {
    const customLabels: Partial<OrganizationLabels> = {
      staffLabel: 'Practitioners',
      staffLabelSingular: 'Practitioner',
      patientLabel: 'Clients',
      patientLabelSingular: 'Client',
      roomLabel: 'Treatment Spaces',
      roomLabelSingular: 'Treatment Space',
      certificationLabel: 'Credentials',
      equipmentLabel: 'Facilities'
    }

    it('uses custom labels in patient context prompt', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_patient',
        confidence: 0.9,
        data: { name: 'Test' },
        warnings: []
      }))

      await parsePatientCommand('Add client Test', customLabels)

      // Verify chatCompletion was called with prompt containing custom labels
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('CLIENTS')
        })
      )
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('client information')
        })
      )
    })

    it('uses custom labels in staff context prompt', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_staff',
        confidence: 0.9,
        data: { name: 'Test' },
        warnings: []
      }))

      await parseStaffCommand('Add practitioner Test', customLabels)

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('PRACTITIONERS')
        })
      )
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('practitioner information')
        })
      )
    })

    it('uses custom labels in room context prompt', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_room',
        confidence: 0.9,
        data: { name: 'Room 1' },
        warnings: []
      }))

      await parseRoomCommand('Add treatment space 1', customLabels)

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('TREATMENT SPACES')
        })
      )
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('treatment space information')
        })
      )
    })

    it('uses custom labels in rule context prompt', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_rules',
        rules: [{
          category: 'availability',
          description: 'Test rule',
          priority: 5,
          ruleLogic: {},
          confidence: 0.9,
          warnings: []
        }],
        overallConfidence: 0.9,
        globalWarnings: []
      }))

      await parseMultipleRulesCommand('Practitioners available on Monday', customLabels)

      // Rule context should use custom staff/patient labels
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('practitioners/clients')
        })
      )
    })

    it('uses default labels when no custom labels provided', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_patient',
        confidence: 0.9,
        data: { name: 'Test' },
        warnings: []
      }))

      await parsePatientCommand('Add patient Test')

      // Should use default "PATIENTS" and "patient"
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('PATIENTS')
        })
      )
    })

    it('merges partial labels with defaults', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_staff',
        confidence: 0.9,
        data: { name: 'Test' },
        warnings: []
      }))

      // Only provide staff labels
      const partialLabels: Partial<OrganizationLabels> = {
        staffLabel: 'Therapists',
        staffLabelSingular: 'Therapist'
      }

      await parseStaffCommand('Add therapist Test', partialLabels)

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('THERAPISTS')
        })
      )
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('therapist information')
        })
      )
    })

    it('includes certification label in prompts', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_staff',
        confidence: 0.9,
        data: { name: 'Test', certifications: ['ABA'] },
        warnings: []
      }))

      await parseStaffCommand('Add staff with ABA credential', customLabels)

      // Should use "credentials" instead of default "certifications"
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('credentials')
        })
      )
    })

    it('includes equipment label in room prompts', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_room',
        confidence: 0.9,
        data: { name: 'Room 1', capabilities: ['wheelchair_accessible'] },
        warnings: []
      }))

      await parseRoomCommand('Add room with facilities', customLabels)

      // Should use "facilities" instead of default "equipment"
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('facilities')
        })
      )
    })
  })

  describe('General Voice Command Parsing', () => {
    it('uses general context prompt with custom labels', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_patient',
        confidence: 0.85,
        data: { name: 'Test' },
        warnings: []
      }))

      const customLabels: Partial<OrganizationLabels> = {
        staffLabelSingular: 'Therapist',
        patientLabelSingular: 'Client'
      }

      await parseVoiceCommand('Add someone', 'general', customLabels)

      // General context should mention custom labels
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('client')
        })
      )
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('therapist')
        })
      )
    })
  })

  describe('Response Parsing', () => {
    it('returns parsed command with original transcript', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        commandType: 'create_patient',
        confidence: 0.95,
        data: { name: 'John Doe' },
        warnings: []
      }))

      const result = await parsePatientCommand('Add patient John Doe')

      expect(result.originalTranscript).toBe('Add patient John Doe')
      expect(result.commandType).toBe('create_patient')
      expect(result.confidence).toBe(0.95)
    })

    it('handles missing fields with defaults', async () => {
      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({
        // Missing commandType, confidence, warnings
        data: { name: 'Test' }
      }))

      const result = await parsePatientCommand('Test')

      expect(result.commandType).toBe('unknown')
      expect(result.confidence).toBe(0.5)
      expect(result.warnings).toEqual([])
    })

    it('throws error on AI failure', async () => {
      vi.mocked(chatCompletion).mockRejectedValue(new Error('API timeout'))

      await expect(parsePatientCommand('Test')).rejects.toThrow('Voice parsing service error: API timeout')
    })
  })
})
