// Organization
export interface Organization {
  id: string
  name: string
  subdomain: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  status: 'active' | 'inactive'
  requiresHipaa: boolean
  createdAt: string
  updatedAt: string
  // Label customization
  businessTypeTemplateId?: string | null
  staffLabel: string
  staffLabelSingular: string
  patientLabel: string
  patientLabelSingular: string
  roomLabel: string
  roomLabelSingular: string
  certificationLabel: string
  equipmentLabel: string
  suggestedCertifications: string[]
  suggestedRoomEquipment: string[]
}

// Business Type Template
export interface BusinessTypeTemplate {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  staffLabel: string
  staffLabelSingular: string
  patientLabel: string
  patientLabelSingular: string
  roomLabel: string
  roomLabelSingular: string
  certificationLabel: string
  equipmentLabel: string
  suggestedCertifications: string[]
  suggestedRoomEquipment: string[]
  createdAt: string
  updatedAt: string
  organizationCount?: number
}

// Organization Labels (subset for updating)
export interface OrganizationLabels {
  staffLabel?: string
  staffLabelSingular?: string
  patientLabel?: string
  patientLabelSingular?: string
  roomLabel?: string
  roomLabelSingular?: string
  certificationLabel?: string
  equipmentLabel?: string
  suggestedCertifications?: string[]
  suggestedRoomEquipment?: string[]
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
  mfaEnabled?: boolean
  passwordChangedAt?: string | null
  status: 'pending' | 'active'
  invitationExpiresAt?: string | null
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

// Parsed rule item from voice input (for multi-rule parsing)
export type PendingRuleStatus = 'pending' | 'confirmed' | 'rejected' | 'editing'

export interface ParsedRuleItem {
  id: string // Client-generated for tracking
  category: RuleCategory
  description: string
  priority: number
  ruleLogic: Record<string, unknown>
  confidence: number
  warnings: string[]
  status: PendingRuleStatus
}

export interface ParsedMultiRuleResponse {
  commandType: 'create_rules'
  rules: Array<{
    category: RuleCategory
    description: string
    priority?: number
    ruleLogic?: Record<string, unknown>
    confidence: number
    warnings: string[]
  }>
  overallConfidence: number
  originalTranscript: string
  globalWarnings: string[]
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

// Session Status
export type SessionStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'late_cancel'
  | 'no_show'

// Cancellation Reason
export type CancellationReason =
  | 'patient_request'
  | 'caregiver_request'
  | 'therapist_unavailable'
  | 'weather'
  | 'illness'
  | 'scheduling_conflict'
  | 'other'

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
  // Session status tracking
  status?: SessionStatus
  actualStartTime?: string | null
  actualEndTime?: string | null
  statusUpdatedAt?: string | null
  statusUpdatedById?: string | null
  // Cancellation details
  cancellationReason?: CancellationReason | null
  cancellationNotes?: string | null
  cancelledAt?: string | null
  cancelledById?: string | null
  // Confirmation tracking
  confirmedAt?: string | null
  confirmedById?: string | null
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

// Staff Availability Status
export type AvailabilityStatus = 'pending' | 'approved' | 'rejected'

// Staff Availability (includes time-off requests)
export interface StaffAvailability {
  id: string
  staffId: string
  date: string
  available: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
  // Request workflow fields
  status: AvailabilityStatus
  requestedAt: string | null
  requestedById: string | null
  reviewedAt: string | null
  reviewedById: string | null
  reviewerNotes: string | null
  createdAt: string
  updatedAt: string
  // Joined fields (when fetching with staff)
  staffName?: string
  staffEmail?: string | null
}

// Staff availability with required staff info (for admin panel)
export interface StaffAvailabilityWithStaff extends StaffAvailability {
  staffName: string
  staffEmail: string | null
}

// Organization Settings
export interface BusinessHoursDay {
  open: boolean
  start: string
  end: string
}

export interface BusinessHours {
  monday: BusinessHoursDay
  tuesday: BusinessHoursDay
  wednesday: BusinessHoursDay
  thursday: BusinessHoursDay
  friday: BusinessHoursDay
  saturday: BusinessHoursDay
  sunday: BusinessHoursDay
}

export interface OrganizationSettings {
  id: string
  organizationId: string
  businessHours: BusinessHours
  timezone: string
  defaultSessionDuration: number
  slotInterval: number
  lateCancelWindowHours: number
  createdAt: string
  updatedAt: string
}

// Organization Features
export interface OrganizationFeatures {
  id: string
  organizationId: string
  emailRemindersEnabled: boolean
  smsRemindersEnabled: boolean
  reminderHours: number[]
  patientPortalEnabled: boolean
  portalAllowCancel: boolean
  portalAllowReschedule: boolean
  portalRequireConfirmation: boolean
  selfBookingEnabled: boolean
  selfBookingLeadTimeHours: number
  selfBookingMaxFutureDays: number
  selfBookingRequiresApproval: boolean
  portalWelcomeTitle: string
  portalWelcomeMessage: string
  portalPrimaryColor: string | null
  portalSecondaryColor: string | null
  portalLogoUrl: string | null
  portalBackgroundUrl: string | null
  portalShowOrgName: boolean
  portalContactEmail: string | null
  portalContactPhone: string | null
  portalFooterText: string | null
  portalTermsUrl: string | null
  portalPrivacyUrl: string | null
  advancedReportsEnabled: boolean
  reportExportEnabled: boolean
  voiceCommandsEnabled: boolean
  medicalTranscribeEnabled: boolean
  apiAccessEnabled: boolean
  webhooksEnabled: boolean
  maxStaff: number | null
  maxPatients: number | null
  maxRemindersPerMonth: number | null
  createdAt: string
  updatedAt: string
}

export interface FeatureStatuses {
  emailReminders: boolean
  smsReminders: boolean
  patientPortal: boolean
  advancedReports: boolean
  reportExport: boolean
  voiceCommands: boolean
  medicalTranscribe: boolean
  apiAccess: boolean
  webhooks: boolean
}

// Session Status Counts
export interface SessionStatusCounts {
  scheduled: number
  confirmed: number
  checked_in: number
  in_progress: number
  completed: number
  cancelled: number
  late_cancel: number
  no_show: number
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
  token?: string
  user?: User
  organization?: Organization | null
  // MFA fields (when MFA is required)
  requiresMfa?: boolean
  mfaToken?: string
}

// MFA types
export interface MfaSetupResponse {
  qrCode: string
  secret: string
  otpauthUrl: string
}

export interface MfaVerifyResponse {
  success: boolean
  backupCodes: string[]
}

export interface MfaStatusResponse {
  enabled: boolean
  backupCodesRemaining: number
}

// Rule Analysis
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

export interface RuleAnalysisSummary {
  totalRulesAnalyzed: number
  conflictsFound: number
  duplicatesFound: number
  enhancementsSuggested: number
}

export interface RuleAnalysisResult {
  conflicts: RuleConflict[]
  duplicates: RuleDuplicate[]
  enhancements: RuleEnhancement[]
  summary: RuleAnalysisSummary
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Portal branding/customization from organization settings
export interface PortalBranding {
  // Organization info
  organizationName: string
  organizationSubdomain: string

