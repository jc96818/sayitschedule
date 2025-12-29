import { staffRepository, type StaffCreate, type DefaultHours } from '../repositories/staff.js'
import { patientRepository, type PatientCreate } from '../repositories/patients.js'
import { roomRepository, type RoomCreate } from '../repositories/rooms.js'
import { ruleRepository, type RuleCreate } from '../repositories/rules.js'
import type { Staff, Patient, Room, Rule, Gender, RuleCategory } from '@prisma/client'

export type ExportEntityType = 'staff' | 'patients' | 'rooms' | 'rules'
export type ExportFormat = 'json' | 'csv'

export interface ExportResult {
  data: Buffer
  filename: string
  contentType: string
}

export interface ImportPreview {
  total: number
  toCreate: number
  toSkip: number
  errors: string[]
  records: Record<string, unknown>[]
}

export interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

// CSV Headers for each entity type
const CSV_HEADERS: Record<ExportEntityType, string[]> = {
  staff: ['id', 'name', 'email', 'phone', 'gender', 'certifications', 'hireDate', 'defaultHours', 'status'],
  patients: ['id', 'name', 'identifier', 'gender', 'sessionFrequency', 'preferredTimes', 'requiredCertifications', 'preferredRoomId', 'requiredRoomCapabilities', 'notes', 'status'],
  rooms: ['id', 'name', 'capabilities', 'description', 'status'],
  rules: ['id', 'category', 'description', 'priority', 'isActive', 'ruleLogic']
}

// Required fields for import validation
const REQUIRED_FIELDS: Record<ExportEntityType, string[]> = {
  staff: ['name', 'gender'],
  patients: ['name', 'gender'],
  rooms: ['name'],
  rules: ['category', 'description']
}

// Valid enum values
const VALID_GENDERS = ['male', 'female', 'other']
const VALID_STATUSES = ['active', 'inactive']
const VALID_RULE_CATEGORIES = ['gender_pairing', 'session', 'availability', 'specific_pairing', 'certification']

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  let str: string
  if (typeof value === 'object') {
    str = JSON.stringify(value)
  } else if (value instanceof Date) {
    str = value.toISOString()
  } else {
    str = String(value)
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert records to CSV format
 */
function toCSV(records: Record<string, unknown>[], headers: string[]): string {
  const lines: string[] = []

  // Header row
  lines.push(headers.join(','))

  // Data rows
  for (const record of records) {
    const values = headers.map(h => escapeCSV(record[h]))
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

/**
 * Parse CSV content into records
 */
function parseCSV(content: string, headers: string[]): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  // Skip header row, parse data rows
  const records: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const record: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      let value: unknown = values[j]

      // Try to parse JSON fields
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value)
        } catch {
          // Keep as string if parse fails
        }
      }

      // Convert boolean strings
      if (value === 'true') value = true
      if (value === 'false') value = false

      // Convert number strings for specific fields
      if (header === 'sessionFrequency' || header === 'priority') {
        const num = Number(value)
        if (!isNaN(num)) value = num
      }

      record[header] = value === '' ? null : value
    }
    records.push(record)
  }

  return records
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++ // Skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  values.push(current)
  return values
}

/**
 * Validate a record for import
 */
function validateRecord(
  record: Record<string, unknown>,
  entityType: ExportEntityType,
  index: number
): string[] {
  const errors: string[] = []
  const required = REQUIRED_FIELDS[entityType]

  // Check required fields
  for (const field of required) {
    if (!record[field] && record[field] !== 0 && record[field] !== false) {
      errors.push(`Row ${index + 1}: Missing required field "${field}"`)
    }
  }

  // Validate enum values
  if (entityType === 'staff' || entityType === 'patients') {
    const gender = record['gender']
    if (gender && !VALID_GENDERS.includes(String(gender).toLowerCase())) {
      errors.push(`Row ${index + 1}: Invalid gender "${gender}". Must be one of: ${VALID_GENDERS.join(', ')}`)
    }

    const status = record['status']
    if (status && !VALID_STATUSES.includes(String(status).toLowerCase())) {
      errors.push(`Row ${index + 1}: Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`)
    }
  }

  if (entityType === 'rooms') {
    const status = record['status']
    if (status && !VALID_STATUSES.includes(String(status).toLowerCase())) {
      errors.push(`Row ${index + 1}: Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`)
    }
  }

  if (entityType === 'rules') {
    const category = record['category']
    if (category && !VALID_RULE_CATEGORIES.includes(String(category).toLowerCase())) {
      errors.push(`Row ${index + 1}: Invalid category "${category}". Must be one of: ${VALID_RULE_CATEGORIES.join(', ')}`)
    }
  }

  return errors
}

