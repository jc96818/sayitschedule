import axios from 'axios'
import type {
  LoginRequest,
  LoginResponse,
  User,
  Organization,
  OrganizationLabels,
  BusinessTypeTemplate,
  Staff,
  Patient,
  Rule,
  Room,
  Schedule,
  Session,
  SessionStatus,
  CancellationReason,
  SessionStatusCounts,
  OrganizationSettings,
  OrganizationFeatures,
  FeatureStatuses,
  BusinessHours,
  StaffAvailability,
  AvailabilityStatus,
  ApiResponse,
  PaginatedResponse,
  MfaSetupResponse,
  MfaVerifyResponse,
  MfaStatusResponse,
  ParsedMultiRuleResponse,
  RuleAnalysisResult,
  HelpCategory,
  HelpArticle,
  HelpSearchResult
} from '@/types'

// Transcription settings types
export type TranscriptionProviderType = 'aws_medical' | 'aws_standard'
export type MedicalSpecialty = 'PRIMARYCARE' | 'CARDIOLOGY' | 'NEUROLOGY' | 'ONCOLOGY' | 'RADIOLOGY' | 'UROLOGY'

export interface TranscriptionSettings {
  transcriptionProvider: TranscriptionProviderType
  medicalSpecialty: MedicalSpecialty
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect for MFA verification failures or login attempts
      // These should be handled by the component to show proper error messages
      const url = error.config?.url || ''
      const isMfaOrLoginEndpoint = url.includes('/auth/verify-mfa') || url.includes('/auth/login')

      if (!isMfaOrLoginEndpoint) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Token verification response type
export interface VerifyTokenResponse {
  valid: boolean
  type: 'invitation' | 'password_reset'
  user: {
    email: string
    name: string
  }
  organization: {
    name: string
    subdomain: string
  } | null
}

// Setup password response type
export interface SetupPasswordResponse {
  success: boolean
  message: string
  token?: string  // Not present if requiresMfaSetup is true
  requiresMfaSetup?: boolean  // True for HIPAA orgs requiring MFA
  mfaSetupToken?: string  // Token for first-time MFA setup flow
  user: User
  organization: Organization | null
}

// First-time MFA setup response types (for HIPAA compliance)
export interface FirstTimeMfaSetupResponse {
  qrCode: string
  secret: string
  otpauthUrl: string
}

export interface FirstTimeMfaVerifyResponse {
  success: boolean
  backupCodes: string[]
  message: string
  token: string
  user: User
  organization: Organization | null
}

// Auth Service
export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', credentials)
    return data
  },

  async me(): Promise<{ user: User; organization: Organization | null }> {
    const { data } = await api.get('/auth/me')
    return data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const { data } = await api.post<VerifyTokenResponse>('/auth/verify-token', { token })
    return data
  },

  async setupPassword(token: string, password: string): Promise<SetupPasswordResponse> {
    const { data } = await api.post<SetupPasswordResponse>('/auth/setup-password', { token, password })
    return data
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>('/auth/request-password-reset', { email })
    return data
  },

  // First-time MFA setup for HIPAA compliance
  async firstTimeMfaSetup(mfaSetupToken: string): Promise<FirstTimeMfaSetupResponse> {
    const { data } = await api.post<FirstTimeMfaSetupResponse>('/auth/mfa/first-time-setup', { mfaSetupToken })
    return data
  },

  async firstTimeMfaVerify(mfaSetupToken: string, code: string): Promise<FirstTimeMfaVerifyResponse> {
    const { data } = await api.post<FirstTimeMfaVerifyResponse>('/auth/mfa/first-time-verify', { mfaSetupToken, code })
    return data
  }
}

