<script setup lang="ts">
import Toggle from './Toggle.vue'

interface Props {
  title: string
  description: string
  category: 'gender_pairing' | 'session' | 'availability' | 'specific_pairing' | 'certification'
  isActive: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  edit: []
  delete: []
}>()

const categoryColors = {
  gender_pairing: 'blue',
  session: 'green',
  availability: 'yellow',
  specific_pairing: 'purple',
  certification: 'red'
}
</script>

<template>
  <div class="rule-item">
    <div :class="['rule-icon', categoryColors[category]]">
      <!-- Users Icon -->
      <svg v-if="category === 'gender_pairing'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <!-- Clock Icon -->
      <svg v-else-if="category === 'session'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <!-- Calendar Icon -->
      <svg v-else-if="category === 'availability'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <!-- Link Icon -->
      <svg v-else-if="category === 'specific_pairing'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <!-- Badge Icon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    </div>
    <div class="rule-content">
      <h4>{{ title }}</h4>
      <p>{{ description }}</p>
    </div>
    <div class="rule-actions">
      <Toggle :model-value="isActive" @update:model-value="emit('toggle')" />
      <button class="action-btn" title="Edit" @click="emit('edit')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button class="action-btn danger" title="Delete" @click="emit('delete')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rule-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  background-color: var(--card-background);
  transition: border-color 0.2s;
}

.rule-item:hover {
  border-color: var(--primary-color);
}

.rule-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rule-icon svg {
  width: 20px;
  height: 20px;
}

.rule-icon.blue {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.rule-icon.green {
  background-color: var(--success-light);
  color: var(--success-color);
}

.rule-icon.yellow {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.rule-icon.purple {
  background-color: #ede9fe;
  color: #7c3aed;
}

.rule-icon.red {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.rule-content {
  flex: 1;
  min-width: 0;
}

.rule-content h4 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 4px 0;
  color: var(--text-primary);
}

.rule-content p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background-color: var(--background-color);
  color: var(--text-primary);
}

.action-btn.danger:hover {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.action-btn svg {
  width: 18px;
  height: 18px;
}
</style>
