<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const patientId = route.params.id

const patient = ref({
  id: patientId,
  name: 'Emily Carter',
  gender: 'female',
  sessionFrequency: 2,
  preferredTimes: ['Morning'],
  requiredCertifications: ['ABA'],
  notes: 'Prefers quiet environment',
  status: 'active'
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>{{ patient.name }}</h2>
        <p>Patient Profile</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline">Edit Profile</button>
      </div>
    </header>

    <div class="page-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Patient Information</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Full Name</label>
              <p>{{ patient.name }}</p>
            </div>
            <div class="form-group">
              <label>Gender</label>
              <p>{{ patient.gender }}</p>
            </div>
            <div class="form-group">
              <label>Sessions per Week</label>
              <p>{{ patient.sessionFrequency }}</p>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <p>{{ patient.notes }}</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Requirements</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Required Certifications</label>
              <div>
                <span v-for="cert in patient.requiredCertifications" :key="cert" class="badge badge-primary" style="margin-right: 8px;">
                  {{ cert }}
                </span>
              </div>
            </div>
            <div class="form-group">
              <label>Preferred Times</label>
              <div>
                <span v-for="time in patient.preferredTimes" :key="time" class="badge badge-primary" style="margin-right: 8px;">
                  {{ time }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