// Organization Service
export const organizationService = {
  async list(): Promise<PaginatedResponse<Organization>> {
    const { data } = await api.get('/organizations')
    return data
  },

  async get(id: string): Promise<ApiResponse<Organization>> {
    const { data } = await api.get(`/organizations/${id}`)
    return data
  },

  async create(org: Partial<Organization>): Promise<ApiResponse<Organization>> {
    const { data } = await api.post('/organizations', org)
    return data
  },

  async update(id: string, org: Partial<Organization>): Promise<ApiResponse<Organization>> {
    const { data } = await api.put(`/organizations/${id}`, org)
    return data
  },

  async switchContext(id: string): Promise<{ token: string; organization: Organization }> {
    const { data } = await api.post(`/organizations/${id}/switch`)
    return data
  },

  async updateBranding(branding: {
    name?: string
    primaryColor?: string
    secondaryColor?: string
    logoUrl?: string | null
    organizationId?: string
  }): Promise<ApiResponse<Organization>> {
    const { data } = await api.put('/organizations/current/branding', branding)
    return data
  },

  async getTranscriptionSettings(): Promise<ApiResponse<TranscriptionSettings>> {
    const { data } = await api.get('/organizations/current/transcription')
    return data
  },

  async updateTranscriptionSettings(settings: {
    transcriptionProvider?: 'aws_medical' | 'aws_standard'
    medicalSpecialty?: MedicalSpecialty
    organizationId?: string
  }): Promise<ApiResponse<TranscriptionSettings>> {
    const { data } = await api.put('/organizations/current/transcription', settings)
    return data
  },

  async getLabels(): Promise<ApiResponse<OrganizationLabels>> {
    const { data } = await api.get('/organizations/current/labels')
    return data
  },

  async updateLabels(labels: OrganizationLabels & { organizationId?: string }): Promise<ApiResponse<Organization>> {
    const { data } = await api.put('/organizations/current/labels', labels)
    return data
  },

  async uploadLogo(file: File): Promise<ApiResponse<{
    logoUrl: string
    logoUrlSmall: string
    logoUrlMedium: string
    logoUrlLarge: string
    logoUrlGrayscale: string
    logoUrlGrayscaleSmall: string
    logoUrlGrayscaleMedium: string
  }>> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/organizations/current/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  async deleteLogo(): Promise<ApiResponse<Organization>> {
    const { data } = await api.delete('/organizations/current/logo')
    return data
  }
}

// Template Service (for super admins)
export const templateService = {
  async list(params?: { search?: string; isActive?: boolean }): Promise<PaginatedResponse<BusinessTypeTemplate>> {
    const { data } = await api.get('/templates', { params })
    return data
  },

  async listActive(): Promise<ApiResponse<BusinessTypeTemplate[]>> {
    const { data } = await api.get('/templates/active')
    return data
  },

  async get(id: string): Promise<ApiResponse<BusinessTypeTemplate>> {
    const { data } = await api.get(`/templates/${id}`)
    return data
  },

  async create(template: Partial<BusinessTypeTemplate>): Promise<ApiResponse<BusinessTypeTemplate>> {
    const { data } = await api.post('/templates', template)
    return data
  },

  async update(id: string, template: Partial<BusinessTypeTemplate>): Promise<ApiResponse<BusinessTypeTemplate>> {
    const { data } = await api.put(`/templates/${id}`, template)
    return data
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const { data } = await api.delete(`/templates/${id}`)
    return data
  }
}

