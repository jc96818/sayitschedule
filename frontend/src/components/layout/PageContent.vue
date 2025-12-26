<script setup lang="ts">
</script>

<template>
  <div class="page-content">
    <slot />
  </div>
</template>

<style scoped>
.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
</style>
