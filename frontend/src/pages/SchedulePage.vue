<script setup lang="ts">
import { ref } from 'vue'

const currentWeek = ref('December 23 - 27, 2024')
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Schedule</h2>
        <p>{{ currentWeek }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline">Export PDF</button>
        <RouterLink to="/schedule/generate" class="btn btn-primary">Generate New</RouterLink>
      </div>
    </header>

    <div class="page-content">
      <div class="card">
        <div class="card-header">
          <h3>Weekly Schedule</h3>
          <span class="badge badge-success">Published</span>
        </div>
        <div class="card-body">
          <p class="text-muted">Schedule calendar view will be implemented here.</p>
        </div>
      </div>
    </div>
  </div>
</template>
