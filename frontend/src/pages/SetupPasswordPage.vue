<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService, type VerifyTokenResponse } from '@/services/api'

const route = useRoute()
const router = useRouter()

// State
const loading = ref(true)
const submitting = ref(false)
const tokenValid = ref(false)
const tokenError = ref('')
const tokenInfo = ref<VerifyTokenResponse | null>(null)

// Form state
const password = ref('')
const confirmPassword = ref('')
const formError = ref('')
const showPassword = ref(false)

// Password requirements
const passwordRequirements = computed(() => {
  const pwd = password.value
  return {
    minLength: pwd.length >= 8,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd)
  }
})

const allRequirementsMet = computed(() => {
  const reqs = passwordRequirements.value
  return reqs.minLength && reqs.hasUppercase && reqs.hasLowercase && reqs.hasNumber
})

const passwordsMatch = computed(() => {
  return password.value === confirmPassword.value && password.value.length > 0
})

const canSubmit = computed(() => {
  return allRequirementsMet.value && passwordsMatch.value && !submitting.value
})

const submitButtonText = computed(() => {
  if (submitting.value) return 'Setting up...'
  return tokenInfo.value?.type === 'invitation'
    ? 'Complete Setup'
    : 'Reset Password'
})

onMounted(async () => {
  const token = route.query.token as string

  if (!token) {
    tokenError.value = 'No invitation token provided. Please check your email for the correct link.'
    loading.value = false
    return
  }

  try {
    const response = await authService.verifyToken(token)
    tokenInfo.value = response
    tokenValid.value = true
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string; code?: string } } }
    if (err.response?.data?.code === 'INVALID_TOKEN') {
      tokenError.value = 'This invitation link has expired or is invalid. Please contact your administrator to send a new invitation.'
    } else {
      tokenError.value = err.response?.data?.error || 'Failed to verify invitation. Please try again.'
    }
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  formError.value = ''

  if (!canSubmit.value) return

  const token = route.query.token as string
  if (!token) {
    formError.value = 'Invalid token'
    return
  }

  submitting.value = true

  try {
    const response = await authService.setupPassword(token, password.value)

    // Check if MFA setup is required (HIPAA compliance)
    if (response.requiresMfaSetup && response.mfaSetupToken) {
      // Redirect to MFA setup page with the token
      const orgName = response.organization?.name || 'Your organization'
      router.push({
        path: '/mfa-setup',
        query: {
          token: response.mfaSetupToken,
          org: orgName
        }
      })
      return
    }

    // No MFA required - proceed with normal login
    if (response.token) {
      localStorage.setItem('token', response.token)
      router.push('/app')
    }
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    formError.value = err.response?.data?.error || 'Failed to set password. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <h1>{{ tokenInfo?.organization?.name || 'Say It Schedule' }}</h1>
        <p v-if="tokenInfo?.type === 'invitation'">Complete your account setup</p>
        <p v-else>Reset your password</p>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-center py-4">
        <p class="text-muted">Verifying invitation...</p>
      </div>

      <!-- Token error state -->
      <div v-else-if="tokenError" class="error-state">
        <div class="error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="64" height="64">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2>Unable to Continue</h2>
        <p>{{ tokenError }}</p>
        <RouterLink to="/login" class="btn btn-primary" style="margin-top: 24px;">
          Go to Login
        </RouterLink>
      </div>

      <!-- Password setup form -->
      <form v-else-if="tokenValid" @submit.prevent="handleSubmit">
        <div class="welcome-message">
          <p>Hi <strong>{{ tokenInfo?.user.name }}</strong>,</p>
          <p v-if="tokenInfo?.type === 'invitation'">
            Please create a password to complete your account setup.
          </p>
          <p v-else>
            Enter a new password for your account.
          </p>
        </div>

        <div v-if="formError" class="alert alert-danger mb-2">
          {{ formError }}
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            class="form-control"
            :value="tokenInfo?.user.email"
            disabled
          />
        </div>

        <div class="form-group">
          <label for="password">New Password</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-control"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              class="password-toggle"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="password-requirements">
          <p class="requirements-title">Password requirements:</p>
          <ul>
            <li :class="{ met: passwordRequirements.minLength }">
              <span class="check">{{ passwordRequirements.minLength ? '✓' : '○' }}</span>
              At least 8 characters
            </li>
            <li :class="{ met: passwordRequirements.hasUppercase }">
              <span class="check">{{ passwordRequirements.hasUppercase ? '✓' : '○' }}</span>
              One uppercase letter
            </li>
            <li :class="{ met: passwordRequirements.hasLowercase }">
              <span class="check">{{ passwordRequirements.hasLowercase ? '✓' : '○' }}</span>
              One lowercase letter
            </li>
            <li :class="{ met: passwordRequirements.hasNumber }">
              <span class="check">{{ passwordRequirements.hasNumber ? '✓' : '○' }}</span>
              One number
            </li>
          </ul>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            class="form-control"
            placeholder="Confirm your password"
            required
          />
          <small v-if="confirmPassword && !passwordsMatch" class="text-danger">
            Passwords do not match
          </small>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block btn-lg"
          :disabled="!canSubmit"
        >
          {{ submitButtonText }}
        </button>
      </form>

      <p style="text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 14px;">
        Need help? Contact your administrator
      </p>
    </div>
  </div>
</template>

<style scoped>
.error-state {
  text-align: center;
  padding: 24px 0;
}

.error-icon {
  color: var(--danger);
  margin-bottom: 16px;
}

.error-state h2 {
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.error-state p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.welcome-message {
  background: var(--background-color);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

.welcome-message p {
  margin: 0 0 8px;
  color: var(--text-secondary);
}

.welcome-message p:last-child {
  margin-bottom: 0;
}

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}

.password-toggle:hover {
  color: var(--text-primary);
}

.password-requirements {
  background: var(--background-color);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.requirements-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 8px;
}

.password-requirements ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.password-requirements li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  padding: 4px 0;
}

.password-requirements li.met {
  color: var(--success);
}

.password-requirements .check {
  font-size: 14px;
  width: 16px;
}

.text-danger {
  color: var(--danger);
  font-size: 12px;
  margin-top: 4px;
}

.py-4 {
  padding: 32px 0;
}
</style>
