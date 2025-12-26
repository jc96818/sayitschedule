import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openaiClient
}

export type VoiceCommandType = 'create_patient' | 'create_staff' | 'create_rule' | 'schedule_session' | 'unknown'
export type VoiceContext = 'patient' | 'staff' | 'rule' | 'schedule' | 'general'

export interface ParsedPatientData {
  name: string
  gender?: 'male' | 'female' | 'other'
  sessionFrequency?: number
  requiredCertifications?: string[]
  preferredTimes?: string[]
  notes?: string
}

export interface ParsedStaffData {
  name: string
  gender?: 'male' | 'female' | 'other'
  email?: string
  phone?: string
  certifications?: string[]
  notes?: string
}

export interface ParsedRuleData {
  category: 'gender_pairing' | 'session' | 'availability' | 'specific_pairing' | 'certification'
  description: string
  priority?: number
  ruleLogic?: Record<string, unknown>
}

export interface ParsedSessionData {
  therapistName: string
  patientName: string
  date?: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  notes?: string
}

export interface ParsedVoiceCommand {
  commandType: VoiceCommandType
  confidence: number
  data: ParsedPatientData | ParsedStaffData | ParsedRuleData | ParsedSessionData | Record<string, unknown>
  warnings: string[]
  originalTranscript: string
}

function getSystemPrompt(context: VoiceContext): string {
  const basePrompt = `You are a voice command parser for a therapy scheduling application called "Say It Schedule".
Your job is to parse spoken commands and extract structured data.
Return ONLY valid JSON - no additional text or explanations.`

  const contextPrompts: Record<VoiceContext, string> = {
    patient: `${basePrompt}

The user is creating or managing PATIENTS (clients who receive therapy).
Extract patient information like:
- name (required)
- gender (male/female/other - can infer from name if confident)
- sessionFrequency (sessions per week, default 2 if not specified)
- requiredCertifications (therapy types needed: Speech, Occupational, Physical, Behavioral, ABA)
- preferredTimes (morning/afternoon/specific times)
- notes (any additional info)`,

    staff: `${basePrompt}

The user is creating or managing STAFF (therapists who provide therapy).
Extract staff information like:
- name (required)
- gender (male/female/other - can infer from name if confident)
- email (if mentioned)
- phone (if mentioned)
- certifications (therapy certifications: Speech, Occupational, Physical, Behavioral, ABA)
- notes (any additional info)`,

    rule: `${basePrompt}

The user is creating SCHEDULING RULES for the therapy center.
Extract rule information like:
- category: one of [gender_pairing, session, availability, specific_pairing, certification]
  - gender_pairing: rules about matching genders (e.g., "female patients with female therapists")
  - session: rules about session timing/frequency
  - availability: rules about availability windows
  - specific_pairing: specific therapist-patient assignments
  - certification: rules about certification requirements
- description: clear description of the rule
- priority: 1-10 (default 5)
- ruleLogic: structured logic object`,

    schedule: `${basePrompt}

The user is scheduling a therapy SESSION (assigning a therapist to a patient at a specific time).
Extract session information like:
- therapistName (required - the staff member's name)
- patientName (required - the patient's name)
- date (specific date if mentioned)
- dayOfWeek (monday/tuesday/etc if mentioned instead of date)
- startTime (in HH:mm format)
- endTime (in HH:mm format, usually startTime + 1 hour)
- notes (any additional info)`,

    general: `${basePrompt}

Determine what type of command the user is trying to execute:
- create_patient: Adding a new patient/client
- create_staff: Adding a new therapist/staff member
- create_rule: Creating a scheduling rule
- schedule_session: Scheduling a specific session
- unknown: Cannot determine intent`
  }

  return contextPrompts[context]
}

function getUserPrompt(transcript: string, context: VoiceContext): string {
  return `Parse this voice command: "${transcript}"

Return a JSON object with this structure:
{
  "commandType": "${context === 'general' ? '<detected_type>' : `create_${context}`}",
  "confidence": <0.0-1.0 based on how complete/clear the command is>,
  "data": {
    <extracted fields based on command type>
  },
  "warnings": [<array of strings for any ambiguities, missing info, or assumptions made>]
}

Important:
- confidence should be 0.9+ if all required fields are clear
- confidence should be 0.6-0.9 if some fields are inferred or optional fields missing
- confidence should be below 0.6 if critical information is unclear
- Always include warnings for any assumptions or inferences made
- For names, use proper capitalization (e.g., "John Smith" not "john smith")`
}

export async function parseVoiceCommand(
  transcript: string,
  context: VoiceContext = 'general'
): Promise<ParsedVoiceCommand> {
  const systemPrompt = getSystemPrompt(context)
  const userPrompt = getUserPrompt(transcript, context)

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-5',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response content from OpenAI')
    }

    const parsed = JSON.parse(content) as Omit<ParsedVoiceCommand, 'originalTranscript'>

    // Validate response structure
    if (!parsed.commandType) {
      parsed.commandType = 'unknown'
    }
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = 0.5
    }
    if (!parsed.data) {
      parsed.data = {}
    }
    if (!Array.isArray(parsed.warnings)) {
      parsed.warnings = []
    }

    return {
      ...parsed,
      originalTranscript: transcript
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API Error:', error.message)
      throw new Error(`Voice parsing service error: ${error.message}`)
    }
    throw error
  }
}

// Helper function to parse patient-specific commands
export async function parsePatientCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'patient')
}

// Helper function to parse staff-specific commands
export async function parseStaffCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'staff')
}

// Helper function to parse rule-specific commands
export async function parseRuleCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'rule')
}

// Helper function to parse schedule-specific commands
export async function parseScheduleCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule')
}