/**
 * Export data for an entity type
 */
export async function exportData(
  organizationId: string,
  entityType: ExportEntityType,
  format: ExportFormat
): Promise<ExportResult> {
  let records: Record<string, unknown>[]

  switch (entityType) {
    case 'staff': {
      const staff = await staffRepository.findByOrganization(organizationId)
      records = staff.map((s: Staff) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        gender: s.gender,
        certifications: s.certifications,
        hireDate: s.hireDate?.toISOString() || null,
        defaultHours: s.defaultHours,
        status: s.status
      }))
      break
    }
    case 'patients': {
      const patients = await patientRepository.findByOrganization(organizationId)
      records = patients.map((p: Patient) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
        gender: p.gender,
        sessionFrequency: p.sessionFrequency,
        preferredTimes: p.preferredTimes,
        requiredCertifications: p.requiredCertifications,
        preferredRoomId: p.preferredRoomId,
        requiredRoomCapabilities: p.requiredRoomCapabilities,
        notes: p.notes,
        status: p.status
      }))
      break
    }
    case 'rooms': {
      const rooms = await roomRepository.findByOrganization(organizationId)
      records = rooms.map((r: Room) => ({
        id: r.id,
        name: r.name,
        capabilities: r.capabilities,
        description: r.description,
        status: r.status
      }))
      break
    }
    case 'rules': {
      const rules = await ruleRepository.findActiveByOrganization(organizationId)
      records = rules.map((r: Rule) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        priority: r.priority,
        isActive: r.isActive,
        ruleLogic: r.ruleLogic
      }))
      break
    }
  }

  const date = new Date().toISOString().split('T')[0]
  const filename = `${entityType}-${date}.${format}`

  if (format === 'json') {
    const content = JSON.stringify(records, null, 2)
    return {
      data: Buffer.from(content, 'utf-8'),
      filename,
      contentType: 'application/json'
    }
  } else {
    const content = toCSV(records, CSV_HEADERS[entityType])
    return {
      data: Buffer.from(content, 'utf-8'),
      filename,
      contentType: 'text/csv'
    }
  }
}

/**
 * Parse an import file and return records
 */
export function parseImportFile(
  buffer: Buffer,
  entityType: ExportEntityType,
  format: ExportFormat
): Record<string, unknown>[] {
  const content = buffer.toString('utf-8')

  if (format === 'json') {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : [parsed]
  } else {
    return parseCSV(content, CSV_HEADERS[entityType])
  }
}

/**
 * Preview import - check for duplicates and validate
 */
