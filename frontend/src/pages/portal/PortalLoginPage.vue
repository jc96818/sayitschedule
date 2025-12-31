<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'
import { applyBranding } from '@/composables/useBranding'

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
  <div
    class="portal-login"
    :style="branding?.backgroundUrl ? { backgroundImage: `url(${branding.backgroundUrl})` } : {}"
  >
    <div class="login-container">
      <!-- Logo and Welcome -->
      <div class="login-header">
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

      <!-- Portal Disabled Message -->
      <div v-if="portalDisabled && !loading" class="portal-disabled">
        <div class="disabled-icon">🔒</div>
        <h2>Portal Unavailable</h2>
        <p>{{ error || 'The patient portal is not available for this organization.' }}</p>
      </div>

      <!-- Login Form -->
      <div v-else class="login-card">
        <div class="card-header">
          <h2 class="welcome-title">{{ branding?.welcomeTitle || 'Welcome' }}</h2>
          <p class="welcome-message">{{ branding?.welcomeMessage || 'Sign in to access your appointments.' }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form">
          <!-- Channel Toggle -->
          <div class="channel-toggle">
            <button
              type="button"
              :class="['toggle-btn', { active: channel === 'email' }]"
              @click="channel = 'email'"
            >
              Email
            </button>
            <button
              type="button"
              :class="['toggle-btn', { active: channel === 'sms' }]"
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

          <!-- Error Message -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="submit-btn"
            :disabled="isSubmitting || !identifier.trim()"
          >
            <span v-if="isSubmitting">Sending...</span>
            <span v-else>
              {{ channel === 'email' ? 'Send Login Link' : 'Send Login Code' }}
            </span>
          </button>
        </form>

        <!-- Contact Info -->
        <div v-if="branding?.contactEmail || branding?.contactPhone" class="contact-info">
          <p>Need help?</p>
          <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`">
            {{ branding.contactEmail }}
          </a>
          <a v-if="branding?.contactPhone" :href="`tel:${branding.contactPhone}`">
            {{ branding.contactPhone }}
          </a>
        </div>
      </div>

      <!-- Footer Links -->
      <div class="login-footer">
        <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank">Terms of Service</a>
        <span v-if="branding?.termsUrl && branding?.privacyUrl">•</span>
        <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank">Privacy Policy</a>
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
  background: linear-gradient(135deg, var(--primary-light, #dbeafe) 0%, #f8fafc 100%);
  background-size: cover;
  background-position: center;
  padding: 2rem;
}

.login-container {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Header */
.login-header {
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

/* Portal Disabled */
.portal-disabled {
  background: white;
  border-radius: 1rem;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.disabled-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.portal-disabled h2 {
  font-size: 1.25rem;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.portal-disabled p {
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* Login Card */
.login-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.card-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.welcome-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem;
}

.welcome-message {
  color: var(--text-secondary, #64748b);
  margin: 0;
  font-size: 0.9375rem;
}

/* Channel Toggle */
.channel-toggle {
  display: flex;
  background: var(--background-color, #f1f5f9);
  border-radius: 0.5rem;
  padding: 0.25rem;
  margin-bottom: 1.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  border-radius: 0.375rem;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-btn.active {
  background: white;
  color: var(--primary-color, #2563eb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color, #2563eb);
  box-shadow: 0 0 0 3px var(--primary-light, #dbeafe);
}

.form-input:disabled {
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

/* Contact Info */
.contact-info {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
  text-align: center;
}

.contact-info p {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
}

.contact-info a {
  color: var(--primary-color, #2563eb);
  text-decoration: none;
  font-size: 0.875rem;
  display: block;
  margin-top: 0.25rem;
}

.contact-info a:hover {
  text-decoration: underline;
}

/* Footer */
.login-footer {
  margin-top: 2rem;
  display: flex;
  gap: 0.75rem;
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
}

.login-footer a {
  color: var(--text-secondary, #64748b);
  text-decoration: none;
}

.login-footer a:hover {
  color: var(--primary-color, #2563eb);
}

/* Responsive */
@media (max-width: 480px) {
  .portal-login {
    padding: 1rem;
  }

  .login-card {
    padding: 1.5rem;
  }
}
</style>
