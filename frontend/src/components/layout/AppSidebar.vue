<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { buildSubdomainUrl, getSubdomain } from '@/utils/subdomain'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const organization = computed(() => authStore.organization)

// SuperAdmin viewing an organization context (on an org subdomain, not admin subdomain)
const isSuperAdminInOrgContext = computed(() => {
  const subdomain = getSubdomain()
  return authStore.isSuperAdmin && subdomain !== null && subdomain !== 'admin'
})

function handleBackToSuperAdmin() {
  const token = authStore.token
  if (token) {
    window.location.href = buildSubdomainUrl('admin', '/super-admin', token)
  }
}

const userInitials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const roleLabel = computed(() => {
  const roles: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    admin_assistant: 'Admin Assistant',
    staff: 'Staff'
  }
  return roles[user.value?.role || ''] || 'User'
})

interface NavItem {
  name: string
  path: string
  icon: string
  roles?: string[]
  showWhen?: () => boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation = computed<NavSection[]>(() => {
  const sections: NavSection[] = [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', path: '/app', icon: 'home' },
        { name: 'Schedule', path: '/app/schedule', icon: 'calendar' }
      ]
    },
    {
      title: 'Management',
      items: [
        { name: 'Rules', path: '/app/rules', icon: 'adjustments' },
        { name: 'Staff', path: '/app/staff', icon: 'users' },
        { name: 'Patients', path: '/app/patients', icon: 'user-group' },
        { name: 'Rooms', path: '/app/rooms', icon: 'building' }
      ]
    },
    {
      title: 'Admin',
      items: [
        { name: 'Settings', path: '/app/settings', icon: 'cog', roles: ['admin', 'super_admin'] },
        { name: 'Data Management', path: '/app/data-management', icon: 'database', roles: ['admin', 'super_admin'] },
        { name: 'Users', path: '/app/users', icon: 'lock', roles: ['admin', 'super_admin'] },
        { name: 'HIPAA BAA', path: '/app/baa', icon: 'shield', roles: ['admin', 'super_admin'], showWhen: () => organization.value?.requiresHipaa === true }
      ]
    },
    {
      title: 'Account',
      items: [
        { name: 'My Account', path: '/app/account', icon: 'user-circle' }
      ]
    }
  ]

  // Filter items based on user role and showWhen condition
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // Check role restriction
        if (item.roles && !item.roles.includes(user.value?.role || '')) {
          return false
        }
        // Check showWhen condition
        if (item.showWhen && !item.showWhen()) {
          return false
        }
        return true
      })
    }))
    .filter((section) => section.items.length > 0)
})

function isActive(path: string): boolean {
  if (path === '/app') {
    return route.path === '/app'
  }
  return route.path.startsWith(path)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar">
    <!-- SuperAdmin context banner -->
    <a v-if="isSuperAdminInOrgContext" href="#" class="super-admin-banner" @click.prevent="handleBackToSuperAdmin">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Back to Super Admin</span>
    </a>

    <div class="sidebar-header">
      <img
        v-if="organization?.logoUrl"
        :src="organization.logoUrl"
        :alt="organization.name"
        class="org-logo"
      />
      <h1 class="org-name">{{ organization?.name || 'Say It Schedule' }}</h1>
    </div>

    <nav class="sidebar-nav">
      <div v-for="section in navigation" :key="section.title" class="nav-section">
        <div class="nav-section-title">{{ section.title }}</div>
        <RouterLink
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          :class="['nav-item', { active: isActive(item.path) }]"
        >
          <!-- Home Icon -->
          <svg v-if="item.icon === 'home'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <!-- Calendar Icon -->
          <svg v-else-if="item.icon === 'calendar'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <!-- Adjustments Icon -->
          <svg v-else-if="item.icon === 'adjustments'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <!-- Users Icon -->
          <svg v-else-if="item.icon === 'users'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <!-- User Group Icon -->
          <svg v-else-if="item.icon === 'user-group'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <!-- Cog Icon -->
          <svg v-else-if="item.icon === 'cog'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <!-- Lock Icon -->
          <svg v-else-if="item.icon === 'lock'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <!-- Building Icon -->
          <svg v-else-if="item.icon === 'building'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <!-- User Circle Icon -->
          <svg v-else-if="item.icon === 'user-circle'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <!-- Database Icon -->
          <svg v-else-if="item.icon === 'database'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <!-- Shield Icon -->
          <svg v-else-if="item.icon === 'shield'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {{ item.name }}
        </RouterLink>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">{{ userInitials }}</div>
        <div class="user-details">
          <div class="user-name">{{ user?.name || 'User' }}</div>
          <div class="user-role">{{ roleLabel }}</div>
        </div>
        <button class="btn btn-ghost btn-icon" title="Logout" @click="handleLogout">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background-color: var(--card-background);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.super-admin-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background-color: var(--primary-color);
  color: white;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
}

.super-admin-banner:hover {
  background-color: var(--primary-dark, #1e40af);
  text-decoration: none;
}

.super-admin-banner svg {
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 4px solid var(--primary-color);
  text-align: center;
}

.org-logo {
  max-width: 120px;
  max-height: 48px;
  margin-bottom: 12px;
  object-fit: contain;
}

.org-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0;
  line-height: 1.3;
  /* Allow wrapping for long names, but limit to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section-title {
  padding: 0 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: var(--text-secondary);
  transition: all 0.2s;
  cursor: pointer;
  text-decoration: none;
}

.nav-item:hover {
  background-color: var(--background-color);
  color: var(--text-primary);
  text-decoration: none;
}

.nav-item.active {
  background-color: var(--primary-light);
  color: var(--primary-color);
  border-right: 3px solid var(--primary-color);
}

.nav-item svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-light);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-ghost {
  background-color: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-ghost:hover {
  background-color: var(--background-color);
  color: var(--text-primary);
}

.btn-icon {
  width: 36px;
  height: 36px;
}
</style>
