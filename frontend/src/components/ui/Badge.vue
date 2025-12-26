<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary'
})
</script>

<template>
  <span :class="['badge', `badge-${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.badge-primary {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.badge-success {
  background-color: var(--success-light);
  color: var(--success-color);
}

.badge-warning {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.badge-danger {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.badge-secondary {
  background-color: #f1f5f9;
  color: var(--text-secondary);
}
</style>
