<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  totalItems?: number
  perPage?: number
}

const props = withDefaults(defineProps<Props>(), {
  perPage: 20
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const displayRange = computed(() => {
  if (!props.totalItems) return ''
  const start = (props.currentPage - 1) * props.perPage + 1
  const end = Math.min(props.currentPage * props.perPage, props.totalItems)
  return `${start}-${end} of ${props.totalItems}`
})

const pages = computed(() => {
  const items: (number | string)[] = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      items.push(i)
    }
  } else {
    items.push(1)
    if (current > 3) {
      items.push('...')
    }
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      items.push(i)
    }
    if (current < total - 2) {
      items.push('...')
    }
    items.push(total)
  }

  return items
})

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('update:currentPage', page)
  }
}
</script>

<template>
  <div class="pagination">
    <span v-if="displayRange" class="pagination-info">{{ displayRange }}</span>
    <div class="pagination-controls">
      <button
        class="pagination-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <template v-for="(page, index) in pages" :key="index">
        <span v-if="page === '...'" class="pagination-ellipsis">...</span>
        <button
          v-else
          :class="['pagination-btn', 'pagination-page', { active: page === currentPage }]"
          @click="goToPage(page as number)"
        >
          {{ page }}
        </button>
      </template>
      <button
        class="pagination-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: white;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--background-color);
  border-color: var(--primary-color);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.pagination-btn svg {
  width: 16px;
  height: 16px;
}

.pagination-ellipsis {
  padding: 0 8px;
  color: var(--text-secondary);
}
</style>
