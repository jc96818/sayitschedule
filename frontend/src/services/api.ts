import axios from 'axios'
import type {
  LoginRequest,
  LoginResponse,
  User,
  Organization,
  Staff,
  Patient,
  Rule,
  Room,
  Schedule,
  Session,
  ApiResponse,
  PaginatedResponse,
  MfaSetupResponse,
  MfaVerifyResponse,
  MfaStatusResponse,
  ParsedMultiRuleResponse,
  RuleAnalysisResult
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
    const { data } = await api.post('/patients', patient)
    return data
  },

  async update(id: string, patient: Partial<Patient>): Promise<ApiResponse<Patient>> {
    const { data } = await api.put(`/patients/${id}`, patient)
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

  async createDraftCopy(id: string): Promise<ApiResponse<Schedule & { sessions: Session[] }, { message: string; sourceScheduleId: string }>> {
    const { data } = await api.post(`/schedules/${id}/create-draft`)
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

  async create(user: { email: string; password: string; name: string }): Promise<ApiResponse<User>> {
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

  async resetPassword(id: string, password: string): Promise<{ success: boolean }> {
    const { data } = await api.post(`/super-admin/users/${id}/reset-password`, { password })
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

export default api
