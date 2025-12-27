import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

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
        path: 'users',
        name: 'users',
        component: () => import('@/pages/UsersPage.vue')
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue')
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
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('token')

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

  // Check superadmin requirement
  if (to.meta.requiresSuperAdmin) {
    // Dynamically import to avoid circular dependency
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Ensure user data is loaded
    if (!authStore.user && token) {
      try {
        await authStore.fetchCurrentUser()
      } catch {
        // Token invalid, redirect to login
        next({ name: 'login' })
        return
      }
    }

    // Check if user is superadmin
    if (!authStore.isSuperAdmin) {
      // Non-superadmin trying to access superadmin routes - redirect to dashboard
      next({ name: 'dashboard' })
      return
    }
  }

  next()
})

export default router
