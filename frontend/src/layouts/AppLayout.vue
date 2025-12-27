<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBranding } from '@/composables/useBranding'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const authStore = useAuthStore()

// Initialize branding - watches organization and applies colors
useBranding()

onMounted(async () => {
  if (authStore.token && !authStore.user) {
    await authStore.fetchCurrentUser()
  }
})
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  background-color: var(--background-color);
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }
}
</style>
