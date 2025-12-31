import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { consumeAuthTokenFromUrl, getSubdomain, isAdminSubdomain, buildSubdomainUrl } from '@/utils/subdomain'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/pages/LandingPage.vue'),
    meta: { requiresAuth: false, isPublic: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/setup-password',
    name: 'setup-password',
    component: () => import('@/pages/SetupPasswordPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/pages/ForgotPasswordPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/mfa-setup',
    name: 'mfa-setup',
    component: () => import('@/pages/FirstTimeMfaSetupPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/app/schedule/:id/print',
    name: 'schedule-print',
    component: () => import('@/pages/SchedulePrintPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/app',
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
        component: () => import('@/pages/RulesPage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'staff',
        name: 'staff',
        component: () => import('@/pages/StaffListPage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'staff/:id',
        name: 'staff-profile',
        component: () => import('@/pages/StaffProfilePage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'patients',
        name: 'patients',
        component: () => import('@/pages/PatientListPage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'patients/:id',
        name: 'patient-profile',
        component: () => import('@/pages/PatientProfilePage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('@/pages/RoomsListPage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'rooms/:id',
        name: 'room-profile',
        component: () => import('@/pages/RoomProfilePage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
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
      },
      {
        path: 'my-schedule',
        name: 'my-schedule',
        component: () => import('@/pages/MySchedulePage.vue')
      },
      {
        path: 'time-off-requests',
        name: 'time-off-requests',
        component: () => import('@/pages/TimeOffRequestsPage.vue'),
        meta: { requiredRoles: ['super_admin', 'admin', 'admin_assistant'] }
      },
      {
        path: 'data-management',
        name: 'data-management',
        component: () => import('@/pages/DataManagementPage.vue')
      },
      {
        path: 'baa',
        name: 'baa',
        component: () => import('@/pages/BaaPage.vue')
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTAL ROUTES (Patient/Caregiver facing)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    path: '/portal',
    name: 'portal-redirect',
    redirect: '/portal/login'
  },
  {
    path: '/portal/login',
    name: 'portal-login',
    component: () => import('@/pages/portal/PortalLoginPage.vue'),
    meta: { requiresAuth: false, isPortal: true }
  },
  {
    path: '/portal/verify',
    name: 'portal-verify',
    component: () => import('@/pages/portal/PortalVerifyPage.vue'),
    meta: { requiresAuth: false, isPortal: true }
  },
  {
    path: '/portal',
    component: () => import('@/layouts/PortalLayout.vue'),
    meta: { requiresPortalAuth: true, isPortal: true },
    children: [
      {
        path: 'dashboard',
        name: 'portal-dashboard',
        component: () => import('@/pages/portal/PortalDashboardPage.vue')
      },
      {
        path: 'appointments',
        name: 'portal-appointments',
        component: () => import('@/pages/portal/PortalAppointmentsPage.vue')
      },
      {
        path: 'book',
        name: 'portal-book',
        component: () => import('@/pages/portal/PortalBookingPage.vue'),
        meta: { requiresSelfBooking: true }
      },
      {
        path: 'settings',
        name: 'portal-settings',
        component: () => import('@/pages/portal/PortalSettingsPage.vue')
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
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
      },
      {
        path: 'baa',
        name: 'super-admin-baa',
        component: () => import('@/pages/SuperAdminBaaPage.vue')
      },
      {
        path: 'leads',
        name: 'super-admin-leads',
        component: () => import('@/pages/SuperAdminLeadsPage.vue')
      },
      {
        path: 'templates',
        name: 'super-admin-templates',
        component: () => import('@/pages/SuperAdminTemplatesPage.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTAL ROUTE HANDLING (separate from staff app)
  // ═══════════════════════════════════════════════════════════════════════════
  if (to.meta.isPortal) {
    const portalToken = localStorage.getItem('portal_token')

    // Portal auth required but no token
    if (to.meta.requiresPortalAuth && !portalToken) {
      next({ name: 'portal-login' })
      return
    }

    // Already logged in, redirect to dashboard
    if (to.name === 'portal-login' && portalToken) {
      next({ name: 'portal-dashboard' })
      return
    }

    // For authenticated portal routes, validate session
    if (to.meta.requiresPortalAuth && portalToken) {
      const { usePortalAuthStore } = await import('@/stores/portalAuth')
      const portalStore = usePortalAuthStore()

      // Ensure user data is loaded
      if (!portalStore.user) {
        try {
          await portalStore.fetchCurrentUser()
        } catch {
          // Token invalid, redirect to login
          localStorage.removeItem('portal_token')
          next({ name: 'portal-login' })
          return
        }
      }

      // Check self-booking requirement
      if (to.meta.requiresSelfBooking && !portalStore.canBook) {
        next({ name: 'portal-dashboard' })
        return
      }
    }

    next()
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAFF APP ROUTE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  // First, check for auth token in URL (cross-subdomain transfer)
  const transferredToken = consumeAuthTokenFromUrl()

  const token = transferredToken || localStorage.getItem('token')

  // Redirect to login if auth required but no token
  if (to.meta.requiresAuth && !token) {
    next({ name: 'login' })
    return
  }

  // Redirect to dashboard if already logged in and going to login or landing
  if ((to.name === 'login' || to.name === 'landing') && token) {
    next('/app')
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

  // Check role-based access for routes with requiredRoles
  if (to.meta.requiredRoles && Array.isArray(to.meta.requiredRoles)) {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    const userRole = authStore.user?.role
    if (!userRole || !to.meta.requiredRoles.includes(userRole)) {
      next({ name: 'dashboard' })
      return
    }
  }

  next()
})

export default router
