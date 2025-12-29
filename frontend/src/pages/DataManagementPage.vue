<script setup lang="ts">
import { ref, computed } from 'vue'
import { Modal, Alert, Button, Badge } from '@/components/ui'
import {
  dataManagementService,
  type ExportEntityType,
  type ExportFormat,
  type ImportPreview,
  type ImportResult
} from '@/services/api'

// Entity type definitions
const entityTypes: { value: ExportEntityType; label: string; description: string }[] = [
  { value: 'staff', label: 'Staff', description: 'Therapists and staff members' },
  { value: 'patients', label: 'Patients', description: 'Patient records' },
  { value: 'rooms', label: 'Rooms', description: 'Therapy rooms and facilities' },
  { value: 'rules', label: 'Rules', description: 'Scheduling rules and constraints' }
]

// Export state
const exportLoading = ref<string | null>(null)
const exportError = ref<string | null>(null)
const exportSuccess = ref<string | null>(null)

// Import state
const showImportModal = ref(false)
const selectedEntityType = ref<ExportEntityType>('staff')
const selectedFile = ref<File | null>(null)
const importFormat = ref<ExportFormat>('csv')
const importPreview = ref<ImportPreview | null>(null)
const parsedRecords = ref<Record<string, unknown>[]>([])
const importLoading = ref(false)
const importPreviewLoading = ref(false)
const importResult = ref<ImportResult | null>(null)
const importError = ref<string | null>(null)

// Get entity label
function getEntityLabel(value: ExportEntityType): string {
  return entityTypes.find(e => e.value === value)?.label || value
}

