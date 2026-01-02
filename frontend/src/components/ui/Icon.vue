<script setup lang="ts">
import { computed } from 'vue'

type IconName =
  | 'calendar'
  | 'check'
  | 'chevronRightUp'
  | 'clock'
  | 'info'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'plus'
  | 'warning'
  | 'x'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    title?: string
  }>(),
  {
    size: 20,
    title: undefined
  }
)

const ariaHidden = computed(() => (props.title ? undefined : true))
const ariaLabel = computed(() => (props.title ? props.title : undefined))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size"
    :height="size"
    :aria-hidden="ariaHidden"
    :aria-label="ariaLabel"
    :role="title ? 'img' : undefined"
    focusable="false"
  >
    <title v-if="title">{{ title }}</title>

    <template v-if="name === 'lock'">
      <path d="M16 11V8a4 4 0 0 0-8 0v3" />
      <path d="M6.5 11h11A1.5 1.5 0 0 1 19 12.5v7A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11Z" />
    </template>

    <template v-else-if="name === 'clock'">
      <path d="M12 7v5l3 2" />
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
    </template>

    <template v-else-if="name === 'info'">
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
    </template>

    <template v-else-if="name === 'mail'">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" />
      <path d="m6.5 7 5.5 4 5.5-4" />
    </template>

    <template v-else-if="name === 'phone'">
      <path d="M9 4h6" />
      <path d="M10 4v3l1 1h2l1-1V4" />
      <path d="M8.5 9.5c2.5 6 5.5 8.5 11 10.5 1 .35 2-.3 2.25-1.35l.7-3a2 2 0 0 0-1.5-2.35l-3-.7a2 2 0 0 0-2.05.8l-.7 1c-1.9-1-3.6-2.7-4.6-4.6l1-.7a2 2 0 0 0 .8-2.05l-.7-3A2 2 0 0 0 9.35 2.5l-3 .7C5.3 3.45 4.65 4.45 5 5.45c.7 2 1.6 3.9 2.6 5.7" />
    </template>

    <template v-else-if="name === 'warning'">
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.7 1.9 19.1A2 2 0 0 0 3.6 22h16.8a2 2 0 0 0 1.7-2.9L13.7 4.7a2 2 0 0 0-3.4 0Z" />
    </template>

    <template v-else-if="name === 'calendar'">
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M4 8h16" />
      <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v12A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-12A2.5 2.5 0 0 1 6.5 5Z" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="m20 6-11 11-5-5" />
    </template>

    <template v-else-if="name === 'x'">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </template>

    <template v-else-if="name === 'chevronRightUp'">
      <path d="M7 17 17 7" />
      <path d="M10 7h7v7" />
    </template>
  </svg>
</template>