export async function previewImport(
  organizationId: string,
  records: Record<string, unknown>[],
  entityType: ExportEntityType
): Promise<ImportPreview> {
  const errors: string[] = []
  const toCreate: Record<string, unknown>[] = []
  let toSkip = 0

  // Validate all records first
  for (let i = 0; i < records.length; i++) {
    const recordErrors = validateRecord(records[i], entityType, i)
    errors.push(...recordErrors)
  }

  // If validation errors, return early
  if (errors.length > 0) {
    return {
      total: records.length,
      toCreate: 0,
      toSkip: 0,
      errors,
      records: records.slice(0, 5)
    }
  }

  // Check for duplicates
  switch (entityType) {
    case 'staff': {
      const existing = await staffRepository.findByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((s: Staff) => `${s.name.toLowerCase()}|${(s.email || '').toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${String(record['name'] || '').toLowerCase()}|${String(record['email'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          toSkip++
        } else {
          toCreate.push(record)
        }
      }
      break
    }
    case 'patients': {
      const existing = await patientRepository.findByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((p: Patient) => `${p.name.toLowerCase()}|${(p.identifier || '').toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${String(record['name'] || '').toLowerCase()}|${String(record['identifier'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          toSkip++
        } else {
          toCreate.push(record)
        }
      }
      break
    }
    case 'rooms': {
      const existing = await roomRepository.findByOrganization(organizationId)
      const existingNames = new Set(existing.map((r: Room) => r.name.toLowerCase()))

      for (const record of records) {
        const name = String(record['name'] || '').toLowerCase()
        if (existingNames.has(name)) {
          toSkip++
        } else {
          toCreate.push(record)
        }
      }
      break
    }
    case 'rules': {
      const existing = await ruleRepository.findActiveByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((r: Rule) => `${r.category}|${r.description.toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${record['category']}|${String(record['description'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          toSkip++
        } else {
          toCreate.push(record)
        }
      }
      break
    }
  }

  return {
    total: records.length,
    toCreate: toCreate.length,
    toSkip,
    errors,
    records: toCreate.slice(0, 5)
  }
}

/**
 * Execute import - create new records
 */
export async function executeImport(
  organizationId: string,
  records: Record<string, unknown>[],
  entityType: ExportEntityType,
  userId: string
): Promise<ImportResult> {
  const errors: string[] = []
  let created = 0
  let skipped = 0

  // Re-check for duplicates and create records
  switch (entityType) {
    case 'staff': {
      const existing = await staffRepository.findByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((s: Staff) => `${s.name.toLowerCase()}|${(s.email || '').toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${String(record['name'] || '').toLowerCase()}|${String(record['email'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          skipped++
          continue
        }

        try {
          const createData: StaffCreate = {
            organizationId,
            name: String(record['name']),
            gender: String(record['gender']).toLowerCase() as Gender,
            email: record['email'] ? String(record['email']) : null,
            phone: record['phone'] ? String(record['phone']) : null,
            certifications: Array.isArray(record['certifications']) ? record['certifications'] : [],
            defaultHours: record['defaultHours'] as DefaultHours | undefined,
            hireDate: record['hireDate'] ? new Date(String(record['hireDate'])) : null
          }
          await staffRepository.create(createData)
          created++
          existingKeys.add(key) // Prevent duplicates within the same import
        } catch (e) {
          errors.push(`Failed to create staff "${record['name']}": ${e instanceof Error ? e.message : 'Unknown error'}`)
        }
      }
      break
    }
    case 'patients': {
      const existing = await patientRepository.findByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((p: Patient) => `${p.name.toLowerCase()}|${(p.identifier || '').toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${String(record['name'] || '').toLowerCase()}|${String(record['identifier'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          skipped++
          continue
        }

        try {
          const createData: PatientCreate = {
            organizationId,
            name: String(record['name']),
            gender: String(record['gender']).toLowerCase() as Gender,
            identifier: record['identifier'] ? String(record['identifier']) : null,
            sessionFrequency: typeof record['sessionFrequency'] === 'number' ? record['sessionFrequency'] : 2,
            preferredTimes: Array.isArray(record['preferredTimes']) ? record['preferredTimes'] : null,
            requiredCertifications: Array.isArray(record['requiredCertifications']) ? record['requiredCertifications'] : [],
            preferredRoomId: record['preferredRoomId'] ? String(record['preferredRoomId']) : null,
            requiredRoomCapabilities: Array.isArray(record['requiredRoomCapabilities']) ? record['requiredRoomCapabilities'] : [],
            notes: record['notes'] ? String(record['notes']) : null
          }
          await patientRepository.create(createData)
          created++
          existingKeys.add(key)
        } catch (e) {
          errors.push(`Failed to create patient "${record['name']}": ${e instanceof Error ? e.message : 'Unknown error'}`)
        }
      }
      break
    }
    case 'rooms': {
      const existing = await roomRepository.findByOrganization(organizationId)
      const existingNames = new Set(existing.map((r: Room) => r.name.toLowerCase()))

      for (const record of records) {
        const name = String(record['name'] || '').toLowerCase()
        if (existingNames.has(name)) {
          skipped++
          continue
        }

        try {
          const createData: RoomCreate = {
            organizationId,
            name: String(record['name']),
            capabilities: Array.isArray(record['capabilities']) ? record['capabilities'] : [],
            description: record['description'] ? String(record['description']) : null
          }
          await roomRepository.create(createData)
          created++
          existingNames.add(name)
        } catch (e) {
          errors.push(`Failed to create room "${record['name']}": ${e instanceof Error ? e.message : 'Unknown error'}`)
        }
      }
      break
    }
    case 'rules': {
      const existing = await ruleRepository.findActiveByOrganization(organizationId)
      const existingKeys = new Set(
        existing.map((r: Rule) => `${r.category}|${r.description.toLowerCase()}`)
      )

      for (const record of records) {
        const key = `${record['category']}|${String(record['description'] || '').toLowerCase()}`
        if (existingKeys.has(key)) {
          skipped++
          continue
        }

        try {
          const createData: RuleCreate = {
            organizationId,
            category: String(record['category']) as RuleCategory,
            description: String(record['description']),
            ruleLogic: (record['ruleLogic'] as Record<string, unknown>) || {},
            priority: typeof record['priority'] === 'number' ? record['priority'] : 0,
            createdById: userId
          }
          await ruleRepository.create(createData)
          created++
          existingKeys.add(key)
        } catch (e) {
          errors.push(`Failed to create rule "${record['description']}": ${e instanceof Error ? e.message : 'Unknown error'}`)
        }
      }
      break
    }
  }

  return { created, skipped, errors }
}