// Export functions
async function handleExport(entityType: ExportEntityType, format: ExportFormat) {
  exportLoading.value = `${entityType}-${format}`
  exportError.value = null
  exportSuccess.value = null

  try {
    const blob = await dataManagementService.exportData(entityType, format)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().split('T')[0]
    link.download = `${entityType}-${date}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    exportSuccess.value = `${getEntityLabel(entityType)} exported successfully as ${format.toUpperCase()}`
    setTimeout(() => { exportSuccess.value = null }, 3000)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Export failed'
  } finally {
    exportLoading.value = null
  }
}

// Import functions
function openImportModal(entityType: ExportEntityType) {
  selectedEntityType.value = entityType
  selectedFile.value = null
  importPreview.value = null
  importResult.value = null
  importError.value = null
  parsedRecords.value = []
  showImportModal.value = true
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.[0]) {
    selectedFile.value = target.files[0]
    // Detect format from file extension
    importFormat.value = selectedFile.value.name.endsWith('.json') ? 'json' : 'csv'
    // Reset preview
    importPreview.value = null
    importResult.value = null
    importError.value = null
  }
}

async function handlePreview() {
  if (!selectedFile.value) return

  importPreviewLoading.value = true
  importError.value = null

  try {
    const response = await dataManagementService.previewImport(
      selectedFile.value,
      selectedEntityType.value,
      importFormat.value
    )
    importPreview.value = response.data
    parsedRecords.value = response.data.records
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Preview failed'
  } finally {
    importPreviewLoading.value = false
  }
}

async function handleImport() {
  if (!importPreview.value || importPreview.value.toCreate === 0) return

  importLoading.value = true
  importError.value = null

  try {
    const response = await dataManagementService.executeImport(
      selectedEntityType.value,
      parsedRecords.value
    )
    importResult.value = response.data
    importPreview.value = null
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Import failed'
  } finally {
    importLoading.value = false
  }
}

function closeImportModal() {
  showImportModal.value = false
  selectedFile.value = null
  importPreview.value = null
  importResult.value = null
  parsedRecords.value = []
  importError.value = null
}

// Format preview value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Get preview table headers
const previewHeaders = computed(() => {
  if (!importPreview.value?.records.length) return []
  return Object.keys(importPreview.value.records[0]).slice(0, 6) // Limit to first 6 columns
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Data Management</h2>
        <p>Export and import organization data</p>
      </div>
    </header>

    <div class="page-content">
      <!-- Success/Error Alerts -->
      <Alert v-if="exportSuccess" variant="success" class="mb-3" dismissible @dismiss="exportSuccess = null">
        {{ exportSuccess }}
      </Alert>
      <Alert v-if="exportError" variant="danger" class="mb-3" dismissible @dismiss="exportError = null">
        {{ exportError }}
      </Alert>

      <!-- Export Section -->
      <div class="card mb-3">
        <div class="card-header">
          <h3>Export Data</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-3">Download your organization data in CSV or JSON format.</p>

          <div class="entity-grid">
            <div v-for="entity in entityTypes" :key="entity.value" class="entity-card">
              <div class="entity-info">
                <div class="entity-icon">
                  <svg v-if="entity.value === 'staff'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <svg v-else-if="entity.value === 'patients'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <svg v-else-if="entity.value === 'rooms'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <svg v-else-if="entity.value === 'rules'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <div class="entity-name">{{ entity.label }}</div>
                  <div class="entity-description">{{ entity.description }}</div>
                </div>
              </div>
              <div class="entity-actions">
                <Button
                  variant="outline"
                  size="sm"
                  :loading="exportLoading === `${entity.value}-csv`"
                  @click="handleExport(entity.value, 'csv')"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :loading="exportLoading === `${entity.value}-json`"
                  @click="handleExport(entity.value, 'json')"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  JSON
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Import Section -->
      <div class="card">
        <div class="card-header">
          <h3>Import Data</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-3">
            Upload a CSV or JSON file to import data. Duplicate records (matching by name/identifier) will be skipped.
          </p>

          <div class="entity-grid">
            <div v-for="entity in entityTypes" :key="entity.value" class="entity-card">
              <div class="entity-info">
                <div class="entity-icon entity-icon-import">
                  <svg v-if="entity.value === 'staff'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <svg v-else-if="entity.value === 'patients'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <svg v-else-if="entity.value === 'rooms'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <svg v-else-if="entity.value === 'rules'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <div class="entity-name">{{ entity.label }}</div>
                  <div class="entity-description">{{ entity.description }}</div>
                </div>
              </div>
              <div class="entity-actions">
                <Button
                  variant="primary"
                  size="sm"
                  @click="openImportModal(entity.value)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <Modal v-model="showImportModal" :title="`Import ${getEntityLabel(selectedEntityType)}`" size="lg">
      <Alert v-if="importError" variant="danger" class="mb-3">
        {{ importError }}
      </Alert>

      <!-- Success Result -->
      <div v-if="importResult" class="import-result">
        <Alert variant="success" class="mb-3">
          Import completed successfully!
        </Alert>
        <div class="result-stats">
          <div class="stat stat-success">
            <span class="stat-value">{{ importResult.created }}</span>
            <span class="stat-label">Records Created</span>
          </div>
          <div class="stat stat-warning">
            <span class="stat-value">{{ importResult.skipped }}</span>
            <span class="stat-label">Duplicates Skipped</span>
          </div>
        </div>
        <div v-if="importResult.errors.length > 0" class="result-errors mt-3">
          <h4>Errors:</h4>
          <ul>
            <li v-for="(error, i) in importResult.errors" :key="i" class="text-danger">{{ error }}</li>
          </ul>
        </div>
      </div>

      <!-- File Selection -->
      <div v-else>
        <div class="form-group">
          <label>Select File</label>
          <input
            type="file"
            class="form-control"
            accept=".csv,.json"
            @change="handleFileSelect"
          />
          <small class="text-muted">Supported formats: CSV, JSON (max 10MB)</small>
        </div>

        <div v-if="selectedFile" class="selected-file mt-2">
          <Badge variant="primary">{{ selectedFile.name }}</Badge>
          <span class="text-muted ms-2">{{ (selectedFile.size / 1024).toFixed(1) }} KB</span>
        </div>

        <!-- Preview Button -->
        <div v-if="selectedFile && !importPreview" class="mt-3">
          <Button
            variant="outline"
            :loading="importPreviewLoading"
            @click="handlePreview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Import
          </Button>
        </div>

        <!-- Preview Results -->
        <div v-if="importPreview" class="import-preview mt-3">
          <div class="preview-stats">
            <div class="stat">
              <span class="stat-value">{{ importPreview.total }}</span>
              <span class="stat-label">Total Records</span>
            </div>
            <div class="stat stat-success">
              <span class="stat-value">{{ importPreview.toCreate }}</span>
              <span class="stat-label">To Create</span>
            </div>
            <div class="stat stat-warning">
              <span class="stat-value">{{ importPreview.toSkip }}</span>
              <span class="stat-label">Duplicates (Skip)</span>
            </div>
          </div>

          <div v-if="importPreview.errors.length > 0" class="preview-errors mt-3">
            <Alert variant="danger">
              <strong>Validation Errors:</strong>
              <ul class="mb-0 mt-2">
                <li v-for="(error, i) in importPreview.errors" :key="i">{{ error }}</li>
              </ul>
            </Alert>
          </div>

          <div v-if="importPreview.records.length > 0 && importPreview.errors.length === 0" class="preview-table mt-3">
            <h4>Preview (first {{ Math.min(5, importPreview.records.length) }} records to create):</h4>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th v-for="key in previewHeaders" :key="key">{{ key }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(record, i) in importPreview.records.slice(0, 5)" :key="i">
                    <td v-for="key in previewHeaders" :key="key">
                      {{ formatValue(record[key]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button variant="outline" @click="closeImportModal">
          {{ importResult ? 'Close' : 'Cancel' }}
        </Button>
        <Button
          v-if="importPreview && importPreview.toCreate > 0 && importPreview.errors.length === 0 && !importResult"
          variant="primary"
          :loading="importLoading"
          @click="handleImport"
        >
          Import {{ importPreview.toCreate }} Records
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.entity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.entity-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.entity-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.entity-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.entity-icon-import {
  background-color: var(--success-color);
}

.entity-name {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 4px;
}

.entity-description {
  font-size: 13px;
  color: var(--text-secondary);
}

.entity-actions {
  display: flex;
  gap: 8px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-stats,
.result-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat {
  text-align: center;
  padding: 16px 24px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  min-width: 100px;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.stat-success {
  background-color: rgba(34, 197, 94, 0.1);
}

.stat-success .stat-value {
  color: var(--success-color);
}

.stat-warning {
  background-color: rgba(234, 179, 8, 0.1);
}

.stat-warning .stat-value {
  color: #b45309;
}

.preview-table h4,
.result-errors h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.preview-table .table-container {
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.preview-table table {
  width: 100%;
  font-size: 13px;
}

.preview-table th {
  text-transform: capitalize;
}

.preview-table td {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-result {
  padding: 8px 0;
}

.result-errors ul {
  margin: 0;
  padding-left: 20px;
}

.text-danger {
  color: var(--danger-color);
}

.ms-2 {
  margin-left: 8px;
}
</style>
