<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const step = ref<'setup' | 'verify' | 'backup'>('setup')

// MFA data
const qrCode = ref('')
const secret = ref('')
const verificationCode = ref('')
const backupCodes = ref<string[]>([])
const backupCodesCopied = ref(false)

// Get token from query params
const mfaSetupToken = computed(() => route.query.token as string)

// Organization info (passed via query)
const organizationName = computed(() => route.query.org as string || 'your organization')

onMounted(async () => {
  if (!mfaSetupToken.value) {
    error.value = 'Missing setup token. Please start the registration process again.'
    loading.value = false
    return
  }

  try {
    const response = await authService.firstTimeMfaSetup(mfaSetupToken.value)
    qrCode.value = response.qrCode
    secret.value = response.secret
    loading.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } }
    error.value = err.response?.data?.error || 'Failed to initialize MFA setup. Please try again.'
    loading.value = false
  }
})

async function handleVerify() {
  error.value = ''
  submitting.value = true

  try {
    const response = await authService.firstTimeMfaVerify(mfaSetupToken.value, verificationCode.value)

    // Store backup codes to display
    backupCodes.value = response.backupCodes
    step.value = 'backup'

    // Store the auth data for when user proceeds
    localStorage.setItem('pendingAuth', JSON.stringify({
      token: response.token,
      user: response.user,
      organization: response.organization
    }))
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } }
    error.value = err.response?.data?.error || 'Invalid verification code. Please try again.'
    verificationCode.value = ''
  } finally {
    submitting.value = false
  }
}

async function copyBackupCodes() {
  const codesText = backupCodes.value.join('\n')
  try {
    await navigator.clipboard.writeText(codesText)
    backupCodesCopied.value = true
    setTimeout(() => { backupCodesCopied.value = false }, 2000)
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = codesText
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    backupCodesCopied.value = true
    setTimeout(() => { backupCodesCopied.value = false }, 2000)
  }
}

function proceedToApp() {
  // Get pending auth data and complete login
  const pendingAuth = localStorage.getItem('pendingAuth')
  if (pendingAuth) {
    const { token, user, organization } = JSON.parse(pendingAuth)
    localStorage.removeItem('pendingAuth')
    localStorage.setItem('token', token)

    // Set auth store state
    authStore.setAuthState(token, user, organization)

    // Navigate to app
    router.push('/app')
  } else {
    router.push('/login')
  }
}