// Staff Service
export const staffService = {
  async list(params?: { search?: string; status?: string }): Promise<PaginatedResponse<Staff>> {
    const { data } = await api.get('/staff', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Staff>> {
    const { data } = await api.get(`/staff/${id}`)
    return data
  },

  // Get current user's linked staff profile
  async getMyProfile(): Promise<ApiResponse<Staff>> {
    const { data } = await api.get('/staff/me')
    return data
  },

  async create(staff: Partial<Staff>): Promise<ApiResponse<Staff>> {
    const { data } = await api.post('/staff', staff)
    return data
  },

  async update(id: string, staff: Partial<Staff>): Promise<ApiResponse<Staff>> {
    const { data } = await api.put(`/staff/${id}`, staff)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/staff/${id}`)
  }
}

// Staff Availability Service
export const availabilityService = {
  // Get availability for a specific staff member
  async listByStaff(
    staffId: string,
    params?: { startDate?: string; endDate?: string; status?: AvailabilityStatus }
  ): Promise<ApiResponse<StaffAvailability[]>> {
    const { data } = await api.get(`/staff/${staffId}/availability`, { params })
    return data
  },

  // Create a new availability record / time-off request
  async create(
    staffId: string,
    availability: {
      date: string
      available: boolean
      startTime?: string
      endTime?: string
      reason?: string
    }
  ): Promise<ApiResponse<StaffAvailability>> {
    const { data } = await api.post(`/staff/${staffId}/availability`, availability)
    return data
  },

  // Update an availability record
  async update(
    staffId: string,
    id: string,
    availability: Partial<{
      date: string
      available: boolean
      startTime: string | null
      endTime: string | null
      reason: string | null
    }>
  ): Promise<ApiResponse<StaffAvailability>> {
    const { data } = await api.put(`/staff/${staffId}/availability/${id}`, availability)
    return data
  },

  // Delete an availability record
  async delete(staffId: string, id: string): Promise<void> {
    await api.delete(`/staff/${staffId}/availability/${id}`)
  },

  // Approve a pending request (admin only)
  async approve(
    staffId: string,
    id: string,
    notes?: string
  ): Promise<ApiResponse<StaffAvailability>> {
    const { data } = await api.post(`/staff/${staffId}/availability/${id}/approve`, { notes })
    return data
  },

  // Reject a pending request (admin only)
  async reject(
    staffId: string,
    id: string,
    notes?: string
  ): Promise<ApiResponse<StaffAvailability>> {
    const { data } = await api.post(`/staff/${staffId}/availability/${id}/reject`, { notes })
    return data
  },

  // Get all pending requests for the organization (admin only)
  async listPending(params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<StaffAvailability>> {
    const { data } = await api.get('/availability/pending', { params })
    return data
  },

  // Get count of pending requests
  async countPending(): Promise<ApiResponse<{ pendingCount: number }>> {
    const { data } = await api.get('/availability/count')
    return data
  },

  // Get all availability for the organization (admin only)
  async listAll(params?: {
    startDate?: string
    endDate?: string
    status?: AvailabilityStatus
  }): Promise<ApiResponse<StaffAvailability[]>> {
    const { data } = await api.get('/availability', { params })
    return data
  }
}

// Patient Service
export const patientService = {
  async list(params?: { search?: string; status?: string }): Promise<PaginatedResponse<Patient>> {
    const { data } = await api.get('/patients', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Patient>> {
    const { data } = await api.get(`/patients/${id}`)
    return data
  },

  async create(patient: Partial<Patient>): Promise<ApiResponse<Patient>> {
    // Map frontend field names to API field names
    const payload = {
      ...patient,
      sessionFrequency: patient.sessionsPerWeek ?? patient.sessionFrequency ?? 1
    }
    const { data } = await api.post('/patients', payload)
    return data
  },

  async update(id: string, patient: Partial<Patient>): Promise<ApiResponse<Patient>> {
    // Map frontend field names to API field names
    const payload = {
      ...patient,
      sessionFrequency: patient.sessionsPerWeek ?? patient.sessionFrequency
    }
    const { data } = await api.put(`/patients/${id}`, payload)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/patients/${id}`)
  }
}

// Rules Service
export const rulesService = {
  async list(): Promise<PaginatedResponse<Rule>> {
    // Fetch all rules (use high limit since rules are managed on a single page)
    const { data } = await api.get('/rules', { params: { limit: 1000 } })
    return data
  },

  async create(rule: Partial<Rule>): Promise<ApiResponse<Rule>> {
    const { data } = await api.post('/rules', rule)
    return data
  },

  async update(id: string, rule: Partial<Rule>): Promise<ApiResponse<Rule>> {
    const { data } = await api.put(`/rules/${id}`, rule)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/rules/${id}`)
  },

  async parseVoice(transcript: string): Promise<ApiResponse<{ rule: Partial<Rule>; confidence: number }>> {
    const { data } = await api.post('/rules/parse-voice', { transcript })
    return data
  },

  async analyze(): Promise<ApiResponse<RuleAnalysisResult>> {
    const { data } = await api.post('/rules/analyze')
    return data
  }
}

// Room Service
export const roomService = {
  async list(params?: { search?: string; status?: string }): Promise<PaginatedResponse<Room>> {
    const { data } = await api.get('/rooms', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Room>> {
    const { data } = await api.get(`/rooms/${id}`)
    return data
  },

  async create(room: Partial<Room>): Promise<ApiResponse<Room>> {
    const { data } = await api.post('/rooms', room)
    return data
  },

  async update(id: string, room: Partial<Room>): Promise<ApiResponse<Room>> {
    const { data } = await api.put(`/rooms/${id}`, room)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/rooms/${id}`)
  }
}

