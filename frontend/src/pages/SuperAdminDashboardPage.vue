<script setup lang="ts">
import { ref } from 'vue'

const organizations = ref([
  { id: '1', name: 'Project Hope', subdomain: 'projecthope', status: 'active', users: 5, staff: 12, patients: 48, createdAt: '2024-01-15' },
  { id: '2', name: 'Sunny Side Therapy', subdomain: 'sunnyside', status: 'active', users: 3, staff: 8, patients: 32, createdAt: '2024-02-20' },
  { id: '3', name: 'Care Connect', subdomain: 'careconnect', status: 'inactive', users: 2, staff: 5, patients: 15, createdAt: '2024-03-10' }
])

const showCreateModal = ref(false)
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Super Admin Dashboard</h2>
        <p>Manage all organizations</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="showCreateModal = true">Create Organization</button>
      </div>
    </header>

    <div class="page-content">
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ organizations.length }}</h4>
            <p>Total Organizations</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ organizations.filter(o => o.status === 'active').length }}</h4>
            <p>Active Organizations</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon yellow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ organizations.reduce((sum, o) => sum + o.staff, 0) }}</h4>
            <p>Total Staff</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <h4>{{ organizations.reduce((sum, o) => sum + o.patients, 0) }}</h4>
            <p>Total Patients</p>
          </div>
        </div>
      </div>

      <!-- Organizations Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Organizations</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Users</th>
                <th>Staff</th>
                <th>Patients</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="org in organizations" :key="org.id">
                <td><strong>{{ org.name }}</strong></td>
                <td>{{ org.subdomain }}.sayitschedule.com</td>
                <td>
                  <span class="badge" :class="org.status === 'active' ? 'badge-success' : 'badge-danger'">
                    {{ org.status }}
                  </span>
                </td>
                <td>{{ org.users }}</td>
                <td>{{ org.staff }}</td>
                <td>{{ org.patients }}</td>
                <td>{{ org.createdAt }}</td>
                <td>
                  <RouterLink :to="`/super-admin/organizations/${org.id}`" class="btn btn-sm btn-outline">Edit</RouterLink>
                  <button class="btn btn-sm btn-primary" style="margin-left: 8px;">Enter</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
