<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { organizationService } from '@/services/api'
import { applyBranding } from '@/composables/useBranding'
import { Alert } from '@/components/ui'

const authStore = useAuthStore()

const organization = computed(() => authStore.organization)

// Form state
const name = ref('')
const primaryColor = ref('#2563eb')
const secondaryColor = ref('#1e40af')
const logoUrl = ref<string | null>(null)

// UI state
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

// Initialize form with current org values
watch(
  organization,
  (org) => {
    if (org) {
      name.value = org.name
      primaryColor.value = org.primaryColor || '#2563eb'
      secondaryColor.value = org.secondaryColor || '#1e40af'
      logoUrl.value = org.logoUrl
    }
  },
  { immediate: true }
)

// Preview colors as they change
watch([primaryColor, secondaryColor], ([primary, secondary]) => {
  applyBranding(primary, secondary)
})

async function handleSave() {
  if (!organization.value) return

  saving.value = true
  error.value = null
  success.value = false

  try {
    const response = await organizationService.updateBranding({
      name: name.value,
      primaryColor: primaryColor.value,
      secondaryColor: secondaryColor.value,
      logoUrl: logoUrl.value,
      organizationId: organization.value.id
    })

    // Update the auth store with new org data
    authStore.setOrganizationContext(response.data)
    success.value = true

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save settings'
    // Revert to original colors on error
    if (organization.value) {
      applyBranding(
        organization.value.primaryColor || '#2563eb',
        organization.value.secondaryColor
      )
    }
  } finally {
    saving.value = false
  }
}

function handleReset() {
  if (organization.value) {
    name.value = organization.value.name
    primaryColor.value = organization.value.primaryColor || '#2563eb'
    secondaryColor.value = organization.value.secondaryColor || '#1e40af'
    logoUrl.value = organization.value.logoUrl
  }
}
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Settings</h2>
        <p>Configure organization settings</p>
      </div>
    </header>

    <div class="page-content">
      <Alert v-if="error" variant="danger" class="mb-3" dismissible @dismiss="error = null">
        {{ error }}
      </Alert>

      <Alert v-if="success" variant="success" class="mb-3">
        Settings saved successfully!
      </Alert>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Organization Branding</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="org-name">Organization Name</label>
              <input
                id="org-name"
                v-model="name"
                type="text"
                class="form-control"
                placeholder="Enter organization name"
              />
            </div>

            <div class="color-row">
              <div class="form-group">
                <label for="primary-color">Primary Color</label>
                <div class="color-input-wrapper">
                  <input
                    id="primary-color"
                    v-model="primaryColor"
                    type="color"
                    class="form-control color-input"
                  />
                  <input
                    v-model="primaryColor"
                    type="text"
                    class="form-control color-text"
                    pattern="^#[0-9a-fA-F]{6}$"
                    maxlength="7"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="secondary-color">Secondary Color</label>
                <div class="color-input-wrapper">
                  <input
                    id="secondary-color"
                    v-model="secondaryColor"
                    type="color"
                    class="form-control color-input"
                  />
                  <input
                    v-model="secondaryColor"
                    type="text"
                    class="form-control color-text"
                    pattern="^#[0-9a-fA-F]{6}$"
                    maxlength="7"
                  />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="logo-url">Logo URL</label>
              <input
                id="logo-url"
                v-model="logoUrl"
                type="url"
                class="form-control"
                placeholder="https://example.com/logo.png"
              />
              <small class="text-muted">Enter a URL to your organization's logo (recommended: 80x80px)</small>
            </div>

            <div v-if="logoUrl" class="logo-preview">
              <label>Logo Preview</label>
              <img :src="logoUrl" alt="Logo preview" class="preview-image" />
            </div>

            <div class="button-row">
              <button class="btn btn-outline" type="button" @click="handleReset">
                Reset
              </button>
              <button
                class="btn btn-primary"
                type="button"
                :disabled="saving"
                @click="handleSave"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Holidays</h3>
          </div>
          <div class="card-body">
            <p class="text-muted">Federal holidays are automatically excluded from scheduling.</p>
            <ul class="holiday-list">
              <li>New Year's Day - January 1</li>
              <li>MLK Day - 3rd Monday of January</li>
              <li>Presidents' Day - 3rd Monday of February</li>
              <li>Memorial Day - Last Monday of May</li>
              <li>Juneteenth - June 19</li>
              <li>Independence Day - July 4</li>
              <li>Labor Day - 1st Monday of September</li>
              <li>Thanksgiving - 4th Thursday of November</li>
              <li>Christmas Day - December 25</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
}

.color-input {
  width: 48px;
  height: 48px;
  padding: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.color-text {
  flex: 1;
  font-family: monospace;
  text-transform: uppercase;
}

.logo-preview {
  margin-bottom: 20px;
}

.logo-preview label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.preview-image {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--background-color);
}

.button-row {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.holiday-list {
  margin-top: 16px;
  padding-left: 20px;
  line-height: 1.8;
}

.holiday-list li {
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .color-row {
    grid-template-columns: 1fr;
  }
}
</style>