  // Branding
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  backgroundUrl: string | null
  showOrgName: boolean

  // Welcome text
  welcomeTitle: string
  welcomeMessage: string

  // Contact info
  contactEmail: string | null
  contactPhone: string | null

  // Footer
  footerText: string | null
  termsUrl: string | null
  privacyUrl: string | null

  // Labels
  patientLabel: string
  patientLabelSingular: string

  // Feature flags
  selfBookingEnabled: boolean
  portalAllowCancel: boolean
  portalAllowReschedule: boolean
  portalRequireConfirmation: boolean
}

// Portal user (authenticated contact)
export interface PortalUser {
  contactId: string
  patientId: string
  organizationId: string
  name: string
  email: string | null
  phone: string | null
}

// Portal session (appointment)
export interface PortalSession {
  id: string
  date: string
  startTime: string
  endTime: string
  therapistName: string
  roomName: string | null
  status: SessionStatus | 'pending'
  notes: string | null
  confirmedAt: string | null
  canCancel: boolean
  canConfirm: boolean
}

// Portal auth request result
export interface PortalAuthRequestResult {
  success: boolean
  message: string
  channel?: 'email' | 'sms'
  expiresAt?: string
}

// Portal auth verify result
export interface PortalVerifyResult {
  message: string
  sessionToken: string
  user: PortalUser
  expiresAt: string
}

// Portal booking availability slot
export interface PortalAvailabilitySlot {
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
  roomId: string | null
  roomName: string | null
}

// Portal booking hold
export interface PortalBookingHold {
  id: string
  staffId: string
  staffName: string
  roomId: string | null
  roomName: string | null
  date: string
  startTime: string
  endTime: string
  expiresAt: string
}

// Portal booking settings
export interface PortalBookingSettings {
  selfBookingEnabled: boolean
  leadTimeHours: number
  maxFutureDays: number
  requiresApproval: boolean
  earliestBookingDate: string
  latestBookingDate: string
}
