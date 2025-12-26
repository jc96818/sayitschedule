import axios from 'axios'
import type {
  LoginRequest,
  LoginResponse,
  User,
  Organization,
  Staff,
  Patient,
  Rule,
  Schedule,
  Session,
  ApiResponse,
  PaginatedResponse
} from '@/types'

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
      localStorage.removeItem('token')
      window.location.href = '/login'
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

  async switchContext(id: string): Promise<void> {
    await api.post(`/organizations/${id}/switch`)
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
    const { data } = await api.get('/rules')
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
  }
}

// Voice Service Types
export type VoiceContext = 'patient' | 'staff' | 'rule' | 'schedule' | 'schedule_modify' | 'general'

export interface ParsedVoiceCommand {
  commandType: 'create_patient' | 'create_staff' | 'create_rule' | 'schedule_session' | 'modify_session' | 'cancel_session' | 'unknown'
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

  async parseRule(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/rule', { transcript })
    return data
  },

  async parseSchedule(transcript: string): Promise<ApiResponse<ParsedVoiceCommand>> {
    const { data } = await api.post('/voice/parse/schedule', { transcript })
    return data
  }
}

export default api
