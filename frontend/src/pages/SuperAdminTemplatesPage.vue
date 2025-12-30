<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { templateService } from '@/services/api'
import { Modal, Alert, Badge, Button, StatCard } from '@/components/ui'
import type { BusinessTypeTemplate } from '@/types'

const templates = ref<BusinessTypeTemplate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')

const editingTemplate = ref<BusinessTypeTemplate | null>(null)

const newTemplate = ref<Partial<BusinessTypeTemplate>>({
  name: '',
  description: '',
  isDefault: false,
  isActive: true,
  staffLabel: 'Staff',
  staffLabelSingular: 'Staff Member',
  patientLabel: 'Patients',
  patientLabelSingular: 'Patient',
  roomLabel: 'Rooms',
  roomLabelSingular: 'Room',
  certificationLabel: 'Certifications',
  equipmentLabel: 'Equipment',
  suggestedCertifications: [],
  suggestedRoomEquipment: []
})

// New certification/equipment input for create modal
const newCert = ref('')
const newEquip = ref('')
// New certification/equipment input for edit modal
const editCert = ref('')
const editEquip = ref('')

const filteredTemplates = computed(() => {
  let result = templates.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query))
    )
  }

  if (statusFilter.value !== 'all') {
    result = result.filter(t => statusFilter.value === 'active' ? t.isActive : !t.isActive)
  }

  return result
})

const stats = computed(() => ({
  totalTemplates: templates.value.length,
  activeTemplates: templates.value.filter(t => t.isActive).length,
  defaultTemplate: templates.value.find(t => t.isDefault)?.name || 'None'
}))

async function fetchTemplates() {
  loading.value = true
  error.value = null
  try {
    const response = await templateService.list()
    templates.value = response.data
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load templates'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  newTemplate.value = {
    name: '',
    description: '',
    isDefault: false,
    isActive: true,
    staffLabel: 'Staff',
    staffLabelSingular: 'Staff Member',
    patientLabel: 'Patients',
    patientLabelSingular: 'Patient',
    roomLabel: 'Rooms',
    roomLabelSingular: 'Room',
    certificationLabel: 'Certifications',
    equipmentLabel: 'Equipment',
    suggestedCertifications: [],
    suggestedRoomEquipment: []
  }
  newCert.value = ''
  newEquip.value = ''
}

async function handleCreateTemplate() {
  loading.value = true
  error.value = null
  try {
    await templateService.create(newTemplate.value)
    showCreateModal.value = false
    resetForm()
    await fetchTemplates()
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create template'
  } finally {
    loading.value = false
  }
}

function openEditModal(template: BusinessTypeTemplate) {
  editingTemplate.value = { ...template }
  editCert.value = ''
  editEquip.value = ''
  showEditModal.value = true
}

async function handleUpdateTemplate() {
  if (!editingTemplate.value) return
  loading.value = true
  error.value = null
  try {
    await templateService.update(editingTemplate.value.id, editingTemplate.value)
    showEditModal.value = false
    editingTemplate.value = null
    await fetchTemplates()
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update template'
  } finally {
    loading.value = false
  }
}

async function handleDeleteTemplate(template: BusinessTypeTemplate) {
  if (!confirm(`Are you sure you want to deactivate "${template.name}"?`)) return
  loading.value = true
  error.value = null
  try {
    await templateService.delete(template.id)
    await fetchTemplates()
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to deactivate template'
  } finally {
    loading.value = false
  }
}

// Certification management for create modal
function addCert() {
  if (newCert.value.trim() && !newTemplate.value.suggestedCertifications?.includes(newCert.value.trim())) {
    newTemplate.value.suggestedCertifications = [...(newTemplate.value.suggestedCertifications || []), newCert.value.trim()]
    newCert.value = ''
  }
}

function removeCert(cert: string) {
  newTemplate.value.suggestedCertifications = (newTemplate.value.suggestedCertifications || []).filter(c => c !== cert)
}

