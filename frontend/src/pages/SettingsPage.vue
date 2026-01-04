<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { organizationService, settingsService, type TranscriptionProviderType, type MedicalSpecialty } from '@/services/api'
import { applyBranding } from '@/composables/useBranding'
import { Alert, Badge, Button } from '@/components/ui'
import type { OrganizationLabels, OrganizationFeatures, BusinessHours } from '@/types'
import { getSubdomain } from '@/utils/subdomain'

const authStore = useAuthStore()

const organization = computed(() => authStore.organization)

// Compute the portal URL based on current subdomain
const portalUrl = computed(() => {
  const subdomain = getSubdomain()
  if (!subdomain) return null

  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = window.location.port

  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    const portSuffix = port ? `:${port}` : ''
    return `${protocol}//${subdomain}.localhost${portSuffix}/portal`
  }

  // Production
  const parts = hostname.split('.')
  const baseDomain = parts.slice(-2).join('.')
  return `${protocol}//${subdomain}.${baseDomain}/portal`
})

// Form state
const name = ref('')
const primaryColor = ref('#2563eb')
const secondaryColor = ref('#1e40af')
const logoUrl = ref<string | null>(null)
const logoFile = ref<File | null>(null)
const logoUploading = ref(false)
const logoDeleting = ref(false)

// Scheduling settings state
const timezone = ref('America/New_York')
const defaultSessionDuration = ref(60)
const slotInterval = ref(30)
const lateCancelWindowHours = ref(24)
const schedulingLoading = ref(false)
const schedulingSaving = ref(false)
const schedulingError = ref<string | null>(null)
const schedulingSuccess = ref(false)

// Business hours state
const defaultBusinessHours: BusinessHours = {
  sunday: { open: false, start: '08:00', end: '18:00' },
  monday: { open: true, start: '08:00', end: '18:00' },
  tuesday: { open: true, start: '08:00', end: '18:00' },
  wednesday: { open: true, start: '08:00', end: '18:00' },
  thursday: { open: true, start: '08:00', end: '18:00' },
  friday: { open: true, start: '08:00', end: '18:00' },
  saturday: { open: false, start: '08:00', end: '18:00' }
}
const businessHours = ref<BusinessHours>({ ...defaultBusinessHours })
const businessHoursLoading = ref(false)
const businessHoursSaving = ref(false)
const businessHoursError = ref<string | null>(null)
const businessHoursSuccess = ref(false)

// Day labels for display
const dayLabels: { key: keyof BusinessHours; label: string }[] = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' }
]

// Common timezone options
const timezoneOptions = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'UTC', label: 'UTC' }
]

// Transcription settings state
const transcriptionProvider = ref<TranscriptionProviderType>('aws_medical')
const medicalSpecialty = ref<MedicalSpecialty>('PRIMARYCARE')
const transcriptionLoading = ref(false)
const transcriptionSaving = ref(false)
const transcriptionError = ref<string | null>(null)
const transcriptionSuccess = ref(false)

// Labels settings state
const labels = ref<OrganizationLabels>({
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
const labelsLoading = ref(false)
const labelsSaving = ref(false)
const labelsError = ref<string | null>(null)
const labelsSuccess = ref(false)
const newCertification = ref('')
const newEquipment = ref('')

// Portal/features settings state
const portalLoading = ref(false)
const portalSaving = ref(false)
const portalError = ref<string | null>(null)
const portalSuccess = ref(false)

const patientPortalEnabled = ref(false)
const portalAllowCancel = ref(false)
const portalAllowReschedule = ref(false)
const portalRequireConfirmation = ref(true)

const selfBookingEnabled = ref(false)
const selfBookingLeadTimeHours = ref(24)
const selfBookingMaxFutureDays = ref(30)
const selfBookingRequiresApproval = ref(false)

const portalShowOrgName = ref(true)
const portalWelcomeTitle = ref('')
const portalWelcomeMessage = ref('')
const portalPrimaryColor = ref('')
const portalSecondaryColor = ref('')
const portalLogoUrl = ref('')
const portalBackgroundUrl = ref('')
const portalContactEmail = ref('')
const portalContactPhone = ref('')
const portalFooterText = ref('')
const portalTermsUrl = ref('')
const portalPrivacyUrl = ref('')

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

// Logo file upload handling
const logoInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function triggerLogoUpload() {
  logoInputRef.value?.click()
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false

  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processLogoFile(file)
  }
}

async function processLogoFile(file: File) {
  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    error.value = 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF, SVG'
    return
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'File size exceeds 5MB limit'
    return
  }

  logoFile.value = file
  logoUploading.value = true
  error.value = null

  try {
    const response = await organizationService.uploadLogo(file)
    logoUrl.value = response.data.logoUrl

    // Update the auth store with new org data
    if (organization.value) {
      authStore.setOrganizationContext({
        ...organization.value,
        logoUrl: response.data.logoUrl
      })
    }

    success.value = true
    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (e: unknown) {
    // Extract error message from API response or Error object
    const axiosError = e as { response?: { data?: { error?: string } } }
    if (axiosError.response?.data?.error) {
      error.value = axiosError.response.data.error
    } else if (e instanceof Error) {
      error.value = e.message
    } else {
      error.value = 'Failed to upload logo'
    }
  } finally {
    logoUploading.value = false
    logoFile.value = null
    // Reset the file input
    if (logoInputRef.value) {
      logoInputRef.value.value = ''
    }
  }
}

function handleLogoFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    processLogoFile(file)
  }
}