// Schedule Modification Types (used by scheduleService)
export interface ScheduleModification {
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

export interface VoiceModifyResult {
  action: string
  session: Session
  message: string
  from?: { date: string; startTime: string }
  to?: { date: string; startTime: string }
}

// Schedule copy modification types
export interface SessionModification {
  original: {
    therapistName?: string
    patientName?: string
    date: string
    startTime: string
  }
  replacement?: {
    therapistName?: string
    patientName?: string
    date: string
    startTime: string
  }
  reason: string
}

export interface CopyModifications {
  regenerated: SessionModification[]
  removed: SessionModification[]
  warnings: string[]
}

// Schedule Service
export const scheduleService = {
  async list(params?: { status?: string }): Promise<PaginatedResponse<Schedule>> {
    const { data } = await api.get('/schedules', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Schedule & { sessions: Session[] }>> {
    const { data } = await api.get(`/schedules/${id}`)
    return data
  },

  async generate(weekStartDate: string): Promise<ApiResponse<Schedule & { sessions: Session[] }, { stats: { totalSessions: number; patientsScheduled: number; therapistsUsed: number }; warnings: string[] }>> {
    const { data } = await api.post('/schedules/generate', { weekStartDate })
    return data
  },

  async publish(id: string): Promise<ApiResponse<Schedule>> {
    const { data } = await api.post(`/schedules/${id}/publish`)
    return data
  },

  async updateSession(scheduleId: string, sessionId: string, session: Partial<Session>): Promise<ApiResponse<Session>> {
    const { data } = await api.put(`/schedules/${scheduleId}/sessions/${sessionId}`, session)
    return data
  },

  async exportPdf(id: string): Promise<Blob> {
    const { data } = await api.get(`/schedules/${id}/export/pdf`, { responseType: 'blob' })
    return data
  },

  async modifyByVoice(scheduleId: string, modification: ScheduleModification): Promise<ApiResponse<VoiceModifyResult>> {
    const { data } = await api.post(`/schedules/${scheduleId}/modify-voice`, modification)
    return data
  },

  async deleteSession(scheduleId: string, sessionId: string): Promise<void> {
    await api.delete(`/schedules/${scheduleId}/sessions/${sessionId}`)
  },

  async createDraftCopy(id: string): Promise<ApiResponse<Schedule & { sessions: Session[] }, { message: string; sourceScheduleId: string; modifications?: CopyModifications }>> {
    const { data } = await api.post(`/schedules/${id}/create-draft`)
    return data
  },

  async createSession(scheduleId: string, session: {
    staffId: string
    patientId: string
    roomId?: string
    date: string
    startTime: string
    endTime: string
    notes?: string
  }): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/schedules/${scheduleId}/sessions`, session)
    return data
  }
}

// Voice Service Types
export type VoiceContext = 'patient' | 'staff' | 'rule' | 'room' | 'schedule' | 'schedule_modify' | 'general'

export interface ParsedVoiceCommand {
  commandType: 'create_patient' | 'create_staff' | 'create_rule' | 'create_room' | 'schedule_session' | 'modify_session' | 'cancel_session' | 'generate_schedule' | 'unknown'
  confidence: number
  data: Record<string, unknown>
  warnings: string[]
  originalTranscript: string
}

// Voice Service
export const voiceService = {
  async parseCommand(transcript: string, context: VoiceContext = 'general'): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse', { transcript, context })
    return data
  },

  async parsePatient(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/patient', { transcript })
    return data
  },

  async parseStaff(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/staff', { transcript })
    return data
  },

  async parseRule(transcript: string): Promise<ApiResponse<ParsedMultiRuleResponse>> {
    const { data } = await api.post('/voice/parse/rule', { transcript })
    return data
  },

  async parseRoom(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/room', { transcript })
    return data
  },

  async parseSchedule(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/schedule', { transcript })
    return data
  },

  async parseScheduleGenerate(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/schedule-generate', { transcript })
    return data
  }
}

// Super Admin Users Service
export const superAdminUsersService = {
  async list(params?: { search?: string }): Promise<PaginatedResponse<User>> {
    const { data } = await api.get('/super-admin/users', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<User>> {
    const { data } = await api.get(`/super-admin/users/${id}`)
    return data
  },

  async create(user: { email: string; name: string }): Promise<ApiResponse<User>> {
    const { data } = await api.post('/super-admin/users', user)
    return data
  },

  async update(id: string, user: { email?: string; name?: string }): Promise<ApiResponse<User>> {
    const { data } = await api.put(`/super-admin/users/${id}`, user)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/super-admin/users/${id}`)
  },

  async resendInvite(id: string): Promise<{ message: string }> {
    const { data } = await api.post(`/super-admin/users/${id}/resend-invite`)
    return data
  }
}

// Account Service (for current user's account settings)
export const accountService = {
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const { data } = await api.post('/account/change-password', { currentPassword, newPassword })
    return data
  },

