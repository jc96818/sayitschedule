<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations'
import { useAuthStore } from '@/stores/auth'
import { Modal, Alert, Badge, Button, StatCard } from '@/components/ui'
import { buildSubdomainUrl } from '@/utils/subdomain'
import type { Organization } from '@/types'

const router = useRouter()
const organizationsStore = useOrganizationsStore()
const authStore = useAuthStore()

const showCreateModal = ref(false)
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')

const newOrg = ref<Partial<Organization>>({
  name: '',
  subdomain: '',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  status: 'active'
})

const filteredOrganizations = computed(() => {
  let result = organizationsStore.organizations

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      org =>
        org.name.toLowerCase().includes(query) ||
        org.subdomain.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value !== 'all') {
    result = result.filter(org => org.status === statusFilter.value)
  }

  return result
})

const stats = computed(() => ({
  totalOrgs: organizationsStore.organizations.length,
  activeOrgs: organizationsStore.organizations.filter(o => o.status === 'active').length,
  inactiveOrgs: organizationsStore.organizations.filter(o => o.status === 'inactive').length
}))

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

async function handleCreateOrg() {
  try {
    await organizationsStore.createOrganization(newOrg.value)
    showCreateModal.value = false
    resetForm()
  } catch (error) {
    console.error('Failed to create organization:', error)
  }
}

function resetForm() {
  newOrg.value = {
    name: '',
    subdomain: '',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    status: 'active'
  }
}

async function handleEnterOrg(org: Organization) {
  try {
    // Switch context returns a new JWT with the org's ID embedded
    const { token } = await organizationsStore.switchContext(org.id)
    // Redirect superadmin to the organization's subdomain with the new token
    if (token && org.subdomain) {
      const redirectUrl = buildSubdomainUrl(org.subdomain, '/', token)
      window.location.href = redirectUrl
    } else {
      // Fallback for development (no subdomain routing)
      authStore.setOrganizationContext(org)
      router.push('/')
    }
  } catch (error) {
    console.error('Failed to switch organization context:', error)
  }
}

async function handleToggleStatus(org: Organization) {
  const newStatus = org.status === 'active' ? 'inactive' : 'active'
  try {
    await organizationsStore.updateOrganization(org.id, { status: newStatus })
  } catch (error) {
    console.error('Failed to update organization status:', error)
  }
}

onMounted(() => {
  organizationsStore.fetchOrganizations()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Super Admin Dashboard</h2>
        <p>Manage all organizations</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="showCreateModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Organization
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="organizationsStore.error" variant="danger" class="mb-3" dismissible @dismiss="organizationsStore.error = null">
        {{ organizationsStore.error }}
      </Alert>

      <!-- Stats -->
      <div class="stats-grid">
        <StatCard
          :value="stats.totalOrgs"
          label="Total Organizations"
          icon="building"
          color="blue"
        />
        <StatCard
          :value="stats.activeOrgs"
          label="Active Organizations"
          icon="check"
          color="green"
        />
        <StatCard
          :value="stats.inactiveOrgs"
          label="Inactive Organizations"
          icon="pause"
          color="yellow"
        />
      </div>

      <!-- Filters -->
      <div class="filters-row mb-3">
        <div class="search-input">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search organizations..."
            class="form-control"
          />
        </div>
        <select v-model="statusFilter" class="form-control" style="width: 160px;">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <!-- Organizations Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Organizations ({{ filteredOrganizations.length }})</h3>
        </div>

        <div v-if="organizationsStore.loading && organizationsStore.organizations.length === 0" class="card-body text-center">
          <p class="text-muted">Loading organizations...</p>
        </div>

        <div v-else-if="filteredOrganizations.length === 0" class="card-body text-center">
          <p class="text-muted">No organizations found.</p>
        </div>

        <div v-else class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="org in filteredOrganizations" :key="org.id">
                <td>
                  <div class="org-name">
                    <div class="org-color" :style="{ backgroundColor: org.primaryColor }"></div>
                    <strong>{{ org.name }}</strong>
                  </div>
                </td>
                <td>
                  <span class="subdomain">{{ org.subdomain }}.sayitschedule.com</span>
                </td>
                <td>
                  <Badge :variant="org.status === 'active' ? 'success' : 'warning'">
                    {{ org.status === 'active' ? 'Active' : 'Inactive' }}
                  </Badge>
                </td>
                <td>{{ formatDate(org.createdAt) }}</td>
                <td>
                  <div class="action-buttons">
                    <RouterLink :to="`/super-admin/organizations/${org.id}`" class="btn btn-sm btn-outline">
                      Edit
                    </RouterLink>
                    <Button
                      size="sm"
                      :variant="org.status === 'active' ? 'warning' : 'success'"
                      @click="handleToggleStatus(org)"
                    >
                      {{ org.status === 'active' ? 'Deactivate' : 'Activate' }}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      @click="handleEnterOrg(org)"
                    >
                      Enter
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Organization Modal -->
    <Modal v-model="showCreateModal" title="Create Organization" size="md">
      <form @submit.prevent="handleCreateOrg">
        <div class="form-group">
          <label for="name">Organization Name</label>
          <input
            id="name"
            v-model="newOrg.name"
            type="text"
            class="form-control"
            placeholder="e.g., Project Hope Therapy"
            required
          />
        </div>

        <div class="form-group">
          <label for="subdomain">Subdomain</label>
          <div class="subdomain-input">
            <input
              id="subdomain"
              v-model="newOrg.subdomain"
              type="text"
              class="form-control"
              placeholder="projecthope"
              pattern="[a-z0-9-]+"
              required
            />
            <span class="subdomain-suffix">.sayitschedule.com</span>
          </div>
          <small class="text-muted">Lowercase letters, numbers, and hyphens only</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="primaryColor">Primary Color</label>
            <input
              id="primaryColor"
              v-model="newOrg.primaryColor"
              type="color"
              class="form-control color-input"
            />
          </div>
          <div class="form-group">
            <label for="secondaryColor">Secondary Color</label>
            <input
              id="secondaryColor"
              v-model="newOrg.secondaryColor"
              type="color"
              class="form-control color-input"
            />
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showCreateModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="organizationsStore.loading">
            Create Organization
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.filters-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-input {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input input {
  padding-left: 40px;
}

.org-name {
  display: flex;
  align-items: center;
  gap: 12px;
}

.org-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.subdomain {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 8px;
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

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.color-input {
  height: 48px;
  padding: 4px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
