<script setup lang="ts">
import { ref } from 'vue'

const staff = ref([
  { id: '1', name: 'Sarah Martinez', gender: 'female', email: 'sarah@example.com', certifications: ['ABA', 'Pediatrics'], status: 'active' },
  { id: '2', name: 'Ethan Williams', gender: 'male', email: 'ethan@example.com', certifications: ['ABA'], status: 'active' },
  { id: '3', name: 'Amanda Chen', gender: 'female', email: 'amanda@example.com', certifications: ['Speech Therapy'], status: 'active' },
  { id: '4', name: 'John Davis', gender: 'male', email: 'john@example.com', certifications: ['ABA', 'OT'], status: 'active' }
])

const searchQuery = ref('')
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Staff</h2>
        <p>Manage therapists and staff members</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary">Add Staff</button>
      </div>
    </header>

    <div class="page-content">
      <div class="card">
        <div class="card-header">
          <h3>All Staff ({{ staff.length }})</h3>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Search staff..."
            style="width: 250px;"
          />
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Email</th>
                <th>Certifications</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in staff" :key="member.id">
                <td>{{ member.name }}</td>
                <td>{{ member.gender }}</td>
                <td>{{ member.email }}</td>
                <td>
                  <span v-for="cert in member.certifications" :key="cert" class="badge badge-primary" style="margin-right: 4px;">
                    {{ cert }}
                  </span>
                </td>
                <td>
                  <span class="badge badge-success">{{ member.status }}</span>
                </td>
                <td>
                  <RouterLink :to="`/staff/${member.id}`" class="btn btn-sm btn-outline">View</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
