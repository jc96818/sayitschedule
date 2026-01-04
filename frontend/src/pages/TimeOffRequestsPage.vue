<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAvailabilityStore } from '@/stores/availability'
import { Alert, Badge, Button } from '@/components/ui'
import { useLabels } from '@/composables/useLabels'
import type { StaffAvailability, AvailabilityStatus } from '@/types'

const { staffLabelSingular } = useLabels()
const availabilityStore = useAvailabilityStore()

// Filter state
const statusFilter = ref<AvailabilityStatus | 'all'>('all')
const dateRangeFilter = ref<'upcoming' | 'past' | 'all'>('all')

// Processing state for approve/reject actions
const processingId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const reviewNotes = ref<Record<string, string>>({})

// Computed
const loading = computed(() => availabilityStore.loading)
const error = computed(() => availabilityStore.error)

const filteredRequests = computed(() => {
  let requests = [...availabilityStore.allRequests]

  // Filter by status
  if (statusFilter.value !== 'all') {
    requests = requests.filter(r => r.status === statusFilter.value)
  }

  // Filter by date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (dateRangeFilter.value === 'upcoming') {
    requests = requests.filter(r => new Date(r.date) >= today)
  } else if (dateRangeFilter.value === 'past') {
    requests = requests.filter(r => new Date(r.date) < today)
  }

  // Sort by date descending (newest first), then by status (pending first)
  return requests.sort((a, b) => {
    // Pending requests first
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (b.status === 'pending' && a.status !== 'pending') return 1
    // Then by date
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
})

const pendingCount = computed(() =>
  availabilityStore.allRequests.filter(r => r.status === 'pending').length
)

const approvedCount = computed(() =>
  availabilityStore.allRequests.filter(r => r.status === 'approved').length
)

const rejectedCount = computed(() =>
  availabilityStore.allRequests.filter(r => r.status === 'rejected').length
)

// Methods
function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTimeRange(request: StaffAvailability): string {
  if (!request.startTime || !request.endTime) {
    return 'Full Day'
  }
  return `${request.startTime} - ${request.endTime}`
}

function getStatusVariant(status: AvailabilityStatus): 'warning' | 'success' | 'danger' {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    default:
      return 'warning'
  }
}

async function handleApprove(request: StaffAvailability) {
  processingId.value = request.id
  actionError.value = null

  try {
    await availabilityStore.approve(
      request.staffId,
      request.id,
      reviewNotes.value[request.id] || undefined
    )
    delete reviewNotes.value[request.id]
    // Refresh the list
    await loadRequests()
  } catch (err: unknown) {
    actionError.value = err instanceof Error ? err.message : 'Failed to approve request'
  } finally {
    processingId.value = null
  }
}

async function handleReject(request: StaffAvailability) {
  if (!reviewNotes.value[request.id]) {
    actionError.value = 'Please provide a reason for rejection'
    return
  }

  processingId.value = request.id
  actionError.value = null

  try {
    await availabilityStore.reject(
      request.staffId,
      request.id,
      reviewNotes.value[request.id]
    )
    delete reviewNotes.value[request.id]
    // Refresh the list
    await loadRequests()
  } catch (err: unknown) {
    actionError.value = err instanceof Error ? err.message : 'Failed to reject request'
  } finally {
    processingId.value = null
  }
}

async function loadRequests() {
  const params: { status?: AvailabilityStatus } = {}
  if (statusFilter.value !== 'all') {
    params.status = statusFilter.value
  }
  await availabilityStore.fetchAll(params)
}

// Watch for filter changes
watch([statusFilter], () => {
  loadRequests()
})

