<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBaaStore } from '@/stores/baa'
import { useAuthStore } from '@/stores/auth'
import { Alert, Badge, Modal } from '@/components/ui'
import type { BaaStatus } from '@/services/api'

const baaStore = useBaaStore()
const authStore = useAuthStore()

// Filter state
const searchQuery = ref('')
const statusFilter = ref<BaaStatus | ''>('')

// Detail modal state
const showDetailModal = ref(false)
const selectedOrgId = ref<string | null>(null)
const selectedOrgName = ref('')

// Countersign modal state
const showCountersignModal = ref(false)
const countersignName = ref('')
const countersignTitle = ref('')
const countersignError = ref<string | null>(null)

// Void modal state
const showVoidModal = ref(false)
const voidReason = ref('')
const voidError = ref<string | null>(null)

// Status colors - typed to match Badge component variants
type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning'
const statusColors: Record<string, BadgeVariant> = {
  not_started: 'secondary',
  awaiting_org_signature: 'warning',
  awaiting_vendor_signature: 'primary',
  executed: 'success',
  voided: 'danger',
  superseded: 'secondary'
}

// Formatters
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

// Load data
async function loadData() {
  await Promise.all([
    baaStore.fetchAdminBaaStats(),
    baaStore.fetchAdminBaaList({ search: searchQuery.value, status: statusFilter.value || undefined })
  ])
}

async function handleSearch() {
  await baaStore.fetchAdminBaaList({
    page: 1,
    search: searchQuery.value,
    status: statusFilter.value || undefined
  })
}

async function handlePageChange(page: number) {
  await baaStore.fetchAdminBaaList({
    page,
    search: searchQuery.value,
    status: statusFilter.value || undefined
  })
}

async function openDetailModal(orgId: string, orgName: string) {
  selectedOrgId.value = orgId
  selectedOrgName.value = orgName
  showDetailModal.value = true
  await baaStore.fetchAdminOrgBaa(orgId)
}

function openCountersignModal() {
  if (authStore.user) {
    countersignName.value = authStore.user.name
    countersignTitle.value = 'Authorized Representative'
  }
  countersignError.value = null
  showCountersignModal.value = true
}

async function handleCountersign() {
  if (!selectedOrgId.value) return

  if (!countersignName.value || !countersignTitle.value) {
    countersignError.value = 'Name and title are required'
    return
  }

  try {
    await baaStore.countersignBaa(selectedOrgId.value, countersignName.value, countersignTitle.value)
    showCountersignModal.value = false
    await loadData() // Refresh stats
  } catch (e) {
    countersignError.value = e instanceof Error ? e.message : 'Failed to countersign'
  }
}

function openVoidModal() {
  voidReason.value = ''
  voidError.value = null
  showVoidModal.value = true
}

async function handleVoid() {
  if (!selectedOrgId.value) return

  if (!voidReason.value) {
    voidError.value = 'Reason is required'
    return
  }

  try {
    await baaStore.voidBaa(selectedOrgId.value, voidReason.value)
    showVoidModal.value = false
    await loadData() // Refresh stats
  } catch (e) {
    voidError.value = e instanceof Error ? e.message : 'Failed to void BAA'
  }
}

