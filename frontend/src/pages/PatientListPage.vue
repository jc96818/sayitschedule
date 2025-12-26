<script setup lang="ts">
import { ref } from 'vue'

const patients = ref([
  { id: '1', name: 'Emily Carter', gender: 'female', sessionFrequency: 2, requiredCertifications: ['ABA'], status: 'active' },
  { id: '2', name: 'Emilio Rodriguez', gender: 'male', sessionFrequency: 3, requiredCertifications: ['ABA', 'Pediatrics'], status: 'active' },
  { id: '3', name: 'Marcus Johnson', gender: 'male', sessionFrequency: 2, requiredCertifications: ['Speech Therapy'], status: 'active' },
  { id: '4', name: 'Lisa Wong', gender: 'female', sessionFrequency: 2, requiredCertifications: ['ABA'], status: 'active' }
])

const searchQuery = ref('')
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Patients</h2>
        <p>Manage patient records</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary">Add Patient</button>
      </div>
    </header>

    <div class="page-content">
      <div class="card">
        <div class="card-header">
          <h3>All Patients ({{ patients.length }})</h3>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Search patients..."
            style="width: 250px;"
          />
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Sessions/Week</th>
                <th>Required Certifications</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="patient in patients" :key="patient.id">
                <td>{{ patient.name }}</td>
                <td>{{ patient.gender }}</td>
                <td>{{ patient.sessionFrequency }}</td>
                <td>
                  <span v-for="cert in patient.requiredCertifications" :key="cert" class="badge badge-primary" style="margin-right: 4px;">
                    {{ cert }}
                  </span>
                </td>
                <td>
                  <span class="badge badge-success">{{ patient.status }}</span>
                </td>
                <td>
                  <RouterLink :to="`/patients/${patient.id}`" class="btn btn-sm btn-outline">View</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
