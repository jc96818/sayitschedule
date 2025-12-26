<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const stats = ref({
  activeTherapists: 0,
  activePatients: 0,
  sessionsThisWeek: 0,
  conflicts: 0
})

const upcomingWeeks = ref([
  { week: 'Dec 30 - Jan 3', status: 'draft', sessions: 88, conflicts: 3 },
  { week: 'Jan 6 - Jan 10', status: 'not_started', sessions: null, conflicts: null },
  { week: 'Jan 13 - Jan 17', status: 'not_started', sessions: null, conflicts: null }
])

onMounted(async () => {
  // TODO: Fetch real stats from API
  stats.value = {
    activeTherapists: 12,
    activePatients: 48,
    sessionsThisWeek: 96,
    conflicts: 3
  }
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Dashboard</h2>
        <p>Welcome back, {{ authStore.user?.name?.split(' ')[0] }}</p>
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
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ stats.activeTherapists }}</h4>
            <p>Active Therapists</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ stats.activePatients }}</h4>
            <p>Active Patients</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon yellow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ stats.sessionsThisWeek }}</h4>
            <p>Sessions This Week</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ stats.conflicts }}</h4>
            <p>Scheduling Conflicts</p>
          </div>
        </div>
      </div>

      <!-- Alert -->
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <strong>Attention:</strong> Sarah Martinez has requested time off for Friday, January 3rd.
          <a href="#">Review availability updates</a>
        </div>
      </div>

      <div class="grid-2">
        <!-- This Week's Schedule Preview -->
        <div class="card">
          <div class="card-header">
            <h3>This Week's Schedule</h3>
            <span class="badge badge-success">Published</span>
          </div>
          <div class="card-body">
            <p class="text-muted mb-2">December 23 - 27, 2024</p>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Sessions</th>
                  <th>Therapists</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Monday</td><td>24</td><td>12</td></tr>
                <tr><td>Tuesday</td><td>24</td><td>12</td></tr>
                <tr><td>Wednesday</td><td>22</td><td>11</td></tr>
                <tr><td>Thursday</td><td>24</td><td>12</td></tr>
                <tr><td>Friday</td><td>20</td><td>10</td></tr>
              </tbody>
            </table>
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
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <RouterLink to="/schedule/generate" class="btn btn-outline" style="justify-content: flex-start;">
                Generate New Schedule
              </RouterLink>
              <RouterLink to="/rules" class="btn btn-outline" style="justify-content: flex-start;">
                Add Voice Rule
              </RouterLink>
              <RouterLink to="/staff" class="btn btn-outline" style="justify-content: flex-start;">
                Add New Staff
              </RouterLink>
              <RouterLink to="/patients" class="btn btn-outline" style="justify-content: flex-start;">
                Add New Patient
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Upcoming Weeks -->
      <div class="card mt-3">
        <div class="card-header">
          <h3>Upcoming Weeks</h3>
        </div>
        <div class="card-body">
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
              <tr v-for="week in upcomingWeeks" :key="week.week">
                <td>{{ week.week }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge-warning': week.status === 'draft',
                      'badge-secondary': week.status === 'not_started'
                    }"
                  >
                    {{ week.status === 'draft' ? 'Draft' : 'Not Started' }}
                  </span>
                </td>
                <td>{{ week.sessions ?? '-' }}</td>
                <td>
                  <span v-if="week.conflicts" class="badge badge-danger">{{ week.conflicts }}</span>
                  <span v-else>-</span>
                </td>
                <td>
                  <button v-if="week.status === 'draft'" class="btn btn-sm btn-outline">Edit</button>
                  <button v-if="week.status === 'draft'" class="btn btn-sm btn-primary" style="margin-left: 8px;">Publish</button>
                  <button v-if="week.status === 'not_started'" class="btn btn-sm btn-primary">Generate</button>
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
.badge-secondary {
  background-color: #f1f5f9;
  color: var(--text-secondary);
}
</style>
