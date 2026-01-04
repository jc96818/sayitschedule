import { chatCompletion, isProviderConfigured, getActiveProvider } from './aiProvider.js'

// Re-export for route-level checks
export { isProviderConfigured, getActiveProvider }

// Organization labels for dynamic prompt customization
export interface OrganizationLabels {
  staffLabel: string
  staffLabelSingular: string
  patientLabel: string
  patientLabelSingular: string
  roomLabel: string
  roomLabelSingular: string
  certificationLabel: string
  equipmentLabel: string
}

// Default labels (therapy-focused)
const defaultLabels: OrganizationLabels = {
  staffLabel: 'Staff',
  staffLabelSingular: 'Staff Member',
  patientLabel: 'Patients',
  patientLabelSingular: 'Patient',
  roomLabel: 'Rooms',
  roomLabelSingular: 'Room',
  certificationLabel: 'Certifications',
  equipmentLabel: 'Equipment'
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

// Individual rule item with its own confidence and warnings (for multi-rule parsing)
export interface ParsedRuleItem {
  category: 'gender_pairing' | 'session' | 'availability' | 'specific_pairing' | 'certification'
  description: string
  priority?: number
  ruleLogic?: Record<string, unknown>
  confidence: number
  warnings: string[]
}

// Response type for multi-rule parsing
export interface ParsedMultiRuleResponse {
  commandType: 'create_rules'
  rules: ParsedRuleItem[]
  overallConfidence: number
  originalTranscript: string
  globalWarnings: string[]
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
  action: 'move' | 'cancel' | 'swap' | 'create' | 'reassign_therapist' | 'reassign_room' | 'reassign_patient' | 'change_duration'
  therapistName?: string
  patientName?: string
  currentDate?: string
  currentDayOfWeek?: string
  currentStartTime?: string
  newDate?: string
  newDayOfWeek?: string
  newStartTime?: string
  newEndTime?: string
  newTherapistName?: string
  newRoomName?: string
  newPatientName?: string
  newDurationMinutes?: number
  // For swap action
  swapTherapistName?: string
  swapPatientName?: string
  swapDayOfWeek?: string
  swapStartTime?: string
  notes?: string
}

export interface ParsedVoiceCommand {
  commandType: VoiceCommandType
  confidence: number
  data: ParsedPatientData | ParsedStaffData | ParsedRuleData | ParsedRoomData | ParsedSessionData | Record<string, unknown>
  warnings: string[]
  originalTranscript: string
}

function getSystemPrompt(context: VoiceContext, labels: OrganizationLabels = defaultLabels): string {
  const { staffLabel, staffLabelSingular, patientLabel, patientLabelSingular, roomLabel, roomLabelSingular, certificationLabel, equipmentLabel } = labels
  const staffLower = staffLabel.toLowerCase()
  const staffSingularLower = staffLabelSingular.toLowerCase()
  const patientLower = patientLabel.toLowerCase()
  const patientSingularLower = patientLabelSingular.toLowerCase()
  const roomSingularLower = roomLabelSingular.toLowerCase()
  // roomLabel is used directly in the prompts (e.g., roomLabel.toUpperCase())

  const basePrompt = `You are a voice command parser for a scheduling application called "Say It Schedule".
Your job is to parse spoken commands and extract structured data.
Return ONLY valid JSON - no additional text or explanations.`

  const contextPrompts: Record<VoiceContext, string> = {
    patient: `${basePrompt}

The user is creating or managing ${patientLabel.toUpperCase()} (${patientLower} who receive services).
Extract ${patientSingularLower} information like:
- name (required)
- gender (male/female/other - can infer from name if confident)
- sessionFrequency (sessions per week, default 2 if not specified)
- requiredCertifications (${certificationLabel.toLowerCase()} needed)
- preferredTimes (morning/afternoon/specific times)
- notes (any additional info)`,

    staff: `${basePrompt}

The user is creating or managing ${staffLabel.toUpperCase()} (${staffLower} who provide services).
Extract ${staffSingularLower} information like:
- name (required)
- gender (male/female/other - can infer from name if confident)
- email (if mentioned)
- phone (if mentioned)
- certifications (${certificationLabel.toLowerCase()})
- notes (any additional info)`,

    rule: `${basePrompt}

The user is creating SCHEDULING RULES.
IMPORTANT: A single voice command may contain MULTIPLE rules. Look for:
- Conjunctions like "and", "also", "plus" connecting separate constraints
- Multiple ${staffLower}/${patientLower} names with different constraints
- Separate conditions that should be individual rules

For EACH rule detected, extract:
- category: one of [gender_pairing, session, availability, specific_pairing, certification]
  - gender_pairing: rules about matching genders (e.g., "female ${patientLower} with female ${staffLower}")
  - session: rules about session timing/frequency
  - availability: rules about when ${staffLower}/${patientLower} are available or unavailable
  - specific_pairing: specific ${staffSingularLower}-${patientSingularLower} assignments
  - certification: rules about ${certificationLabel.toLowerCase()} requirements
- description: clear description of the rule
- priority: 1-10 (default 5)
- ruleLogic: structured logic object with parsed constraints
- confidence: 0.0-1.0 for this specific rule
- warnings: array of any ambiguities for this rule

EXAMPLES OF MULTIPLE RULES:
- "Debbie is only available on Wednesdays and Amy is only available on Mondays and Fridays"
  → 2 rules: one for Debbie (availability: Wednesday), one for Amy (availability: Monday, Friday)
- "John should only see male ${staffLower} and Sarah needs a ${staffSingularLower} with ABA certification"
  → 2 rules: one gender_pairing for John, one certification for Sarah
- "Morning sessions only before 11 AM"
  → 1 rule: session timing constraint

Return JSON with this structure:
{
  "commandType": "create_rules",
  "rules": [
    {
      "category": "...",
      "description": "...",
      "priority": 5,
      "ruleLogic": {...},
      "confidence": 0.9,
      "warnings": []
    }
  ],
  "overallConfidence": <minimum confidence across all rules>,
  "globalWarnings": ["...any warnings about the overall interpretation..."]
}`,

    room: `${basePrompt}

The user is creating or managing ${roomLabel.toUpperCase()}.
Extract ${roomSingularLower} information like:
- name (required): the ${roomSingularLower} name or identifier (e.g., "${roomLabelSingular} 101", "Sensory ${roomLabelSingular}", "Suite A")
- description: optional description of the ${roomSingularLower}
- capabilities: array of ${equipmentLabel.toLowerCase()}/features available in the ${roomSingularLower}
  Common capabilities include:
  - wheelchair_accessible: ${roomSingularLower} is accessible to wheelchairs
  - sensory_equipment: has sensory ${equipmentLabel.toLowerCase()}
  - computer_station: has computers/tablets
  - therapy_swing: has a therapy swing
  - quiet_room: soundproofed/quiet environment
  - large_space: larger ${roomSingularLower} for movement
  - outdoor_access: access to outdoor area
  - video_recording: has video recording capability

EXAMPLES:
- "Add ${roomSingularLower.toLowerCase()} 101 with wheelchair access and sensory equipment" → name: "${roomLabelSingular} 101", capabilities: ["wheelchair_accessible", "sensory_equipment"]
- "Create a new ${roomSingularLower.toLowerCase()} called Suite A" → name: "Suite A"
- "Add the sensory ${roomSingularLower.toLowerCase()} with therapy swing and quiet room capabilities" → name: "Sensory ${roomLabelSingular}", capabilities: ["therapy_swing", "quiet_room"]`,

    schedule: `${basePrompt}

The user is scheduling a SESSION (assigning a ${staffSingularLower} to a ${patientSingularLower} at a specific time).
Extract session information like:
- therapistName (required - the ${staffSingularLower}'s name)
- patientName (required - the ${patientSingularLower}'s name)
- date (specific date if mentioned)
- dayOfWeek (monday/tuesday/etc if mentioned instead of date)
- startTime (in HH:mm format)
- endTime (in HH:mm format, usually startTime + 1 hour)
- notes (any additional info)`,

    schedule_modify: `${basePrompt}

The user is MODIFYING an existing schedule. They want to move, cancel, swap, reassign, or add sessions.
Determine the action and extract the relevant information:

ACTIONS:
- move: Reschedule a session to a different time or day
- cancel: Remove/delete a session
- swap: Exchange two sessions' times (swap one session's time slot with another)
- create: Add a new session (if they're not modifying existing)
- reassign_therapist: Change the ${staffSingularLower} assigned to a session (uses newTherapistName)
- reassign_room: Change the ${roomSingularLower} for a session (uses newRoomName)
- reassign_patient: Change the ${patientSingularLower} for a session (uses newPatientName)
- change_duration: Change the length/duration of a session (uses newDurationMinutes)

EXTRACT:
- action (required): one of [move, cancel, swap, create, reassign_therapist, reassign_room, reassign_patient, change_duration]
- therapistName: the ${staffSingularLower}'s name (to identify the session)
- patientName: the ${patientSingularLower}'s name (alternative way to identify)
- currentDayOfWeek: current day (monday/tuesday/etc) - lowercase
- currentStartTime: current time in HH:mm format (24-hour)
- newDayOfWeek: new day for move/swap - lowercase
- newStartTime: new time in HH:mm format (24-hour)
- newEndTime: new end time (usually startTime + 1 hour)
- newTherapistName: for reassign_therapist, the new ${staffSingularLower}'s name
- newRoomName: for reassign_room, the new ${roomSingularLower} name
- newPatientName: for reassign_patient, the new ${patientSingularLower}'s name
- newDurationMinutes: for change_duration, the new session length in minutes (e.g., 30, 45, 60, 90, 120)
- swapTherapistName: for swap, the ${staffSingularLower} whose session to swap with
- swapPatientName: for swap, the ${patientSingularLower} whose session to swap with
- swapDayOfWeek: for swap, the day of the second session
- swapStartTime: for swap, the time of the second session
- notes: any additional context

TIME PARSING:
- "9 AM" = "09:00"
- "2 PM" = "14:00"
- "10:30 AM" = "10:30"
- "3:30 PM" = "15:30"

EXAMPLES:
- "Move John's 9 AM session to 2 PM" → action: move, therapistName: John, currentStartTime: 09:00, newStartTime: 14:00
- "Cancel Sarah's Friday 10 AM" → action: cancel, therapistName: Sarah, currentDayOfWeek: friday, currentStartTime: 10:00
- "Reschedule Monday 2 PM with Emma to Wednesday" → action: move, patientName: Emma, currentDayOfWeek: monday, currentStartTime: 14:00, newDayOfWeek: wednesday
- "Add a session for Sarah with Emma on Tuesday at 10 AM" → action: create, therapistName: Sarah, patientName: Emma, newDayOfWeek: tuesday, newStartTime: 10:00
- "Schedule John to see Noah on Friday at 2 PM" → action: create, therapistName: John, patientName: Noah, newDayOfWeek: friday, newStartTime: 14:00
- "Change the therapist for Monday's 9 AM to Emily" → action: reassign_therapist, currentDayOfWeek: monday, currentStartTime: 09:00, newTherapistName: Emily
- "Assign David to the 2 PM session with Emma" → action: reassign_therapist, patientName: Emma, currentStartTime: 14:00, newTherapistName: David
- "Move Sarah's 10 AM session to Room B" → action: reassign_room, therapistName: Sarah, currentStartTime: 10:00, newRoomName: Room B
- "Put the Friday 3 PM session in the Sensory Room" → action: reassign_room, currentDayOfWeek: friday, currentStartTime: 15:00, newRoomName: Sensory Room
- "Change the patient for Monday's 10 AM to Emma instead" → action: reassign_patient, currentDayOfWeek: monday, currentStartTime: 10:00, newPatientName: Emma
- "Switch Sarah's 9 AM patient to Noah" → action: reassign_patient, therapistName: Sarah, currentStartTime: 09:00, newPatientName: Noah
- "Swap Sarah's Monday 9 AM with John's Tuesday 10 AM" → action: swap, therapistName: Sarah, currentDayOfWeek: monday, currentStartTime: 09:00, swapTherapistName: John, swapDayOfWeek: tuesday, swapStartTime: 10:00
- "Exchange the Monday 2 PM session with Tuesday's 11 AM" → action: swap, currentDayOfWeek: monday, currentStartTime: 14:00, swapDayOfWeek: tuesday, swapStartTime: 11:00
- "Swap David's Monday 11 AM with Michael's Wednesday 11 AM" → action: swap, therapistName: David, currentDayOfWeek: monday, currentStartTime: 11:00, swapTherapistName: Michael, swapDayOfWeek: wednesday, swapStartTime: 11:00
- "Make Sarah's 9 AM session 90 minutes" → action: change_duration, therapistName: Sarah, currentStartTime: 09:00, newDurationMinutes: 90
- "Change Monday's 10 AM to a 2 hour session" → action: change_duration, currentDayOfWeek: monday, currentStartTime: 10:00, newDurationMinutes: 120
- "Shorten the Friday 2 PM session to 30 minutes" → action: change_duration, currentDayOfWeek: friday, currentStartTime: 14:00, newDurationMinutes: 30
- "Extend Emma's session to 1.5 hours" → action: change_duration, patientName: Emma, newDurationMinutes: 90`,

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
- create_patient: Adding a new ${patientSingularLower}
- create_staff: Adding a new ${staffSingularLower}
- create_rule: Creating a scheduling rule
- schedule_session: Scheduling a specific session
- unknown: Cannot determine intent`
  }

  return contextPrompts[context]
}

function getUserPrompt(transcript: string, context: VoiceContext): string {
  // Special handling for rule context - uses multi-rule format
  if (context === 'rule') {
    return `Parse this voice command for scheduling rules: "${transcript}"

The response format is already defined in the system prompt. Follow that structure exactly.

Guidelines:
- Detect if transcript contains MULTIPLE rules (look for "and", "also", multiple names with different constraints)
- Each rule should have its own confidence score
- overallConfidence should be the MINIMUM of all rule confidences
- Use proper name capitalization (e.g., "Debbie" not "debbie")
- Default priority to 5 if not specified
- Include warnings for any assumptions or inferred values`
  }

  // For schedule_modify and schedule_generate, use different command type patterns
  let commandTypeHint: string
  if (context === 'general') {
    commandTypeHint = '<detected_type>'
  } else if (context === 'schedule_modify') {
    commandTypeHint = '<modify_session, cancel_session, or schedule_session based on action>'
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
  context: VoiceContext = 'general',
  labels?: Partial<OrganizationLabels>
): Promise<ParsedVoiceCommand> {
  const mergedLabels = { ...defaultLabels, ...labels }
  const systemPrompt = getSystemPrompt(context, mergedLabels)
  const userPrompt = getUserPrompt(transcript, context)

  try {
    const content = await chatCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: 1024
    })

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
    if (error instanceof Error) {
      console.error('AI API Error:', error.message)
      throw new Error(`Voice parsing service error: ${error.message}`)
    }
    throw error
  }
}

// Helper function to parse patient-specific commands
export async function parsePatientCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'patient', labels)
}

// Helper function to parse staff-specific commands
export async function parseStaffCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'staff', labels)
}

// Helper function to parse rule-specific commands (legacy single-rule format)
export async function parseRuleCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'rule', labels)
}

// Helper function to parse multiple rules from a single transcript
export async function parseMultipleRulesCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedMultiRuleResponse> {
  const mergedLabels = { ...defaultLabels, ...labels }
  const systemPrompt = getSystemPrompt('rule', mergedLabels)
  const userPrompt = getUserPrompt(transcript, 'rule')

  try {
    const content = await chatCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: 2048 // Increased for multiple rules
    })

    const parsed = JSON.parse(content) as Partial<ParsedMultiRuleResponse>

    // Validate and normalize response
    if (!parsed.commandType) {
      parsed.commandType = 'create_rules'
    }
    if (!Array.isArray(parsed.rules)) {
      // Handle legacy single-rule response format or malformed response
      parsed.rules = []
    }
    if (!Array.isArray(parsed.globalWarnings)) {
      parsed.globalWarnings = []
    }

    // Ensure each rule has required fields with defaults
    const validCategories = ['gender_pairing', 'session', 'availability', 'specific_pairing', 'certification'] as const
    parsed.rules = parsed.rules.map(rule => ({
      category: validCategories.includes(rule.category as typeof validCategories[number])
        ? rule.category
        : 'session',
      description: rule.description || '',
      priority: typeof rule.priority === 'number' ? rule.priority : 5,
      ruleLogic: rule.ruleLogic || {},
      confidence: typeof rule.confidence === 'number' ? rule.confidence : 0.5,
      warnings: Array.isArray(rule.warnings) ? rule.warnings : []
    }))

    // Calculate overall confidence as minimum across all rules
    if (typeof parsed.overallConfidence !== 'number') {
      parsed.overallConfidence = parsed.rules.length > 0
        ? Math.min(...parsed.rules.map(r => r.confidence))
        : 0
    }

    return {
      commandType: parsed.commandType,
      rules: parsed.rules,
      overallConfidence: parsed.overallConfidence,
      originalTranscript: transcript,
      globalWarnings: parsed.globalWarnings
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('AI API Error:', error.message)
      throw new Error(`Voice parsing service error: ${error.message}`)
    }
    throw error
  }
}

// Helper function to parse room-specific commands
export async function parseRoomCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'room', labels)
}

// Helper function to parse schedule-specific commands (for creating new sessions)
export async function parseScheduleCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule', labels)
}

// Helper function to parse schedule modification commands (move, cancel, swap)
export async function parseScheduleModifyCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule_modify', labels)
}

// Helper function to parse schedule generation commands (generate a week's schedule)
export async function parseScheduleGenerateCommand(transcript: string, labels?: Partial<OrganizationLabels>): Promise<ParsedVoiceCommand> {
  return parseVoiceCommand(transcript, 'schedule_generate', labels)
}
