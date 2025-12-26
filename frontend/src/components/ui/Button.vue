<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  icon?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  block: false,
  icon: false,
  disabled: false,
  loading: false,
  type: 'button'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const classes = computed(() => [
  'btn',
  `btn-${props.variant}`,
  {
    'btn-sm': props.size === 'sm',
    'btn-lg': props.size === 'lg',
    'btn-block': props.block,
    'btn-icon': props.icon,
    'btn-loading': props.loading
  }
])

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="btn-spinner"></span>
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #475569;
}

.btn-success {
  background-color: var(--success-color);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--background-color);
}

.btn-ghost {
  background-color: transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--background-color);
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

.btn-block {
  width: 100%;
}

.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
}

.btn-loading {
  position: relative;
  color: transparent;
}

.btn-spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
