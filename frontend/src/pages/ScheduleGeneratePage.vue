<script setup lang="ts">
import { ref } from 'vue'

const selectedWeek = ref('')
const generating = ref(false)
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Generate Schedule</h2>
        <p>Create a new AI-powered schedule</p>
      </div>
    </header>

    <div class="page-content">
      <div class="card">
        <div class="card-header">
          <h3>Schedule Configuration</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>Select Week</label>
            <input v-model="selectedWeek" type="week" class="form-control" />
          </div>
          <button class="btn btn-primary" :disabled="!selectedWeek || generating">
            {{ generating ? 'Generating...' : 'Generate Schedule' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