// Equipment management for create modal
function addEquip() {
  if (newEquip.value.trim() && !newTemplate.value.suggestedRoomEquipment?.includes(newEquip.value.trim())) {
    newTemplate.value.suggestedRoomEquipment = [...(newTemplate.value.suggestedRoomEquipment || []), newEquip.value.trim()]
    newEquip.value = ''
  }
}

function removeEquip(equip: string) {
  newTemplate.value.suggestedRoomEquipment = (newTemplate.value.suggestedRoomEquipment || []).filter(e => e !== equip)
}

// Certification management for edit modal
function addEditCert() {
  if (!editingTemplate.value) return
  if (editCert.value.trim() && !editingTemplate.value.suggestedCertifications?.includes(editCert.value.trim())) {
    editingTemplate.value.suggestedCertifications = [...(editingTemplate.value.suggestedCertifications || []), editCert.value.trim()]
    editCert.value = ''
  }
}

function removeEditCert(cert: string) {
  if (!editingTemplate.value) return
  editingTemplate.value.suggestedCertifications = (editingTemplate.value.suggestedCertifications || []).filter(c => c !== cert)
}

// Equipment management for edit modal
function addEditEquip() {
  if (!editingTemplate.value) return
  if (editEquip.value.trim() && !editingTemplate.value.suggestedRoomEquipment?.includes(editEquip.value.trim())) {
    editingTemplate.value.suggestedRoomEquipment = [...(editingTemplate.value.suggestedRoomEquipment || []), editEquip.value.trim()]
    editEquip.value = ''
  }
}

function removeEditEquip(equip: string) {
  if (!editingTemplate.value) return
  editingTemplate.value.suggestedRoomEquipment = (editingTemplate.value.suggestedRoomEquipment || []).filter(e => e !== equip)
}

