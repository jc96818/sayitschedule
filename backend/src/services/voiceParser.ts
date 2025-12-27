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

export type VoiceCommandType =
  | 'create_patient'
  | 'create_staff'
  | 'create_rule'
  | 'create_room'
  | 'schedule_session'
  | 'modify_session'
  | 'cancel_session'
  | 'generate_schedule'
  | 'unknown'

export type VoiceContext = 'patient' | 'staff' | 'rule' | 'room' | 'schedule' | 'schedule_modify' | 'schedule_generate' | 'general'

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

export interface ParsedRoomData {
  name: string
  description?: string
  capabilities?: string[]
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

export interface ParsedScheduleModifyData {
  action: 'move' | 'cancel' | 'swap' | 'create'
  therapistName?: string
  patientName?: string
  currentDate?: string
  currentDayOfWeek?: string
  currentStartTime?: string
  newDate?: string
  newDayOfWeek?: string
  newStartTime?: string
  newEndTime?: string
  notes?: string
}

export interface ParsedVoiceCommand {
  commandType: VoiceCommandType
  confidence: number
  data: ParsedPatientData | ParsedStaffData | ParsedRuleData | ParsedRoomData | ParsedSessionData | Record<string, unknown>
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

    room: `${basePrompt}

The user is creating or managing THERAPY ROOMS for the center.
Extract room information like:
- name (required): the room name or identifier (e.g., "Room 101", "Sensory Room", "Therapy Suite A")
- description: optional description of the room
- capabilities: array of equipment/features available in the room
  Common capabilities include:
  - wheelchair_accessible: room is accessible to wheelchairs
  - sensory_equipment: has sensory therapy equipment
  - computer_station: has computers/tablets for therapy
  - therapy_swing: has a therapy swing
  - quiet_room: soundproofed/quiet environment
  - large_space: larger room for movement therapy
  - outdoor_access: access to outdoor area
  - video_recording: has video recording capability

EXAMPLES:
- "Add room 101 with wheelchair access and sensory equipment" → name: "Room 101", capabilities: ["wheelchair_accessible", "sensory_equipment"]
- "Create a new room called Therapy Suite A" → name: "Therapy Suite A"
- "Add the sensory room with therapy swing and quiet room capabilities" → name: "Sensory Room", capabilities: ["therapy_swing", "quiet_room"]`,

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

    schedule_modify: `${basePrompt}

The user is MODIFYING an existing therapy schedule. They want to move, cancel, or swap sessions.
Determine the action and extract the relevant information:

ACTIONS:
- move: Reschedule a session to a different time or day
- cancel: Remove/delete a session
- swap: Exchange two sessions' times
- create: Add a new session (if they're not modifying existing)

EXTRACT:
- action (required): one of [move, cancel, swap, create]
- therapistName: the therapist's name (to identify the session)
- patientName: the patient's name (alternative way to identify)
- currentDayOfWeek: current day (monday/tuesday/etc) - lowercase
- currentStartTime: current time in HH:mm format (24-hour)
- newDayOfWeek: new day for move/swap - lowercase
- newStartTime: new time in HH:mm format (24-hour)
- newEndTime: new end time (usually startTime + 1 hour)
- notes: any additional context

TIME PARSING:
- "9 AM" = "09:00"
- "2 PM" = "14:00"
- "10:30 AM" = "10:30"
- "3:30 PM" = "15:30"

EXAMPLES:
- "Move John's 9 AM session to 2 PM" → action: move, therapistName: John, currentStartTime: 09:00, newStartTime: 14:00
- "Cancel Sarah's Friday 10 AM" → action: cancel, therapistName: Sarah, currentDayOfWeek: friday, currentStartTime: 10:00
- "Reschedule Monday 2 PM with Emma to Wednesday" → action: move, patientName: Emma, currentDayOfWeek: monday, currentStartTime: 14:00, newDayOfWeek: wednesday`,

    schedule_generate: `${basePrompt}

The user wants to GENERATE a new weekly schedule. They need to specify which week to generate.
Extract the week information:

EXTRACT:
- weekReference: How the user referred to the week (e.g., "this week", "next week", "the week of January 6th")
- weekStartDate: The Monday of that week in YYYY-MM-DD format (calculate based on today's date and the reference)

TODAY'S DATE CONTEXT:
- Use today's date to calculate relative references like "this week" or "next week"
- "This week" means the current week (Monday of current week)
- "Next week" means the following week
- "Week of [date]" means find the Monday of that week

EXAMPLES:
- "Generate a schedule for this week" → weekReference: "this week", weekStartDate: <Monday of current week>
- "Create next week's schedule" → weekReference: "next week", weekStartDate: <Monday of next week>
- "Generate schedule for the week of January 6th" → weekReference: "week of January 6th", weekStartDate: "2025-01-06" (if Jan 6 is a Monday, otherwise find that week's Monday)
- "Make a schedule starting Monday the 13th" → weekReference: "Monday the 13th", weekStartDate: <that Monday's date>

IMPORTANT:
- Always return weekStartDate as a Monday in YYYY-MM-DD format
- If the user mentions a specific date that's not a Monday, find the Monday of that week
- Include confidence 0.9+ if the week is clearly specified
- Include a warning if you had to infer or calculate the date`,

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
  // For schedule_modify and schedule_generate, use different command type patterns
  let commandTypeHint: string
  if (context === 'general') {
    commandTypeHint = '<detected_type>'
  } else if (context === 'schedule_modify') {
    commandTypeHint = '<modify_session or cancel_session based on action>'
  } else if (context === 'schedule_generate') {
    commandTypeHint = 'generate_schedule'
  } else {
    commandTypeHint = `create_${context}`
  }

  return `Parse this voice command: "${transcript}"

Return a JSON object with this structure:
{
  "commandType": "${commandTypeHint}",
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
      model: 'gpt-5.1',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1024,
      store: false
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

// Helper function to parse room-specific commands
export async function parseRoomCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'room')
}

// Helper function to parse schedule-specific commands (for creating new sessions)
export async function parseScheduleCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule')
}

// Helper function to parse schedule modification commands (move, cancel, swap)
export async function parseScheduleModifyCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule_modify')
}

// Helper function to parse schedule generation commands (generate a week's schedule)
export async function parseScheduleGenerateCommand(transcript: string): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule_generate')
}