async function handleDeleteLogo() {
  if (!logoUrl.value) return

  logoDeleting.value = true
  error.value = null

  try {
    await organizationService.deleteLogo()
    logoUrl.value = null

    // Update the auth store
    if (organization.value) {
      authStore.setOrganizationContext({
        ...organization.value,
        logoUrl: null
      })
    }

    success.value = true
    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete logo'
  } finally {
    logoDeleting.value = false
  }
}

// Load scheduling settings
async function loadSchedulingSettings() {
  schedulingLoading.value = true
  schedulingError.value = null

  try {
    const response = await settingsService.getSettings()
    timezone.value = response.data.timezone || 'America/New_York'
    defaultSessionDuration.value = response.data.defaultSessionDuration || 60
    slotInterval.value = response.data.slotInterval || 30
    lateCancelWindowHours.value = response.data.lateCancelWindowHours || 24
  } catch (e) {
    schedulingError.value = e instanceof Error ? e.message : 'Failed to load scheduling settings'
  } finally {
    schedulingLoading.value = false
  }
}

// Save scheduling settings
async function handleSaveScheduling() {
  schedulingSaving.value = true
  schedulingError.value = null
  schedulingSuccess.value = false

  try {
    await settingsService.updateSettings({
      timezone: timezone.value,
      defaultSessionDuration: defaultSessionDuration.value,
      slotInterval: slotInterval.value,
      lateCancelWindowHours: lateCancelWindowHours.value
    })

    schedulingSuccess.value = true
    setTimeout(() => {
      schedulingSuccess.value = false
    }, 3000)
  } catch (e) {
    schedulingError.value = e instanceof Error ? e.message : 'Failed to save scheduling settings'
  } finally {
    schedulingSaving.value = false
  }
}

// Load business hours
async function loadBusinessHours() {
  businessHoursLoading.value = true
  businessHoursError.value = null

  try {
    const response = await settingsService.getBusinessHours()
    businessHours.value = response.data
  } catch (e) {
    businessHoursError.value = e instanceof Error ? e.message : 'Failed to load business hours'
  } finally {
    businessHoursLoading.value = false
  }
}

// Save business hours
async function handleSaveBusinessHours() {
  businessHoursSaving.value = true
  businessHoursError.value = null
  businessHoursSuccess.value = false

  try {
    await settingsService.updateBusinessHours(businessHours.value)

    businessHoursSuccess.value = true
    setTimeout(() => {
      businessHoursSuccess.value = false
    }, 3000)
  } catch (e) {
    businessHoursError.value = e instanceof Error ? e.message : 'Failed to save business hours'
  } finally {
    businessHoursSaving.value = false
  }
}

// Load transcription settings
// Note: Backend determines org from subdomain context, so we don't require organization.value
async function loadTranscriptionSettings() {
  transcriptionLoading.value = true
  transcriptionError.value = null

  try {
    const response = await organizationService.getTranscriptionSettings()
    transcriptionProvider.value = response.data.transcriptionProvider
    medicalSpecialty.value = response.data.medicalSpecialty
  } catch (e) {
    transcriptionError.value = e instanceof Error ? e.message : 'Failed to load transcription settings'
  } finally {
    transcriptionLoading.value = false
  }
}

// Save transcription settings
// Note: Backend determines org from subdomain context, so we don't require organization.value
async function handleSaveTranscription() {
  transcriptionSaving.value = true
  transcriptionError.value = null
  transcriptionSuccess.value = false

  try {
    await organizationService.updateTranscriptionSettings({
      transcriptionProvider: transcriptionProvider.value,
      medicalSpecialty: medicalSpecialty.value,
      organizationId: organization.value?.id
    })

    transcriptionSuccess.value = true
    setTimeout(() => {
      transcriptionSuccess.value = false
    }, 3000)
  } catch (e) {
    transcriptionError.value = e instanceof Error ? e.message : 'Failed to save transcription settings'
  } finally {
    transcriptionSaving.value = false
  }
}

