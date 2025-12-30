<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { authService } from '@/services/api'

const email = ref('')
const loading = ref(false)
const submitted = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    await authService.requestPasswordReset(email.value)
    submitted.value = true
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    error.value = err.response?.data?.error || err.message || 'An error occurred. Please try again.'
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
        <p>Reset Your Password</p>
      </div>

      <!-- Success State -->
      <div v-if="submitted" class="success-state">
        <div class="success-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="64" height="64">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2>Check Your Email</h2>
        <p>If an account exists for <strong>{{ email }}</strong>, you'll receive a password reset link shortly.</p>
        <p class="expiry-notice">The link will expire in 1 hour.</p>
        <RouterLink to="/login" class="btn btn-primary btn-block" style="margin-top: 24px;">
          Return to Login
        </RouterLink>
      </div>

      <!-- Request Form -->
      <form v-else @submit.prevent="handleSubmit">
        <p class="form-description">
          Enter your email address and we'll send you a link to reset your password.
        </p>

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
            autofocus
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>

        <RouterLink to="/login" class="btn btn-ghost btn-block" style="margin-top: 12px;">
          Back to Login
        </RouterLink>
      </form>

      <p style="text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 14px;">
        Need help? Contact your administrator
      </p>
    </div>
  </div>
</template>

<style scoped>
.form-description {
  color: var(--text-secondary);
  margin-bottom: 24px;
  text-align: center;
}

.success-state {
  text-align: center;
  padding: 16px 0;
}

.success-icon {
  color: var(--success);
  margin-bottom: 16px;
}

.success-state h2 {
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.success-state p {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}

.expiry-notice {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
