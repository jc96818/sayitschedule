<script setup lang="ts">
import type { SessionStatus } from '@/types'

interface Props {
  status: SessionStatus
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

// Status display configuration
const statusConfig: Record<SessionStatus, { label: string; variant: string; icon: string }> = {
  scheduled: {
    label: 'Scheduled',
    variant: 'secondary',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'primary',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  checked_in: {
    label: 'Checked In',
    variant: 'info',
    icon: 'M5 13l4 4L19 7'
  },
  in_progress: {
    label: 'In Progress',
    variant: 'warning',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  completed: {
    label: 'Completed',
    variant: 'success',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'danger',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  late_cancel: {
    label: 'Late Cancel',
    variant: 'danger-dark',
    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  no_show: {
    label: 'No Show',
    variant: 'danger',
    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
  }
}

const config = statusConfig[props.status] || statusConfig.scheduled
</script>

<template>
  <span :class="['session-status-badge', `variant-${config.variant}`, `size-${size}`]">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      class="status-icon"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        :d="config.icon"
      />
    </svg>
    <span class="status-label">{{ config.label }}</span>
  </span>
</template>

<style scoped>
.session-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-weight: 500;
  white-space: nowrap;
}

.status-icon {
  flex-shrink: 0;
}

/* Sizes */
.size-sm {
  font-size: 11px;
  padding: 2px 8px;
}

.size-sm .status-icon {
  width: 12px;
  height: 12px;
}

.size-md {
  font-size: 12px;
}

.size-md .status-icon {
  width: 14px;
  height: 14px;
}

.size-lg {
  font-size: 14px;
  padding: 6px 14px;
}

.size-lg .status-icon {
  width: 18px;
  height: 18px;
}

/* Variants */
.variant-secondary {
  background-color: #f1f5f9;
  color: var(--text-secondary);
}

.variant-primary {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.variant-info {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.variant-warning {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

.variant-success {
  background-color: var(--success-light);
  color: var(--success-color);
}

.variant-danger {
  background-color: var(--danger-light);
  color: var(--danger-color);
}

.variant-danger-dark {
  background-color: #fecaca;
  color: #991b1b;
}
</style>
