<script setup lang="ts">
import { ref } from 'vue'

const users = ref([
  { id: '1', name: 'Jane Connor', email: 'jane@example.com', role: 'admin', lastLogin: '2024-12-26' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'admin_assistant', lastLogin: '2024-12-25' },
  { id: '3', name: 'Sarah Martinez', email: 'sarah@example.com', role: 'staff', lastLogin: '2024-12-24' }
])
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Users</h2>
        <p>Manage user accounts</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary">Add User</button>
      </div>
    </header>

    <div class="page-content">
      <div class="card">
        <div class="card-header">
          <h3>All Users ({{ users.length }})</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <span class="badge badge-primary">{{ user.role.replace('_', ' ') }}</span>
                </td>
                <td>{{ user.lastLogin }}</td>
                <td>
                  <button class="btn btn-sm btn-outline">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
