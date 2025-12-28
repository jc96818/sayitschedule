import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { consumeAuthTokenFromUrl, getSubdomain, isAdminSubdomain, buildSubdomainUrl } from '@/utils/subdomain'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/schedule/:id/print',
    name: 'schedule-print',
    component: () => import('@/pages/SchedulePrintPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue')
      },
      {
        path: 'schedule',
        name: 'schedule',
        component: () => import('@/pages/SchedulePage.vue')
      },
      {
        path: 'schedule/generate',
        name: 'schedule-generate',
        component: () => import('@/pages/ScheduleGeneratePage.vue')
      },
      {
        path: 'rules',
        name: 'rules',
        component: () => import('@/pages/RulesPage.vue')
      },
      {
        path: 'staff',
        name: 'staff',
        component: () => import('@/pages/StaffListPage.vue')
      },
      {
        path: 'staff/:id',
        name: 'staff-profile',
        component: () => import('@/pages/StaffProfilePage.vue')
      },
      {
        path: 'patients',
        name: 'patients',
        component: () => import('@/pages/PatientListPage.vue')
      },
      {
        path: 'patients/:id',
        name: 'patient-profile',
        component: () => import('@/pages/PatientProfilePage.vue')
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('@/pages/RoomsListPage.vue')
      },
      {
        path: 'rooms/:id',
        name: 'room-profile',
        component: () => import('@/pages/RoomProfilePage.vue')
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/pages/UsersPage.vue')
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue')
      },
      {
        path: 'account',
        name: 'account',
        component: () => import('@/pages/AccountSettingsPage.vue')
      }
    ]
  },
  {
    path: '/super-admin',
    component: () => import('@/layouts/SuperAdminLayout.vue'),
    meta: { requiresAuth: true, requiresSuperAdmin: true },
    children: [
      {
        path: '',
        name: 'super-admin-dashboard',
        component: () => import('@/pages/SuperAdminDashboardPage.vue')
      },
      {
        path: 'organizations/:id',
        name: 'organization-edit',
        component: () => import('@/pages/OrganizationEditPage.vue')
      },
      {
        path: 'users',
        name: 'super-admin-users',
        component: () => import('@/pages/SuperAdminUsersPage.vue')
      },
      {
        path: 'account',
        name: 'super-admin-account',
        component: () => import('@/pages/AccountSettingsPage.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  // First, check for auth token in URL (cross-subdomain transfer)
  const transferredToken = consumeAuthTokenFromUrl()

  const token = transferredToken || localStorage.getItem('token')

  // Redirect to login if auth required but no token
  if (to.meta.requiresAuth && !token) {
    next({ name: 'login' })
    return
  }

  // Redirect to dashboard if already logged in and going to login
  if (to.name === 'login' && token) {
    next({ name: 'dashboard' })
    return
  }

  // For authenticated routes, validate subdomain matches user's organization
  if (to.meta.requiresAuth && token) {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Ensure user data is loaded
    if (!authStore.user) {
      try {
        await authStore.fetchCurrentUser()
      } catch {
        // Token invalid, redirect to login
        localStorage.removeItem('token')
        next({ name: 'login' })
        return
      }
    }

    const currentSubdomain = getSubdomain()
    const isOnAdminSubdomain = isAdminSubdomain()

    // Superadmin validation
    if (authStore.isSuperAdmin) {
      // Superadmins should be on admin subdomain for super-admin routes
      if (to.meta.requiresSuperAdmin && !isOnAdminSubdomain) {
        // Redirect to admin subdomain
        const redirectUrl = buildSubdomainUrl('admin', to.fullPath, token)
        window.location.href = redirectUrl
        return
      }
    } else {
      // Non-superadmin users
      const userOrgSubdomain = authStore.organization?.subdomain

      // Check if user is on the wrong subdomain
      if (userOrgSubdomain && currentSubdomain && currentSubdomain !== userOrgSubdomain) {
        // User is on wrong org subdomain - redirect to their org
        const redirectUrl = buildSubdomainUrl(userOrgSubdomain, to.fullPath, token)
        window.location.href = redirectUrl
        return
      }

      // Non-superadmin trying to access superadmin routes
      if (to.meta.requiresSuperAdmin) {
        next({ name: 'dashboard' })
        return
      }
    }
  }

  // Check superadmin requirement (legacy check, kept for safety)
  if (to.meta.requiresSuperAdmin) {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    if (!authStore.isSuperAdmin) {
      next({ name: 'dashboard' })
      return
    }
  }

  next()
})

export default router