  async getMfaStatus(): Promise<MfaStatusResponse> {
    const { data } = await api.get('/account/mfa/status')
    return data
  },

  async setupMfa(password: string): Promise<MfaSetupResponse> {
    const { data } = await api.post('/account/mfa/setup', { password })
    return data
  },

  async verifyMfa(code: string): Promise<MfaVerifyResponse> {
    const { data } = await api.post('/account/mfa/verify', { code })
    return data
  },

  async disableMfa(password: string): Promise<{ success: boolean }> {
    const { data } = await api.post('/account/mfa/disable', { password })
    return data
  },

  async regenerateBackupCodes(password: string): Promise<{ backupCodes: string[] }> {
    const { data } = await api.post('/account/mfa/backup-codes', { password })
    return data
  }
}

// Auth Service MFA verification (for login flow)
export const mfaAuthService = {
  async verifyMfa(mfaToken: string, code: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/verify-mfa', { mfaToken, code })
    return data
  }
}

// BAA (Business Associate Agreement) Types
export type BaaStatus = 'not_started' | 'awaiting_org_signature' | 'awaiting_vendor_signature' | 'executed' | 'voided' | 'superseded'

export interface BaaStatusInfo {
  label: string
  description: string
  color: string
}

export interface BaaAgreement {
  id: string
  organizationId: string
  status: BaaStatus
  templateName: string
  templateVersion: string
  templateSha256: string
  executedPdfSha256?: string
  executedPdfPath?: string
  orgSignedAt?: string
  orgSignerUserId?: string
  orgSignerName?: string
  orgSignerTitle?: string
  orgSignerEmail?: string
  orgSignerIp?: string
  orgSignerUserAgent?: string
  vendorSignedAt?: string
  vendorSignerUserId?: string
  vendorSignerName?: string
  vendorSignerTitle?: string
  createdAt: string
  updatedAt: string
}

export interface BaaAgreementWithOrg extends BaaAgreement {
  organization: {
    id: string
    name: string
    subdomain: string
    status: string
  }
}

export interface BaaStatusResponse {
  hasAgreement: boolean
  agreement: BaaAgreement | null
  statusInfo: BaaStatusInfo | null
  templateVersion: string
  canSign: boolean
  canCountersign: boolean
  templateConfig: {
    name: string
    version: string
    vendor: {
      legalName: string
      address: string
      contactName: string
      contactEmail: string
      contactPhone: string
    }
  }
}

export interface BaaSignRequest {
  signerName: string
  signerTitle: string
  signerEmail: string
  consent: boolean
  organizationAddress?: string
}

export interface BaaCountersignRequest {
  signerName: string
  signerTitle: string
}

export interface BaaStats {
  total: number
  executed: number
  awaitingOrgSignature: number
  awaitingVendorSignature: number
  notStarted: number
  statusOptions: Array<{ value: string; label: string; description: string; color: string }>
}

// Data Management Types
export type ExportEntityType = 'staff' | 'patients' | 'rooms' | 'rules'
export type ExportFormat = 'json' | 'csv'

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

// Data Management Service
export const dataManagementService = {
  async exportData(entityType: ExportEntityType, format: ExportFormat): Promise<Blob> {
    const { data } = await api.get(`/data-management/export/${entityType}/${format}`, {
      responseType: 'blob'
    })
    return data
  },

  async previewImport(
    file: File,
    entityType: ExportEntityType,
    format: ExportFormat
  ): Promise<ApiResponse<ImportPreview>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entityType', entityType)
    formData.append('format', format)

    const { data } = await api.post('/data-management/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  async executeImport(
    entityType: ExportEntityType,
    records: Record<string, unknown>[]
  ): Promise<ApiResponse<ImportResult>> {
    const { data } = await api.post('/data-management/import/execute', {
      entityType,
      records
    })
    return data
  }
}

