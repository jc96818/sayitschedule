import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime'

const MODEL_ID = 'us.amazon.nova-2-lite-v1:0'

let bedrockClient: BedrockRuntimeClient | null = null

function getClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  }
  return bedrockClient
}

interface NovaInvokeOptions {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  jsonOutput?: boolean
}

async function invokeNova(options: NovaInvokeOptions): Promise<string> {
  const { systemPrompt, userPrompt, maxTokens, jsonOutput = true } = options

  const messages: Message[] = [
    { role: 'user', content: [{ text: userPrompt }] },
  ]

  // Prefill for JSON output - forces the model to start with {
  if (jsonOutput) {
    messages.push({
      role: 'assistant',
      content: [{ text: '{' }],
    })
  }

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages,
    inferenceConfig: {
      maxTokens,
      temperature: 0, // Use greedy decoding for structured outputs
    },
  })

  const response = await getClient().send(command)

  // Extract text from the response
  const outputContent = response.output?.message?.content
  if (!outputContent || outputContent.length === 0) {
    throw new Error('No response content from Nova')
  }

  // Find the text content block
  const textBlock = outputContent.find((block): block is ContentBlock.TextMember => 'text' in block)
  if (!textBlock) {
    throw new Error('No text content in Nova response')
  }

  let text = textBlock.text

  // Prepend the prefilled "{" for JSON parsing since prefill consumed it
  if (jsonOutput) {
    text = '{' + text
  }

  return text
}

// Re-export types from openai.ts that will be used
export interface StaffForScheduling {
  id: string
  name: string
  gender: 'male' | 'female' | 'other'
  certifications: string[]
  defaultHours: Record<string, { start: string; end: string } | null>
}

export interface PatientForScheduling {
  id: string
  identifier: string | null
  name: string
  gender: 'male' | 'female' | 'other'
  sessionFrequency: number
  requiredCertifications: string[]
  preferredTimes: string[] | null
  preferredRoomId?: string | null
  requiredRoomCapabilities?: string[]
}

export interface RuleForScheduling {
  id: string
  category: string
  description: string
  ruleLogic: Record<string, unknown>
  priority: number
}

export interface RoomForScheduling {
  id: string
  name: string
  capabilities: string[]
}

export interface GeneratedSession {
  therapistId: string
  patientId: string
  roomId?: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  notes?: string
}

export interface ScheduleGenerationResult {
  sessions: GeneratedSession[]
  warnings: string[]
}

// Rule Analysis types
export interface RuleConflict {
  ruleIds: string[]
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestion: string
}

export interface RuleDuplicate {
  ruleIds: string[]
  description: string
  recommendation: string
}

export interface SuggestedRule {
  category: string
  description: string
  priority?: number
}

export interface RuleEnhancement {
  relatedRuleIds: string[]
  suggestion: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
  suggestedRules?: SuggestedRule[]
}

export interface RuleAnalysisResult {
  conflicts: RuleConflict[]
  duplicates: RuleDuplicate[]
  enhancements: RuleEnhancement[]
  summary: {
    totalRulesAnalyzed: number
    conflictsFound: number
    duplicatesFound: number
    enhancementsSuggested: number
  }
}

export interface EntityNamesContext {
  staffNames: string[]
  patientNames: string[]
  roomNames: string[]
}

function formatStaffForPrompt(staff: StaffForScheduling[]): string {
  return staff.map(s => {
    const hours = Object.entries(s.defaultHours || {})
      .filter(([_, h]) => h !== null)
      .map(([day, h]) => `${day}: ${h!.start}-${h!.end}`)
      .join(', ')

    return `- ID: ${s.id}
  Name: ${s.name}
  Gender: ${s.gender}
  Certifications: [${s.certifications.join(', ')}]
  Working Hours: ${hours || 'Not specified'}`
  }).join('\n')
}

function formatPatientsForPrompt(patients: PatientForScheduling[]): string {
  return patients.map(p => {
    const displayId = p.identifier || p.id
    const roomCaps = (p.requiredRoomCapabilities || []).join(', ')
    return `- ID: ${p.id}
  Patient ID: ${displayId}
  Name: ${p.name}
  Gender: ${p.gender}
  Sessions Per Week: ${p.sessionFrequency}
  Required Certifications: [${p.requiredCertifications.join(', ')}]
  Preferred Times: [${(p.preferredTimes || []).join(', ')}]
  Preferred Room: ${p.preferredRoomId || 'None'}
  Required Room Capabilities: [${roomCaps}]`
  }).join('\n')
}

function formatRoomsForPrompt(rooms: RoomForScheduling[]): string {
  if (rooms.length === 0) return 'No rooms configured.'
  return rooms.map(r => {
    return `- ID: ${r.id}
  Name: ${r.name}
  Capabilities: [${r.capabilities.join(', ')}]`
  }).join('\n')
}

function formatRulesForPrompt(rules: RuleForScheduling[]): string {
  return rules.map((r, i) => {
    return `${i + 1}. [${r.category}] ${r.description} (priority: ${r.priority})`
  }).join('\n')
}

