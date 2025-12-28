<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { accountService } from '@/services/api'
import { Alert, Button } from '@/components/ui'
import type { MfaStatusResponse, MfaSetupResponse } from '@/types'

// Password change state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref<string | null>(null)
const passwordSuccess = ref(false)

// MFA state
const mfaStatus = ref<MfaStatusResponse | null>(null)
const mfaLoading = ref(false)
const mfaError = ref<string | null>(null)

// MFA Setup modal state
const showMfaSetup = ref(false)
const mfaSetupData = ref<MfaSetupResponse | null>(null)
const mfaSetupCode = ref('')
const mfaSetupLoading = ref(false)
const mfaSetupError = ref<string | null>(null)
const mfaBackupCodes = ref<string[] | null>(null)
const mfaSetupPassword = ref('')

// MFA Disable state
const showDisableMfa = ref(false)
const disablePassword = ref('')
const disableLoading = ref(false)
const disableError = ref<string | null>(null)

// Backup codes regeneration state
const showRegenerateBackup = ref(false)
const regeneratePassword = ref('')
const regenerateLoading = ref(false)
const regenerateError = ref<string | null>(null)
const newBackupCodes = ref<string[] | null>(null)

async function loadMfaStatus() {
  mfaLoading.value = true
  mfaError.value = null
  try {
    mfaStatus.value = await accountService.getMfaStatus()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    mfaError.value = err.response?.data?.error || 'Failed to load MFA status'
  } finally {
    mfaLoading.value = false
  }
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New passwords do not match'
    return
  }

  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters'
    return
  }

  passwordLoading.value = true
  passwordError.value = null
  passwordSuccess.value = false

  try {
    await accountService.changePassword(currentPassword.value, newPassword.value)
    passwordSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    passwordError.value = err.response?.data?.error || 'Failed to change password'
  } finally {
    passwordLoading.value = false
  }
}

async function startMfaSetup() {
  mfaSetupError.value = null
  mfaSetupData.value = null
  mfaBackupCodes.value = null
  mfaSetupCode.value = ''
  mfaSetupPassword.value = ''
  showMfaSetup.value = true
}

async function beginMfaSetup() {
  if (!mfaSetupPassword.value) {
    mfaSetupError.value = 'Password is required'
    return
  }

  mfaSetupLoading.value = true
  mfaSetupError.value = null

  try {
    mfaSetupData.value = await accountService.setupMfa(mfaSetupPassword.value)
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    mfaSetupError.value = err.response?.data?.error || 'Failed to start MFA setup'
  } finally {
    mfaSetupLoading.value = false
  }
}

async function verifyMfaSetup() {
  if (!mfaSetupCode.value || mfaSetupCode.value.length < 6) {
    mfaSetupError.value = 'Please enter a valid 6-digit code'
    return
  }

  mfaSetupLoading.value = true
  mfaSetupError.value = null

  try {
    const result = await accountService.verifyMfa(mfaSetupCode.value)
    mfaBackupCodes.value = result.backupCodes
    await loadMfaStatus()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    mfaSetupError.value = err.response?.data?.error || 'Invalid verification code'
  } finally {
    mfaSetupLoading.value = false
  }
}

function closeMfaSetup() {
  showMfaSetup.value = false
  mfaSetupData.value = null
  mfaBackupCodes.value = null
  mfaSetupCode.value = ''
  mfaSetupPassword.value = ''
  mfaSetupError.value = null
}

async function handleDisableMfa() {
  if (!disablePassword.value) {
    disableError.value = 'Password is required'
    return
  }

  disableLoading.value = true
  disableError.value = null

  try {
    await accountService.disableMfa(disablePassword.value)
    showDisableMfa.value = false
    disablePassword.value = ''
    await loadMfaStatus()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    disableError.value = err.response?.data?.error || 'Failed to disable MFA'
  } finally {
    disableLoading.value = false
  }
}

async function handleRegenerateBackupCodes() {
  if (!regeneratePassword.value) {
    regenerateError.value = 'Password is required'
    return
  }

  regenerateLoading.value = true
  regenerateError.value = null

  try {
    const result = await accountService.regenerateBackupCodes(regeneratePassword.value)
    newBackupCodes.value = result.backupCodes
    await loadMfaStatus()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    regenerateError.value = err.response?.data?.error || 'Failed to regenerate backup codes'
  } finally {
    regenerateLoading.value = false
  }
}

function closeRegenerateBackup() {
  showRegenerateBackup.value = false
  regeneratePassword.value = ''
  newBackupCodes.value = null
  regenerateError.value = null
}

function copyBackupCodes(codes: string[]) {
  const text = codes.join('\n')
  navigator.clipboard.writeText(text)
}