onMounted(() => {
  fetchTemplates()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Business Type Templates</h2>
        <p>Manage label templates for organizations</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="showCreateModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Template
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Alerts -->
      <Alert v-if="error" variant="danger" class="mb-3" dismissible @dismiss="error = null">
        {{ error }}
      </Alert>
      <Alert v-if="success" variant="success" class="mb-3">
        Template saved successfully!
      </Alert>

      <!-- Stats -->
      <div class="stats-grid">
        <StatCard
          :value="stats.totalTemplates"
          label="Total Templates"
          icon="building"
          color="blue"
        />
        <StatCard
          :value="stats.activeTemplates"
          label="Active Templates"
          icon="check"
          color="green"
        />
        <StatCard
          :value="stats.defaultTemplate"
          label="Default Template"
          icon="calendar"
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
            placeholder="Search templates..."
            class="form-control"
          />
        </div>
        <select v-model="statusFilter" class="form-control" style="width: 160px;">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <!-- Templates Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Templates ({{ filteredTemplates.length }})</h3>
        </div>

        <div v-if="loading && templates.length === 0" class="card-body text-center">
          <p class="text-muted">Loading templates...</p>
        </div>

        <div v-else-if="filteredTemplates.length === 0" class="card-body text-center">
          <p class="text-muted">No templates found.</p>
        </div>

        <div v-else class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Labels Preview</th>
                <th>Organizations</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="template in filteredTemplates" :key="template.id">
                <td>
                  <div class="template-name">
                    <strong>{{ template.name }}</strong>
                    <Badge v-if="template.isDefault" variant="primary" class="ml-2">Default</Badge>
                  </div>
                  <small v-if="template.description" class="text-muted">{{ template.description }}</small>
                </td>
                <td>
                  <div class="labels-preview">
                    <span class="label-preview">{{ template.staffLabel }}</span>
                    <span class="label-preview">{{ template.patientLabel }}</span>
                    <span class="label-preview">{{ template.roomLabel }}</span>
                  </div>
                </td>
                <td>
                  <span class="org-count">{{ template.organizationCount || 0 }}</span>
                </td>
                <td>
                  <Badge :variant="template.isActive ? 'success' : 'warning'">
                    {{ template.isActive ? 'Active' : 'Inactive' }}
                  </Badge>
                </td>
                <td>
                  <div class="action-buttons">
                    <Button size="sm" variant="outline" @click="openEditModal(template)">
                      Edit
                    </Button>
                    <Button
                      v-if="template.isActive && !template.isDefault"
                      size="sm"
                      variant="warning"
                      @click="handleDeleteTemplate(template)"
                    >
                      Deactivate
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Template Modal -->
    <Modal v-model="showCreateModal" title="Create Template" size="lg">
      <form @submit.prevent="handleCreateTemplate">
        <div class="form-row">
          <div class="form-group">
            <label for="name">Template Name</label>
            <input
              id="name"
              v-model="newTemplate.name"
              type="text"
              class="form-control"
              placeholder="e.g., ABA Therapy"
              required
            />
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <input
              id="description"
              v-model="newTemplate.description"
              type="text"
              class="form-control"
              placeholder="Brief description"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input v-model="newTemplate.isDefault" type="checkbox" />
            <span>Set as default template</span>
          </label>
        </div>

        <h4 class="section-title">Label Configuration</h4>
        <div class="labels-form-grid">
          <div class="form-group">
            <label>Staff (Plural)</label>
            <input v-model="newTemplate.staffLabel" type="text" class="form-control" placeholder="Staff" />
          </div>
          <div class="form-group">
            <label>Staff (Singular)</label>
            <input v-model="newTemplate.staffLabelSingular" type="text" class="form-control" placeholder="Staff Member" />
          </div>
          <div class="form-group">
            <label>Patients (Plural)</label>
            <input v-model="newTemplate.patientLabel" type="text" class="form-control" placeholder="Patients" />
          </div>
          <div class="form-group">
            <label>Patient (Singular)</label>
            <input v-model="newTemplate.patientLabelSingular" type="text" class="form-control" placeholder="Patient" />
          </div>
          <div class="form-group">
            <label>Rooms (Plural)</label>
            <input v-model="newTemplate.roomLabel" type="text" class="form-control" placeholder="Rooms" />
          </div>
          <div class="form-group">
            <label>Room (Singular)</label>
            <input v-model="newTemplate.roomLabelSingular" type="text" class="form-control" placeholder="Room" />
          </div>
          <div class="form-group">
            <label>Certifications Label</label>
            <input v-model="newTemplate.certificationLabel" type="text" class="form-control" placeholder="Certifications" />
          </div>
          <div class="form-group">
            <label>Equipment Label</label>
            <input v-model="newTemplate.equipmentLabel" type="text" class="form-control" placeholder="Equipment" />
          </div>
        </div>

        <h4 class="section-title">Suggested Options</h4>
        <div class="suggestions-form">
          <div class="form-group">
            <label>Suggested Certifications</label>
            <div class="tag-input-row">
              <input
                v-model="newCert"
                type="text"
                class="form-control"
                placeholder="Add certification..."
                @keydown.enter.prevent="addCert"
              />
              <Button type="button" variant="outline" size="sm" @click="addCert">Add</Button>
            </div>
            <div v-if="newTemplate.suggestedCertifications?.length" class="tags-list">
              <Badge
                v-for="cert in newTemplate.suggestedCertifications"
                :key="cert"
                variant="primary"
                class="tag-badge"
                @click="removeCert(cert)"
              >
                {{ cert }} ×
              </Badge>
            </div>
          </div>
          <div class="form-group">
            <label>Suggested Equipment</label>
            <div class="tag-input-row">
              <input
                v-model="newEquip"
                type="text"
                class="form-control"
                placeholder="Add equipment..."
                @keydown.enter.prevent="addEquip"
              />
              <Button type="button" variant="outline" size="sm" @click="addEquip">Add</Button>
            </div>
            <div v-if="newTemplate.suggestedRoomEquipment?.length" class="tags-list">
              <Badge
                v-for="equip in newTemplate.suggestedRoomEquipment"
                :key="equip"
                variant="primary"
                class="tag-badge"
                @click="removeEquip(equip)"
              >
                {{ equip }} ×
              </Badge>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <Button type="button" variant="outline" @click="showCreateModal = false">Cancel</Button>
          <Button type="submit" variant="primary" :loading="loading">Create Template</Button>
        </div>
      </form>
    </Modal>

    <!-- Edit Template Modal -->
    <Modal v-model="showEditModal" title="Edit Template" size="lg">
      <form v-if="editingTemplate" @submit.prevent="handleUpdateTemplate">
        <div class="form-row">
          <div class="form-group">
            <label for="edit-name">Template Name</label>
            <input
              id="edit-name"
              v-model="editingTemplate.name"
              type="text"
              class="form-control"
              required
            />
          </div>
          <div class="form-group">
            <label for="edit-description">Description</label>
            <input
              id="edit-description"
              v-model="editingTemplate.description"
              type="text"
              class="form-control"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input v-model="editingTemplate.isDefault" type="checkbox" />
            <span>Set as default template</span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input v-model="editingTemplate.isActive" type="checkbox" />
            <span>Active</span>
          </label>
        </div>

        <h4 class="section-title">Label Configuration</h4>
        <div class="labels-form-grid">
          <div class="form-group">
            <label>Staff (Plural)</label>
            <input v-model="editingTemplate.staffLabel" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Staff (Singular)</label>
            <input v-model="editingTemplate.staffLabelSingular" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Patients (Plural)</label>
            <input v-model="editingTemplate.patientLabel" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Patient (Singular)</label>
            <input v-model="editingTemplate.patientLabelSingular" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Rooms (Plural)</label>
            <input v-model="editingTemplate.roomLabel" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Room (Singular)</label>
            <input v-model="editingTemplate.roomLabelSingular" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Certifications Label</label>
            <input v-model="editingTemplate.certificationLabel" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Equipment Label</label>
            <input v-model="editingTemplate.equipmentLabel" type="text" class="form-control" />
          </div>
        </div>

        <h4 class="section-title">Suggested Options</h4>
        <div class="suggestions-form">
          <div class="form-group">
            <label>Suggested Certifications</label>
            <div class="tag-input-row">
              <input
                v-model="editCert"
                type="text"
                class="form-control"
                placeholder="Add certification..."
                @keydown.enter.prevent="addEditCert"
              />
              <Button type="button" variant="outline" size="sm" @click="addEditCert">Add</Button>
            </div>
            <div v-if="editingTemplate.suggestedCertifications?.length" class="tags-list">
              <Badge
                v-for="cert in editingTemplate.suggestedCertifications"
                :key="cert"
                variant="primary"
                class="tag-badge"
                @click="removeEditCert(cert)"
              >
                {{ cert }} ×
              </Badge>
            </div>
          </div>
          <div class="form-group">
            <label>Suggested Equipment</label>
            <div class="tag-input-row">
              <input
                v-model="editEquip"
                type="text"
                class="form-control"
                placeholder="Add equipment..."
                @keydown.enter.prevent="addEditEquip"
              />
              <Button type="button" variant="outline" size="sm" @click="addEditEquip">Add</Button>
            </div>
            <div v-if="editingTemplate.suggestedRoomEquipment?.length" class="tags-list">
              <Badge
                v-for="equip in editingTemplate.suggestedRoomEquipment"
                :key="equip"
                variant="primary"
                class="tag-badge"
                @click="removeEditEquip(equip)"
              >
                {{ equip }} ×
              </Badge>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <Button type="button" variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button type="submit" variant="primary" :loading="loading">Save Changes</Button>
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

.template-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ml-2 {
  margin-left: 8px;
}

.labels-preview {
  display: flex;
  gap: 8px;
}

.label-preview {
  font-size: 12px;
  padding: 2px 8px;
  background-color: var(--background-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.org-count {
  font-weight: 600;
  color: var(--primary-color);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.labels-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.suggestions-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.tag-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-input-row .form-control {
  flex: 1;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-badge {
  cursor: pointer;
  transition: opacity 0.2s;
}

.tag-badge:hover {
  opacity: 0.8;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
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

.mb-3 {
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .form-row,
  .labels-form-grid,
  .suggestions-form {
    grid-template-columns: 1fr;
  }
}
</style>
