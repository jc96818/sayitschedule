<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const user = computed(() => authStore.user)

const userInitials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

async function logout() {
  await authStore.logout()
  window.location.href = '/login'
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
      <div class="sidebar-header" style="border-color: rgba(255,255,255,0.1);">
        <h1 style="color: white;">Say It Schedule</h1>
        <span style="color: rgba(255,255,255,0.6);">Super Admin</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title" style="color: rgba(255,255,255,0.5);">Platform</div>
          <RouterLink
            to="/super-admin"
            class="nav-item"
            :class="{ active: route.path === '/super-admin' }"
            style="color: rgba(255,255,255,0.8);"
          >
            Organizations
          </RouterLink>
          <RouterLink
            to="/super-admin/users"
            class="nav-item"
            :class="{ active: route.path === '/super-admin/users' }"
            style="color: rgba(255,255,255,0.8);"
          >
            Super Admins
          </RouterLink>
          <RouterLink
            to="/super-admin/baa"
            class="nav-item"
            :class="{ active: route.path === '/super-admin/baa' }"
            style="color: rgba(255,255,255,0.8);"
          >
            BAA Management
          </RouterLink>
          <RouterLink
            to="/super-admin/leads"
            class="nav-item"
            :class="{ active: route.path === '/super-admin/leads' }"
            style="color: rgba(255,255,255,0.8);"
          >
            Leads
          </RouterLink>
          <RouterLink
            to="/super-admin/templates"
            class="nav-item"
            :class="{ active: route.path === '/super-admin/templates' }"
            style="color: rgba(255,255,255,0.8);"
          >
            Templates
          </RouterLink>
        </div>
        <div class="nav-section">
          <div class="nav-section-title" style="color: rgba(255,255,255,0.5);">Account</div>
          <RouterLink
            to="/super-admin/account"
            class="nav-item"
            :class="{ active: route.path === '/super-admin/account' }"
            style="color: rgba(255,255,255,0.8);"
          >
            Settings
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer" style="border-color: rgba(255,255,255,0.1);">
        <div class="user-info">
          <div class="user-avatar" style="background: rgba(255,255,255,0.1); color: white;">{{ userInitials }}</div>
          <div class="user-details">
            <div class="user-name" style="color: white;">{{ user?.name }}</div>
            <div class="user-role" style="color: rgba(255,255,255,0.6);">Super Admin</div>
          </div>
          <button class="btn btn-ghost btn-icon" title="Logout" style="color: white;" @click="logout">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: white !important;
}

.nav-item.active {
  background-color: rgba(59, 130, 246, 0.3) !important;
  border-right-color: #3b82f6 !important;
  color: white !important;
  font-weight: 600;
}

.nav-item.active:hover {
  background-color: rgba(59, 130, 246, 0.4) !important;
}
</style>
