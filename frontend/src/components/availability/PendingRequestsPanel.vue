<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAvailabilityStore } from '@/stores/availability'
import { Button, Alert } from '@/components/ui'
import type { StaffAvailability } from '@/types'

defineProps<{
  compact?: boolean
}>()

const availabilityStore = useAvailabilityStore()

const reviewNotes = ref<Record<string, string>>({})
const processingId = ref<string | null>(null)
const error = ref<string | null>(null)

const pendingRequests = computed(() => availabilityStore.pendingRequests)
const loading = computed(() => availabilityStore.loading)
const hasMore = computed(() => availabilityStore.hasMore)

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function formatTimeRange(request: StaffAvailability): string {
  if (!request.startTime || !request.endTime) {
    return 'Full Day'
  }
  return `${request.startTime} - ${request.endTime}`
}

async function handleApprove(request: StaffAvailability) {
  processingId.value = request.id
  error.value = null

  try {
    await availabilityStore.approve(
      request.staffId,
      request.id,
      reviewNotes.value[request.id] || undefined
    )
    delete reviewNotes.value[request.id]
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to approve request'
  } finally {
    processingId.value = null
  }
}

async function handleReject(request: StaffAvailability) {
  if (!reviewNotes.value[request.id]) {
    error.value = 'Please provide a reason for rejection'
    return
  }

  processingId.value = request.id
  error.value = null

  try {
    await availabilityStore.reject(
      request.staffId,
      request.id,
      reviewNotes.value[request.id]
    )
    delete reviewNotes.value[request.id]
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to reject request'
  } finally {
    processingId.value = null
  }
}

async function loadMore() {
  await availabilityStore.fetchPending()
}

onMounted(() => {
  availabilityStore.fetchPending()
})
</script>

<template>
  <div class="pending-requests-panel" :class="{ compact }">
    <div class="panel-header">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Pending Time-Off Requests
      </h3>
      <span v-if="pendingRequests.length > 0" class="badge">
        {{ pendingRequests.length }}
      </span>
    </div>

    <Alert v-if="error" variant="danger" class="panel-alert" dismissible @dismiss="error = null">
      {{ error }}
    </Alert>

    <!-- Loading State -->
    <div v-if="loading && pendingRequests.length === 0" class="loading-state">
      <div class="spinner"></div>
      <span>Loading requests...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="pendingRequests.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>No pending requests</span>
    </div>

    <!-- Request List -->
    <div v-else class="requests-list">
      <div
        v-for="request in pendingRequests"
        :key="request.id"
        class="request-card"
        :class="{ processing: processingId === request.id }"
      >
        <div class="request-header">
          <div class="staff-info">
            <span class="staff-name">{{ request.staffName }}</span>
            <span class="request-date">{{ formatDate(request.date) }}</span>
          </div>
          <span class="time-badge">{{ formatTimeRange(request) }}</span>
        </div>

        <div v-if="request.reason" class="request-reason">
          {{ request.reason }}
        </div>

        <div v-if="!compact" class="request-notes">
          <input
            v-model="reviewNotes[request.id]"
            type="text"
            class="notes-input"
            placeholder="Add a note (required for rejection)"
            :disabled="processingId === request.id"
          />
        </div>

        <div class="request-actions">
          <Button
            variant="success"
            size="sm"
            :loading="processingId === request.id"
            @click="handleApprove(request)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            :loading="processingId === request.id"
            @click="handleReject(request)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Reject
          </Button>
        </div>
      </div>

      <!-- Load More -->
      <Button
        v-if="hasMore"
        variant="outline"
        block
        :loading="loading"
        @click="loadMore"
      >
        Load More
      </Button>
    </div>
  </div>
</template>

<style scoped>
.pending-requests-panel {
  background: var(--card-background, #fff);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-color, #e5e7eb);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--background-color, #f9fafb);
}

.panel-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: var(--warning-color, #f59e0b);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
}

.panel-alert {
  margin: 12px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-muted, #9ca3af);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #2563eb);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.requests-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  padding: 16px;
  background: var(--background-color, #f9fafb);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e5e7eb);
  transition: opacity 0.2s;
}

.request-card.processing {
  opacity: 0.6;
  pointer-events: none;
}

.request-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.staff-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.staff-name {
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.request-date {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.time-badge {
  padding: 4px 10px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  white-space: nowrap;
}

.request-reason {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 12px;
  padding: 8px;
  background: var(--card-background, #fff);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-color, #e5e7eb);
}

.request-notes {
  margin-bottom: 12px;
}

.notes-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--card-background, #fff);
  color: var(--text-primary, #111827);
}

.notes-input:focus {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.notes-input:disabled {
  opacity: 0.6;
}

.request-actions {
  display: flex;
  gap: 8px;
}

/* Compact mode */
.compact .requests-list {
  max-height: 400px;
  overflow-y: auto;
}

.compact .request-notes {
  display: none;
}

.compact .request-card {
  padding: 12px;
}
</style>