async function handleDownload(baaId: string) {
  try {
    await baaStore.adminDownloadBaa(baaId)
  } catch {
    // Error handled by store
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>BAA Management</h2>
        <p>Manage Business Associate Agreements across organizations</p>
      </div>
    </header>

    <div class="page-content">
      <Alert v-if="baaStore.error" variant="danger" class="mb-3" dismissible @dismiss="baaStore.clearError">
        {{ baaStore.error }}
      </Alert>

      <!-- Stats Cards -->
      <div v-if="baaStore.adminBaaStats" class="stats-grid mb-4">
        <div class="stat-card">
          <div class="stat-value">{{ baaStore.adminBaaStats.executed }}</div>
          <div class="stat-label">Executed</div>
        </div>
        <div class="stat-card stat-warning">
          <div class="stat-value">{{ baaStore.adminBaaStats.awaitingVendorSignature }}</div>
          <div class="stat-label">Awaiting Countersign</div>
        </div>
        <div class="stat-card stat-info">
          <div class="stat-value">{{ baaStore.adminBaaStats.awaitingOrgSignature }}</div>
          <div class="stat-label">Awaiting Org Signature</div>
        </div>
        <div class="stat-card stat-muted">
          <div class="stat-value">{{ baaStore.adminBaaStats.notStarted }}</div>
          <div class="stat-label">Not Started</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="filter-row">
            <div class="form-group mb-0">
              <input
                v-model="searchQuery"
                type="text"
                class="form-control"
                placeholder="Search organizations..."
                @keyup.enter="handleSearch"
              />
            </div>
            <div class="form-group mb-0">
              <select v-model="statusFilter" class="form-control" @change="handleSearch">
                <option value="">All Statuses</option>
                <option value="executed">Executed</option>
                <option value="awaiting_vendor_signature">Awaiting Countersign</option>
                <option value="awaiting_org_signature">Awaiting Org Signature</option>
                <option value="not_started">Not Started</option>
                <option value="voided">Voided</option>
              </select>
            </div>
            <button class="btn btn-primary" @click="handleSearch">
              Search
            </button>
          </div>
        </div>
      </div>

      <!-- BAA List -->
      <div class="card">
        <div class="card-header">
          <h3>BAA Agreements</h3>
        </div>
        <div class="card-body p-0">
          <div v-if="baaStore.loading && !baaStore.adminBaaList.length" class="loading-state">
            Loading...
          </div>
          <div v-else-if="!baaStore.adminBaaList.length" class="empty-state">
            No BAA agreements found.
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Status</th>
                <th>Org Signed</th>
                <th>Vendor Signed</th>
                <th>Template</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="baa in baaStore.adminBaaList" :key="baa.id">
                <td>
                  <div class="org-info">
                    <strong>{{ baa.organization.name }}</strong>
                    <small>{{ baa.organization.subdomain }}</small>
                  </div>
                </td>
                <td>
                  <Badge :variant="statusColors[baa.status] || 'secondary'">
                    {{ baa.statusInfo?.label || baa.status }}
                  </Badge>
                </td>
                <td>
                  <span v-if="baa.orgSignedAt">
                    {{ formatDate(baa.orgSignedAt) }}
                    <small class="text-muted d-block">{{ baa.orgSignerName }}</small>
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="baa.vendorSignedAt">
                    {{ formatDate(baa.vendorSignedAt) }}
                    <small class="text-muted d-block">{{ baa.vendorSignerName }}</small>
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <small>v{{ baa.templateVersion }}</small>
                </td>
                <td>
                  <div class="action-buttons">
                    <button
                      class="btn btn-sm btn-outline"
                      @click="openDetailModal(baa.organizationId, baa.organization.name)"
                    >
                      View
                    </button>
                    <button
                      v-if="baa.status === 'awaiting_vendor_signature'"
                      class="btn btn-sm btn-primary"
                      @click="openDetailModal(baa.organizationId, baa.organization.name)"
                    >
                      Countersign
                    </button>
                    <button
                      v-if="baa.status === 'executed'"
                      class="btn btn-sm btn-outline"
                      @click="handleDownload(baa.id)"
                    >
                      Download
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="baaStore.adminPagination.totalPages > 1" class="card-footer">
          <div class="pagination">
            <button
              class="btn btn-sm btn-outline"
              :disabled="baaStore.adminPagination.page <= 1"
              @click="handlePageChange(baaStore.adminPagination.page - 1)"
            >
              Previous
            </button>
            <span class="pagination-info">
              Page {{ baaStore.adminPagination.page }} of {{ baaStore.adminPagination.totalPages }}
            </span>
            <button
              class="btn btn-sm btn-outline"
              :disabled="baaStore.adminPagination.page >= baaStore.adminPagination.totalPages"
              @click="handlePageChange(baaStore.adminPagination.page + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <Modal v-model="showDetailModal" :title="`BAA Details - ${selectedOrgName}`" size="lg">
      <div v-if="baaStore.loading" class="loading-state">
        Loading...
      </div>
      <div v-else-if="!baaStore.adminSelectedOrg" class="empty-state">
        <p>No BAA found for this organization.</p>
        <p class="text-muted">The organization administrator needs to initiate and sign the BAA first.</p>
      </div>
      <div v-else>
        <div class="detail-section">
          <h4>Current Agreement</h4>
          <div class="detail-grid">
            <div>
              <label>Status</label>
              <Badge :variant="statusColors[baaStore.adminSelectedOrg.current.status] || 'secondary'">
                {{ baaStore.adminSelectedOrg.current.statusInfo?.label }}
              </Badge>
            </div>
            <div>
              <label>Template Version</label>
              <p>{{ baaStore.adminSelectedOrg.current.templateVersion }}</p>
            </div>
            <div>
              <label>Created</label>
              <p>{{ formatDate(baaStore.adminSelectedOrg.current.createdAt) }}</p>
            </div>
          </div>

          <div v-if="baaStore.adminSelectedOrg.current.orgSignedAt" class="signature-section">
            <h5>Organization Signature</h5>
            <div class="detail-grid">
              <div>
                <label>Signer</label>
                <p>{{ baaStore.adminSelectedOrg.current.orgSignerName }}</p>
              </div>
              <div>
                <label>Title</label>
                <p>{{ baaStore.adminSelectedOrg.current.orgSignerTitle }}</p>
              </div>
              <div>
                <label>Email</label>
                <p>{{ baaStore.adminSelectedOrg.current.orgSignerEmail }}</p>
              </div>
              <div>
                <label>Signed Date</label>
                <p>{{ formatDate(baaStore.adminSelectedOrg.current.orgSignedAt) }}</p>
              </div>
              <div>
                <label>IP Address</label>
                <p>{{ baaStore.adminSelectedOrg.current.orgSignerIp }}</p>
              </div>
            </div>
          </div>

          <div v-if="baaStore.adminSelectedOrg.current.vendorSignedAt" class="signature-section">
            <h5>Vendor Signature</h5>
            <div class="detail-grid">
              <div>
                <label>Signer</label>
                <p>{{ baaStore.adminSelectedOrg.current.vendorSignerName }}</p>
              </div>
              <div>
                <label>Title</label>
                <p>{{ baaStore.adminSelectedOrg.current.vendorSignerTitle }}</p>
              </div>
              <div>
                <label>Signed Date</label>
                <p>{{ formatDate(baaStore.adminSelectedOrg.current.vendorSignedAt) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="baaStore.adminSelectedOrg.history.length > 1" class="detail-section">
          <h4>History</h4>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in baaStore.adminSelectedOrg.history" :key="item.id">
                <td>{{ item.templateVersion }}</td>
                <td>
                  <Badge :variant="statusColors[item.status] || 'secondary'" size="sm">
                    {{ item.statusInfo?.label }}
                  </Badge>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-outline" @click="showDetailModal = false">
          Close
        </button>
        <template v-if="baaStore.adminSelectedOrg">
          <button
            v-if="baaStore.adminSelectedOrg.canCountersign"
            class="btn btn-primary"
            @click="openCountersignModal"
          >
            Countersign
          </button>
          <button
            v-if="baaStore.adminSelectedOrg.current.status === 'executed'"
            class="btn btn-outline"
            @click="handleDownload(baaStore.adminSelectedOrg.current.id)"
          >
            Download
          </button>
          <button
            v-if="baaStore.adminSelectedOrg.current.status !== 'voided' && baaStore.adminSelectedOrg.current.status !== 'superseded'"
            class="btn btn-danger"
            @click="openVoidModal"
          >
            Void BAA
          </button>
        </template>
      </template>
    </Modal>

    <!-- Countersign Modal -->
    <Modal v-model="showCountersignModal" title="Countersign BAA" size="md">
      <Alert v-if="countersignError" variant="danger" class="mb-3" dismissible @dismiss="countersignError = null">
        {{ countersignError }}
      </Alert>

      <p class="mb-4">
        You are about to countersign the BAA for <strong>{{ selectedOrgName }}</strong>.
        This will make the agreement fully executed.
      </p>

      <div class="form-group">
        <label for="countersign-name">Your Name *</label>
        <input
          id="countersign-name"
          v-model="countersignName"
          type="text"
          class="form-control"
          required
        />
      </div>

      <div class="form-group">
        <label for="countersign-title">Your Title *</label>
        <input
          id="countersign-title"
          v-model="countersignTitle"
          type="text"
          class="form-control"
          required
        />
      </div>

      <template #footer>
        <button class="btn btn-outline" @click="showCountersignModal = false">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          :disabled="baaStore.signing"
          @click="handleCountersign"
        >
          {{ baaStore.signing ? 'Signing...' : 'Countersign' }}
        </button>
      </template>
    </Modal>

    <!-- Void Modal -->
    <Modal v-model="showVoidModal" title="Void BAA" size="md">
      <Alert v-if="voidError" variant="danger" class="mb-3" dismissible @dismiss="voidError = null">
        {{ voidError }}
      </Alert>

      <Alert variant="warning" class="mb-4">
        Warning: Voiding a BAA will prevent the organization from accessing PHI-related features
        until a new agreement is signed.
      </Alert>

      <div class="form-group">
        <label for="void-reason">Reason for Voiding *</label>
        <textarea
          id="void-reason"
          v-model="voidReason"
          class="form-control"
          rows="3"
          placeholder="Enter the reason for voiding this agreement..."
          required
        ></textarea>
      </div>

      <template #footer>
        <button class="btn btn-outline" @click="showVoidModal = false">
          Cancel
        </button>
        <button
          class="btn btn-danger"
          :disabled="baaStore.loading"
          @click="handleVoid"
        >
          {{ baaStore.loading ? 'Voiding...' : 'Void BAA' }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-success);
}

.stat-warning .stat-value {
  color: var(--color-warning);
}

.stat-info .stat-value {
  color: var(--color-info);
}

.stat-muted .stat-value {
  color: var(--text-muted);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.filter-row .form-group {
  flex: 1;
  max-width: 300px;
}

.org-info {
  display: flex;
  flex-direction: column;
}

.org-info small {
  color: var(--text-muted);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.loading-state,
.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.detail-section h5 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 16px 0 12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.detail-grid label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.detail-grid p {
  margin: 0;
  color: var(--text-primary);
}

.signature-section {
  background-color: var(--background-muted);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-top: 16px;
}

.d-block {
  display: block;
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-row .form-group {
    max-width: none;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