function getWeekDates(weekStartDate: Date): string[] {
  const dates: string[] = []
  for (let i = 0; i < 5; i++) { // Monday to Friday
    const date = new Date(weekStartDate)
    date.setDate(date.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
}

export async function generateScheduleWithAI(
  weekStartDate: Date,
  staff: StaffForScheduling[],
  patients: PatientForScheduling[],
  rules: RuleForScheduling[],
  rooms: RoomForScheduling[] = []
): Promise<ScheduleGenerationResult> {
  const weekDates = getWeekDates(weekStartDate)
  const hasRooms = rooms.length > 0

  const systemPrompt = `You are an expert therapy scheduling assistant. Your task is to generate an optimal weekly schedule that assigns therapists to patients while respecting all constraints.

CRITICAL RULES:
1. Each therapist can only have ONE session at a time (no overlapping sessions)
2. Each patient can only have ONE session at a time (no overlapping sessions)
3. Sessions must be within the therapist's working hours for that day
4. Therapists must have ALL required certifications for each patient they see
5. Try to honor gender pairing rules when possible
6. Each patient should receive their required number of sessions per week
7. Distribute sessions evenly across the week when possible
8. Standard session duration is 60 minutes unless otherwise specified${hasRooms ? `
9. Assign rooms to sessions when rooms are available
10. Each room can only have ONE session at a time (no overlapping sessions)
11. If a patient requires specific room capabilities, only assign rooms that have ALL required capabilities
12. If a patient has a preferred room, try to use that room when possible` : ''}

You must return ONLY a valid JSON object with no additional text.`

  const roomsSection = hasRooms ? `

ROOMS (${rooms.length} rooms):
${formatRoomsForPrompt(rooms)}` : ''

  const userPrompt = `Generate a schedule for the week of ${weekDates[0]} to ${weekDates[4]}.

AVAILABLE DATES: ${weekDates.join(', ')}

STAFF (${staff.length} therapists):
${formatStaffForPrompt(staff)}

PATIENTS (${patients.length} patients):
${formatPatientsForPrompt(patients)}${roomsSection}

SCHEDULING RULES:
${rules.length > 0 ? formatRulesForPrompt(rules) : 'No specific rules defined.'}

Generate a complete schedule. Return a JSON object with this exact structure:
{
  "sessions": [
    {
      "therapistId": "<staff UUID>",
      "patientId": "<patient UUID>",${hasRooms ? `
      "roomId": "<room UUID or null>",` : ''}
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "notes": "optional note"
    }
  ],
  "warnings": ["any scheduling constraints that couldn't be fully satisfied"]
}

Ensure:
- Use exact UUIDs from the staff${hasRooms ? ', patient, and room' : ' and patient'} lists above
- Times are in 24-hour format (e.g., "09:00", "14:30")
- Each patient gets approximately their required sessions per week
- No time conflicts for any therapist${hasRooms ? ', patient, or room' : ' or patient'}`

  const debugAI = process.env.DEBUG_AI_REQUESTS === 'true'

  if (debugAI) {
    console.log('\n========== AI SCHEDULE GENERATION REQUEST ==========')
    console.log('SYSTEM PROMPT:')
    console.log(systemPrompt)
    console.log('\nUSER PROMPT:')
    console.log(userPrompt)
    console.log('====================================================\n')
  }

  try {
    const content = await invokeNova({
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      jsonOutput: true
    })

    if (debugAI) {
      console.log('\n========== AI SCHEDULE GENERATION RESPONSE ==========')
      console.log(content)
      console.log('=====================================================\n')
    }

    const result = JSON.parse(content) as ScheduleGenerationResult

    // Validate the response structure
    if (!Array.isArray(result.sessions)) {
      throw new Error('Invalid response: sessions must be an array')
    }

    // Ensure warnings array exists
    if (!Array.isArray(result.warnings)) {
      result.warnings = []
    }

    return result
  } catch (error) {
    if (error instanceof Error) {
      console.error('Nova API Error:', error.message)
      throw new Error(`AI service error: ${error.message}`)
    }
    throw error
  }
}

function formatRulesForAnalysis(rules: RuleForScheduling[]): string {
  return rules.map((r, i) => {
    return `Rule ${i + 1}:
  - ID: ${r.id}
  - Category: ${r.category}
  - Description: ${r.description}
  - Priority: ${r.priority}`
  }).join('\n\n')
}

export async function analyzeRulesWithAI(
  rules: RuleForScheduling[],
  context: EntityNamesContext
): Promise<RuleAnalysisResult> {
  if (rules.length === 0) {
    return {
      conflicts: [],
      duplicates: [],
      enhancements: [],
      summary: {
        totalRulesAnalyzed: 0,
        conflictsFound: 0,
        duplicatesFound: 0,
        enhancementsSuggested: 0
      }
    }
  }

  const systemPrompt = `You are an expert scheduling rules analyst. Your task is to analyze scheduling rules for a therapy scheduling system and identify ONLY significant issues:

1. CONFLICTS: Rules that directly contradict each other or create impossible scheduling scenarios
2. DUPLICATES: Rules that are functionally identical or nearly identical (not just related)
3. ENHANCEMENTS: Critical missing rules that would cause scheduling failures

IMPORTANT GUIDELINES:
- Be CONSERVATIVE. Only report issues that would cause real problems.
- It is perfectly acceptable to return empty arrays if the rules are well-structured.
- Do NOT suggest enhancements just because rules could theoretically be more explicit or detailed.
- Do NOT flag rules as duplicates if they cover different aspects of the same topic.
- Do NOT suggest adding rules that are already implied by existing rules.
- Avoid suggesting stylistic or organizational improvements.
- A well-maintained rule set should have FEW or NO findings.

You must return ONLY a valid JSON object with no additional text.`

  const contextSection = `
CONTEXT - Entity names in the system:
- Staff/Therapists: ${context.staffNames.length > 0 ? context.staffNames.join(', ') : 'None defined'}
- Patients: ${context.patientNames.length > 0 ? context.patientNames.join(', ') : 'None defined'}
- Rooms: ${context.roomNames.length > 0 ? context.roomNames.join(', ') : 'None defined'}`

  const userPrompt = `Analyze the following ${rules.length} scheduling rules for conflicts, duplicates, and potential enhancements.
${contextSection}

RULES TO ANALYZE:
${formatRulesForAnalysis(rules)}

Return a JSON object with this exact structure:
{
  "conflicts": [
    {
      "ruleIds": ["<rule ID 1>", "<rule ID 2>"],
      "description": "Clear explanation of the conflict",
      "severity": "high" | "medium" | "low",
      "suggestion": "How to resolve the conflict"
    }
  ],
  "duplicates": [
    {
      "ruleIds": ["<rule ID 1>", "<rule ID 2>"],
      "description": "Explanation of why these rules are duplicates",
      "recommendation": "Which rule to keep or how to consolidate"
    }
  ],
  "enhancements": [
    {
      "relatedRuleIds": ["<optional related rule IDs>"],
      "suggestion": "The suggested improvement or what's missing",
      "rationale": "Why this enhancement would help",
      "priority": "high" | "medium" | "low",
      "suggestedRules": [
        {
          "category": "gender_pairing" | "session" | "availability" | "specific_pairing" | "certification",
          "description": "The actual rule text that can be added directly to the system",
          "priority": 50
        }
      ]
    }
  ],
  "summary": {
    "totalRulesAnalyzed": ${rules.length},
    "conflictsFound": <number>,
    "duplicatesFound": <number>,
    "enhancementsSuggested": <number>
  }
}

CRITICAL INSTRUCTIONS:
- Only report ACTUAL problems, not theoretical or stylistic concerns.
- Empty arrays are the CORRECT response when rules are well-structured.
- Do NOT invent problems to fill the response.
- Enhancements should ONLY be suggested for critical gaps that would cause scheduling failures.
- If rules adequately cover a topic, do NOT suggest making them "more explicit" or "clearer".

Severity/Priority guidelines (use sparingly):
- HIGH: Critical issues that WILL cause scheduling failures
- MEDIUM: Issues that create ambiguity leading to incorrect schedules
- LOW: Do NOT use - if it's low priority, don't report it at all

For enhancements (only if truly necessary):
- "suggestedRules" should contain ready-to-use rule descriptions
- Only suggest rules that fill genuine gaps, not refinements of existing rules`

  try {
    const content = await invokeNova({
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      jsonOutput: true
    })

    const result = JSON.parse(content) as RuleAnalysisResult

    // Validate and ensure arrays exist
    if (!Array.isArray(result.conflicts)) {
      result.conflicts = []
    }
    if (!Array.isArray(result.duplicates)) {
      result.duplicates = []
    }
    if (!Array.isArray(result.enhancements)) {
      result.enhancements = []
    }
    if (!result.summary) {
      result.summary = {
        totalRulesAnalyzed: rules.length,
        conflictsFound: result.conflicts.length,
        duplicatesFound: result.duplicates.length,
        enhancementsSuggested: result.enhancements.length
      }
    }

    return result
  } catch (error) {
    if (error instanceof Error) {
      console.error('Nova API Error:', error.message)
      throw new Error(`AI service error: ${error.message}`)
    }
    throw error
  }
}

// Check if Nova provider is properly configured
export function isConfigured(): boolean {
  // AWS SDK will use IAM roles, environment variables, or profile
  // We just need to verify the region is available or use default
  return true // AWS SDK handles credential chain automatically
}

// Voice parsing support

interface ChatCompletionOptions {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
}

/**
 * Generic chat completion function for voice parsing
 * This matches the interface expected by voiceParser.ts
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { systemPrompt, userPrompt, maxTokens } = options

  return invokeNova({
    systemPrompt,
    userPrompt,
    maxTokens,
    jsonOutput: true
  })
}
