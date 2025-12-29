<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoomsStore } from '@/stores/rooms'
import { VoiceInput, VoiceHintsModal, Modal, Alert, Badge, Button, SearchBox } from '@/components/ui'
import { voiceService } from '@/services/api'
import type { Room } from '@/types'

const roomsStore = useRoomsStore()

// Voice hints modal ref
const voiceHintsModal = ref<InstanceType<typeof VoiceHintsModal> | null>(null)

const searchQuery = ref('')
const statusFilter = ref('active')

// Add room modal
const showAddModal = ref(false)
const newRoom = ref<Partial<Room>>({
  name: '',
  description: '',
  capabilities: [],
  status: 'active'
})

// New capability input
const newCapability = ref('')

// Voice confirmation
const showVoiceConfirmation = ref(false)
const voiceTranscript = ref('')
const parsedRoom = ref<Partial<Room> | null>(null)

const filteredRooms = computed(() => {
  let result = roomsStore.rooms

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query)) ||
        r.capabilities.some((c) => c.toLowerCase().includes(query))
    )
  }

  if (statusFilter.value) {
    result = result.filter((r) => r.status === statusFilter.value)
  }

  return result
})

const voiceLoading = ref(false)
const voiceError = ref('')

async function handleVoiceResult(transcript: string) {
  voiceTranscript.value = transcript
  voiceLoading.value = true
  voiceError.value = ''

  try {
    const response = await voiceService.parseCommand(transcript, 'general')
    const parsed = response.data

    // Parse room creation from voice command
    if (parsed.confidence >= 0.5) {
      parsedRoom.value = {
        name: (parsed.data.name as string) || '',
        description: (parsed.data.description as string) || '',
        capabilities: (parsed.data.capabilities as string[]) || [],
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

async function confirmVoiceRoom() {
  if (parsedRoom.value) {
    await roomsStore.createRoom(parsedRoom.value)
    showVoiceConfirmation.value = false
    parsedRoom.value = null
    voiceTranscript.value = ''
  }
}

function cancelVoiceConfirmation() {
  showVoiceConfirmation.value = false
  parsedRoom.value = null
  voiceTranscript.value = ''
}

function editVoiceParsed() {
  if (parsedRoom.value) {
    newRoom.value = { ...parsedRoom.value }
    showAddModal.value = true
    cancelVoiceConfirmation()
  }
}

function addCapability() {
  if (newCapability.value.trim() && !newRoom.value.capabilities?.includes(newCapability.value.trim())) {
    newRoom.value.capabilities = [...(newRoom.value.capabilities || []), newCapability.value.trim()]
    newCapability.value = ''
  }
}

function removeCapability(cap: string) {
  newRoom.value.capabilities = (newRoom.value.capabilities || []).filter((c) => c !== cap)
}

async function handleAddRoom() {
  await roomsStore.createRoom(newRoom.value)
  showAddModal.value = false
  resetForm()
}

function resetForm() {
  newRoom.value = {
    name: '',
    description: '',
    capabilities: [],
    status: 'active'
  }
  newCapability.value = ''
}

onMounted(() => {
  roomsStore.fetchRooms()
})

watch([statusFilter], () => {
  roomsStore.fetchRooms({
    status: statusFilter.value || undefined
  })
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
        <h2>Room Management</h2>
        <p>Configure therapy rooms and their capabilities</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Voice Hints Modal -->
      <VoiceHintsModal ref="voiceHintsModal" page-type="room" />

      <!-- Voice Interface -->
      <VoiceInput
        title="Voice Room Management"
        description="Click the microphone and speak to add new rooms."
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
          <strong>Add New Room:</strong>
          <div style="margin-top: 8px; display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; text-align: left;">
            <span class="text-muted">Name:</span> <span>{{ parsedRoom?.name }}</span>
            <span class="text-muted">Capabilities:</span>
            <span>
              <Badge v-for="cap in parsedRoom?.capabilities" :key="cap" variant="primary" style="margin-right: 4px;">
                {{ cap }}
              </Badge>
              <span v-if="!parsedRoom?.capabilities?.length">None</span>
            </span>
          </div>
        </div>
        <div class="confirmation-actions">
          <Button variant="success" @click="confirmVoiceRoom">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Add Room
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
            placeholder="Search rooms by name or capability..."
            style="flex: 1; min-width: 250px;"
          />
          <select v-model="statusFilter" class="form-control" style="width: auto;">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <!-- Rooms Table -->
      <div class="card">
        <div class="card-header">
          <h3>Rooms ({{ roomsStore.totalCount }})</h3>
        </div>

        <div v-if="roomsStore.loading" class="card-body text-center">
          <p class="text-muted">Loading rooms...</p>
        </div>

        <div v-else-if="roomsStore.error" class="card-body">
          <Alert variant="danger">{{ roomsStore.error }}</Alert>
        </div>

        <div v-else-if="filteredRooms.length === 0" class="card-body text-center">
          <p class="text-muted">No rooms found</p>
          <p class="text-sm text-muted mt-2">Add your first room to get started with room-based scheduling.</p>
        </div>

        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Capabilities</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="room in filteredRooms"
                :key="room.id"
                :style="room.status === 'inactive' ? { opacity: 0.6 } : {}"
              >
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="room-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div style="font-weight: 500;">{{ room.name }}</div>
                  </div>
                </td>
                <td>
                  <Badge
                    v-for="cap in (room.capabilities || [])"
                    :key="cap"
                    variant="primary"
                    style="margin-right: 4px; margin-bottom: 4px;"
                  >
                    {{ cap.replace(/_/g, ' ') }}
                  </Badge>
                  <span v-if="!room.capabilities?.length" class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="room.description">{{ room.description }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <Badge :variant="room.status === 'active' ? 'success' : 'secondary'">
                    {{ room.status }}
                  </Badge>
                </td>
                <td>
                  <RouterLink :to="`/rooms/${room.id}`" class="btn btn-ghost btn-sm">
                    View
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="text-sm text-muted">
            Showing {{ filteredRooms.length }} of {{ roomsStore.totalCount }} rooms
          </span>
        </div>
      </div>
    </div>

    <!-- Add Room Modal -->
    <Modal v-model="showAddModal" title="Add Room" size="md">
      <form @submit.prevent="handleAddRoom">
        <div class="form-group">
          <label for="name">Room Name</label>
          <input
            id="name"
            v-model="newRoom.name"
            type="text"
            class="form-control"
            placeholder="e.g., Room 101, Sensory Room A"
            required
          />
        </div>

        <div class="form-group">
          <label for="description">Description (Optional)</label>
          <textarea
            id="description"
            v-model="newRoom.description"
            class="form-control"
            rows="2"
            placeholder="Brief description of the room"
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
              v-for="cap in capabilitySuggestions.filter(c => !newRoom.capabilities?.includes(c))"
              :key="cap"
              type="button"
              variant="ghost"
              size="sm"
              @click="newRoom.capabilities = [...(newRoom.capabilities || []), cap]"
            >
              + {{ cap.replace(/_/g, ' ') }}
            </Button>
          </div>
          <div v-if="newRoom.capabilities?.length" class="capability-tags">
            <Badge
              v-for="cap in newRoom.capabilities"
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
          <Button type="button" variant="outline" @click="showAddModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="roomsStore.loading">
            Add Room
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

.room-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
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
</style>