function goToStep(targetStep: 'setup' | 'verify') {
  step.value = targetStep
  error.value = ''
  verificationCode.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card mfa-setup-card">
      <div class="login-logo">
        <h1>Say It Schedule</h1>
        <p>Two-Factor Authentication Setup</p>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-center py-4">
        <p class="text-muted">Initializing MFA setup...</p>
      </div>

      <!-- Error state (fatal) -->
      <div v-else-if="error && step === 'setup' && !qrCode" class="error-state">
        <div class="error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="64" height="64">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2>Setup Error</h2>
        <p>{{ error }}</p>
        <RouterLink to="/login" class="btn btn-primary" style="margin-top: 24px;">
          Back to Login
        </RouterLink>
      </div>

      <!-- Step 1: Show QR Code -->
      <div v-else-if="step === 'setup'" class="mfa-step">
        <div class="step-header">
          <div class="step-badge">Step 1 of 3</div>
          <h2>Scan QR Code</h2>
          <p class="hipaa-notice">
            {{ organizationName }} requires two-factor authentication for HIPAA compliance.
          </p>
        </div>

        <div class="qr-section">
          <div class="qr-code" v-html="qrCode"></div>
          <p class="instruction">Scan this QR code with your authenticator app</p>
          <p class="apps-hint">
            Recommended apps: Google Authenticator, Authy, or Microsoft Authenticator
          </p>
        </div>

        <div class="manual-entry">
          <p class="manual-label">Can't scan? Enter this code manually:</p>
          <code class="secret-code">{{ secret }}</code>
        </div>

        <button class="btn btn-primary btn-block btn-lg" @click="goToStep('verify')">
          Continue
        </button>
      </div>

      <!-- Step 2: Verify Code -->
      <div v-else-if="step === 'verify'" class="mfa-step">
        <div class="step-header">
          <div class="step-badge">Step 2 of 3</div>
          <h2>Verify Setup</h2>
          <p>Enter the 6-digit code from your authenticator app to confirm setup.</p>
        </div>

        <form @submit.prevent="handleVerify">
          <div v-if="error" class="alert alert-danger mb-2">
            {{ error }}
          </div>

          <div class="form-group">
            <label for="code">Verification Code</label>
            <input
              id="code"
              v-model="verificationCode"
              type="text"
              class="form-control mfa-input"
              placeholder="000000"
              maxlength="6"
              pattern="[0-9]*"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block btn-lg"
            :disabled="submitting || verificationCode.length < 6"
          >
            {{ submitting ? 'Verifying...' : 'Verify' }}
          </button>

          <button type="button" class="btn btn-ghost btn-block" @click="goToStep('setup')">
            Back
          </button>
        </form>
      </div>

      <!-- Step 3: Backup Codes -->
      <div v-else-if="step === 'backup'" class="mfa-step">
        <div class="step-header">
          <div class="step-badge success">Step 3 of 3</div>
          <h2>Save Backup Codes</h2>
          <p class="important-notice">
            Save these backup codes in a secure location. You'll need them if you lose access to your authenticator app.
          </p>
        </div>

        <div class="backup-codes">
          <div class="codes-grid">
            <code v-for="code in backupCodes" :key="code" class="backup-code">{{ code }}</code>
          </div>
          <button class="btn btn-outline copy-btn" @click="copyBackupCodes">
            {{ backupCodesCopied ? 'Copied!' : 'Copy All Codes' }}
          </button>
        </div>

        <div class="warning-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Each code can only be used once. Store them securely!</span>
        </div>

        <button class="btn btn-primary btn-block btn-lg" @click="proceedToApp">
          Continue to App
        </button>
      </div>

      <p style="text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 14px;">
        Need help? Contact your administrator
      </p>
    </div>
  </div>
</template>

<style scoped>
.mfa-setup-card {
  max-width: 480px;
}

.mfa-step {
  text-align: center;
}

.step-header {
  margin-bottom: 24px;
}

.step-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--primary-color);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}

.step-badge.success {
  background: var(--success);
}

.step-header h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.step-header p {
  color: var(--text-secondary);
  font-size: 14px;
}

.hipaa-notice {
  background: #fef3c7;
  color: #92400e;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  margin-top: 12px;
}

.qr-section {
  margin: 24px 0;
}

.qr-code {
  display: inline-block;
  padding: 16px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.qr-code :deep(svg) {
  display: block;
  width: 180px;
  height: 180px;
}

.instruction {
  margin-top: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.apps-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.manual-entry {
  background: var(--background-color);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

.manual-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.secret-code {
  display: block;
  font-size: 14px;
  font-family: monospace;
  letter-spacing: 2px;
  padding: 8px 12px;
  background: white;
  border-radius: var(--radius-sm);
  user-select: all;
  word-break: break-all;
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

.important-notice {
  background: #fef3c7;
  color: #92400e;
  padding: 12px;
  border-radius: var(--radius-md);
}

.backup-codes {
  margin: 24px 0;
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.backup-code {
  display: block;
  padding: 8px 12px;
  background: var(--background-color);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 14px;
  text-align: center;
}

.copy-btn {
  width: 100%;
}

.warning-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef3c7;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  color: #92400e;
  font-size: 13px;
}

.warning-box svg {
  flex-shrink: 0;
}

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
}

.error-state p {
  color: var(--text-secondary);
}

.py-4 {
  padding: 32px 0;
}

.mb-2 {
  margin-bottom: 16px;
}
</style>
