<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePatientsStore } from '@/stores/patients'
import { Modal, Alert, Badge, Button, Toggle } from '@/components/ui'
import type { Patient } from '@/types'

const route = useRoute()
const router = useRouter()
const patientsStore = usePatientsStore()

const patientId = route.params.id as string
const loading = ref(true)
const showEditModal = ref(false)

// Edit form data
const formData = ref<Partial<Patient>>({})

const patient = computed(() => patientsStore.currentPatient)

function formatGender(gender: string): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function openEditModal() {
  if (patient.value) {
    formData.value = { ...patient.value }
  }
  showEditModal.value = true
}

async function handleSave() {
  if (!patient.value) return

  try {
    await patientsStore.updatePatient(patient.value.id, formData.value)
    showEditModal.value = false
  } catch (error) {
    console.error('Failed to update patient:', error)
  }
}

async function handleToggleStatus() {
  if (!patient.value) return

  const newStatus = patient.value.status === 'active' ? 'inactive' : 'active'
  try {
    await patientsStore.updatePatient(patient.value.id, { status: newStatus })
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

async function handleDelete() {
  if (!patient.value) return

  if (confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
    try {
      await patientsStore.deletePatient(patient.value.id)
      router.push('/patients')
    } catch (error) {
      console.error('Failed to delete patient:', error)
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await patientsStore.fetchPatientById(patientId)
  } catch (error) {
    console.error('Failed to load patient:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <RouterLink to="/patients" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Patients
        </RouterLink>
        <h2>{{ patient?.name || 'Patient Profile' }}</h2>
        <p v-if="patient">
          <Badge :variant="patient.status === 'active' ? 'success' : 'secondary'">
            {{ patient.status === 'active' ? 'Active' : 'Inactive' }}
          </Badge>
          <Badge v-if="patient.identifier" variant="secondary" style="margin-left: 8px;">
            ID: {{ patient.identifier }}
          </Badge>
        </p>
      </div>
      <div v-if="patient" class="header-actions">
        <Button variant="outline" @click="openEditModal">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Profile
        </Button>
        <Button variant="danger" @click="handleDelete">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="patientsStore.error" variant="danger" class="mb-3" dismissible @dismiss="patientsStore.error = null">
        {{ patientsStore.error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading patient profile...</p>
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else-if="!patient" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Patient not found.</p>
          <RouterLink to="/patients" class="btn btn-primary" style="margin-top: 16px;">
            Return to Patient List
          </RouterLink>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-else class="grid-2">
        <!-- Patient Information -->
        <div class="card">
          <div class="card-header">
            <h3>Patient Information</h3>
          </div>
          <div class="card-body">
            <div class="profile-avatar green">
              {{ patient.name.charAt(0).toUpperCase() }}
            </div>

            <div class="info-grid">
              <div class="info-item">
                <label>Full Name</label>
                <p>{{ patient.name }}</p>
              </div>
              <div class="info-item">
                <label>Identifier</label>
                <p>{{ patient.identifier || 'Not assigned' }}</p>
              </div>
              <div class="info-item">
                <label>Gender</label>
                <p>{{ formatGender(patient.gender) }}</p>
              </div>
              <div class="info-item">
                <label>Sessions Per Week</label>
                <p>{{ patient.sessionFrequency }}</p>
              </div>
              <div class="info-item">
                <label>Added On</label>
                <p>{{ formatDate(patient.createdAt) }}</p>
              </div>
              <div class="info-item">
                <label>Status</label>
                <div class="status-toggle">
                  <Toggle :model-value="patient.status === 'active'" @update:model-value="handleToggleStatus" />
                  <span>{{ patient.status === 'active' ? 'Active' : 'Inactive' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Requirements & Preferences -->
        <div class="card">
          <div class="card-header">
            <h3>Requirements & Preferences</h3>
          </div>
          <div class="card-body">
            <div class="requirement-section">
              <label>Required Certifications</label>
              <div v-if="patient.requiredCertifications && patient.requiredCertifications.length > 0" class="badge-list">
                <Badge v-for="cert in patient.requiredCertifications" :key="cert" variant="primary">
                  {{ cert }}
                </Badge>
              </div>
              <p v-else class="text-muted">No specific certifications required.</p>
            </div>

            <div class="requirement-section">
              <label>Preferred Times</label>
              <div v-if="patient.preferredTimes && patient.preferredTimes.length > 0" class="badge-list">
                <Badge v-for="time in patient.preferredTimes" :key="time" variant="secondary">
                  {{ time }}
                </Badge>
              </div>
              <p v-else class="text-muted">No specific time preferences.</p>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="card" style="grid-column: span 2;">
          <div class="card-header">
            <h3>Notes</h3>
          </div>
          <div class="card-body">
            <p v-if="patient.notes" class="notes-text">{{ patient.notes }}</p>
            <p v-else class="text-muted">No notes recorded for this patient.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal v-model="showEditModal" title="Edit Patient Profile" size="lg">
      <form @submit.prevent="handleSave">
        <div class="form-row">
          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              class="form-control"
              required
            />
          </div>
          <div class="form-group">
            <label for="identifier">Patient ID</label>
            <input
              id="identifier"
              v-model="formData.identifier"
              type="text"
              class="form-control"
              placeholder="Optional"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="gender">Gender</label>
            <select id="gender" v-model="formData.gender" class="form-control" required>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label for="sessionFrequency">Sessions Per Week</label>
            <input
              id="sessionFrequency"
              v-model.number="formData.sessionFrequency"
              type="number"
              class="form-control"
              min="1"
              max="7"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            v-model="formData.notes"
            class="form-control"
            rows="3"
            placeholder="Additional notes about the patient..."
          ></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showEditModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="patientsStore.loading">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 8px;
}

.back-link:hover {
  color: var(--primary-color);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 24px;
}

.profile-avatar.green {
  background-color: var(--success-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: block;
}

.info-item p {
  margin: 0;
  font-size: 15px;
}

.status-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}

.requirement-section {
  margin-bottom: 20px;
}

.requirement-section:last-child {
  margin-bottom: 0;
}

.requirement-section label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: block;
}

.badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notes-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .grid-2 .card[style*="grid-column"] {
    grid-column: span 1;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
