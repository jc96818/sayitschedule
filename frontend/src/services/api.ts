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

  async generate(weekStartDate: string): Promise<ApiResponse<Schedule>> {
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
  }
}

// Voice Service
export const voiceService = {
  async parseCommand(transcript: string, context: 'rule' | 'staff' | 'patient' | 'schedule'): Promise<ApiResponse<unknown>> {
    const { data } = await api.post('/voice/parse', { transcript, context })
    return data
  }
}

export default api
