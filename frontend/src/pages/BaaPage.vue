<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBaaStore } from '@/stores/baa'
import { Alert, Badge, Modal } from '@/components/ui'

const authStore = useAuthStore()
const baaStore = useBaaStore()

const isAdmin = computed(() => authStore.isAdmin || authStore.isSuperAdmin)

// Sign form state
const showSignModal = ref(false)
const signerName = ref('')
const signerTitle = ref('')
const signerEmail = ref('')
const consent = ref(false)
const signError = ref<string | null>(null)

// Preview state
const showPreview = ref(false)

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

// Initialize with current user info
function initSignForm() {
  if (authStore.user) {
    signerName.value = authStore.user.name
    signerEmail.value = authStore.user.email
  }
  signerTitle.value = ''
  consent.value = false
  signError.value = null
}

async function handleSign() {
  if (!consent.value) {
    signError.value = 'You must consent to electronic signature'
    return
  }

  if (!signerName.value || !signerTitle.value || !signerEmail.value) {
    signError.value = 'All fields are required'
    return
  }

  try {
    await baaStore.signBaa({
      signerName: signerName.value,
      signerTitle: signerTitle.value,
      signerEmail: signerEmail.value,
      consent: consent.value
    })
    showSignModal.value = false
  } catch (e) {
    signError.value = e instanceof Error ? e.message : 'Failed to sign BAA'
  }
}

async function handleDownload() {
  try {
    await baaStore.downloadBaa()
  } catch {
    // Error handled by store
  }
}

async function handleViewPreview() {
  showPreview.value = true
  if (!baaStore.baaPreview) {
    await baaStore.fetchBaaPreview()
  }
}

function openSignModal() {
  initSignForm()
  showSignModal.value = true
}