onMounted(() => {
  loadMfaStatus()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Account Settings</h2>
        <p>Manage your password and security settings</p>
      </div>
    </header>

    <div class="page-content">
      <!-- Password Change Section -->
      <div class="card mb-3">
        <div class="card-header">
          <h3>Change Password</h3>
        </div>
        <div class="card-body">
          <Alert v-if="passwordError" variant="danger" class="mb-3" dismissible @dismiss="passwordError = null">
            {{ passwordError }}
          </Alert>
          <Alert v-if="passwordSuccess" variant="success" class="mb-3" dismissible @dismiss="passwordSuccess = false">
            Password changed successfully
          </Alert>

          <form @submit.prevent="handleChangePassword" class="password-form">
            <div class="form-group">
              <label for="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                v-model="currentPassword"
                type="password"
                class="form-control"
                required
                autocomplete="current-password"
              />
            </div>

            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input
                id="newPassword"
                v-model="newPassword"
                type="password"
                class="form-control"
                minlength="8"
                required
                autocomplete="new-password"
              />
              <small class="text-muted">Minimum 8 characters</small>
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                class="form-control"
                required
                autocomplete="new-password"
              />
            </div>

            <Button type="submit" variant="primary" :loading="passwordLoading">
              Change Password
            </Button>
          </form>
        </div>
      </div>

      <!-- MFA Section -->
      <div class="card">
        <div class="card-header">
          <h3>Two-Factor Authentication (MFA)</h3>
        </div>
        <div class="card-body">
          <Alert v-if="mfaError" variant="danger" class="mb-3" dismissible @dismiss="mfaError = null">
            {{ mfaError }}
          </Alert>

          <div v-if="mfaLoading" class="text-muted">
            Loading MFA status...
          </div>

          <div v-else-if="mfaStatus">
            <div class="mfa-status mb-3">
              <div class="status-indicator" :class="{ enabled: mfaStatus.enabled }">
                <svg v-if="mfaStatus.enabled" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{{ mfaStatus.enabled ? 'MFA Enabled' : 'MFA Not Enabled' }}</span>
              </div>
              <p v-if="mfaStatus.enabled" class="text-muted">
                {{ mfaStatus.backupCodesRemaining }} backup codes remaining
              </p>
            </div>

            <!-- MFA Not Enabled -->
            <div v-if="!mfaStatus.enabled">
              <p class="mb-3">
                Add an extra layer of security to your account by enabling two-factor authentication.
                You'll need an authenticator app like Google Authenticator or Authy.
              </p>
              <Button variant="primary" :loading="mfaSetupLoading" @click="startMfaSetup">
                Enable MFA
              </Button>
            </div>

            <!-- MFA Enabled -->
            <div v-else class="mfa-actions">
              <Button variant="outline" @click="showRegenerateBackup = true">
                Regenerate Backup Codes
              </Button>
              <Button variant="danger" @click="showDisableMfa = true">
                Disable MFA
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MFA Setup Modal -->
    <Teleport to="body">
      <div v-if="showMfaSetup" class="modal-overlay" @click.self="!mfaBackupCodes && closeMfaSetup()">
        <div class="modal-content modal-md">
          <div class="modal-header">
            <h3>{{ mfaBackupCodes ? 'Save Your Backup Codes' : 'Set Up Two-Factor Authentication' }}</h3>
            <button v-if="!mfaBackupCodes" class="modal-close" @click="closeMfaSetup">&times;</button>
          </div>
          <div class="modal-body">
            <div v-if="!mfaBackupCodes">
              <!-- Step 0: Confirm password (recent auth) -->
              <div v-if="!mfaSetupData">
                <Alert v-if="mfaSetupError" variant="danger" class="mb-3" dismissible @dismiss="mfaSetupError = null">
                  {{ mfaSetupError }}
                </Alert>

                <p class="mb-3">Enter your password to start MFA setup:</p>

                <div class="form-group">
                  <label for="mfaSetupPassword">Password</label>
                  <input
                    id="mfaSetupPassword"
                    v-model="mfaSetupPassword"
                    type="password"
                    class="form-control"
                    required
                    autocomplete="current-password"
                  />
                </div>

                <div class="modal-actions">
                  <Button variant="outline" @click="closeMfaSetup">Cancel</Button>
                  <Button variant="primary" :loading="mfaSetupLoading" @click="beginMfaSetup">
                    Continue
                  </Button>
                </div>
              </div>

              <!-- Step 1: QR Code -->
              <div v-else>
                <Alert v-if="mfaSetupError" variant="danger" class="mb-3" dismissible @dismiss="mfaSetupError = null">
                  {{ mfaSetupError }}
                </Alert>

                <p class="mb-3">Scan this QR code with your authenticator app:</p>

                <div class="qr-code-container">
                  <img :src="mfaSetupData.qrCode" alt="MFA QR Code" class="qr-code" />
                </div>

                <details class="manual-entry mb-3">
                  <summary>Can't scan? Enter manually</summary>
                  <div class="manual-code">
                    <code>{{ mfaSetupData.secret }}</code>
                  </div>
                </details>

                <div class="form-group">
                  <label for="mfaCode">Enter the 6-digit code from your app</label>
                  <input
                    id="mfaCode"
                    v-model="mfaSetupCode"
                    type="text"
                    class="form-control"
                    placeholder="000000"
                    maxlength="6"
                    pattern="[0-9]*"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                  />
                </div>

                <div class="modal-actions">
                  <Button variant="outline" @click="closeMfaSetup">Cancel</Button>
                  <Button variant="primary" :loading="mfaSetupLoading" @click="verifyMfaSetup">
                    Verify & Enable
                  </Button>
                </div>
              </div>
            </div>

            <!-- Step 2: Backup Codes -->
            <div v-if="mfaBackupCodes">
              <Alert variant="warning" class="mb-3">
                Save these backup codes in a secure location. Each code can only be used once.
                You won't be able to see them again!
              </Alert>

              <div class="backup-codes">
                <code v-for="code in mfaBackupCodes" :key="code" class="backup-code">
                  {{ code }}
                </code>
              </div>

              <div class="modal-actions">
                <Button variant="outline" @click="copyBackupCodes(mfaBackupCodes)">
                  Copy Codes
                </Button>
                <Button variant="primary" @click="closeMfaSetup">
                  I've Saved My Codes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Disable MFA Modal -->
    <Teleport to="body">
      <div v-if="showDisableMfa" class="modal-overlay" @click.self="showDisableMfa = false">
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h3>Disable Two-Factor Authentication</h3>
            <button class="modal-close" @click="showDisableMfa = false">&times;</button>
          </div>
          <div class="modal-body">
            <Alert v-if="disableError" variant="danger" class="mb-3" dismissible @dismiss="disableError = null">
              {{ disableError }}
            </Alert>

            <Alert variant="warning" class="mb-3">
              Disabling MFA will make your account less secure.
            </Alert>

            <div class="form-group">
              <label for="disablePassword">Enter your password to confirm</label>
              <input
                id="disablePassword"
                v-model="disablePassword"
                type="password"
                class="form-control"
                required
                autocomplete="current-password"
              />
            </div>

            <div class="modal-actions">
              <Button variant="outline" @click="showDisableMfa = false">Cancel</Button>
              <Button variant="danger" :loading="disableLoading" @click="handleDisableMfa">
                Disable MFA
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Regenerate Backup Codes Modal -->
    <Teleport to="body">
      <div v-if="showRegenerateBackup" class="modal-overlay" @click.self="!newBackupCodes && closeRegenerateBackup()">
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h3>{{ newBackupCodes ? 'New Backup Codes' : 'Regenerate Backup Codes' }}</h3>
            <button v-if="!newBackupCodes" class="modal-close" @click="closeRegenerateBackup">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Password confirmation -->
            <div v-if="!newBackupCodes">
              <Alert v-if="regenerateError" variant="danger" class="mb-3" dismissible @dismiss="regenerateError = null">
                {{ regenerateError }}
              </Alert>

              <Alert variant="warning" class="mb-3">
                This will invalidate all your existing backup codes.
              </Alert>

              <div class="form-group">
                <label for="regeneratePassword">Enter your password to confirm</label>
                <input
                  id="regeneratePassword"
                  v-model="regeneratePassword"
                  type="password"
                  class="form-control"
                  required
                  autocomplete="current-password"
                />
              </div>

              <div class="modal-actions">
                <Button variant="outline" @click="closeRegenerateBackup">Cancel</Button>
                <Button variant="primary" :loading="regenerateLoading" @click="handleRegenerateBackupCodes">
                  Regenerate Codes
                </Button>
              </div>
            </div>

            <!-- New backup codes -->
            <div v-else>
              <Alert variant="warning" class="mb-3">
                Save these new backup codes. Your old codes no longer work.
              </Alert>

              <div class="backup-codes">
                <code v-for="code in newBackupCodes" :key="code" class="backup-code">
                  {{ code }}
                </code>
              </div>

              <div class="modal-actions">
                <Button variant="outline" @click="copyBackupCodes(newBackupCodes)">
                  Copy Codes
                </Button>
                <Button variant="primary" @click="closeRegenerateBackup">
                  I've Saved My Codes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.password-form {
  max-width: 400px;
}

.mfa-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--text-secondary);
}

.status-indicator.enabled {
  color: var(--success);
}

.mfa-actions {
  display: flex;
  gap: 12px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-sm {
  width: 400px;
  max-width: 90vw;
}

.modal-md {
  width: 500px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  line-height: 1;
}

.modal-body {
  padding: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* QR Code */
.qr-code-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.qr-code {
  width: 200px;
  height: 200px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.manual-entry {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 6px;
}

.manual-entry summary {
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.manual-code {
  margin-top: 12px;
}

.manual-code code {
  display: block;
  padding: 12px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  word-break: break-all;
  text-align: center;
}

/* Backup Codes */
.backup-codes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.backup-code {
  display: block;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
}
</style>
