<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const organization = computed(() => authStore.organization)

const userInitials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const navItems = [
  { name: 'Dashboard', path: '/', icon: 'home' },
  { name: 'Schedule', path: '/schedule', icon: 'calendar' },
  { name: 'Rules', path: '/rules', icon: 'rules' },
  { name: 'Staff', path: '/staff', icon: 'staff' },
  { name: 'Patients', path: '/patients', icon: 'patients' }
]

const adminItems = [
  { name: 'Settings', path: '/settings', icon: 'settings' },
  { name: 'Users', path: '/users', icon: 'users' }
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

async function logout() {
  await authStore.logout()
  window.location.href = '/login'
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>Say It Schedule</h1>
        <span>{{ organization?.subdomain || 'sayitschedule' }}.com</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Main</div>
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <component :is="'Icon' + item.icon" />
            {{ item.name }}
          </RouterLink>
        </div>

        <div v-if="authStore.canManageUsers" class="nav-section">
          <div class="nav-section-title">Admin</div>
          <RouterLink
            v-for="item in adminItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            {{ item.name }}
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ userInitials }}</div>
          <div class="user-details">
            <div class="user-name">{{ user?.name }}</div>
            <div class="user-role">{{ user?.role?.replace('_', ' ') }}</div>
          </div>
          <button class="btn btn-ghost btn-icon" title="Logout" @click="logout">
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
