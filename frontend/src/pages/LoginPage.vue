<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    await authStore.login({ email: email.value, password: password.value })
    // Redirect superadmins to their dashboard, others to regular dashboard
    if (authStore.isSuperAdmin) {
      router.push('/super-admin')
    } else {
      router.push('/')
    }
  } catch (e) {
    error.value = 'Invalid email or password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <h1>Say It Schedule</h1>
        <p>Voice-Powered Scheduling Made Simple</p>
      </div>

      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="alert alert-danger mb-2">
          {{ error }}
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            placeholder="Enter your email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            placeholder="Enter your password"
            required
          />
        </div>

        <div class="form-group" style="display: flex; justify-content: space-between; align-items: center;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input v-model="rememberMe" type="checkbox" style="width: auto;" />
            <span style="font-weight: normal;">Remember me</span>
          </label>
          <a href="#" style="font-size: 14px;">Forgot password?</a>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <p style="text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 14px;">
        Need help? Contact your administrator
      </p>
    </div>
  </div>
</template>