onMounted(() => {
  loadRequests()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Time-Off Requests</h2>
        <p>Review and manage {{ staffLabelSingular.toLowerCase() }} time-off requests</p>
      </div>
    </header>

    <div class="page-content time-off-content">
      <!-- Stats Cards -->
    <div class="stats-cards">
      <div class="stat-card pending" @click="statusFilter = 'pending'">
        <div class="stat-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ pendingCount }}</span>
          <span class="stat-label">Pending</span>
        </div>
      </div>

      <div class="stat-card approved" @click="statusFilter = 'approved'">
        <div class="stat-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ approvedCount }}</span>
          <span class="stat-label">Approved</span>
        </div>
      </div>

      <div class="stat-card rejected" @click="statusFilter = 'rejected'">
        <div class="stat-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ rejectedCount }}</span>
          <span class="stat-label">Rejected</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <label>Status:</label>
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Date Range:</label>
        <select v-model="dateRangeFilter" class="filter-select">
          <option value="all">All Dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
      </div>

      <Button
        v-if="statusFilter !== 'all' || dateRangeFilter !== 'all'"
        variant="outline"
        size="sm"
        @click="statusFilter = 'all'; dateRangeFilter = 'all'"
      >
        Clear Filters
      </Button>
    </div>

    <!-- Error Alert -->
    <Alert v-if="actionError" variant="danger" class="action-alert" dismissible @dismiss="actionError = null">
      {{ actionError }}
    </Alert>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading requests...</span>
    </div>

    <!-- Error State -->
    <Alert v-else-if="error" variant="danger">
      {{ error }}
    </Alert>

    <!-- Empty State -->
    <div v-else-if="filteredRequests.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <h3>No Requests Found</h3>
      <p v-if="statusFilter !== 'all' || dateRangeFilter !== 'all'">
        No requests match your current filters.
      </p>
      <p v-else>
        No time-off requests have been submitted yet.
      </p>
    </div>

    <!-- Requests Table -->
    <div v-else class="requests-table-container">
      <table class="requests-table">
        <thead>
          <tr>
            <th>{{ staffLabelSingular }}</th>
            <th>Date</th>
            <th>Time</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Reviewed By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="request in filteredRequests"
            :key="request.id"
            :class="{ processing: processingId === request.id }"
          >
            <td class="staff-cell">
              <span class="staff-name">{{ request.staffName || 'Unknown' }}</span>
            </td>
            <td>{{ formatDate(request.date) }}</td>
            <td>{{ formatTimeRange(request) }}</td>
            <td class="reason-cell">
              <span v-if="request.reason" class="reason-text">{{ request.reason }}</span>
              <span v-else class="no-reason">-</span>
            </td>
            <td>
              <Badge :variant="getStatusVariant(request.status)">
                {{ request.status.charAt(0).toUpperCase() + request.status.slice(1) }}
              </Badge>
            </td>
            <td class="reviewer-cell">
              <span v-if="request.reviewedById">Reviewed</span>
              <span v-else class="no-reviewer">-</span>
            </td>
            <td class="actions-cell">
              <template v-if="request.status === 'pending'">
                <div class="pending-actions">
                  <input
                    v-model="reviewNotes[request.id]"
                    type="text"
                    class="notes-input"
                    placeholder="Notes (required for rejection)"
                    :disabled="processingId === request.id"
                  />
                  <div class="action-buttons">
                    <Button
                      variant="success"
                      size="sm"
                      :loading="processingId === request.id"
                      @click="handleApprove(request)"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      :loading="processingId === request.id"
                      @click="handleReject(request)"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <span v-if="request.reviewerNotes" class="review-notes">
                  {{ request.reviewerNotes }}
                </span>
                <span v-else class="no-notes">-</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </div>
</template>

<style scoped>
.time-off-content {
  max-width: 1400px;
}

/* Stats Cards */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
}

.stat-card.pending .stat-icon {
  background: #fef3c7;
  color: #d97706;
}

.stat-card.approved .stat-icon {
  background: #d1fae5;
  color: #059669;
}

.stat-card.rejected .stat-icon {
  background: #fee2e2;
  color: #dc2626;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Filters */
.filters-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-background);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Alert */
.action-alert {
  margin-bottom: 16px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  color: var(--text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
}

/* Table */
.requests-table-container {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
}

.requests-table th,
.requests-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.requests-table th {
  background: var(--background-color);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.requests-table tbody tr {
  transition: background-color 0.2s;
}

.requests-table tbody tr:hover {
  background: var(--background-color);
}

.requests-table tbody tr.processing {
  opacity: 0.6;
  pointer-events: none;
}

.requests-table tbody tr:last-child td {
  border-bottom: none;
}

.staff-cell .staff-name {
  font-weight: 500;
  color: var(--text-primary);
}

.reason-cell {
  max-width: 200px;
}

.reason-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-reason,
.no-reviewer,
.no-notes {
  color: var(--text-muted);
}

.reviewer-cell {
  font-size: 0.875rem;
}

.actions-cell {
  min-width: 200px;
}

.pending-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notes-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--card-background);
  color: var(--text-primary);
}

.notes-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.notes-input:disabled {
  opacity: 0.6;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.review-notes {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 1024px) {
  .requests-table-container {
    overflow-x: auto;
  }

  .requests-table {
    min-width: 800px;
  }
}

@media (max-width: 640px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    flex: 1;
  }

  .filter-select {
    flex: 1;
  }
}
</style>
