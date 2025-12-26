<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  variant?: 'info' | 'success' | 'warning' | 'danger'
  dismissible?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'info',
  dismissible: false
})

const emit = defineEmits<{
  dismiss: []
}>()

const visible = ref(true)

function dismiss() {
  visible.value = false
  emit('dismiss')
}
</script>

<template>
  <div v-if="visible" :class="['alert', `alert-${variant}`]">
    <!-- Info Icon -->
    <svg v-if="variant === 'info'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <!-- Success Icon -->
    <svg v-else-if="variant === 'success'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <!-- Warning Icon -->
    <svg v-else-if="variant === 'warning'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <!-- Danger Icon -->
    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div class="alert-content">
      <slot />
    </div>
    <button v-if="dismissible" class="alert-dismiss" @click="dismiss">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.alert > svg {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.alert-content {
  flex: 1;
}

.alert-content :deep(strong) {
  font-weight: 600;
}

.alert-content :deep(a) {
  font-weight: 500;
  text-decoration: underline;
}

.alert-info {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.alert-success {
  background-color: var(--success-light);
  color: var(--success-color);
}

.alert-warning {
  background-color: var(--warning-light);
  color: #92400e;
}

.alert-danger {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.alert-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin: -4px -4px -4px 0;
  opacity: 0.7;
  color: currentColor;
}

.alert-dismiss:hover {
  opacity: 1;
}

.alert-dismiss svg {
  width: 16px;
  height: 16px;
}
</style>
