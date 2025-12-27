<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStaffStore } from '@/stores/staff'
import { Modal, Alert, Badge, Button, Toggle } from '@/components/ui'
import type { Staff, DefaultHours } from '@/types'

const route = useRoute()
const router = useRouter()
const staffStore = useStaffStore()

const staffId = route.params.id as string
const loading = ref(true)
const showEditModal = ref(false)

// Edit form data
const formData = ref<Partial<Staff>>({})

const staff = computed(() => staffStore.currentStaff)

const dayLabels: Record<keyof DefaultHours, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday'
}

function formatGender(gender: string): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTimeRange(hours: { start: string; end: string } | null): string {
  if (!hours) return 'Off'
  return `${hours.start} - ${hours.end}`
}

function openEditModal() {
  if (staff.value) {
    formData.value = { ...staff.value }
  }
  showEditModal.value = true
}

async function handleSave() {
  if (!staff.value) return

  try {
    await staffStore.updateStaff(staff.value.id, formData.value)
    showEditModal.value = false
  } catch (error) {
    console.error('Failed to update staff:', error)
  }
}

async function handleToggleStatus() {
  if (!staff.value) return

  const newStatus = staff.value.status === 'active' ? 'inactive' : 'active'
  try {
    await staffStore.updateStaff(staff.value.id, { status: newStatus })
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

async function handleDelete() {
  if (!staff.value) return

  if (confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
    try {
      await staffStore.deleteStaff(staff.value.id)
      router.push('/staff')
    } catch (error) {
      console.error('Failed to delete staff:', error)
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await staffStore.fetchStaffById(staffId)
  } catch (error) {
    console.error('Failed to load staff:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <RouterLink to="/staff" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </RouterLink>
        <div class="title-row">
          <h2>{{ staff?.name || 'Staff Profile' }}</h2>
          <Badge v-if="staff" :variant="staff.status === 'active' ? 'success' : 'secondary'">
            {{ staff.status === 'active' ? 'Active' : 'Inactive' }}
          </Badge>
        </div>
      </div>
      <div v-if="staff" class="header-actions">
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
      <Alert v-if="staffStore.error" variant="danger" class="mb-3" dismissible @dismiss="staffStore.error = null">
        {{ staffStore.error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading staff profile...</p>
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else-if="!staff" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Staff member not found.</p>
          <RouterLink to="/staff" class="btn btn-primary" style="margin-top: 16px;">
            Return to Staff List
          </RouterLink>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-else class="grid-2">
        <!-- Personal Information -->
        <div class="card">
          <div class="card-header">
            <h3>Personal Information</h3>
          </div>
          <div class="card-body">
            <div class="profile-avatar">
              {{ staff.name.charAt(0).toUpperCase() }}
            </div>

            <div class="info-grid">
              <div class="info-item">
                <label>Full Name</label>
                <p>{{ staff.name }}</p>
              </div>
              <div class="info-item">
                <label>Gender</label>
                <p>{{ formatGender(staff.gender) }}</p>
              </div>
              <div class="info-item">
                <label>Email</label>
                <p>{{ staff.email || 'Not provided' }}</p>
              </div>
              <div class="info-item">
                <label>Phone</label>
                <p>{{ staff.phone || 'Not provided' }}</p>
              </div>
              <div class="info-item">
                <label>Hire Date</label>
                <p>{{ formatDate(staff.hireDate) }}</p>
              </div>
              <div class="info-item">
                <label>Status</label>
                <div class="status-toggle">
                  <Toggle :model-value="staff.status === 'active'" @update:model-value="handleToggleStatus" />
                  <span>{{ staff.status === 'active' ? 'Active' : 'Inactive' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Certifications -->
        <div class="card">
          <div class="card-header">
            <h3>Certifications</h3>
          </div>
          <div class="card-body">
            <div v-if="staff.certifications && staff.certifications.length > 0" class="cert-list">
              <Badge v-for="cert in staff.certifications" :key="cert" variant="primary">
                {{ cert }}
              </Badge>
            </div>
            <p v-else class="text-muted">No certifications listed.</p>
          </div>
        </div>

        <!-- Default Hours -->
        <div class="card" style="grid-column: span 2;">
          <div class="card-header">
            <h3>Default Working Hours</h3>
          </div>
          <div class="card-body">
            <div class="hours-grid">
              <div
                v-for="(label, day) in dayLabels"
                :key="day"
                class="hours-item"
              >
                <span class="day-label">{{ label }}</span>
                <span class="time-range">
                  {{ formatTimeRange(staff.defaultHours?.[day] || null) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal v-model="showEditModal" title="Edit Staff Profile" size="lg">
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
            <label for="gender">Gender</label>
            <select id="gender" v-model="formData.gender" class="form-control" required>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label for="phone">Phone</label>
            <input
              id="phone"
              v-model="formData.phone"
              type="tel"
              class="form-control"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="hireDate">Hire Date</label>
          <input
            id="hireDate"
            v-model="formData.hireDate"
            type="date"
            class="form-control"
            style="max-width: 200px;"
          />
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showEditModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="staffStore.loading">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.header {
  height: auto;
  min-height: var(--header-height);
  padding: 16px 24px;
}

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

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-row h2 {
  margin: 0;
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

.cert-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hours-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.hours-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  text-align: center;
}

.day-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.time-range {
  font-weight: 500;
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

  .hours-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