onMounted(async () => {
  await baaStore.fetchBaaStatus()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>HIPAA Business Associate Agreement</h2>
        <p>Review and sign the BAA for your organization</p>
      </div>
    </header>

    <div class="page-content">
      <Alert v-if="baaStore.error" variant="danger" class="mb-3" dismissible @dismiss="baaStore.clearError">
        {{ baaStore.error }}
      </Alert>

      <!-- Loading State -->
      <div v-if="baaStore.loading && !baaStore.baaStatus" class="loading-state">
        <p>Loading BAA status...</p>
      </div>

      <!-- BAA Status Card -->
      <div v-else class="card mb-4">
        <div class="card-header">
          <h3>Agreement Status</h3>
          <Badge v-if="baaStore.statusInfo" :variant="statusColors[baaStore.currentStatus] || 'secondary'">
            {{ baaStore.statusInfo.label }}
          </Badge>
        </div>
        <div class="card-body">
          <p v-if="baaStore.statusInfo" class="status-description">
            {{ baaStore.statusInfo.description }}
          </p>

          <!-- Status-specific content -->
          <div v-if="baaStore.currentStatus === 'not_started' || baaStore.currentStatus === 'awaiting_org_signature'" class="status-content">
            <div class="info-box">
              <h4>What is a BAA?</h4>
              <p>
                A Business Associate Agreement (BAA) is a contract required under HIPAA between a covered entity
                (your organization) and a business associate (Say It Schedule) that handles Protected Health Information (PHI).
              </p>
              <p>
                This agreement ensures that Say It Schedule will appropriately safeguard any PHI that is created,
                received, maintained, or transmitted on behalf of your organization.
              </p>
            </div>

            <div v-if="isAdmin" class="action-buttons">
              <button class="btn btn-outline" @click="handleViewPreview">
                Preview Agreement
              </button>
              <button class="btn btn-primary" @click="openSignModal">
                Review &amp; Sign BAA
              </button>
            </div>
            <div v-else class="info-notice">
              <p>Only organization administrators can sign the BAA. Please contact your administrator.</p>
            </div>
          </div>

          <div v-else-if="baaStore.currentStatus === 'awaiting_vendor_signature'" class="status-content">
            <div class="info-box info-box-info">
              <h4>Awaiting Countersignature</h4>
              <p>
                Your organization has signed the BAA. Say It Schedule will review and countersign the agreement shortly.
                You will be notified once the agreement is fully executed.
              </p>
              <div v-if="baaStore.baaStatus?.agreement" class="signature-info">
                <p><strong>Signed by:</strong> {{ baaStore.baaStatus.agreement.orgSignerName }}</p>
                <p><strong>Title:</strong> {{ baaStore.baaStatus.agreement.orgSignerTitle }}</p>
                <p><strong>Date:</strong> {{ new Date(baaStore.baaStatus.agreement.orgSignedAt!).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>

          <div v-else-if="baaStore.currentStatus === 'executed'" class="status-content">
            <div class="info-box info-box-success">
              <h4>Agreement Executed</h4>
              <p>
                The Business Associate Agreement is fully executed and in effect. Your organization can now use
                Say It Schedule for PHI-related workflows.
              </p>
              <div v-if="baaStore.baaStatus?.agreement" class="signature-info">
                <div class="signature-row">
                  <div>
                    <h5>Organization Signature</h5>
                    <p><strong>Signed by:</strong> {{ baaStore.baaStatus.agreement.orgSignerName }}</p>
                    <p><strong>Title:</strong> {{ baaStore.baaStatus.agreement.orgSignerTitle }}</p>
                    <p><strong>Date:</strong> {{ new Date(baaStore.baaStatus.agreement.orgSignedAt!).toLocaleDateString() }}</p>
                  </div>
                  <div>
                    <h5>Vendor Signature</h5>
                    <p><strong>Signed by:</strong> {{ baaStore.baaStatus.agreement.vendorSignerName }}</p>
                    <p><strong>Title:</strong> {{ baaStore.baaStatus.agreement.vendorSignerTitle }}</p>
                    <p><strong>Date:</strong> {{ new Date(baaStore.baaStatus.agreement.vendorSignedAt!).toLocaleDateString() }}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="action-buttons">
              <button class="btn btn-outline" @click="handleDownload">
                Download Executed BAA
              </button>
            </div>
          </div>

          <div v-else-if="baaStore.currentStatus === 'voided'" class="status-content">
            <div class="info-box info-box-danger">
              <h4>Agreement Voided</h4>
              <p>
                This BAA has been voided. Please contact support if you need to establish a new agreement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Template Info -->
      <div v-if="baaStore.baaStatus?.templateConfig" class="card">
        <div class="card-header">
          <h3>Agreement Details</h3>
        </div>
        <div class="card-body">
          <div class="details-grid">
            <div>
              <label>Template Version</label>
              <p>{{ baaStore.baaStatus.templateConfig.version }}</p>
            </div>
            <div>
              <label>Business Associate</label>
              <p>{{ baaStore.baaStatus.templateConfig.vendor.legalName }}</p>
            </div>
            <div>
              <label>Contact</label>
              <p>{{ baaStore.baaStatus.templateConfig.vendor.contactEmail }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sign Modal -->
    <Modal v-model="showSignModal" title="Sign Business Associate Agreement" size="lg">
      <div class="sign-modal-content">
        <Alert v-if="signError" variant="danger" class="mb-3" dismissible @dismiss="signError = null">
          {{ signError }}
        </Alert>

        <div class="legal-notice">
          <h4>Electronic Signature Consent</h4>
          <p>
            By signing this agreement electronically, you confirm that you have the authority to bind your
            organization to this Business Associate Agreement. Your electronic signature will have the same
            legal effect as a handwritten signature.
          </p>
        </div>

        <div class="form-group">
          <label for="signer-name">Full Legal Name *</label>
          <input
            id="signer-name"
            v-model="signerName"
            type="text"
            class="form-control"
            placeholder="Enter your full legal name"
            required
          />
        </div>

        <div class="form-group">
          <label for="signer-title">Title / Position *</label>
          <input
            id="signer-title"
            v-model="signerTitle"
            type="text"
            class="form-control"
            placeholder="e.g., Administrator, Owner, Director"
            required
          />
        </div>

        <div class="form-group">
          <label for="signer-email">Email Address *</label>
          <input
            id="signer-email"
            v-model="signerEmail"
            type="email"
            class="form-control"
            placeholder="Enter your email address"
            required
          />
        </div>

        <div class="consent-checkbox">
          <label class="checkbox-label">
            <input v-model="consent" type="checkbox" />
            <span>
              I consent to electronic signature and confirm I have the authority to sign this agreement
              on behalf of my organization. I have read and agree to the terms of the Business Associate Agreement.
            </span>
          </label>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-outline" @click="showSignModal = false">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          :disabled="baaStore.signing || !consent"
          @click="handleSign"
        >
          {{ baaStore.signing ? 'Signing...' : 'Sign Agreement' }}
        </button>
      </template>
    </Modal>

    <!-- Preview Modal -->
    <Modal v-model="showPreview" title="BAA Preview" size="lg">
      <div class="preview-content">
        <div v-if="baaStore.loading" class="loading-state">
          Loading preview...
        </div>
        <pre v-else class="baa-text">{{ baaStore.baaPreview }}</pre>
      </div>
      <template #footer>
        <button class="btn btn-outline" @click="showPreview = false">
          Close
        </button>
        <button v-if="isAdmin && baaStore.canSign" class="btn btn-primary" @click="showPreview = false; openSignModal()">
          Proceed to Sign
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.loading-state {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
}

.status-description {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.info-box {
  background-color: var(--background-muted);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.info-box h4 {
  margin-bottom: 12px;
  color: var(--text-primary);
}

.info-box p {
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.info-box p:last-child {
  margin-bottom: 0;
}

.info-box-info {
  background-color: #e0f2fe;
  border-left: 4px solid #0ea5e9;
}

.info-box-success {
  background-color: #dcfce7;
  border-left: 4px solid #22c55e;
}

.info-box-danger {
  background-color: #fef2f2;
  border-left: 4px solid #ef4444;
}

.signature-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.signature-info p {
  margin-bottom: 4px;
}

.signature-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.signature-row h5 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.info-notice {
  padding: 16px;
  background-color: var(--background-muted);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.details-grid label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.details-grid p {
  color: var(--text-primary);
  margin: 0;
}

/* Sign Modal */
.sign-modal-content {
  padding: 8px 0;
}

.legal-notice {
  background-color: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 16px;
  margin-bottom: 24px;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.legal-notice h4 {
  margin-bottom: 8px;
  color: #92400e;
}

.legal-notice p {
  color: #78350f;
  margin: 0;
  font-size: 14px;
}

.consent-checkbox {
  margin-top: 24px;
  padding: 16px;
  background-color: var(--background-muted);
  border-radius: var(--radius-md);
}

.checkbox-label {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  cursor: pointer;
}

.checkbox-label input {
  margin-top: 4px;
  flex-shrink: 0;
}

.checkbox-label span {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Preview Modal */
.preview-content {
  max-height: 60vh;
  overflow-y: auto;
}

.baa-text {
  white-space: pre-wrap;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  background-color: var(--background-muted);
  padding: 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
}

@media (max-width: 640px) {
  .signature-row {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-buttons .btn {
    width: 100%;
  }
}
</style>
