import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  organizationId: string | null
  iat?: number
  exp?: number
}

export type UserRole = 'super_admin' | 'admin' | 'admin_assistant' | 'staff'

export interface RequestContext {
  user: JWTPayload | null
  organizationId: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext
  }
}

// Database entity types
export interface Organization {
  id: string
  name: string
  subdomain: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  organizationId: string | null
  email: string
  passwordHash: string
  name: string
  role: UserRole
  createdAt: Date
  lastLogin: Date | null
}

export interface Staff {
  id: string
  organizationId: string
  userId: string | null
  name: string
  gender: 'male' | 'female' | 'other'
  email: string | null
  phone: string | null
  certifications: string[]
  defaultHours: Record<string, { start: string; end: string } | null>
  status: 'active' | 'inactive'
  hireDate: Date | null
  createdAt: Date
}

export interface Patient {
  id: string
  organizationId: string
  name: string
  identifier: string | null
  gender: 'male' | 'female' | 'other'
  sessionFrequency: number
  preferredTimes: string[] | null
  requiredCertifications: string[]
  notes: string | null
  status: 'active' | 'inactive'
  createdAt: Date
}

export type RuleCategory =
  | 'gender_pairing'
  | 'session'
  | 'availability'
  | 'specific_pairing'
  | 'certification'

export interface Rule {
  id: string
  organizationId: string
  category: RuleCategory
  description: string
  ruleLogic: Record<string, unknown>
  priority: number
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type ScheduleStatus = 'draft' | 'published'

export interface Schedule {
  id: string
  organizationId: string
  weekStartDate: Date
  status: ScheduleStatus
  createdBy: string
  createdAt: Date
  publishedAt: Date | null
  version: number
}

export interface Session {
  id: string
  scheduleId: string
  therapistId: string
  patientId: string
  date: Date
  startTime: string
  endTime: string
  notes: string | null
  createdAt: Date
}

export interface StaffAvailability {
  id: string
  staffId: string
  date: Date
  available: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
}

export interface AuditLog {
  id: string
  organizationId: string | null
  userId: string
  action: string
  entityType: string
  entityId: string
  changes: Record<string, unknown>
  timestamp: Date
}

// API types
export type AuthenticatedRequest = FastifyRequest & {
  ctx: RequestContext & { user: JWTPayload }
}

export type RouteHandler<T = unknown> = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<T>
