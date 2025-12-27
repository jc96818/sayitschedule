// Organization
export interface Organization {
  id: string
  name: string
  subdomain: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

// User roles
export type UserRole = 'super_admin' | 'admin' | 'admin_assistant' | 'staff'

// User
export interface User {
  id: string
  organizationId: string | null
  email: string
  name: string
  role: UserRole
  createdAt: string
  lastLogin: string | null
}

// Staff
export interface Staff {
  id: string
  organizationId: string
  userId: string | null
  name: string
  gender: 'male' | 'female' | 'other'
  email: string | null
  phone: string | null
  certifications: string[]
  defaultHours: DefaultHours
  status: 'active' | 'inactive'
  hireDate: string | null
  createdAt: string
  // Optional UI fields (not always present from API)
  maxSessionsPerDay?: number
}

export interface DefaultHours {
  monday: TimeRange | null
  tuesday: TimeRange | null
  wednesday: TimeRange | null
  thursday: TimeRange | null
  friday: TimeRange | null
}

export interface TimeRange {
  start: string // HH:mm format
  end: string
}

// Patient
export interface Patient {
  id: string
  organizationId: string
  name: string
  identifier: string | null
  gender: 'male' | 'female' | 'other'
  sessionFrequency: number // sessions per week
  preferredTimes: string[] | null
  requiredCertifications: string[]
  preferredRoomId: string | null
  requiredRoomCapabilities: string[]
  notes: string | null
  status: 'active' | 'inactive'
  createdAt: string
  // Optional UI fields (used in forms, not always present from API)
  dateOfBirth?: string
  sessionsPerWeek?: number // alias for sessionFrequency
  sessionDuration?: number // in minutes
  genderPreference?: 'male' | 'female' | null
  guardianName?: string
  guardianPhone?: string
  guardianEmail?: string
}

// Rule
export type RuleCategory =
  | 'gender_pairing'
  | 'session'
  | 'availability'
  | 'specific_pairing'
  | 'certification'
  | 'scheduling'
  | 'custom'

export interface Rule {
  id: string
  organizationId: string
  category: RuleCategory
  description: string
  ruleLogic: Record<string, unknown>
  priority: number
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Schedule
export type ScheduleStatus = 'draft' | 'published'

export interface Schedule {
  id: string
  organizationId: string
  weekStartDate: string
  status: ScheduleStatus
  createdBy: string
  createdAt: string
  publishedAt: string | null
  version: number
  // Optional joined data (populated when fetching with sessions)
  sessions?: Session[]
}

// Session
export interface Session {
  id: string
  scheduleId: string
  therapistId: string
  patientId: string
  roomId: string | null
  date: string
  startTime: string
  endTime: string
  notes: string | null
  createdAt: string
  // Joined fields from API
  therapistName?: string
  patientName?: string
  roomName?: string
  roomCapabilities?: string[]
  // Legacy field names (for backwards compatibility)
  staffId?: string
}

// Room
export interface Room {
  id: string
  organizationId: string
  name: string
  capabilities: string[]
  description: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

// Staff Availability
export interface StaffAvailability {
  id: string
  staffId: string
  date: string
  available: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
}

// Audit Log
export interface AuditLog {
  id: string
  organizationId: string | null
  userId: string
  action: string
  entityType: string
  entityId: string
  changes: Record<string, unknown>
  timestamp: string
}

// API Response types
export interface ApiResponse<T, M = unknown> {
  data: T
  message?: string
  meta?: M
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Auth
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
  organization: Organization | null
}