// BAA Service (Business Associate Agreement)
export const baaService = {
  // Organization-scoped endpoints
  async getStatus(): Promise<ApiResponse<BaaStatusResponse>> {
    const { data } = await api.get('/baa/current')
    return data
  },

  async getPreview(): Promise<ApiResponse<{ content: string; templateVersion: string; contentType: string }>> {
    const { data } = await api.get('/baa/current/preview')
    return data
  },

  async initialize(): Promise<ApiResponse<BaaAgreement & { statusInfo: BaaStatusInfo }>> {
    const { data } = await api.post('/baa/current/initialize')
    return data
  },

  async sign(request: BaaSignRequest): Promise<ApiResponse<BaaAgreement & { statusInfo: BaaStatusInfo }, { message: string }>> {
    const { data } = await api.post('/baa/current/sign', request)
    return data
  },

  async download(): Promise<Blob> {
    const { data } = await api.get('/baa/current/download', { responseType: 'blob' })
    return data
  },

  async getHistory(): Promise<ApiResponse<Array<BaaAgreement & { statusInfo: BaaStatusInfo }>>> {
    const { data } = await api.get('/baa/current/history')
    return data
  },

  // Superadmin endpoints
  async adminList(params?: { page?: number; limit?: number; search?: string; status?: BaaStatus }): Promise<PaginatedResponse<BaaAgreementWithOrg & { statusInfo: BaaStatusInfo }>> {
    const { data } = await api.get('/baa/admin/list', { params })
    return data
  },

  async adminGetStats(): Promise<ApiResponse<BaaStats>> {
    const { data } = await api.get('/baa/admin/stats')
    return data
  },

  async adminGetOrgBaa(organizationId: string): Promise<ApiResponse<{
    current: BaaAgreement & { statusInfo: BaaStatusInfo }
    history: Array<BaaAgreement & { statusInfo: BaaStatusInfo }>
    canCountersign: boolean
  }>> {
    const { data } = await api.get(`/baa/admin/${organizationId}`)
    return data
  },

  async adminCountersign(organizationId: string, request: BaaCountersignRequest): Promise<ApiResponse<BaaAgreement & { statusInfo: BaaStatusInfo }, { message: string }>> {
    const { data } = await api.post(`/baa/admin/${organizationId}/countersign`, request)
    return data
  },

  async adminVoid(organizationId: string, reason: string): Promise<ApiResponse<BaaAgreement & { statusInfo: BaaStatusInfo }, { message: string }>> {
    const { data } = await api.post(`/baa/admin/${organizationId}/void`, { reason })
    return data
  },

  async adminDownload(baaId: string): Promise<Blob> {
    const { data } = await api.get(`/baa/admin/${baaId}/download`, { responseType: 'blob' })
    return data
  }
}

// Lead Types
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'closed'

export interface Lead {
  id: string
  name: string
  email: string
  company?: string | null
  phone?: string | null
  role?: string | null
  message?: string | null
  status: LeadStatus
  source: string
  notes?: string | null
  convertedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadSubmission {
  name: string
  email: string
  company?: string
  phone?: string
  role?: string
  message?: string
}

export interface LeadStats {
  total: number
  byStatus: Record<LeadStatus, number>
}

// Lead Service (public - no auth required)
export const leadService = {
  async submit(lead: LeadSubmission): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/leads/submit', lead)
    return data
  }
}

