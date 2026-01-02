<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { applyBranding } from '@/composables/useBranding'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const route = useRoute()
const portalStore = usePortalAuthStore()

// Form state
const code = ref('')
const isSubmitting = ref(false)

// Magic link token (from URL hash/query). Stored separately so we can clear it from the address bar.
const magicLinkToken = ref<string | null>(null)

function parseMagicLinkTokenFromHash(hash: string): string | null {
  const cleaned = hash.replace(/^#/, '').trim()
  if (!cleaned) return null
  const params = new URLSearchParams(cleaned.startsWith('?') ? cleaned.slice(1) : cleaned)
  const token = params.get('token')
  return token && token.length > 0 ? token : null
}

// Computed
const branding = computed(() => portalStore.branding)
const error = computed(() => portalStore.error)
const authChannel = computed(() => portalStore.authChannel)
const authIdentifier = computed(() => portalStore.authIdentifier)
const authRequestSent = computed(() => portalStore.authRequestSent)

// Is this a magic link (email) or OTP (sms)?
const isMagicLink = computed(() => !!magicLinkToken.value)
const isOtpFlow = computed(() => authChannel.value === 'sms' || (!isMagicLink.value && authRequestSent.value))
const portalBgStyle = computed(() => {
  if (!branding.value?.backgroundUrl) return {}
  return { '--portal-bg-url': `url(${branding.value.backgroundUrl})` }
})

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

async function handleVerify(tokenOverride?: string) {
  const tokenToVerify = tokenOverride ?? (isMagicLink.value ? magicLinkToken.value : code.value.trim())

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
  // Capture magic link token (hash preferred to avoid referrer leakage).
  magicLinkToken.value =
    parseMagicLinkTokenFromHash(route.hash) ||
    (route.query.token as string | undefined) ||
    null

  // Clear token from the URL to reduce accidental sharing/logging.
  if (magicLinkToken.value && (route.hash || route.query.token)) {
    try {
      await router.replace({ name: 'portal-verify', query: {}, hash: '' })
    } catch {
      // Ignore
    }
  }

  // Load branding if not loaded
  if (!portalStore.branding) {
    try {
      await portalStore.loadBranding()
    } catch {
      // Ignore
    }
  }

  // Auto-verify if magic link token present
  if (magicLinkToken.value) {
    await handleVerify(magicLinkToken.value)
  }

  // Redirect to login if no auth request pending and no magic link
  if (!authRequestSent.value && !magicLinkToken.value) {
    router.push({ name: 'portal-login' })
  }
})
</script>

<template>
  <div class="portal-verify">
    <div class="verify-background" :style="portalBgStyle" />
    <div class="verify-container">
      <div class="verify-card-shell">
        <header class="auth-header">
          <img
            v-if="branding?.logoUrl"
            :src="branding.logoUrl"
            :alt="branding?.organizationName"
            class="org-logo"
          />
          <div class="org-meta">
            <div class="portal-label">Patient Portal</div>
            <h1 v-if="branding?.showOrgName" class="org-name">
              {{ branding?.organizationName }}
            </h1>
          </div>
        </header>

        <!-- Magic Link Auto-Verify -->
        <div v-if="isMagicLink && isSubmitting" class="verify-card loading-card" aria-busy="true">
          <div class="loading-spinner" aria-hidden="true"></div>
          <p class="loading-text">Verifying your login…</p>
        </div>

        <!-- OTP Entry Form -->
        <div v-else-if="isOtpFlow" class="verify-card">
          <div class="card-header">
            <div class="icon-circle" aria-hidden="true">
              <Icon :name="authChannel === 'sms' ? 'phone' : 'mail'" :size="18" />
            </div>
            <h2>Enter Your Code</h2>
            <p>
              We sent a {{ authChannel === 'sms' ? '6-digit code' : 'login link' }} to
              <strong>{{ maskedIdentifier }}</strong>
            </p>
          </div>

          <form @submit.prevent="handleVerify()" class="verify-form">
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

            <div v-if="error" class="error-message" role="alert">
              {{ error }}
            </div>

            <button type="submit" class="submit-btn" :disabled="isSubmitting || code.length < 6">
              <span v-if="isSubmitting">Verifying…</span>
              <span v-else>Verify & Sign In</span>
            </button>
          </form>

          <div class="verify-actions">
            <button type="button" class="text-btn" :disabled="isSubmitting" @click="handleResend">
              Resend code
            </button>
            <span class="divider" aria-hidden="true">•</span>
            <button type="button" class="text-btn" :disabled="isSubmitting" @click="handleBack">
              Use different {{ authChannel === 'email' ? 'email' : 'phone' }}
            </button>
          </div>
        </div>

        <!-- Magic Link Error -->
        <div v-else-if="error" class="verify-card error-card">
          <div class="icon-circle error" aria-hidden="true">
            <Icon name="warning" :size="18" />
          </div>
          <h2>Verification Failed</h2>
          <p>{{ error }}</p>
          <button class="submit-btn" @click="handleBack">Try Again</button>
        </div>

        <div class="verify-footer">
          <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          <span v-if="branding?.termsUrl && branding?.privacyUrl">•</span>
          <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </div>
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
  padding: 2rem;
  position: relative;
}

.verify-background {
  position: absolute;
  inset: 0;
  background-color: var(--background-color, #f8fafc);
  background-image:
    radial-gradient(900px circle at 15% 10%, var(--primary-light, #dbeafe) 0%, rgba(248, 250, 252, 0) 65%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.98) 100%),
    var(--portal-bg-url, none);
  background-size: cover, cover, cover;
  background-position: center, center, center;
  z-index: 0;
}

.verify-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.03);
}

.verify-container {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
}

.verify-card-shell {
  width: 100%;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 1rem;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.org-logo {
  height: 56px;
  width: auto;
  object-fit: contain;
}

.auth-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(248, 250, 252, 0.6);
}

.org-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.portal-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted, #94a3b8);
}

.org-name {
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--text-primary, #0f172a);
  margin: 0;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Card */
.verify-card {
  padding: 1.5rem 1.25rem 1.25rem;
  width: 100%;
}

.loading-card {
  text-align: center;
  padding: 2rem 1.25rem 1.5rem;
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

.loading-text {
  color: var(--text-secondary, #475569);
  margin: 0;
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
  width: 56px;
  height: 56px;
  background: var(--primary-light, #dbeafe);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.875rem;
  color: var(--primary-dark, #1e40af);
}

.icon-circle.error {
  background: var(--danger-light, #fee2e2);
  color: var(--danger-color, #dc2626);
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 650;
  color: var(--text-primary, #0f172a);
  margin: 0 0 0.5rem;
}

.card-header p {
  color: var(--text-secondary, #475569);
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
  color: var(--text-primary, #0f172a);
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.code-input {
  width: 100%;
  padding: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.5rem;
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  background: rgba(255, 255, 255, 0.95);
}

.code-input:focus-visible {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
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
  border-radius: 0.75rem;
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
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--primary-hover, #1d4ed8);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.22);
}

.submit-btn:disabled {
  opacity: 0.55;
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
  color: var(--text-secondary, #475569);
  text-decoration: none;
}

.verify-footer a:hover {
  color: var(--text-primary, #0f172a);
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