// Load labels settings
async function loadLabelsSettings() {
  labelsLoading.value = true
  labelsError.value = null

  try {
    const response = await organizationService.getLabels()
    labels.value = {
      staffLabel: response.data.staffLabel || 'Staff',
      staffLabelSingular: response.data.staffLabelSingular || 'Staff Member',
      patientLabel: response.data.patientLabel || 'Patients',
      patientLabelSingular: response.data.patientLabelSingular || 'Patient',
      roomLabel: response.data.roomLabel || 'Rooms',
      roomLabelSingular: response.data.roomLabelSingular || 'Room',
      certificationLabel: response.data.certificationLabel || 'Certifications',
      equipmentLabel: response.data.equipmentLabel || 'Equipment',
      suggestedCertifications: response.data.suggestedCertifications || [],
      suggestedRoomEquipment: response.data.suggestedRoomEquipment || []
    }
  } catch (e) {
    labelsError.value = e instanceof Error ? e.message : 'Failed to load label settings'
  } finally {
    labelsLoading.value = false
  }
}

// Save labels settings
async function handleSaveLabels() {
  labelsSaving.value = true
  labelsError.value = null
  labelsSuccess.value = false

  try {
    const response = await organizationService.updateLabels(labels.value)

    // Update the auth store with new org data (response is full Organization)
    if (response.data) {
      authStore.setOrganizationContext(response.data)
    }
    labelsSuccess.value = true
    setTimeout(() => {
      labelsSuccess.value = false
    }, 3000)
  } catch (e) {
    labelsError.value = e instanceof Error ? e.message : 'Failed to save label settings'
  } finally {
    labelsSaving.value = false
  }
}

// Certification management
function addCertification() {
  if (newCertification.value.trim() && !labels.value.suggestedCertifications?.includes(newCertification.value.trim())) {
    labels.value.suggestedCertifications = [...(labels.value.suggestedCertifications || []), newCertification.value.trim()]
    newCertification.value = ''
  }
}

function removeCertification(cert: string) {
  labels.value.suggestedCertifications = (labels.value.suggestedCertifications || []).filter(c => c !== cert)
}

// Equipment management
function addEquipment() {
  if (newEquipment.value.trim() && !labels.value.suggestedRoomEquipment?.includes(newEquipment.value.trim())) {
    labels.value.suggestedRoomEquipment = [...(labels.value.suggestedRoomEquipment || []), newEquipment.value.trim()]
    newEquipment.value = ''
  }
}