// Super Admin Lead Service
export const superAdminLeadService = {
  async list(params?: {
    page?: number
    limit?: number
    search?: string
    status?: LeadStatus
  }): Promise<PaginatedResponse<Lead>> {
    const { data } = await api.get('/leads', { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Lead>> {
    const { data } = await api.get(`/leads/${id}`)
    return data
  },

  async update(id: string, updates: { status?: LeadStatus; notes?: string | null }): Promise<ApiResponse<Lead>> {
    const { data } = await api.put(`/leads/${id}`, updates)
    return data
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const { data } = await api.delete(`/leads/${id}`)
    return data
  },

  async getStats(): Promise<ApiResponse<LeadStats>> {
    const { data } = await api.get('/leads/stats/counts')
    return data
  }
}

// Session Service (for session status management)
export const sessionService = {
  async getToday(): Promise<ApiResponse<Session[]>> {
    const { data } = await api.get('/sessions/today')
    return data
  },

  async getStatusCounts(params?: { dateFrom?: string; dateTo?: string }): Promise<ApiResponse<SessionStatusCounts>> {
    const { data } = await api.get('/sessions/status-counts', { params })
    return data
  },

  async getByStatus(
    status: SessionStatus,
    params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }
  ): Promise<PaginatedResponse<Session>> {
    const { data } = await api.get(`/sessions/by-status/${status}`, { params })
    return data
  },

  async get(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.get(`/sessions/${id}`)
    return data
  },

  async updateStatus(id: string, status: SessionStatus, notes?: string): Promise<ApiResponse<Session>> {
    const { data } = await api.put(`/sessions/${id}/status`, { status, notes })
    return data
  },

  async checkIn(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/sessions/${id}/check-in`)
    return data
  },

  async start(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/sessions/${id}/start`)
    return data
  },

  async complete(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/sessions/${id}/complete`)
    return data
  },

  async cancel(id: string, reason: CancellationReason, notes?: string): Promise<ApiResponse<Session, { isLateCancellation: boolean; message: string }>> {
    const { data } = await api.post(`/sessions/${id}/cancel`, { reason, notes })
    return data
  },

  async markNoShow(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/sessions/${id}/no-show`)
    return data
  },

  async confirm(id: string): Promise<ApiResponse<Session>> {
    const { data } = await api.post(`/sessions/${id}/confirm`)
    return data
  }
}

// Settings Service (organization settings and features)
export const settingsService = {
  async getSettings(): Promise<ApiResponse<OrganizationSettings>> {
    const { data } = await api.get('/settings')
    return data
  },

  async updateSettings(settings: {
    businessHours?: BusinessHours
    timezone?: string
    defaultSessionDuration?: number
    slotInterval?: number
    lateCancelWindowHours?: number
  }): Promise<ApiResponse<OrganizationSettings>> {
    const { data } = await api.put('/settings', settings)
    return data
  },

  async getBusinessHours(): Promise<ApiResponse<BusinessHours>> {
    const { data } = await api.get('/settings/business-hours')
    return data
  },

  async updateBusinessHours(businessHours: BusinessHours): Promise<ApiResponse<OrganizationSettings>> {
    const { data } = await api.put('/settings/business-hours', businessHours)
    return data
  },

  async getFeatures(): Promise<ApiResponse<OrganizationFeatures>> {
    const { data } = await api.get('/settings/features')
    return data
  },

  async getFeatureStatuses(): Promise<ApiResponse<FeatureStatuses>> {
    const { data } = await api.get('/settings/features/status')
    return data
  },

  async updateFeatures(features: Partial<OrganizationFeatures>): Promise<ApiResponse<OrganizationFeatures>> {
    const { data } = await api.put('/settings/features', features)
    return data
  },

  async getFeatureTiers(): Promise<ApiResponse<{
    basic: Partial<OrganizationFeatures>
    professional: Partial<OrganizationFeatures>
    enterprise: Partial<OrganizationFeatures>
  }>> {
    const { data } = await api.get('/settings/features/tiers')
    return data
  },

  async applyTier(tier: 'basic' | 'professional' | 'enterprise'): Promise<ApiResponse<OrganizationFeatures, { tier: string; message: string }>> {
    const { data } = await api.post('/settings/features/apply-tier', { tier })
    return data
  },

  async getPortalConfig(): Promise<ApiResponse<{
    enabled: boolean
    allowCancel: boolean
    allowReschedule: boolean
    requireConfirmation: boolean
  }>> {
    const { data } = await api.get('/settings/features/portal')
    return data
  }
}

