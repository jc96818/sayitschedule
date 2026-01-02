<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { applyBranding } from '@/composables/useBranding'

const router = useRouter()
const portalStore = usePortalAuthStore()

const user = computed(() => portalStore.user)
const branding = computed(() => portalStore.branding)

// Apply branding when it changes
watch(
  branding,
  (b) => {
    if (b?.primaryColor) {
      applyBranding(b.primaryColor, b.secondaryColor)
    }
  },
  { immediate: true }
)

// Navigation items
const navItems = computed(() => {
  const items = [
    { name: 'Dashboard', route: 'portal-dashboard', icon: 'home' },
    { name: 'Appointments', route: 'portal-appointments', icon: 'calendar' }
  ]

  // Only show booking if self-booking is enabled
  if (portalStore.canBook) {
    items.push({ name: 'Book Appointment', route: 'portal-booking', icon: 'plus' })
  }

  items.push({ name: 'Settings', route: 'portal-settings', icon: 'settings' })

  return items
})

async function handleLogout() {
  await portalStore.logout()
  router.push({ name: 'portal-login' })
}

onMounted(async () => {
  // Load branding if not already loaded
  if (!portalStore.branding) {
    try {
      await portalStore.loadBranding()
    } catch {
      // Branding load failed, will use defaults
    }
  }

  // Fetch user if session cookie exists
  if (!portalStore.user) {
    await portalStore.fetchCurrentUser()
  }
})
</script>

<template>
  <div class="portal-layout">
    <!-- Header -->
    <header class="portal-header">
      <div class="header-left">
        <img
          v-if="branding?.logoUrl"
          :src="branding.logoUrl"
          :alt="branding?.organizationName"
          class="org-logo"
        />
        <span v-if="branding?.showOrgName" class="org-name">
          {{ branding?.organizationName }}
        </span>
      </div>

      <nav class="header-nav">
        <router-link
          v-for="item in navItems"
          :key="item.route"
          :to="{ name: item.route }"
          class="nav-link"
        >
          {{ item.name }}
        </router-link>
      </nav>

      <div class="header-right">
        <div class="user-menu">
          <span class="user-name">{{ user?.name }}</span>
          <button class="logout-btn" @click="handleLogout">Sign Out</button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="portal-main">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="portal-footer">
      <div class="footer-content">
        <div class="footer-left">
          <span v-if="branding?.footerText">{{ branding.footerText }}</span>
          <span v-else>&copy; {{ new Date().getFullYear() }} {{ branding?.organizationName }}</span>
        </div>
        <div class="footer-right">
          <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank" rel="noopener noreferrer" class="footer-link">
            Terms of Service
          </a>
          <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank" rel="noopener noreferrer" class="footer-link">
            Privacy Policy
          </a>
          <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`" class="footer-link">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.portal-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--background-color, #f8fafc);
}

/* Header */
.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 64px;
  background: white;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.org-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.org-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.header-nav {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  color: var(--text-secondary, #64748b);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.15s ease;
}

.nav-link:hover {
  color: var(--primary-color, #2563eb);
  background: var(--primary-light, #dbeafe);
}

.nav-link.router-link-active {
  color: var(--primary-color, #2563eb);
  background: var(--primary-light, #dbeafe);
}

.header-right {
  display: flex;
  align-items: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;
}

.logout-btn:hover {
  background: var(--danger-light, #fee2e2);
  border-color: var(--danger-color, #ef4444);
  color: var(--danger-color, #ef4444);
}

/* Main Content */
.portal-main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* Footer */
.portal-footer {
  background: white;
  border-top: 1px solid var(--border-color, #e2e8f0);
  padding: 1rem 1.5rem;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
}

.footer-right {
  display: flex;
  gap: 1.5rem;
}

.footer-link {
  color: var(--text-secondary, #64748b);
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.15s ease;
}

.footer-link:hover {
  color: var(--primary-color, #2563eb);
}

/* Responsive */
@media (max-width: 768px) {
  .portal-header {
    flex-wrap: wrap;
    height: auto;
    padding: 1rem;
    gap: 1rem;
  }

  .header-nav {
    order: 3;
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .nav-link {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .portal-main {
    padding: 1rem;
  }

  .footer-content {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
}
</style>
