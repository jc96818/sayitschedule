<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations'
import { Alert, Badge, Button } from '@/components/ui'
import type { Organization } from '@/types'

const route = useRoute()
const router = useRouter()
const organizationsStore = useOrganizationsStore()

const orgId = route.params.id as string
const loading = ref(true)
const formData = ref<Partial<Organization>>({})

const organization = computed(() => organizationsStore.currentOrganization)

async function handleSave() {
  if (!organization.value) return

  try {
    await organizationsStore.updateOrganization(orgId, formData.value)
    router.push('/super-admin')
  } catch (error) {
    console.error('Failed to save organization:', error)
  }
}

function handleCancel() {
  router.push('/super-admin')
}

onMounted(async () => {
  loading.value = true
  try {
    await organizationsStore.fetchOrganizationById(orgId)
    if (organizationsStore.currentOrganization) {
      formData.value = { ...organizationsStore.currentOrganization }
    }
  } catch (error) {
    console.error('Failed to load organization:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <RouterLink to="/super-admin" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Organizations
        </RouterLink>
        <h2>Edit Organization</h2>
        <p v-if="organization">
          <Badge :variant="organization.status === 'active' ? 'success' : 'warning'">
            {{ organization.status === 'active' ? 'Active' : 'Inactive' }}
          </Badge>
        </p>
      </div>
      <div class="header-actions" v-if="organization">
        <Button variant="outline" @click="handleCancel">Cancel</Button>
        <Button variant="primary" :loading="organizationsStore.loading" @click="handleSave">
          Save Changes
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="organizationsStore.error" variant="danger" class="mb-3" dismissible @dismiss="organizationsStore.error = null">
        {{ organizationsStore.error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Loading organization...</p>
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else-if="!organization" class="card">
        <div class="card-body text-center">
          <p class="text-muted">Organization not found.</p>
          <RouterLink to="/super-admin" class="btn btn-primary" style="margin-top: 16px;">
            Return to Organizations
          </RouterLink>
        </div>
      </div>

      <!-- Edit Form -->
      <div v-else class="grid-2">
        <!-- Basic Information -->
        <div class="card">
          <div class="card-header">
            <h3>Basic Information</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="name">Organization Name</label>
              <input
                id="name"
                v-model="formData.name"
                type="text"
                class="form-control"
                required
              />
            </div>

            <div class="form-group">
              <label for="subdomain">Subdomain</label>
              <div class="subdomain-input">
                <input
                  id="subdomain"
                  v-model="formData.subdomain"
                  type="text"
                  class="form-control"
                  pattern="[a-z0-9-]+"
                  required
                />
                <span class="subdomain-suffix">.sayitschedule.com</span>
              </div>
              <small class="text-muted">Lowercase letters, numbers, and hyphens only</small>
            </div>

            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" v-model="formData.status" class="form-control">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="formData.requiresHipaa"
                  type="checkbox"
                />
                <span>Requires HIPAA Compliance</span>
              </label>
              <small class="text-muted">Enable if this organization handles Protected Health Information (PHI). When enabled, a Business Associate Agreement must be signed.</small>
            </div>
          </div>
        </div>

        <!-- Branding -->
        <div class="card">
          <div class="card-header">
            <h3>Branding</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label for="primaryColor">Primary Color</label>
              <div class="color-picker">
                <input
                  id="primaryColor"
                  v-model="formData.primaryColor"
                  type="color"
                  class="color-input"
                />
                <input
                  v-model="formData.primaryColor"
                  type="text"
                  class="form-control color-text"
                  placeholder="#2563eb"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="secondaryColor">Secondary Color</label>
              <div class="color-picker">
                <input
                  id="secondaryColor"
                  v-model="formData.secondaryColor"
                  type="color"
                  class="color-input"
                />
                <input
                  v-model="formData.secondaryColor"
                  type="text"
                  class="form-control color-text"
                  placeholder="#1e40af"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Logo</label>
              <div class="logo-upload">
                <div v-if="formData.logoUrl" class="logo-preview">
                  <img :src="formData.logoUrl" alt="Organization logo" />
                </div>
                <div v-else class="logo-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>No logo uploaded</span>
                </div>
                <input type="file" class="form-control" accept="image/*" />
              </div>
            </div>

            <!-- Color Preview -->
            <div class="form-group">
              <label>Preview</label>
              <div class="color-preview">
                <div
                  class="preview-primary"
                  :style="{ backgroundColor: formData.primaryColor }"
                >
                  Primary
                </div>
                <div
                  class="preview-secondary"
                  :style="{ backgroundColor: formData.secondaryColor }"
                >
                  Secondary
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="card danger-card" style="grid-column: span 2;">
          <div class="card-header">
            <h3>Danger Zone</h3>
          </div>
          <div class="card-body">
            <div class="danger-item">
              <div>
                <strong>Delete this organization</strong>
                <p class="text-muted" style="margin: 4px 0 0;">
                  Once you delete an organization, there is no going back. Please be certain.
                </p>
              </div>
              <Button variant="danger">
                Delete Organization
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  margin-bottom: 8px;
}

.back-link:hover {
  color: white;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.subdomain-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subdomain-suffix {
  color: var(--text-muted);
  white-space: nowrap;
}

.color-picker {
  display: flex;
  gap: 12px;
  align-items: center;
}

.color-input {
  width: 48px;
  height: 48px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.color-text {
  flex: 1;
  font-family: monospace;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.logo-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.logo-preview,
.logo-placeholder {
  width: 100%;
  height: 120px;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
}

.logo-preview img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}

.color-preview {
  display: flex;
  gap: 12px;
}

.preview-primary,
.preview-secondary {
  flex: 1;
  padding: 16px;
  border-radius: var(--radius-md);
  color: white;
  text-align: center;
  font-weight: 500;
}

.danger-card {
  border-color: var(--danger-color);
}

.danger-card .card-header {
  color: var(--danger-color);
}

.danger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .grid-2 .card[style*="grid-column"] {
    grid-column: span 1;
  }

  .danger-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
