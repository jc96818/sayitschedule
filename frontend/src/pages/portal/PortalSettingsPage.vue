<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePortalAuthStore } from '@/stores/portalAuth'

const router = useRouter()
const portalStore = usePortalAuthStore()

// Computed
const user = computed(() => portalStore.user)
const branding = computed(() => portalStore.branding)

async function handleLogout() {
  await portalStore.logout()
  router.push({ name: 'portal-login' })
}
</script>

<template>
  <div class="portal-settings">
    <h1>Account Settings</h1>

    <!-- Profile Section -->
    <section class="settings-section">
      <h2>Your Profile</h2>
      <div class="profile-card">
        <div class="profile-avatar">
          {{ user?.name?.charAt(0)?.toUpperCase() || '?' }}
        </div>
        <div class="profile-info">
          <h3>{{ user?.name }}</h3>
          <p v-if="user?.email">{{ user.email }}</p>
          <p v-if="user?.phone">{{ user.phone }}</p>
        </div>
      </div>
      <p class="info-note">
        To update your contact information, please reach out to {{ branding?.organizationName }}.
      </p>
    </section>

    <!-- Contact Section -->
    <section class="settings-section">
      <h2>Contact {{ branding?.organizationName }}</h2>
      <div class="contact-options">
        <a v-if="branding?.contactEmail" :href="`mailto:${branding.contactEmail}`" class="contact-card">
          <span class="contact-icon">📧</span>
          <span class="contact-label">Email</span>
          <span class="contact-value">{{ branding.contactEmail }}</span>
        </a>
        <a v-if="branding?.contactPhone" :href="`tel:${branding.contactPhone}`" class="contact-card">
          <span class="contact-icon">📞</span>
          <span class="contact-label">Phone</span>
          <span class="contact-value">{{ branding.contactPhone }}</span>
        </a>
      </div>
    </section>

    <!-- Portal Features -->
    <section class="settings-section">
      <h2>Portal Features</h2>
      <div class="features-list">
        <div class="feature-item">
          <span class="feature-icon">📅</span>
          <div class="feature-info">
            <span class="feature-name">View Appointments</span>
            <span class="feature-status enabled">Available</span>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <div class="feature-info">
            <span class="feature-name">Confirm Appointments</span>
            <span :class="['feature-status', branding?.portalRequireConfirmation ? 'enabled' : 'disabled']">
              {{ branding?.portalRequireConfirmation ? 'Required' : 'Optional' }}
            </span>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✕</span>
          <div class="feature-info">
            <span class="feature-name">Cancel Appointments</span>
            <span :class="['feature-status', branding?.portalAllowCancel ? 'enabled' : 'disabled']">
              {{ branding?.portalAllowCancel ? 'Available' : 'Contact Office' }}
            </span>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">+</span>
          <div class="feature-info">
            <span class="feature-name">Book New Appointments</span>
            <span :class="['feature-status', branding?.selfBookingEnabled ? 'enabled' : 'disabled']">
              {{ branding?.selfBookingEnabled ? 'Available' : 'Contact Office' }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Legal Links -->
    <section v-if="branding?.termsUrl || branding?.privacyUrl" class="settings-section">
      <h2>Legal</h2>
      <div class="legal-links">
        <a v-if="branding?.termsUrl" :href="branding.termsUrl" target="_blank" class="legal-link">
          Terms of Service
          <span class="external-icon">↗</span>
        </a>
        <a v-if="branding?.privacyUrl" :href="branding.privacyUrl" target="_blank" class="legal-link">
          Privacy Policy
          <span class="external-icon">↗</span>
        </a>
      </div>
    </section>

    <!-- Sign Out -->
    <section class="settings-section">
      <h2>Session</h2>
      <button class="logout-btn" @click="handleLogout">
        Sign Out
      </button>
      <p class="logout-note">
        You will need to sign in again to access your appointments.
      </p>
    </section>
  </div>
</template>

<style scoped>
.portal-settings {
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0 0 2rem;
}

/* Sections */
.settings-section {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

/* Profile */
.profile-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  background: var(--primary-light, #dbeafe);
  color: var(--primary-color, #2563eb);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
}

.profile-info h3 {
  margin: 0 0 0.25rem;
  color: var(--text-primary, #1e293b);
}

.profile-info p {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.info-note {
  margin: 0;
  color: var(--text-muted, #94a3b8);
  font-size: 0.8125rem;
  font-style: italic;
}

/* Contact Options */
.contact-options {
  display: flex;
  gap: 1rem;
}

.contact-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
  text-decoration: none;
  transition: all 0.15s ease;
}

.contact-card:hover {
  background: var(--primary-light, #dbeafe);
}

.contact-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.contact-label {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.contact-value {
  color: var(--primary-color, #2563eb);
  font-weight: 500;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Features List */
.features-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
}

.feature-icon {
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.feature-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feature-name {
  color: var(--text-primary, #1e293b);
  font-size: 0.875rem;
}

.feature-status {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
}

.feature-status.enabled {
  background: #dcfce7;
  color: #16a34a;
}

.feature-status.disabled {
  background: #f1f5f9;
  color: #64748b;
}

/* Legal Links */
.legal-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.legal-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--background-color, #f8fafc);
  border-radius: 0.5rem;
  color: var(--text-primary, #1e293b);
  text-decoration: none;
  transition: all 0.15s ease;
}

.legal-link:hover {
  background: var(--primary-light, #dbeafe);
  color: var(--primary-color, #2563eb);
}

.external-icon {
  color: var(--text-muted, #94a3b8);
}

/* Logout */
.logout-btn {
  width: 100%;
  padding: 0.75rem;
  background: white;
  border: 1px solid var(--danger-color, #dc2626);
  color: var(--danger-color, #dc2626);
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.logout-btn:hover {
  background: var(--danger-light, #fee2e2);
}

.logout-note {
  margin: 0.75rem 0 0;
  color: var(--text-muted, #94a3b8);
  font-size: 0.8125rem;
  text-align: center;
}

/* Responsive */
@media (max-width: 480px) {
  .contact-options {
    flex-direction: column;
  }

  .feature-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
