<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useStaffStore } from '@/stores/staff'
import { VoiceInput, VoiceHintsModal, Modal, Alert, Badge, Button, SearchBox } from '@/components/ui'
import { voiceService } from '@/services/api'
import type { Staff } from '@/types'

const staffStore = useStaffStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

const searchQuery = ref('')
const statusFilter = ref('active')
const genderFilter = ref('')

// Add staff modal
const showAddModal = ref(false)
const newStaff = ref<Partial<Staff>>({
  name: '',
  email: '',
  phone: '',
  gender: 'female',
  certifications: [],
  status: 'active',
  maxSessionsPerDay: 2
})

// Voice confirmation
const showVoiceConfirmation = ref(false)
const voiceTranscript = ref('')
const parsedStaff = ref<Partial<Staff> | null>(null)

const filteredStaff = computed(() => {
  let result = staffStore.staff

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.email && s.email.toLowerCase().includes(query))
    )
  }

  if (statusFilter.value) {
    result = result.filter((s) => s.status === statusFilter.value)
  }

  if (genderFilter.value) {
    result = result.filter((s) => s.gender === genderFilter.value)
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
    const response = await voiceService.parseStaff(transcript)
    const parsed = response.data

    if (parsed.commandType === 'create_staff' && parsed.confidence >= 0.5) {
      parsedStaff.value = {
        name: (parsed.data.name as string) || '',
        email: (parsed.data.email as string) || '',
        phone: (parsed.data.phone as string) || '',
        gender: (parsed.data.gender as 'male' | 'female') || 'female',
        certifications: (parsed.data.certifications as string[]) || [],
        maxSessionsPerDay: (parsed.data.maxSessionsPerDay as number) || 2,
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

async function confirmVoiceStaff() {
  if (parsedStaff.value) {
    await staffStore.createStaff(parsedStaff.value)
    showVoiceConfirmation.value = false
    parsedStaff.value = null
    voiceTranscript.value = ''
  }
}

function cancelVoiceConfirmation() {
  showVoiceConfirmation.value = false
  parsedStaff.value = null
  voiceTranscript.value = ''
}

function editVoiceParsed() {
  if (parsedStaff.value) {
    newStaff.value = { ...parsedStaff.value }
    showAddModal.value = true
    cancelVoiceConfirmation()
  }
}

async function handleAddStaff() {
  await staffStore.createStaff(newStaff.value)
  showAddModal.value = false
  resetForm()
}

function resetForm() {
  newStaff.value = {
    name: '',
    email: '',
    phone: '',
    gender: 'female',
    certifications: [],
    status: 'active',
    maxSessionsPerDay: 2
  }
}

onMounted(() => {
  staffStore.fetchStaff()
})

watch([statusFilter, genderFilter], () => {
  staffStore.fetchStaff({
    status: statusFilter.value || undefined
  })
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Staff Management</h2>
        <p>Manage therapists and their availability</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Staff Member
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Voice Hints Modal -->
      <VoiceHintsModal ref="voiceHintsModal" page-type="staff" />

      <!-- Voice Interface -->
      <VoiceInput
        title="Add Staff"
        description="Say it or type it to add a staff member."
        :show-hints-link="true"
        @result="handleVoiceResult"
        @show-hints="voiceHintsModal?.openModal()"
      />

      <!-- Voice Loading State -->
      <div v-if="voiceLoading" class="card mb-3">
        <div class="card-body text-center">
          <p class="text-muted">Processing command...</p>
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
          <div class="label">Your command:</div>
          <div>"{{ voiceTranscript }}"</div>
        </div>
        <div class="interpreted-rule">
          <strong>Add New Staff Member:</strong>
          <div style="margin-top: 8px; display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; text-align: left;">
            <span class="text-muted">Name:</span> <span>{{ parsedStaff?.name }}</span>
            <span class="text-muted">Gender:</span> <span>{{ parsedStaff?.gender }}</span>
            <span class="text-muted">Sessions/Day:</span> <span>{{ parsedStaff?.maxSessionsPerDay || 2 }}</span>
          </div>
        </div>
        <div class="confirmation-actions">
          <Button variant="success" @click="confirmVoiceStaff">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Add Staff Member
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
            placeholder="Search staff by name or email..."
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

      <!-- Staff Table -->
      <div class="card">
        <div class="card-header">
          <h3>Therapists ({{ staffStore.totalCount }})</h3>
        </div>

        <div v-if="staffStore.loading" class="card-body text-center">
          <p class="text-muted">Loading staff...</p>
        </div>

        <div v-else-if="staffStore.error" class="card-body">
          <Alert variant="danger">{{ staffStore.error }}</Alert>
        </div>

        <div v-else-if="filteredStaff.length === 0" class="card-body text-center">
          <p class="text-muted">No staff members found</p>
        </div>

        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Certifications</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="member in filteredStaff"
                :key="member.id"
                :style="member.status === 'inactive' ? { opacity: 0.6 } : {}"
              >
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div
                      class="user-avatar"
                      :style="{ width: '36px', height: '36px', fontSize: '13px', ...getAvatarStyle(member.gender) }"
                    >
                      {{ getInitials(member.name) }}
                    </div>
                    <div style="font-weight: 500;">{{ member.name }}</div>
                  </div>
                </td>
                <td style="text-transform: capitalize;">{{ member.gender }}</td>
                <td>{{ member.email }}</td>
                <td>{{ member.phone || '-' }}</td>
                <td>
                  <Badge
                    v-for="cert in (member.certifications || [])"
                    :key="cert"
                    variant="primary"
                    style="margin-right: 4px;"
                  >
                    {{ cert }}
                  </Badge>
                  <span v-if="!member.certifications?.length">-</span>
                </td>
                <td>
                  <Badge :variant="member.status === 'active' ? 'success' : 'secondary'">
                    {{ member.status }}
                  </Badge>
                </td>
                <td>
                  <RouterLink :to="`/staff/${member.id}`" class="btn btn-ghost btn-sm">
                    View
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="text-sm text-muted">
            Showing {{ filteredStaff.length }} of {{ staffStore.totalCount }} staff members
          </span>
        </div>
      </div>
    </div>

    <!-- Add Staff Modal -->
    <Modal v-model="showAddModal" title="Add Staff Member" size="md">
      <form @submit.prevent="handleAddStaff">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            v-model="newStaff.name"
            type="text"
            class="form-control"
            placeholder="Enter full name"
            required
          />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="newStaff.email"
            type="email"
            class="form-control"
            placeholder="Enter email address"
            required
          />
        </div>

        <div class="form-group">
          <label for="phone">Phone</label>
          <input
            id="phone"
            v-model="newStaff.phone"
            type="tel"
            class="form-control"
            placeholder="(555) 123-4567"
          />
        </div>

        <div class="form-group">
          <label for="gender">Gender</label>
          <select id="gender" v-model="newStaff.gender" class="form-control">
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>

        <div class="form-group">
          <label for="sessions">Max Sessions Per Day</label>
          <input
            id="sessions"
            v-model.number="newStaff.maxSessionsPerDay"
            type="number"
            class="form-control"
            min="1"
            max="10"
          />
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showAddModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="staffStore.loading">
            Add Staff Member
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
