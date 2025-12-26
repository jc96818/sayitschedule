<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const staffId = route.params.id

const staff = ref({
  id: staffId,
  name: 'Sarah Martinez',
  gender: 'female',
  email: 'sarah.martinez@example.com',
  phone: '(555) 123-4567',
  certifications: ['ABA', 'Pediatrics'],
  hireDate: '2023-03-15',
  status: 'active'
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>{{ staff.name }}</h2>
        <p>Staff Profile</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline">Edit Profile</button>
      </div>
    </header>

    <div class="page-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Personal Information</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Full Name</label>
              <p>{{ staff.name }}</p>
            </div>
            <div class="form-group">
              <label>Gender</label>
              <p>{{ staff.gender }}</p>
            </div>
            <div class="form-group">
              <label>Email</label>
              <p>{{ staff.email }}</p>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <p>{{ staff.phone }}</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Certifications</h3>
          </div>
          <div class="card-body">
            <span v-for="cert in staff.certifications" :key="cert" class="badge badge-primary" style="margin-right: 8px;">
              {{ cert }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
