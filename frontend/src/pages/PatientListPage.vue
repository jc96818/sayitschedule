<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePatientsStore } from '@/stores/patients'
import { VoiceInput, Modal, Alert, Badge, Button, SearchBox } from '@/components/ui'
import { voiceService } from '@/services/api'
import type { Patient } from '@/types'

const patientsStore = usePatientsStore()

const searchQuery = ref('')
const statusFilter = ref('')
const genderFilter = ref('')

// Add patient modal
const showAddModal = ref(false)
const newPatient = ref<Partial<Patient>>({
  name: '',
  gender: 'female',
  dateOfBirth: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  sessionsPerWeek: 2,
  sessionDuration: 60,
  requiredCertifications: [],
  genderPreference: null,
  notes: '',
  status: 'active'
})

// Voice confirmation
const showVoiceConfirmation = ref(false)
const voiceTranscript = ref('')
const parsedPatient = ref<Partial<Patient> | null>(null)

const filteredPatients = computed(() => {
  let result = patientsStore.patients

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((p) => p.name.toLowerCase().includes(query))
  }

  if (statusFilter.value) {
    result = result.filter((p) => p.status === statusFilter.value)
  }

  if (genderFilter.value) {
    result = result.filter((p) => p.gender === genderFilter.value)
  }

  return result
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarStyle(gender: string) {
  if (gender === 'female') {
    return { backgroundColor: '#fce7f3', color: '#be185d' }
  }
  return {}
}

const voiceLoading = ref(false)
const voiceError = ref('')

async function handleVoiceResult(transcript: string) {
  voiceTranscript.value = transcript
  voiceLoading.value = true
  voiceError.value = ''

  try {
    const response = await voiceService.parsePatient(transcript)
    const parsed = response.data

    if (parsed.commandType === 'create_patient' && parsed.confidence >= 0.5) {
      parsedPatient.value = {
        name: (parsed.data.name as string) || '',
        gender: (parsed.data.gender as 'male' | 'female') || 'female',
        sessionsPerWeek: (parsed.data.sessionsPerWeek as number) || 2,
        sessionDuration: (parsed.data.sessionDuration as number) || 60,
        requiredCertifications: (parsed.data.requiredCertifications as string[]) || [],
        genderPreference: (parsed.data.genderPreference as 'male' | 'female' | null) || null,
        notes: (parsed.data.notes as string) || '',
        status: 'active'
      }
      showVoiceConfirmation.value = true
    } else {
      voiceError.value = 'Could not understand the command. Please try again or use the form.'
    }
  } catch (error) {
    console.error('Voice parsing failed:', error)
    voiceError.value = 'Voice service unavailable. Please use the form instead.'
  } finally {
    voiceLoading.value = false
  }
}

async function confirmVoicePatient() {
  if (parsedPatient.value) {
    await patientsStore.createPatient(parsedPatient.value)
    showVoiceConfirmation.value = false
    parsedPatient.value = null
    voiceTranscript.value = ''
  }
}

function cancelVoiceConfirmation() {
  showVoiceConfirmation.value = false
  parsedPatient.value = null
  voiceTranscript.value = ''
}

function editVoiceParsed() {
  if (parsedPatient.value) {
    newPatient.value = { ...parsedPatient.value }
    showAddModal.value = true
    cancelVoiceConfirmation()
  }
}

async function handleAddPatient() {
  await patientsStore.createPatient(newPatient.value)
  showAddModal.value = false
  resetForm()
}

function resetForm() {
  newPatient.value = {
    name: '',
    gender: 'female',
    dateOfBirth: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    sessionsPerWeek: 2,
    sessionDuration: 60,
    requiredCertifications: [],
    genderPreference: null,
    notes: '',
    status: 'active'
  }
}

onMounted(() => {
  patientsStore.fetchPatients()
})

watch([statusFilter, genderFilter], () => {
  patientsStore.fetchPatients({
    status: statusFilter.value || undefined
  })
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Patient Management</h2>
        <p>Manage patient records and scheduling preferences</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Patient
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Voice Interface -->
      <VoiceInput
        title="Voice Patient Management"
        description="Click the microphone and speak to add or update patients. Example: 'Add a new patient named John Smith who needs 3 sessions per week'"
        @result="handleVoiceResult"
      />

      <!-- Voice Loading State -->
      <div v-if="voiceLoading" class="card mb-3">
        <div class="card-body text-center">
          <p class="text-muted">Processing voice command...</p>
        </div>
      </div>

      <!-- Voice Error -->
      <Alert v-if="voiceError" variant="warning" class="mb-3">
        {{ voiceError }}
      </Alert>

      <!-- Voice Confirmation Card -->
      <div v-if="showVoiceConfirmation" class="confirmation-card">
        <h4>AI Interpretation</h4>
        <div class="transcription-box mb-2">
          <div class="label">You said:</div>
          <div>"{{ voiceTranscript }}"</div>
        </div>
        <div class="interpreted-rule">
          <strong>Add New Patient:</strong>
          <div style="margin-top: 8px; display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; text-align: left;">
            <span class="text-muted">Name:</span> <span>{{ parsedPatient?.name }}</span>
            <span class="text-muted">Gender:</span> <span>{{ parsedPatient?.gender }}</span>
            <span class="text-muted">Sessions/Week:</span> <span>{{ parsedPatient?.sessionsPerWeek || 2 }}</span>
          </div>
        </div>
        <div class="confirmation-actions">
          <Button variant="success" @click="confirmVoicePatient">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Add Patient
          </Button>
          <Button variant="outline" @click="editVoiceParsed">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Details
          </Button>
          <Button variant="ghost" class="text-danger" @click="cancelVoiceConfirmation">Cancel</Button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-3">
        <div class="card-body" style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
          <SearchBox
            v-model="searchQuery"
            placeholder="Search patients by name..."
            style="flex: 1; min-width: 250px;"
          />
          <select v-model="statusFilter" class="form-control" style="width: auto;">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select v-model="genderFilter" class="form-control" style="width: auto;">
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <!-- Patients Table -->
      <div class="card">
        <div class="card-header">
          <h3>Patients ({{ patientsStore.totalCount }})</h3>
          <Button variant="outline" size="sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </Button>
        </div>

        <div v-if="patientsStore.loading" class="card-body text-center">
          <p class="text-muted">Loading patients...</p>
        </div>

        <div v-else-if="patientsStore.error" class="card-body">
          <Alert variant="danger">{{ patientsStore.error }}</Alert>
        </div>

        <div v-else-if="filteredPatients.length === 0" class="card-body text-center">
          <p class="text-muted">No patients found</p>
        </div>

        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Sessions/Week</th>
                <th>Required Certs</th>
                <th>Gender Pref</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="patient in filteredPatients"
                :key="patient.id"
                :style="patient.status === 'inactive' ? { opacity: 0.6 } : {}"
              >
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div
                      class="user-avatar"
                      :style="{ width: '36px', height: '36px', fontSize: '13px', ...getAvatarStyle(patient.gender) }"
                    >
                      {{ getInitials(patient.name) }}
                    </div>
                    <div>
                      <div style="font-weight: 500;">{{ patient.name }}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">ID: {{ patient.id.slice(0, 8) }}</div>
                    </div>
                  </div>
                </td>
                <td style="text-transform: capitalize;">{{ patient.gender }}</td>
                <td>{{ patient.sessionsPerWeek }}</td>
                <td>
                  <Badge
                    v-for="cert in (patient.requiredCertifications || [])"
                    :key="cert"
                    variant="primary"
                    style="margin-right: 4px;"
                  >
                    {{ cert }}
                  </Badge>
                  <span v-if="!patient.requiredCertifications?.length">-</span>
                </td>
                <td style="text-transform: capitalize;">{{ patient.genderPreference || 'Any' }}</td>
                <td>
                  <Badge :variant="patient.status === 'active' ? 'success' : 'secondary'">
                    {{ patient.status }}
                  </Badge>
                </td>
                <td>
                  <RouterLink :to="`/patients/${patient.id}`" class="btn btn-ghost btn-sm">
                    View
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="text-sm text-muted">
            Showing {{ filteredPatients.length }} of {{ patientsStore.totalCount }} patients
          </span>
        </div>
      </div>
    </div>

    <!-- Add Patient Modal -->
    <Modal v-model="showAddModal" title="Add Patient" size="md">
      <form @submit.prevent="handleAddPatient">
        <div class="form-group">
          <label for="name">Patient Name</label>
          <input
            id="name"
            v-model="newPatient.name"
            type="text"
            class="form-control"
            placeholder="Enter patient name"
            required
          />
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="gender">Gender</label>
            <select id="gender" v-model="newPatient.gender" class="form-control">
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>

          <div class="form-group">
            <label for="dob">Date of Birth</label>
            <input
              id="dob"
              v-model="newPatient.dateOfBirth"
              type="date"
              class="form-control"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="guardian">Guardian Name</label>
          <input
            id="guardian"
            v-model="newPatient.guardianName"
            type="text"
            class="form-control"
            placeholder="Enter guardian name"
          />
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="guardianPhone">Guardian Phone</label>
            <input
              id="guardianPhone"
              v-model="newPatient.guardianPhone"
              type="tel"
              class="form-control"
              placeholder="(555) 123-4567"
            />
          </div>

          <div class="form-group">
            <label for="guardianEmail">Guardian Email</label>
            <input
              id="guardianEmail"
              v-model="newPatient.guardianEmail"
              type="email"
              class="form-control"
              placeholder="guardian@email.com"
            />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="sessions">Sessions Per Week</label>
            <input
              id="sessions"
              v-model.number="newPatient.sessionsPerWeek"
              type="number"
              class="form-control"
              min="1"
              max="10"
            />
          </div>

          <div class="form-group">
            <label for="duration">Session Duration (min)</label>
            <select id="duration" v-model.number="newPatient.sessionDuration" class="form-control">
              <option :value="30">30 minutes</option>
              <option :value="45">45 minutes</option>
              <option :value="60">60 minutes</option>
              <option :value="90">90 minutes</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="genderPref">Therapist Gender Preference</label>
          <select id="genderPref" v-model="newPatient.genderPreference" class="form-control">
            <option :value="null">No Preference</option>
            <option value="female">Female Only</option>
            <option value="male">Male Only</option>
          </select>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            v-model="newPatient.notes"
            class="form-control"
            rows="3"
            placeholder="Any special notes or requirements..."
          ></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showAddModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="patientsStore.loading">
            Add Patient
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.text-danger {
  color: var(--danger-color);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.confirmation-card {
  background-color: var(--card-background);
  border: 2px solid var(--primary-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 20px;
}

.confirmation-card h4 {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.interpreted-rule {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
}

.confirmation-actions {
  display: flex;
  gap: 12px;
}

.transcription-box {
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: left;
}

.transcription-box .label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 8px;
}
</style>
