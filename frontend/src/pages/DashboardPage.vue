<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStaffStore } from '@/stores/staff'
import { usePatientsStore } from '@/stores/patients'
import { useSchedulesStore } from '@/stores/schedules'
import { useAvailabilityStore } from '@/stores/availability'
import { StatCard, Badge, Button, Alert } from '@/components/ui'
import { PendingRequestsPanel } from '@/components/availability'

const router = useRouter()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const patientsStore = usePatientsStore()
const schedulesStore = useSchedulesStore()
const availabilityStore = useAvailabilityStore()

const loading = ref(true)

const isAdmin = computed(() => {
  const role = authStore.user?.role
  return role === 'admin' || role === 'admin_assistant' || role === 'super_admin'
})

const pendingRequestsCount = computed(() => availabilityStore.pendingRequests.length)

const stats = computed(() => ({
  activeTherapists: staffStore.totalCount,
  activePatients: patientsStore.totalCount,
  sessionsThisWeek: schedulesStore.currentWeekSchedule?.sessions?.length || 0,
  conflicts: 0 // TODO: Calculate from sessions
}))

const currentWeekSchedule = computed(() => schedulesStore.currentWeekSchedule)

const upcomingWeeks = computed(() => {
  const weeks = []
  const today = new Date()

  for (let i = 1; i <= 3; i++) {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (i * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 4)

    const weekStr = weekStart.toISOString().split('T')[0]
    const schedule = schedulesStore.schedules.find(s => s.weekStartDate === weekStr)

    weeks.push({
      weekStart: weekStr,
      weekLabel: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
      status: schedule?.status || 'not_started',
      sessions: schedule?.sessions?.length || null,
      conflicts: 0
    })
  }

  return weeks
})

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'secondary' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'warning'
  return 'secondary'
}

function getStatusLabel(status: string): string {
  if (status === 'published') return 'Published'
  if (status === 'draft') return 'Draft'
  return 'Not Started'
}

async function handlePublishSchedule(scheduleId: string) {
  await schedulesStore.publishSchedule(scheduleId)
}

function handleGenerateSchedule(_weekStart: string) {
  router.push('/schedule/generate')
}

onMounted(async () => {
  loading.value = true
  const fetchPromises = [
    staffStore.fetchStaff(),
    patientsStore.fetchPatients(),
    schedulesStore.fetchSchedules()
  ]
  // Fetch pending requests for admins
  if (isAdmin.value) {
    fetchPromises.push(availabilityStore.fetchPending())
  }
  await Promise.all(fetchPromises)
  loading.value = false
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Dashboard</h2>
        <p>Welcome back, {{ authStore.user?.name?.split(' ')[0] || 'User' }}</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/schedule/generate" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Generate Schedule
        </RouterLink>
      </div>
    </header>

    <div class="page-content">
      <!-- Stats -->
      <div class="stats-grid">
        <StatCard
          :value="stats.activeTherapists"
          label="Active Therapists"
          icon="users"
          color="blue"
        />
        <StatCard
          :value="stats.activePatients"
          label="Active Patients"
          icon="patients"
          color="green"
        />
        <StatCard
          :value="stats.sessionsThisWeek"
          label="Sessions This Week"
          icon="calendar"
          color="yellow"
        />
        <StatCard
          :value="stats.conflicts"
          label="Scheduling Conflicts"
          icon="alert"
          :color="stats.conflicts > 0 ? 'red' : 'green'"
        />
      </div>

      <!-- Alert for pending actions -->
      <Alert v-if="stats.conflicts > 0" variant="warning" class="mt-3">
        <strong>Attention:</strong> There are {{ stats.conflicts }} scheduling conflicts that need your attention.
        <RouterLink to="/schedule" style="margin-left: 8px;">Review now</RouterLink>
      </Alert>

      <div class="grid-2 mt-3">
        <!-- This Week's Schedule Preview -->
        <div class="card">
          <div class="card-header">
            <h3>This Week's Schedule</h3>
            <Badge
              v-if="currentWeekSchedule"
              :variant="getStatusBadgeVariant(currentWeekSchedule.status)"
            >
              {{ getStatusLabel(currentWeekSchedule.status) }}
            </Badge>
            <Badge v-else variant="secondary">No Schedule</Badge>
          </div>
          <div class="card-body">
            <div v-if="loading" class="text-center text-muted">
              Loading...
            </div>
            <div v-else-if="!currentWeekSchedule" class="text-center">
              <p class="text-muted mb-2">No schedule generated for this week.</p>
              <RouterLink to="/schedule/generate" class="btn btn-primary btn-sm">
                Generate Schedule
              </RouterLink>
            </div>
            <div v-else>
              <p class="text-muted mb-2">
                {{ currentWeekSchedule.weekStartDate }}
              </p>
              <div class="schedule-summary">
                <div class="summary-row">
                  <span>Total Sessions</span>
                  <strong>{{ currentWeekSchedule.sessions?.length || 0 }}</strong>
                </div>
                <div class="summary-row">
                  <span>Therapists</span>
                  <strong>{{ stats.activeTherapists }}</strong>
                </div>
                <div class="summary-row">
                  <span>Patients</span>
                  <strong>{{ stats.activePatients }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/schedule">View Full Schedule</RouterLink>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div class="card-body">
            <div class="quick-actions">
              <RouterLink to="/schedule/generate" class="btn btn-outline quick-action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate New Schedule
              </RouterLink>
              <RouterLink to="/rules" class="btn btn-outline quick-action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Add Voice Rule
              </RouterLink>
              <RouterLink to="/staff" class="btn btn-outline quick-action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add New Staff
              </RouterLink>
              <RouterLink to="/patients" class="btn btn-outline quick-action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add New Patient
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Time Off Requests (Admin only) -->
      <div v-if="isAdmin && pendingRequestsCount > 0" class="mt-3">
        <PendingRequestsPanel compact />
      </div>

      <!-- Upcoming Weeks -->
      <div class="card mt-3">
        <div class="card-header">
          <h3>Upcoming Weeks</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Status</th>
                <th>Sessions</th>
                <th>Conflicts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="week in upcomingWeeks" :key="week.weekStart">
                <td>{{ week.weekLabel }}</td>
                <td>
                  <Badge :variant="getStatusBadgeVariant(week.status)">
                    {{ getStatusLabel(week.status) }}
                  </Badge>
                </td>
                <td>{{ week.sessions ?? '-' }}</td>
                <td>
                  <Badge v-if="week.conflicts > 0" variant="danger">{{ week.conflicts }}</Badge>
                  <span v-else>-</span>
                </td>
                <td>
                  <template v-if="week.status === 'draft'">
                    <RouterLink :to="`/schedule`" class="btn btn-sm btn-outline">Edit</RouterLink>
                    <Button
                      size="sm"
                      variant="primary"
                      style="margin-left: 8px;"
                      @click="handlePublishSchedule(week.weekStart)"
                    >
                      Publish
                    </Button>
                  </template>
                  <Button
                    v-else-if="week.status === 'not_started'"
                    size="sm"
                    variant="primary"
                    @click="handleGenerateSchedule(week.weekStart)"
                  >
                    Generate
                  </Button>
                  <RouterLink
                    v-else
                    :to="`/schedule`"
                    class="btn btn-sm btn-outline"
                  >
                    View
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.schedule-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.summary-row:last-child {
  border-bottom: none;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-action-btn {
  justify-content: flex-start;
  gap: 12px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid,
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
