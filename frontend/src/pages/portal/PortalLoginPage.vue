<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { applyBranding } from '@/composables/useBranding'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const portalStore = usePortalAuthStore()

// Form state
const identifier = ref('')
const channel = ref<'email' | 'sms'>('email')
const isSubmitting = ref(false)

// Computed
const branding = computed(() => portalStore.branding)
const error = computed(() => portalStore.error)
const loading = computed(() => portalStore.loading)
const portalDisabled = computed(() => !branding.value)
const portalBgStyle = computed(() => {
  if (!branding.value?.backgroundUrl) return {}
  return { '--portal-bg-url': `url(${branding.value.backgroundUrl})` }
})

// Placeholder text based on channel
const placeholderText = computed(() => {
  return channel.value === 'email' ? 'Enter your email address' : 'Enter your phone number'
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

async function handleSubmit() {
  if (!identifier.value.trim()) return

  isSubmitting.value = true
  portalStore.clearError()

  try {
    await portalStore.requestLogin(identifier.value.trim(), channel.value)
    // Navigate to verify page
    router.push({ name: 'portal-verify' })
  } catch {
    // Error is stored in portalStore.error
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  // Load branding for this organization
  try {
    await portalStore.loadBranding()
  } catch {
    // Portal may not be enabled - error will show in UI
  }
})
</script>

<template>
  <div class="portal-login">
    <div class="login-background" :style="portalBgStyle" />

    <div class="portal-auth-container">
      <div class="auth-card" :aria-busy="loading">
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

        <!-- Portal Disabled Message -->
        <div v-if="portalDisabled && !loading" class="auth-state">
          <div class="state-icon" aria-hidden="true">
            <Icon name="lock" :size="22" />
          </div>
          <h2 class="state-title">Portal Unavailable</h2>
          <p class="state-message">{{ error || 'The patient portal is not available for this organization.' }}</p>
        </div>

        <!-- Login Form -->
        <div v-else class="auth-body">
          <div class="welcome-header">
            <h2 class="welcome-title">{{ branding?.welcomeTitle || 'Welcome' }}</h2>
            <p class="welcome-message">{{ branding?.welcomeMessage || 'Sign in to access your appointments.' }}</p>
          </div>

          <form @submit.prevent="handleSubmit" class="login-form">
            <!-- Channel Toggle -->
            <div class="channel-toggle" role="tablist" aria-label="Sign in method">
              <button
                type="button"
                :class="['toggle-btn', { active: channel === 'email' }]"
                :aria-selected="channel === 'email'"
                @click="channel = 'email'"
              >
                Email
              </button>
              <button
                type="button"
                :class="['toggle-btn', { active: channel === 'sms' }]"
                :aria-selected="channel === 'sms'"
                @click="channel = 'sms'"
              >
                Phone
              </button>
            </div>

            <!-- Identifier Input -->
            <div class="form-group">
              <label :for="channel" class="form-label">
                {{ channel === 'email' ? 'Email Address' : 'Phone Number' }}
              </label>
              <div class="input-row">
                <span class="input-icon" aria-hidden="true">
                  <Icon :name="channel === 'email' ? 'mail' : 'phone'" :size="18" />
                </span>
                <input
                  :id="channel"
                  v-model="identifier"
                  :type="channel === 'email' ? 'email' : 'tel'"
                  :placeholder="placeholderText"
                  class="form-input"
                  required
                  :disabled="isSubmitting"
                />
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="error-message" role="alert">
              {{ error }}
            </div>

            <!-- Submit Button -->
            <button type="submit" class="submit-btn" :disabled="isSubmitting || !identifier.trim()">
              <span v-if="isSubmitting">Sending…</span>
              <span v-else>
                {{ channel === 'email' ? 'Send Login Link' : 'Send Login Code' }}
              </span>
            </button>
          </form>

          <!-- Contact Info -->
          <div v-if="branding?.contactEmail || branding?.contactPhone" class="contact-info">
            <p>Need help?</p>
            <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`" class="contact-link">
              <Icon name="mail" :size="16" />
              <span>{{ branding.contactEmail }}</span>
            </a>
            <a v-if="branding?.contactPhone" :href="`tel:${branding.contactPhone}`" class="contact-link">
              <Icon name="phone" :size="16" />
              <span>{{ branding.contactPhone }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Footer Links -->
      <div class="login-footer">
        <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <span v-if="branding?.termsUrl && branding?.privacyUrl">•</span>
        <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 2rem;
}

/* Background layer */
.login-background {
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

.login-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.03);
}

.portal-auth-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Card */
.auth-card {
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

.auth-body {
  padding: 1.5rem 1.25rem 1.25rem;
}

.auth-state {
  padding: 2rem 1.25rem 1.5rem;
  text-align: center;
}

.state-icon {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  background: rgba(226, 232, 240, 0.7);
  color: var(--text-secondary, #475569);
}

.state-title {
  font-size: 1.125rem;
  color: var(--text-primary, #0f172a);
  margin: 0 0 0.5rem;
}

.state-message {
  color: var(--text-secondary, #475569);
  margin: 0;
  line-height: 1.55;
  font-size: 0.9375rem;
}

.welcome-header {
  margin-bottom: 2rem;
}

.welcome-title {
  font-size: 1.375rem;
  font-weight: 650;
  color: var(--text-primary, #0f172a);
  margin: 0 0 0.75rem;
  line-height: 1.3;
}

.welcome-message {
  color: var(--text-secondary, #475569);
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* Channel Toggle */
.channel-toggle {
  display: flex;
  background: rgba(226, 232, 240, 0.7);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 0.75rem;
  padding: 0.1875rem;
  margin-bottom: 1.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  border-radius: 0.625rem;
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover:not(.active) {
  color: var(--text-primary, #0f172a);
}

.toggle-btn.active {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary-dark, #1e40af);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
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

.input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.875rem;
  display: inline-flex;
  color: var(--text-muted, #94a3b8);
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 0.75rem;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.95);
}

.form-input:focus-visible {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}

.form-input:disabled {
  background: var(--background-color, #f1f5f9);
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--text-muted, #94a3b8);
}

/* Error */
.error-message {
  background: var(--danger-light, #fee2e2);
  color: var(--danger-color, #dc2626);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Submit Button */
.submit-btn {
  width: 100%;
  padding: 1rem 1.5rem;
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

.submit-btn:active:not(:disabled) {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.18);
  transform: translateY(1px);
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Contact Info */
.contact-info {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(226, 232, 240, 0.8);
}

.contact-info p {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
}

.contact-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary, #475569);
  text-decoration: none;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.contact-link:hover {
  text-decoration: underline;
  color: var(--primary-dark, #1e40af);
}

/* Footer */
.login-footer {
  margin-top: 2rem;
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.login-footer a {
  color: var(--text-secondary, #475569);
  text-decoration: none;
  transition: color 0.2s ease;
}

.login-footer a:hover {
  color: var(--text-primary, #0f172a);
}

.login-footer span {
  color: var(--text-muted, #94a3b8);
}

/* Responsive */
@media (max-width: 480px) {
  .portal-login {
    padding: 1rem;
  }

  .login-card {
    padding: 1.5rem;
  }

  .org-name {
    font-size: 1.5rem;
  }

  .welcome-title {
    font-size: 1.25rem;
  }
}
</style>
