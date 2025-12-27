<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { Modal, Alert, Badge, Button, Toggle } from '@/components/ui'
import type { Room } from '@/types'

const route = useRoute()
const router = useRouter()
const roomsStore = useRoomsStore()

const roomId = route.params.id as string
const loading = ref(true)
const showEditModal = ref(false)

// Edit form data
const formData = ref<Partial<Room>>({})
const newCapability = ref('')

const room = computed(() => roomsStore.currentRoom)

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function openEditModal() {
  if (room.value) {
    formData.value = { ...room.value }
  }
  showEditModal.value = true
}

function addCapability() {
  if (newCapability.value.trim() && !formData.value.capabilities?.includes(newCapability.value.trim())) {
    formData.value.capabilities = [...(formData.value.capabilities || []), newCapability.value.trim()]
    newCapability.value = ''
  }
}

function removeCapability(cap: string) {
  formData.value.capabilities = (formData.value.capabilities || []).filter((c) => c !== cap)
}

async function handleSave() {
  if (!room.value) return

  try {
    await roomsStore.updateRoom(room.value.id, formData.value)
    showEditModal.value = false
  } catch (error) {
    console.error('Failed to update room:', error)
  }
}

async function handleToggleStatus() {
  if (!room.value) return

  const newStatus = room.value.status === 'active' ? 'inactive' : 'active'
  try {
    await roomsStore.updateRoom(room.value.id, { status: newStatus })
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

async function handleDelete() {
  if (!room.value) return

  if (confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
    try {
      await roomsStore.deleteRoom(room.value.id)
      router.push('/rooms')
    } catch (error) {
      console.error('Failed to delete room:', error)
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await roomsStore.fetchRoomById(roomId)
  } catch (error) {
    console.error('Failed to load room:', error)
  } finally {
    loading.value = false
  }
})

// Common capability suggestions
const capabilitySuggestions = [
  'wheelchair_accessible',
  'sensory_equipment',
  'computer_station',
  'therapy_swing',
  'quiet_room',
  'large_space',
  'outdoor_access',
  'video_recording'
]
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <RouterLink to="/rooms" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Rooms
        </RouterLink>
        <div class="title-row">
          <h2>{{ room?.name || 'Room Profile' }}</h2>
          <Badge v-if="room" :variant="room.status === 'active' ? 'success' : 'secondary'">
            {{ room.status === 'active' ? 'Active' : 'Inactive' }}
          </Badge>
        </div>
      </div>
      <div v-if="room" class="header-actions">
        <Button variant="outline" @click="openEditModal">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Room
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
      <Alert v-if="roomsStore.error" variant="danger" class="mb-3" dismissible @dismiss="roomsStore.error = null">
        {{ roomsStore.error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading room details...</p>
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else-if="!room" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Room not found.</p>
          <RouterLink to="/rooms" class="btn btn-primary" style="margin-top: 16px;">
            Return to Room List
          </RouterLink>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-else class="grid-2">
        <!-- Room Information -->
        <div class="card">
          <div class="card-header">
            <h3>Room Information</h3>
          </div>
          <div class="card-body">
            <div class="room-icon-large">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <label>Room Name</label>
                <p>{{ room.name }}</p>
              </div>
              <div class="info-item">
                <label>Status</label>
                <div class="status-toggle">
                  <Toggle :model-value="room.status === 'active'" @update:model-value="handleToggleStatus" />
                  <span>{{ room.status === 'active' ? 'Active' : 'Inactive' }}</span>
                </div>
              </div>
              <div class="info-item full-width">
                <label>Description</label>
                <p>{{ room.description || 'No description provided' }}</p>
              </div>
              <div class="info-item">
                <label>Created</label>
                <p>{{ formatDate(room.createdAt) }}</p>
              </div>
              <div class="info-item">
                <label>Last Updated</label>
                <p>{{ formatDate(room.updatedAt) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Capabilities -->
        <div class="card">
          <div class="card-header">
            <h3>Capabilities & Equipment</h3>
          </div>
          <div class="card-body">
            <div v-if="room.capabilities && room.capabilities.length > 0" class="capability-list">
              <div v-for="cap in room.capabilities" :key="cap" class="capability-item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                {{ cap.replace(/_/g, ' ') }}
              </div>
            </div>
            <p v-else class="text-muted">No capabilities configured for this room.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal v-model="showEditModal" title="Edit Room" size="md">
      <form @submit.prevent="handleSave">
        <div class="form-group">
          <label for="name">Room Name</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            class="form-control"
            required
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            v-model="formData.description"
            class="form-control"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label>Capabilities</label>
          <div class="capability-input">
            <input
              v-model="newCapability"
              type="text"
              class="form-control"
              placeholder="Add capability..."
              @keydown.enter.prevent="addCapability"
            />
            <Button type="button" variant="outline" size="sm" @click="addCapability">Add</Button>
          </div>
          <div class="capability-suggestions">
            <span class="text-sm text-muted">Suggestions:</span>
            <Button
              v-for="cap in capabilitySuggestions.filter(c => !formData.capabilities?.includes(c))"
              :key="cap"
              type="button"
              variant="ghost"
              size="sm"
              @click="formData.capabilities = [...(formData.capabilities || []), cap]"
            >
              + {{ cap.replace(/_/g, ' ') }}
            </Button>
          </div>
          <div v-if="formData.capabilities?.length" class="capability-tags">
            <Badge
              v-for="cap in formData.capabilities"
              :key="cap"
              variant="primary"
              style="margin-right: 4px; margin-bottom: 4px; cursor: pointer;"
              @click="removeCapability(cap)"
            >
              {{ cap.replace(/_/g, ' ') }} ×
            </Badge>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showEditModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="roomsStore.loading">
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

.room-icon-large {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
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

.info-item.full-width {
  grid-column: span 2;
}

.status-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}

.capability-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.capability-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  text-transform: capitalize;
}

.capability-item svg {
  color: var(--success-color);
}

.capability-input {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.capability-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-bottom: 8px;
}

.capability-tags {
  margin-top: 8px;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-item.full-width {
    grid-column: span 1;
  }
}
</style>
