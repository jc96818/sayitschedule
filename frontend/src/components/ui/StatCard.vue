<script setup lang="ts">
interface Props {
  value: number | string
  label: string
  icon?: 'users' | 'patients' | 'calendar' | 'alert' | 'check'
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

withDefaults(defineProps<Props>(), {
  icon: 'users',
  color: 'blue'
})
</script>

<template>
  <div class="stat-card">
    <div :class="['stat-icon', color]">
      <!-- Users Icon -->
      <svg v-if="icon === 'users'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <!-- Patients Icon -->
      <svg v-else-if="icon === 'patients'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <!-- Calendar Icon -->
      <svg v-else-if="icon === 'calendar'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <!-- Alert Icon -->
      <svg v-else-if="icon === 'alert'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <!-- Check Icon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div class="stat-content">
      <h4>{{ value }}</h4>
      <p>{{ label }}</p>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background-color: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-icon.blue {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.stat-icon.green {
  background-color: var(--success-light);
  color: var(--success-color);
}

.stat-icon.yellow {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.stat-icon.red {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.stat-content h4 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-primary);
}

.stat-content p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}
</style>
