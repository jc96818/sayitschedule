<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { applyBranding } from '@/composables/useBranding'

const router = useRouter()
const route = useRoute()
const portalStore = usePortalAuthStore()

// Form state
const code = ref('')
const isSubmitting = ref(false)

// Get token from URL (for magic links)
const tokenFromUrl = computed(() => route.query.token as string | undefined)

// Computed
const branding = computed(() => portalStore.branding)
const error = computed(() => portalStore.error)
const authChannel = computed(() => portalStore.authChannel)
const authIdentifier = computed(() => portalStore.authIdentifier)
const authRequestSent = computed(() => portalStore.authRequestSent)

// Is this a magic link (email) or OTP (sms)?
const isMagicLink = computed(() => !!tokenFromUrl.value)
const isOtpFlow = computed(() => authChannel.value === 'sms' || (!isMagicLink.value && authRequestSent.value))

// Masked identifier for display
const maskedIdentifier = computed(() => {
  if (!authIdentifier.value) return ''

  if (authChannel.value === 'email') {
    const [local, domain] = authIdentifier.value.split('@')
    if (local.length <= 3) return `${local[0]}***@${domain}`
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`
  } else {
    // Phone
    if (authIdentifier.value.length <= 4) return authIdentifier.value
    return `***${authIdentifier.value.slice(-4)}`
  }
})

// Apply branding when loaded
watch(
  branding,
  (b) => {
    if (b?.primaryColor) {
      applyBranding(b.primaryColor, b.secondaryColor)
    }
  },
  { immediate: true }
)

async function handleVerify() {
  const tokenToVerify = isMagicLink.value ? tokenFromUrl.value : code.value.trim()

  if (!tokenToVerify) return

  isSubmitting.value = true
  portalStore.clearError()

  try {
    await portalStore.verifyToken(tokenToVerify)
    // Navigate to dashboard on success
    router.push({ name: 'portal-dashboard' })
  } catch {
    // Error is stored in portalStore.error
  } finally {
    isSubmitting.value = false
  }
}

function handleBack() {
  portalStore.resetAuthRequest()
  router.push({ name: 'portal-login' })
}

async function handleResend() {
  if (!authIdentifier.value || !authChannel.value) return

  isSubmitting.value = true
  portalStore.clearError()

  try {
    await portalStore.requestLogin(authIdentifier.value, authChannel.value)
  } catch {
    // Error handled in store
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  // Load branding if not loaded
  if (!portalStore.branding) {
    try {
      await portalStore.loadBranding()
    } catch {
      // Ignore
    }
  }

  // Auto-verify if token in URL (magic link)
  if (tokenFromUrl.value) {
    await handleVerify()
  }

  // Redirect to login if no auth request pending and no magic link
  if (!authRequestSent.value && !tokenFromUrl.value) {
    router.push({ name: 'portal-login' })
  }
})
</script>

<template>
  <div
    class="portal-verify"
    :style="branding?.backgroundUrl ? { backgroundImage: `url(${branding.backgroundUrl})` } : {}"
  >
    <div class="verify-container">
      <!-- Logo and Org Name -->
      <div class="verify-header">
        <img
          v-if="branding?.logoUrl"
          :src="branding.logoUrl"
          :alt="branding?.organizationName"
          class="org-logo"
        />
        <h1 v-if="branding?.showOrgName" class="org-name">
          {{ branding?.organizationName }}
        </h1>
      </div>

      <!-- Magic Link Auto-Verify -->
      <div v-if="isMagicLink && isSubmitting" class="verify-card loading-card">
        <div class="loading-spinner"></div>
        <p>Verifying your login...</p>
      </div>

      <!-- OTP Entry Form -->
      <div v-else-if="isOtpFlow" class="verify-card">
        <div class="card-header">
          <div class="icon-circle">
            <span v-if="authChannel === 'sms'">📱</span>
            <span v-else>📧</span>
          </div>
          <h2>Enter Your Code</h2>
          <p>
            We sent a {{ authChannel === 'sms' ? '6-digit code' : 'login link' }} to
            <strong>{{ maskedIdentifier }}</strong>
          </p>
        </div>

        <form @submit.prevent="handleVerify" class="verify-form">
          <!-- OTP Input -->
          <div class="form-group">
            <label for="code" class="form-label">Verification Code</label>
            <input
              id="code"
              v-model="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="Enter 6-digit code"
              class="code-input"
              autocomplete="one-time-code"
              :disabled="isSubmitting"
            />
          </div>

          <!-- Error Message -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="submit-btn"
            :disabled="isSubmitting || code.length < 6"
          >
            <span v-if="isSubmitting">Verifying...</span>
            <span v-else>Verify & Sign In</span>
          </button>
        </form>

        <!-- Actions -->
        <div class="verify-actions">
          <button
            type="button"
            class="text-btn"
            :disabled="isSubmitting"
            @click="handleResend"
          >
            Resend code
          </button>
          <span class="divider">•</span>
          <button
            type="button"
            class="text-btn"
            :disabled="isSubmitting"
            @click="handleBack"
          >
            Use different {{ authChannel === 'email' ? 'email' : 'phone' }}
          </button>
        </div>
      </div>

      <!-- Magic Link Error -->
      <div v-else-if="error" class="verify-card error-card">
        <div class="icon-circle error">
          <span>⚠️</span>
        </div>
        <h2>Verification Failed</h2>
        <p>{{ error }}</p>
        <button class="submit-btn" @click="handleBack">
          Try Again
        </button>
      </div>

      <!-- Footer Links -->
      <div class="verify-footer">
        <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <span v-if="branding?.termsUrl && branding?.privacyUrl">•</span>
        <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-verify {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-light, #dbeafe) 0%, #f8fafc 100%);
  background-size: cover;
  background-position: center;
  padding: 2rem;
}

.verify-container {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Header */
.verify-header {
  text-align: center;
  margin-bottom: 2rem;
}

.org-logo {
  height: 64px;
  width: auto;
  object-fit: contain;
  margin-bottom: 1rem;
}

.org-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

/* Card */
.verify-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.loading-card {
  text-align: center;
  padding: 3rem 2rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--primary-light, #dbeafe);
  border-top-color: var(--primary-color, #2563eb);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-card {
  text-align: center;
}

.card-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.icon-circle {
  width: 64px;
  height: 64px;
  background: var(--primary-light, #dbeafe);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
}

.icon-circle.error {
  background: var(--danger-light, #fee2e2);
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.card-header p {
  color: var(--text-secondary, #64748b);
  margin: 0;
  font-size: 0.9375rem;
}

/* Form */
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.code-input {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.5rem;
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.code-input:focus {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 3px var(--primary-light, #dbeafe);
}

.code-input:disabled {
  background: var(--background-color, #f1f5f9);
  cursor: not-allowed;
}

/* Error */
.error-message {
  background: var(--danger-light, #fee2e2);
  color: var(--danger-color, #dc2626);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  text-align: center;
}

/* Submit Button */
.submit-btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: var(--primary-color, #2563eb);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--primary-hover, #1d4ed8);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Actions */
.verify-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
}

.text-btn {
  background: none;
  border: none;
  color: var(--primary-color, #2563eb);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
}

.text-btn:hover {
  text-decoration: underline;
}

.text-btn:disabled {
  color: var(--text-muted, #94a3b8);
  cursor: not-allowed;
}

.divider {
  color: var(--text-muted, #94a3b8);
}

/* Footer */
.verify-footer {
  margin-top: 2rem;
  display: flex;
  gap: 0.75rem;
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
}

.verify-footer a {
  color: var(--text-secondary, #64748b);
  text-decoration: none;
}

.verify-footer a:hover {
  color: var(--primary-color, #2563eb);
}

/* Responsive */
@media (max-width: 480px) {
  .portal-verify {
    padding: 1rem;
  }

  .verify-card {
    padding: 1.5rem;
  }

  .code-input {
    font-size: 1.25rem;
    letter-spacing: 0.25rem;
  }
}
</style>