// Help / Knowledge Base
export const helpService = {
  async listCategories(): Promise<ApiResponse<HelpCategory[]>> {
    const { data } = await api.get('/help/categories')
    return data
  },

  async getArticle(category: string, article: string): Promise<ApiResponse<HelpArticle>> {
    const { data } = await api.get(`/help/articles/${encodeURIComponent(category)}/${encodeURIComponent(article)}`)
    return data
  },

  async search(q: string, opts?: { limit?: number }): Promise<ApiResponse<HelpSearchResult[]>> {
    const { data } = await api.get('/help/search', { params: { q, limit: opts?.limit } })
    return data
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL SERVICES (Patient/Caregiver Portal)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PortalBranding,
  PortalUser,
  PortalSession,
  PortalAuthRequestResult,
  PortalVerifyResult,
  PortalAvailabilitySlot,
  PortalBookingHold,
  PortalBookingSettings
} from '@/types'

// Separate axios instance for portal (uses different token storage)
const portalApi = axios.create({
  baseURL: '/api/portal',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Portal token interceptor
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      // Don't redirect for auth endpoints
      if (!url.includes('/auth/')) {
        localStorage.removeItem('portal_token')
        window.location.href = '/portal/login'
      }
    }
    return Promise.reject(error)
  }
)

// Portal Branding Service (public - no auth required)
export const portalBrandingService = {
  async getBranding(): Promise<ApiResponse<PortalBranding>> {
    const { data } = await portalApi.get('/branding')
    return data
  }
}

// Portal Auth Service
export const portalAuthService = {
  async requestLogin(
    identifier: string,
    channel: 'email' | 'sms'
  ): Promise<PortalAuthRequestResult> {
    const { data } = await portalApi.post('/auth/request', { identifier, channel })
    return data
  },

  async verifyToken(token: string): Promise<PortalVerifyResult> {
    const { data } = await portalApi.post('/auth/verify', { token })
    return data
  },

  async me(): Promise<ApiResponse<PortalUser>> {
    const { data } = await portalApi.get('/me')
    return data
  },

  async logout(): Promise<void> {
    await portalApi.post('/auth/logout')
  }
}

// Portal Appointments Service
export const portalAppointmentsService = {
  async getUpcoming(): Promise<ApiResponse<PortalSession[]>> {
    const { data } = await portalApi.get('/appointments')
    return data
  },

  async getPast(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<PortalSession>> {
    const { data } = await portalApi.get('/appointments/history', { params })
    return data
  },

  async get(sessionId: string): Promise<ApiResponse<PortalSession>> {
    const { data } = await portalApi.get(`/appointments/${sessionId}`)
    return data
  },

  async confirm(sessionId: string): Promise<ApiResponse<PortalSession>> {
    const { data } = await portalApi.post(`/appointments/${sessionId}/confirm`)
    return data
  },

  async cancel(sessionId: string, reason?: string): Promise<ApiResponse<PortalSession>> {
    const { data } = await portalApi.post(`/appointments/${sessionId}/cancel`, { reason })
    return data
  },

  async reschedule(sessionId: string, holdId: string, reason?: string): Promise<ApiResponse<PortalSession>> {
    const { data } = await portalApi.post(`/appointments/${sessionId}/reschedule`, { holdId, reason })
    return data
  }
}

// Portal Booking Service (self-booking)
export const portalBookingService = {
  async getSettings(): Promise<ApiResponse<PortalBookingSettings>> {
    const { data } = await portalApi.get('/booking/settings')
    return data
  },

  async getAvailability(params: {
    dateFrom: string
    dateTo: string
    staffId?: string
    duration?: number
  }): Promise<ApiResponse<PortalAvailabilitySlot[]>> {
    const { data } = await portalApi.get('/booking/availability', { params })
    return data
  },

  async getTherapists(): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
    const { data } = await portalApi.get('/booking/therapists')
    return data
  },

  async createHold(slot: {
    staffId: string
    roomId?: string
    date: string
    startTime: string
    endTime: string
  }): Promise<ApiResponse<PortalBookingHold>> {
    const { data } = await portalApi.post('/booking/hold', slot)
    return data
  },

  async releaseHold(holdId: string): Promise<{ success: boolean }> {
    const { data } = await portalApi.delete(`/booking/hold/${holdId}`)
    return data
  },

  async book(holdId: string, notes?: string): Promise<ApiResponse<PortalSession>> {
    const { data } = await portalApi.post('/booking/book', { holdId, notes })
    return data
  }
}

export default api
