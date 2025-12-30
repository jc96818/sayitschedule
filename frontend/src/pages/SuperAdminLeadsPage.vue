<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Modal, Alert, Badge, Button, StatCard, FormSelect, FormTextarea } from '@/components/ui'
import { superAdminLeadService, type Lead, type LeadStatus, type LeadStats } from '@/services/api'

const leads = ref<Lead[]>([])
const stats = ref<LeadStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref<LeadStatus | ''>('')

// Edit modal state
const showEditModal = ref(false)
const editingLead = ref<Lead | null>(null)
const editForm = ref({
  status: '' as LeadStatus | '',
  notes: ''
})
const saving = ref(false)

// Delete confirmation
const showDeleteModal = ref(false)
const deletingLead = ref<Lead | null>(null)
const deleting = ref(false)

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' }
]

const statusColors: Record<LeadStatus, 'primary' | 'warning' | 'success' | 'secondary' | 'danger'> = {
  new: 'primary',
  contacted: 'warning',
  qualified: 'primary',
  converted: 'success',
  closed: 'secondary'
}

const filteredLeads = computed(() => {
  let result = leads.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      lead =>
        lead.name.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        (lead.company?.toLowerCase().includes(query) ?? false)
    )
  }

  if (statusFilter.value) {
    result = result.filter(lead => lead.status === statusFilter.value)
  }

  return result
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchLeads() {
  loading.value = true
  error.value = null

  try {
    const [leadsResponse, statsResponse] = await Promise.all([
      superAdminLeadService.list({ limit: 100 }),
      superAdminLeadService.getStats()
    ])

    leads.value = leadsResponse.data
    stats.value = statsResponse.data
  } catch (e) {
    error.value = 'Failed to load leads'
    console.error('Failed to fetch leads:', e)
  } finally {
    loading.value = false
  }
}

function openEditModal(lead: Lead) {
  editingLead.value = lead
  editForm.value = {
    status: lead.status,
    notes: lead.notes || ''
  }
  showEditModal.value = true
}

async function handleSave() {
  if (!editingLead.value || !editForm.value.status) return

  saving.value = true
  try {
    await superAdminLeadService.update(editingLead.value.id, {
      status: editForm.value.status as LeadStatus,
      notes: editForm.value.notes || null
    })
    showEditModal.value = false
    await fetchLeads()
  } catch (e) {
    console.error('Failed to update lead:', e)
  } finally {
    saving.value = false
  }
}

function openDeleteModal(lead: Lead) {
  deletingLead.value = lead
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingLead.value) return

  deleting.value = true
  try {
    await superAdminLeadService.delete(deletingLead.value.id)
    showDeleteModal.value = false
    await fetchLeads()
  } catch (e) {
    console.error('Failed to delete lead:', e)
  } finally {
    deleting.value = false
  }
}

onMounted(fetchLeads)
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Lead Management</h2>
        <p>View and manage leads from the landing page</p>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="error" variant="danger" class="mb-3" dismissible @dismiss="error = null">
        {{ error }}
      </Alert>

      <!-- Stats -->
      <div v-if="stats" class="stats-grid">
        <StatCard :value="stats.total" label="Total Leads" icon="users" color="blue" />
        <StatCard :value="stats.byStatus.new" label="New" icon="alert" color="blue" />
        <StatCard :value="stats.byStatus.contacted" label="Contacted" icon="users" color="yellow" />
        <StatCard :value="stats.byStatus.qualified" label="Qualified" icon="check" color="blue" />
        <StatCard :value="stats.byStatus.converted" label="Converted" icon="check" color="green" />
      </div>

      <!-- Filters -->
      <div class="filters-row mb-3">
        <div class="search-input">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            width="18"
            height="18"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search leads..."
            class="form-control"
          />
        </div>
        <select v-model="statusFilter" class="form-control" style="width: 160px">
          <option value="">All Status</option>
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Leads Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Leads ({{ filteredLeads.length }})</h3>
        </div>

        <div v-if="loading && leads.length === 0" class="card-body text-center">
          <p class="text-muted">Loading leads...</p>
        </div>

        <div v-else-if="filteredLeads.length === 0" class="card-body text-center">
          <p class="text-muted">No leads found.</p>
        </div>

        <div v-else class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lead in filteredLeads" :key="lead.id">
                <td>
                  <strong>{{ lead.name }}</strong>
                </td>
                <td>
                  <a :href="`mailto:${lead.email}`" class="email-link">{{ lead.email }}</a>
                </td>
                <td>{{ lead.company || '—' }}</td>
                <td>{{ lead.role || '—' }}</td>
                <td>
                  <Badge :variant="statusColors[lead.status]">
                    {{ lead.status.charAt(0).toUpperCase() + lead.status.slice(1) }}
                  </Badge>
                </td>
                <td>{{ formatDate(lead.createdAt) }}</td>
                <td>
                  <div class="action-buttons">
                    <Button size="sm" variant="outline" @click="openEditModal(lead)">
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" @click="openDeleteModal(lead)">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit Lead Modal -->
    <Modal v-model="showEditModal" title="Edit Lead" size="md">
      <div v-if="editingLead">
        <div class="lead-details mb-3">
          <p><strong>Name:</strong> {{ editingLead.name }}</p>
          <p><strong>Email:</strong> {{ editingLead.email }}</p>
          <p v-if="editingLead.company"><strong>Company:</strong> {{ editingLead.company }}</p>
          <p v-if="editingLead.phone"><strong>Phone:</strong> {{ editingLead.phone }}</p>
          <p v-if="editingLead.message"><strong>Message:</strong> {{ editingLead.message }}</p>
        </div>

        <form @submit.prevent="handleSave">
          <FormSelect
            v-model="editForm.status"
            label="Status"
            :options="statusOptions"
            required
          />

          <FormTextarea
            v-model="editForm.notes"
            label="Notes"
            placeholder="Add internal notes about this lead..."
            :rows="4"
          />

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px">
            <Button type="button" variant="outline" @click="showEditModal = false">
              Cancel
            </Button>
            <Button type="submit" variant="primary" :loading="saving"> Save Changes </Button>
          </div>
        </form>
      </div>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <Modal v-model="showDeleteModal" title="Delete Lead" size="sm">
      <div v-if="deletingLead">
        <p>Are you sure you want to delete the lead from <strong>{{ deletingLead.name }}</strong>?</p>
        <p class="text-muted">This action cannot be undone.</p>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px">
          <Button type="button" variant="outline" @click="showDeleteModal = false">
            Cancel
          </Button>
          <Button variant="danger" :loading="deleting" @click="handleDelete"> Delete Lead </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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

.email-link {
  color: var(--primary-color);
  text-decoration: none;
}

.email-link:hover {
  text-decoration: underline;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.lead-details {
  background: var(--background-color);
  padding: 16px;
  border-radius: var(--radius-md);
}

.lead-details p {
  margin: 8px 0;
}

.lead-details p:first-child {
  margin-top: 0;
}

.lead-details p:last-child {
  margin-bottom: 0;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
