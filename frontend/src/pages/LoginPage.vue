<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getPostLoginRedirectUrl } from '@/utils/subdomain'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const error = ref('')
const loading = ref(false)

// MFA state
const mfaCode = ref('')
const mfaError = ref('')
const mfaLoading = ref(false)

const showMfaForm = computed(() => authStore.mfaRequired)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    const response = await authStore.login({ email: email.value, password: password.value })

    // Check if MFA is required
    if (response.requiresMfa) {
      // MFA flow will continue in the MFA form
      loading.value = false
      return
    }

    // No MFA - proceed with redirect
    handlePostLoginRedirect()
  } catch (e) {
    error.value = 'Invalid email or password'
  } finally {
    loading.value = false
  }
}

async function handleMfaSubmit() {
  mfaError.value = ''
  mfaLoading.value = true

  try {
    await authStore.verifyMfa(mfaCode.value)
    handlePostLoginRedirect()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } }
    mfaError.value = err.response?.data?.error || 'Invalid verification code'
    // Clear the code field so user can try again
    mfaCode.value = ''
  } finally {
    mfaLoading.value = false
  }
}

function handlePostLoginRedirect() {
  // Check if we need to redirect to a different subdomain
  const redirectUrl = getPostLoginRedirectUrl(
    authStore.isSuperAdmin,
    authStore.organization?.subdomain,
    authStore.token!
  )

  if (redirectUrl) {
    // Cross-subdomain redirect - use window.location for full page navigation
    window.location.href = redirectUrl
    return
  }

  // Same-subdomain navigation - use Vue Router
  if (authStore.isSuperAdmin) {
    router.push('/super-admin')
  } else {
    router.push('/app')
  }
}

function cancelMfa() {
  authStore.clearMfaState()
  mfaCode.value = ''
  mfaError.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <h1>Say It Schedule</h1>
        <p>Voice-Powered Scheduling Made Simple</p>
      </div>

      <!-- Login Form -->
      <form v-if="!showMfaForm" @submit.prevent="handleSubmit">
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
          <RouterLink to="/forgot-password" style="font-size: 14px;">Forgot password?</RouterLink>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <!-- MFA Verification Form -->
      <form v-else @submit.prevent="handleMfaSubmit">
        <div class="mfa-header">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48" style="color: var(--primary);">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2>Two-Factor Authentication</h2>
          <p>Enter the 6-digit code from your authenticator app</p>
        </div>

        <div v-if="mfaError" class="alert alert-danger mb-2">
          {{ mfaError }}
        </div>

        <div class="form-group">
          <label for="mfaCode">Verification Code</label>
          <input
            id="mfaCode"
            v-model="mfaCode"
            type="text"
            class="form-control mfa-input"
            placeholder="000000"
            maxlength="10"
            pattern="[0-9A-Za-z-]*"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
          />
          <small class="text-muted">Or enter a backup code (XXXX-XXXX)</small>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="mfaLoading">
          {{ mfaLoading ? 'Verifying...' : 'Verify' }}
        </button>

        <button type="button" class="btn btn-ghost btn-block" style="margin-top: 12px;" @click="cancelMfa">
          Back to Login
        </button>
      </form>

      <p style="text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 14px;">
        Need help? Contact your administrator
      </p>
    </div>
  </div>
</template>

<style scoped>
.mfa-header {
  text-align: center;
  margin-bottom: 24px;
}

.mfa-header svg {
  margin-bottom: 16px;
}

.mfa-header h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.mfa-header p {
  color: var(--text-secondary);
  font-size: 14px;
}

.mfa-input {
  text-align: center;
  font-size: 24px;
  letter-spacing: 8px;
  font-family: monospace;
}

.mfa-input::placeholder {
  letter-spacing: 8px;
}
</style>