function removeEquipment(equip: string) {
  labels.value.suggestedRoomEquipment = (labels.value.suggestedRoomEquipment || []).filter(e => e !== equip)
}

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOptionalHex(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

async function loadPortalSettings() {
  portalLoading.value = true
  portalError.value = null

  try {
    const response = await settingsService.getFeatures()
    const features = response.data as OrganizationFeatures

    patientPortalEnabled.value = features.patientPortalEnabled
    portalAllowCancel.value = features.portalAllowCancel
    portalAllowReschedule.value = features.portalAllowReschedule
    portalRequireConfirmation.value = features.portalRequireConfirmation

    selfBookingEnabled.value = features.selfBookingEnabled
    selfBookingLeadTimeHours.value = features.selfBookingLeadTimeHours
    selfBookingMaxFutureDays.value = features.selfBookingMaxFutureDays
    selfBookingRequiresApproval.value = features.selfBookingRequiresApproval

    portalShowOrgName.value = features.portalShowOrgName
    portalWelcomeTitle.value = features.portalWelcomeTitle || ''
    portalWelcomeMessage.value = features.portalWelcomeMessage || ''
    portalPrimaryColor.value = features.portalPrimaryColor || ''
    portalSecondaryColor.value = features.portalSecondaryColor || ''
    portalLogoUrl.value = features.portalLogoUrl || ''
    portalBackgroundUrl.value = features.portalBackgroundUrl || ''
    portalContactEmail.value = features.portalContactEmail || ''
    portalContactPhone.value = features.portalContactPhone || ''
    portalFooterText.value = features.portalFooterText || ''
    portalTermsUrl.value = features.portalTermsUrl || ''
    portalPrivacyUrl.value = features.portalPrivacyUrl || ''
  } catch (e) {
    portalError.value = e instanceof Error ? e.message : 'Failed to load portal settings'
  } finally {
    portalLoading.value = false
  }
}

async function handleSavePortalSettings() {
  portalSaving.value = true
  portalError.value = null
  portalSuccess.value = false

  try {
    await settingsService.updateFeatures({
      patientPortalEnabled: patientPortalEnabled.value,
      portalAllowCancel: portalAllowCancel.value,
      portalAllowReschedule: portalAllowReschedule.value,
      portalRequireConfirmation: portalRequireConfirmation.value,
      selfBookingEnabled: selfBookingEnabled.value,
      selfBookingLeadTimeHours: selfBookingLeadTimeHours.value,
      selfBookingMaxFutureDays: selfBookingMaxFutureDays.value,
      selfBookingRequiresApproval: selfBookingRequiresApproval.value,
      portalShowOrgName: portalShowOrgName.value,
      portalWelcomeTitle: portalWelcomeTitle.value.trim(),
      portalWelcomeMessage: portalWelcomeMessage.value.trim(),
      portalPrimaryColor: normalizeOptionalHex(portalPrimaryColor.value),
      portalSecondaryColor: normalizeOptionalHex(portalSecondaryColor.value),
      portalLogoUrl: normalizeOptionalString(portalLogoUrl.value),
      portalBackgroundUrl: normalizeOptionalString(portalBackgroundUrl.value),
      portalContactEmail: normalizeOptionalString(portalContactEmail.value),
      portalContactPhone: normalizeOptionalString(portalContactPhone.value),
      portalFooterText: normalizeOptionalString(portalFooterText.value),
      portalTermsUrl: normalizeOptionalString(portalTermsUrl.value),
      portalPrivacyUrl: normalizeOptionalString(portalPrivacyUrl.value)
    } as Partial<OrganizationFeatures>)

    portalSuccess.value = true
    setTimeout(() => {
      portalSuccess.value = false
    }, 3000)
  } catch (e) {
    portalError.value = e instanceof Error ? e.message : 'Failed to save portal settings'
  } finally {
    portalSaving.value = false
  }
}

// Load settings on mount
onMounted(() => {
  loadSchedulingSettings()
  loadBusinessHours()
  loadTranscriptionSettings()
  loadLabelsSettings()
  loadPortalSettings()
})
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
              <label>Organization Logo</label>
              <div class="logo-upload-area" :class="{ 'is-uploading': logoUploading }">
                <div v-if="logoUploading" class="logo-uploading-overlay">
                  <div class="spinner"></div>
                  <span>Uploading...</span>
                </div>
                <div v-if="logoUrl" class="logo-preview-container">
                  <img :src="logoUrl" alt="Logo preview" class="preview-image" />
                  <div class="logo-actions">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      :disabled="logoUploading || logoDeleting"
                      @click="triggerLogoUpload"
                    >
                      {{ logoUploading ? 'Uploading...' : 'Change' }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-danger-outline"
                      :disabled="logoDeleting || logoUploading"
                      @click="handleDeleteLogo"
                    >
                      {{ logoDeleting ? 'Deleting...' : 'Remove' }}
                    </button>
                  </div>
                </div>
                <div
                  v-else
                  class="logo-upload-placeholder"
                  :class="{ 'drag-over': isDragging }"
                  @click="triggerLogoUpload"
                  @dragover="handleDragOver"
                  @dragleave="handleDragLeave"
                  @drop="handleDrop"
                >
                  <div class="upload-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <span class="upload-text">{{ logoUploading ? 'Uploading...' : isDragging ? 'Drop to upload' : 'Click or drag to upload logo' }}</span>
                  <span class="upload-hint">PNG, JPG, WebP, GIF, or SVG (max 5MB)</span>
                </div>
                <input
                  ref="logoInputRef"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  class="hidden-file-input"
                  @change="handleLogoFileChange"
                />
              </div>
              <small class="text-muted">Logo will be resized to multiple sizes and a grayscale version will be created for print.</small>
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
            <h3>Scheduling Settings</h3>
          </div>
          <div class="card-body">
            <Alert v-if="schedulingError" variant="danger" class="mb-3" dismissible @dismiss="schedulingError = null">
              {{ schedulingError }}
            </Alert>

            <Alert v-if="schedulingSuccess" variant="success" class="mb-3">
              Scheduling settings saved successfully!
            </Alert>

            <div v-if="schedulingLoading" class="loading-state">
              Loading scheduling settings...
            </div>

            <template v-else>
              <div class="form-group">
                <label for="timezone">Timezone</label>
                <select
                  id="timezone"
                  v-model="timezone"
                  class="form-control"
                >
                  <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                    {{ tz.label }}
                  </option>
                </select>
                <small class="text-muted">
                  Used for schedule generation and displaying session times.
                </small>
              </div>

              <div class="form-group">
                <label for="default-duration">Default Session Duration (minutes)</label>
                <input
                  id="default-duration"
                  v-model.number="defaultSessionDuration"
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label for="slot-interval">Slot Interval (minutes)</label>
                <input
                  id="slot-interval"
                  v-model.number="slotInterval"
                  type="number"
                  min="5"
                  max="60"
                  step="5"
                  class="form-control"
                />
                <small class="text-muted">
                  How often new time slots start (e.g., 30 = slots at :00 and :30).
                </small>
              </div>

              <div class="form-group">
                <label for="late-cancel">Late Cancellation Window (hours)</label>
                <input
                  id="late-cancel"
                  v-model.number="lateCancelWindowHours"
                  type="number"
                  min="0"
                  max="168"
                  class="form-control"
                />
                <small class="text-muted">
                  Cancellations within this window of the session time are marked as late.
                </small>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="schedulingSaving"
                  @click="handleSaveScheduling"
                >
                  {{ schedulingSaving ? 'Saving...' : 'Save Scheduling Settings' }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Operating Days</h3>
          </div>
          <div class="card-body">
            <Alert v-if="businessHoursError" variant="danger" class="mb-3" dismissible @dismiss="businessHoursError = null">
              {{ businessHoursError }}
            </Alert>

            <Alert v-if="businessHoursSuccess" variant="success" class="mb-3">
              Operating days saved successfully!
            </Alert>

            <div v-if="businessHoursLoading" class="loading-state">
              Loading operating days...
            </div>

            <template v-else>
              <p class="text-muted mb-3">
                Select which days of the week your organization is open for scheduling sessions.
                The AI scheduler will only create sessions on open days.
              </p>

              <div class="business-hours-grid">
                <div
                  v-for="day in dayLabels"
                  :key="day.key"
                  class="business-hours-row"
                  :class="{ 'day-closed': !businessHours[day.key].open }"
                >
                  <label class="day-toggle">
                    <input
                      v-model="businessHours[day.key].open"
                      type="checkbox"
                    />
                    <span class="day-name">{{ day.label }}</span>
                  </label>

                  <div v-if="businessHours[day.key].open" class="hours-inputs">
                    <input
                      v-model="businessHours[day.key].start"
                      type="time"
                      class="form-control time-input"
                    />
                    <span class="time-separator">to</span>
                    <input
                      v-model="businessHours[day.key].end"
                      type="time"
                      class="form-control time-input"
                    />
                  </div>
                  <div v-else class="closed-label">
                    Closed
                  </div>
                </div>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="businessHoursSaving"
                  @click="handleSaveBusinessHours"
                >
                  {{ businessHoursSaving ? 'Saving...' : 'Save Operating Days' }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Voice Transcription</h3>
          </div>
          <div class="card-body">
            <Alert v-if="transcriptionError" variant="danger" class="mb-3" dismissible @dismiss="transcriptionError = null">
              {{ transcriptionError }}
            </Alert>

            <Alert v-if="transcriptionSuccess" variant="success" class="mb-3">
              Transcription settings saved successfully!
            </Alert>

            <div v-if="transcriptionLoading" class="loading-state">
              Loading transcription settings...
            </div>

            <template v-else>
              <div class="form-group">
                <label for="transcription-provider">Transcription Provider</label>
                <select
                  id="transcription-provider"
                  v-model="transcriptionProvider"
                  class="form-control"
                >
                  <option value="aws_medical">AWS Medical Transcribe (HIPAA-eligible)</option>
                  <option value="aws_standard">AWS Standard Transcribe</option>
                </select>
                <small class="text-muted">
                  AWS Medical Transcribe is optimized for medical terminology and HIPAA-eligible.
                </small>
              </div>

              <div v-if="transcriptionProvider === 'aws_medical'" class="form-group">
                <label for="medical-specialty">Medical Specialty</label>
                <select
                  id="medical-specialty"
                  v-model="medicalSpecialty"
                  class="form-control"
                >
                  <option value="PRIMARYCARE">Primary Care</option>
                  <option value="CARDIOLOGY">Cardiology</option>
                  <option value="NEUROLOGY">Neurology</option>
                  <option value="ONCOLOGY">Oncology</option>
                  <option value="RADIOLOGY">Radiology</option>
                  <option value="UROLOGY">Urology</option>
                </select>
                <small class="text-muted">
                  Selecting the appropriate specialty improves transcription accuracy for medical terms.
                </small>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="transcriptionSaving"
                  @click="handleSaveTranscription"
                >
                  {{ transcriptionSaving ? 'Saving...' : 'Save Transcription Settings' }}
                </button>
              </div>
            </template>
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

        <div class="card card-full-width">
          <div class="card-header card-header-with-action">
            <h3>Patient Portal & Self-Booking</h3>
            <a
              v-if="portalUrl"
              :href="portalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="view-portal-link"
            >
              View Portal →
            </a>
          </div>
          <div class="card-body">
            <Alert v-if="portalError" variant="danger" class="mb-3" dismissible @dismiss="portalError = null">
              {{ portalError }}
            </Alert>

            <Alert v-if="portalSuccess" variant="success" class="mb-3">
              Portal settings saved successfully!
            </Alert>

            <div v-if="portalLoading" class="loading-state">
              Loading portal settings...
            </div>

            <template v-else>
              <div class="form-group">
                <label>
                  <input v-model="patientPortalEnabled" type="checkbox" />
                  Enable Patient Portal
                </label>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label>
                    <input v-model="portalRequireConfirmation" type="checkbox" />
                    Require Appointment Confirmation
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <input v-model="portalAllowCancel" type="checkbox" />
                    Allow Portal Cancellation
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <input v-model="portalAllowReschedule" type="checkbox" />
                    Allow Portal Rescheduling
                  </label>
                </div>
              </div>

              <hr class="separator" />

              <div class="form-group">
                <label>
                  <input v-model="selfBookingEnabled" type="checkbox" />
                  Enable Self-Booking
                </label>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label for="lead-time">Lead Time (hours)</label>
                  <input
                    id="lead-time"
                    v-model.number="selfBookingLeadTimeHours"
                    type="number"
                    min="0"
                    max="168"
                    class="form-control"
                  />
                </div>
                <div class="form-group">
                  <label for="max-future">Max Future Days</label>
                  <input
                    id="max-future"
                    v-model.number="selfBookingMaxFutureDays"
                    type="number"
                    min="0"
                    max="365"
                    class="form-control"
                  />
                </div>
                <div class="form-group">
                  <label>
                    <input v-model="selfBookingRequiresApproval" type="checkbox" />
                    Require Approval (book as pending)
                  </label>
                </div>
              </div>

              <hr class="separator" />

              <h4>Portal Appearance</h4>
              <div class="grid-2">
                <div class="form-group">
                  <label>
                    <input v-model="portalShowOrgName" type="checkbox" />
                    Show Organization Name
                  </label>
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label for="portal-primary">Portal Primary Color (optional)</label>
                  <input
                    id="portal-primary"
                    v-model="portalPrimaryColor"
                    type="text"
                    class="form-control"
                    placeholder="#2563eb (leave blank to use org color)"
                    pattern="^#[0-9a-fA-F]{6}$"
                    maxlength="7"
                  />
                </div>
                <div class="form-group">
                  <label for="portal-secondary">Portal Secondary Color (optional)</label>
                  <input
                    id="portal-secondary"
                    v-model="portalSecondaryColor"
                    type="text"
                    class="form-control"
                    placeholder="#1e40af (leave blank to use org color)"
                    pattern="^#[0-9a-fA-F]{6}$"
                    maxlength="7"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="portal-logo">Portal Logo URL (optional)</label>
                <input
                  id="portal-logo"
                  v-model="portalLogoUrl"
                  type="url"
                  class="form-control"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div class="form-group">
                <label for="portal-bg">Portal Background Image URL (optional)</label>
                <input
                  id="portal-bg"
                  v-model="portalBackgroundUrl"
                  type="url"
                  class="form-control"
                  placeholder="https://example.com/background.jpg"
                />
              </div>

              <div class="form-group">
                <label for="welcome-title">Welcome Title</label>
                <input
                  id="welcome-title"
                  v-model="portalWelcomeTitle"
                  type="text"
                  class="form-control"
                  maxlength="100"
                />
              </div>

              <div class="form-group">
                <label for="welcome-message">Welcome Message</label>
                <textarea
                  id="welcome-message"
                  v-model="portalWelcomeMessage"
                  class="form-control"
                  maxlength="500"
                  rows="3"
                />
              </div>

              <hr class="separator" />

              <h4>Portal Footer & Legal</h4>
              <div class="grid-2">
                <div class="form-group">
                  <label for="portal-contact-email">Support Email (optional)</label>
                  <input
                    id="portal-contact-email"
                    v-model="portalContactEmail"
                    type="email"
                    class="form-control"
                    placeholder="support@example.com"
                  />
                </div>
                <div class="form-group">
                  <label for="portal-contact-phone">Support Phone (optional)</label>
                  <input
                    id="portal-contact-phone"
                    v-model="portalContactPhone"
                    type="tel"
                    class="form-control"
                    placeholder="+1 555-555-5555"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="portal-footer">Footer Text (optional)</label>
                <input
                  id="portal-footer"
                  v-model="portalFooterText"
                  type="text"
                  class="form-control"
                  maxlength="500"
                  placeholder="Custom footer message"
                />
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label for="portal-terms">Terms URL (optional)</label>
                  <input
                    id="portal-terms"
                    v-model="portalTermsUrl"
                    type="url"
                    class="form-control"
                    placeholder="https://example.com/terms"
                  />
                </div>
                <div class="form-group">
                  <label for="portal-privacy">Privacy URL (optional)</label>
                  <input
                    id="portal-privacy"
                    v-model="portalPrivacyUrl"
                    type="url"
                    class="form-control"
                    placeholder="https://example.com/privacy"
                  />
                </div>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="portalSaving"
                  @click="handleSavePortalSettings"
                >
                  {{ portalSaving ? 'Saving...' : 'Save Portal Settings' }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <div class="card card-full-width">
          <div class="card-header">
            <h3>Custom Labels</h3>
          </div>
          <div class="card-body">
            <Alert v-if="labelsError" variant="danger" class="mb-3" dismissible @dismiss="labelsError = null">
              {{ labelsError }}
            </Alert>

            <Alert v-if="labelsSuccess" variant="success" class="mb-3">
              Label settings saved successfully!
            </Alert>

            <div v-if="labelsLoading" class="loading-state">
              Loading label settings...
            </div>

            <template v-else>
              <p class="text-muted mb-3">
                Customize how entities are named throughout the application. These labels will appear in navigation, page titles, buttons, and forms.
              </p>

              <div class="labels-grid">
                <!-- Staff Labels -->
                <div class="label-group">
                  <h4>Staff Labels</h4>
                  <div class="form-group">
                    <label for="staff-label">Plural (e.g., "Staff", "Therapists")</label>
                    <input
                      id="staff-label"
                      v-model="labels.staffLabel"
                      type="text"
                      class="form-control"
                      placeholder="Staff"
                    />
                  </div>
                  <div class="form-group">
                    <label for="staff-label-singular">Singular (e.g., "Staff Member", "Therapist")</label>
                    <input
                      id="staff-label-singular"
                      v-model="labels.staffLabelSingular"
                      type="text"
                      class="form-control"
                      placeholder="Staff Member"
                    />
                  </div>
                </div>

                <!-- Patient Labels -->
                <div class="label-group">
                  <h4>Patient Labels</h4>
                  <div class="form-group">
                    <label for="patient-label">Plural (e.g., "Patients", "Clients")</label>
                    <input
                      id="patient-label"
                      v-model="labels.patientLabel"
                      type="text"
                      class="form-control"
                      placeholder="Patients"
                    />
                  </div>
                  <div class="form-group">
                    <label for="patient-label-singular">Singular (e.g., "Patient", "Client")</label>
                    <input
                      id="patient-label-singular"
                      v-model="labels.patientLabelSingular"
                      type="text"
                      class="form-control"
                      placeholder="Patient"
                    />
                  </div>
                </div>

                <!-- Room Labels -->
                <div class="label-group">
                  <h4>Room Labels</h4>
                  <div class="form-group">
                    <label for="room-label">Plural (e.g., "Rooms", "Treatment Areas")</label>
                    <input
                      id="room-label"
                      v-model="labels.roomLabel"
                      type="text"
                      class="form-control"
                      placeholder="Rooms"
                    />
                  </div>
                  <div class="form-group">
                    <label for="room-label-singular">Singular (e.g., "Room", "Treatment Area")</label>
                    <input
                      id="room-label-singular"
                      v-model="labels.roomLabelSingular"
                      type="text"
                      class="form-control"
                      placeholder="Room"
                    />
                  </div>
                </div>

                <!-- Other Labels -->
                <div class="label-group">
                  <h4>Other Labels</h4>
                  <div class="form-group">
                    <label for="certification-label">Certifications Label</label>
                    <input
                      id="certification-label"
                      v-model="labels.certificationLabel"
                      type="text"
                      class="form-control"
                      placeholder="Certifications"
                    />
                  </div>
                  <div class="form-group">
                    <label for="equipment-label">Room Equipment Label</label>
                    <input
                      id="equipment-label"
                      v-model="labels.equipmentLabel"
                      type="text"
                      class="form-control"
                      placeholder="Equipment"
                    />
                  </div>
                </div>
              </div>

              <!-- Suggested Certifications -->
              <div class="suggestions-section">
                <h4>Suggested {{ labels.certificationLabel || 'Certifications' }}</h4>
                <p class="text-muted text-sm">
                  These will be shown as suggestions when adding {{ (labels.staffLabelSingular || 'staff member').toLowerCase() }} certifications.
                </p>
                <div class="tag-input-row">
                  <input
                    v-model="newCertification"
                    type="text"
                    class="form-control"
                    placeholder="Add certification..."
                    @keydown.enter.prevent="addCertification"
                  />
                  <Button type="button" variant="outline" size="sm" @click="addCertification">Add</Button>
                </div>
                <div v-if="labels.suggestedCertifications?.length" class="tags-list">
                  <Badge
                    v-for="cert in labels.suggestedCertifications"
                    :key="cert"
                    variant="primary"
                    class="tag-badge"
                    @click="removeCertification(cert)"
                  >
                    {{ cert }} ×
                  </Badge>
                </div>
              </div>

              <!-- Suggested Equipment -->
              <div class="suggestions-section">
                <h4>Suggested {{ labels.equipmentLabel || 'Equipment' }}</h4>
                <p class="text-muted text-sm">
                  These will be shown as suggestions when configuring {{ (labels.roomLabelSingular || 'room').toLowerCase() }} capabilities.
                </p>
                <div class="tag-input-row">
                  <input
                    v-model="newEquipment"
                    type="text"
                    class="form-control"
                    placeholder="Add equipment..."
                    @keydown.enter.prevent="addEquipment"
                  />
                  <Button type="button" variant="outline" size="sm" @click="addEquipment">Add</Button>
                </div>
                <div v-if="labels.suggestedRoomEquipment?.length" class="tags-list">
                  <Badge
                    v-for="equip in labels.suggestedRoomEquipment"
                    :key="equip"
                    variant="primary"
                    class="tag-badge"
                    @click="removeEquipment(equip)"
                  >
                    {{ equip }} ×
                  </Badge>
                </div>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="labelsSaving"
                  @click="handleSaveLabels"
                >
                  {{ labelsSaving ? 'Saving...' : 'Save Label Settings' }}
                </button>
              </div>
            </template>
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

.logo-upload-area {
  margin-top: 8px;
  position: relative;
}

.logo-upload-area.is-uploading {
  pointer-events: none;
}

.logo-uploading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.logo-preview-container {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.preview-image {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: white;
}

.logo-actions {
  display: flex;
  gap: 8px;
}

.logo-upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--background-color);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.logo-upload-placeholder:hover,
.logo-upload-placeholder.drag-over {
  border-color: var(--color-primary);
  background-color: rgba(37, 99, 235, 0.05);
}

.logo-upload-placeholder.drag-over {
  border-style: solid;
}

.upload-icon {
  color: var(--text-muted);
}

.upload-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.hidden-file-input {
  display: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-danger-outline {
  color: #dc2626;
  border-color: #dc2626;
  background: transparent;
}

.btn-danger-outline:hover {
  background-color: rgba(220, 38, 38, 0.1);
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

.loading-state {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .color-row {
    grid-template-columns: 1fr;
  }
}

.card-full-width {
  grid-column: 1 / -1;
}

.card-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-portal-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.view-portal-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.labels-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

.label-group h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.suggestions-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--background-color);
  border-radius: var(--radius-md);
}

.suggestions-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.tag-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
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

.text-sm {
  font-size: 13px;
}

.mb-3 {
  margin-bottom: 16px;
}

.separator {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 20px 0;
}

@media (max-width: 768px) {
  .labels-grid {
    grid-template-columns: 1fr;
  }
}

/* Business Hours Styles */
.business-hours-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.business-hours-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: background-color 0.2s, border-color 0.2s;
}

.business-hours-row.day-closed {
  background-color: #f8f9fa;
  opacity: 0.7;
}

.day-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  min-width: 140px;
}

.day-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.day-name {
  font-weight: 500;
  color: var(--text-primary);
}

.hours-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input {
  width: 120px;
  padding: 6px 10px;
  font-size: 14px;
}

.time-separator {
  color: var(--text-muted);
  font-size: 13px;
}

.closed-label {
  color: var(--text-muted);
  font-size: 14px;
  font-style: italic;
}

@media (max-width: 640px) {
  .business-hours-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .hours-inputs {
    width: 100%;
  }

  .time-input {
    flex: 1;
  }
}
</style>
