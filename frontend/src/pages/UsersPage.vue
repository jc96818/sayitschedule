<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { Modal, Alert, Badge, Button } from '@/components/ui'
import type { User, UserRole } from '@/types'

const usersStore = useUsersStore()
const authStore = useAuthStore()

// Filters
const searchQuery = ref('')
const roleFilter = ref<UserRole | ''>('')

// Add/Edit modal
const showModal = ref(false)
const isEditing = ref(false)
const formData = ref<Partial<User>>({
  name: '',
  email: '',
  role: 'staff'
})

// Success message for invitation sent
const successMessage = ref<string | null>(null)

// Reset password modal
const showResetPasswordModal = ref(false)
const resetPasswordUserId = ref<string | null>(null)
const newPassword = ref('')

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_assistant: 'Admin Assistant',
  staff: 'Staff'
}

const roleBadgeVariants: Record<UserRole, 'primary' | 'success' | 'warning' | 'secondary'> = {
  super_admin: 'primary',
  admin: 'success',
  admin_assistant: 'warning',
  staff: 'secondary'
}

const filteredUsers = computed(() => {
  let result = usersStore.users

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
  }

  if (roleFilter.value) {
    result = result.filter(user => user.role === roleFilter.value)
  }

  return result
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openAddModal() {
  isEditing.value = false
  formData.value = {
    name: '',
    email: '',
    role: 'staff'
  }
  showModal.value = true
}

function openEditModal(user: User) {
  isEditing.value = true
  formData.value = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  }
  showModal.value = true
}

async function handleSubmit() {
  try {
    if (isEditing.value && formData.value.id) {
      const { id, ...updateData } = formData.value
      await usersStore.updateUser(id, updateData)
    } else {
      await usersStore.createUser(formData.value)
      successMessage.value = `Invitation sent to ${formData.value.email}`
      setTimeout(() => { successMessage.value = null }, 5000)
    }
    showModal.value = false
  } catch (error) {
    console.error('Failed to save user:', error)
  }
}

function formatInvitationExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return ''
  const expiry = new Date(expiresAt)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()

  if (diffMs <= 0) return 'Expired'

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `Expires in ${diffMinutes}m`
  }
  if (diffHours < 24) return `Expires in ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `Expires in ${diffDays}d`
}

function isInvitationExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() <= Date.now()
}

async function handleResendInvite(user: User) {
  if (!confirm(`Resend invitation to ${user.name}?`)) return

  try {
    await usersStore.resendInvite(user.id)
    successMessage.value = `Invitation resent to ${user.email}`
    setTimeout(() => { successMessage.value = null }, 5000)
  } catch (error) {
    console.error('Failed to resend invite:', error)
  }
}

function openResetPasswordModal(userId: string) {
  resetPasswordUserId.value = userId
  newPassword.value = ''
  showResetPasswordModal.value = true
}

async function handleResetPassword() {
  if (!resetPasswordUserId.value) return

  try {
    await usersStore.resetPassword(resetPasswordUserId.value, newPassword.value)
    showResetPasswordModal.value = false
    resetPasswordUserId.value = null
    newPassword.value = ''
  } catch (error) {
    console.error('Failed to reset password:', error)
  }
}

async function handleDeleteUser(id: string) {
  if (id === authStore.user?.id) {
    alert('You cannot delete your own account')
    return
  }

  if (confirm('Are you sure you want to delete this user?')) {
    try {
      await usersStore.deleteUser(id)
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }
}

function canManageUser(user: User): boolean {
  // Super admins can manage everyone
  if (authStore.user?.role === 'super_admin') return true

  // Admins can manage admin assistants and staff
  if (authStore.user?.role === 'admin') {
    return user.role === 'admin_assistant' || user.role === 'staff'
  }

  return false
}

onMounted(() => {
  usersStore.fetchUsers()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Users</h2>
        <p>Manage user accounts and permissions</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="openAddModal">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Invite User
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Success Alert -->
      <Alert v-if="successMessage" variant="success" class="mb-3" dismissible @dismiss="successMessage = null">
        {{ successMessage }}
      </Alert>

      <!-- Error Alert -->
      <Alert v-if="usersStore.error" variant="danger" class="mb-3" dismissible @dismiss="usersStore.error = null">
        {{ usersStore.error }}
      </Alert>

      <!-- Filters -->
      <div class="filters-row mb-3">
        <div class="search-input">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users..."
            class="form-control"
          />
        </div>
        <select v-model="roleFilter" class="form-control" style="width: 180px;">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="admin_assistant">Admin Assistant</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      <!-- Users Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Users ({{ filteredUsers.length }})</h3>
        </div>

        <div v-if="usersStore.loading && usersStore.users.length === 0" class="card-body text-center">
          <p class="text-muted">Loading users...</p>
        </div>

        <div v-else-if="filteredUsers.length === 0" class="card-body text-center">
          <p class="text-muted">No users found.</p>
        </div>

        <div v-else class="card-body" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>
                  <div class="user-name">
                    <div class="user-avatar">
                      {{ user.name.charAt(0).toUpperCase() }}
                    </div>
                    <span>{{ user.name }}</span>
                    <Badge v-if="user.id === authStore.user?.id" variant="secondary" style="margin-left: 8px;">
                      You
                    </Badge>
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td>
                  <Badge :variant="roleBadgeVariants[user.role]">
                    {{ roleLabels[user.role] }}
                  </Badge>
                </td>
                <td>
                  <div class="status-cell">
                    <Badge :variant="user.status === 'active' ? 'success' : 'warning'">
                      {{ user.status === 'active' ? 'Active' : 'Pending' }}
                    </Badge>
                    <span v-if="user.status === 'pending'" class="expiry-text" :class="{ expired: isInvitationExpired(user.invitationExpiresAt) }">
                      {{ formatInvitationExpiry(user.invitationExpiresAt) }}
                    </span>
                  </div>
                </td>
                <td>{{ formatDate(user.lastLogin) }}</td>
                <td>
                  <div class="action-buttons">
                    <Button
                      v-if="canManageUser(user)"
                      size="sm"
                      variant="outline"
                      @click="openEditModal(user)"
                    >
                      Edit
                    </Button>
                    <Button
                      v-if="canManageUser(user) && user.status === 'pending'"
                      size="sm"
                      variant="outline"
                      @click="handleResendInvite(user)"
                    >
                      Resend Invite
                    </Button>
                    <Button
                      v-if="canManageUser(user) && user.status === 'active'"
                      size="sm"
                      variant="outline"
                      @click="openResetPasswordModal(user.id)"
                    >
                      Reset Password
                    </Button>
                    <Button
                      v-if="canManageUser(user) && user.id !== authStore.user?.id"
                      size="sm"
                      variant="danger"
                      @click="handleDeleteUser(user.id)"
                    >
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

    <!-- Add/Edit User Modal -->
    <Modal v-model="showModal" :title="isEditing ? 'Edit User' : 'Invite User'" size="md">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            class="form-control"
            required
          />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            class="form-control"
            required
          />
        </div>

        <div class="form-group">
          <label for="role">Role</label>
          <select id="role" v-model="formData.role" class="form-control" required>
            <option value="admin" v-if="authStore.user?.role === 'super_admin'">Admin</option>
            <option value="admin_assistant">Admin Assistant</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        <div v-if="!isEditing" class="invite-notice">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>An email will be sent with a link to set their password</span>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="usersStore.loading">
            {{ isEditing ? 'Save Changes' : 'Send Invitation' }}
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Reset Password Modal -->
    <Modal v-model="showResetPasswordModal" title="Reset Password" size="sm">
      <form @submit.prevent="handleResetPassword">
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            class="form-control"
            minlength="8"
            required
          />
          <small class="text-muted">Minimum 8 characters</small>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <Button type="button" variant="outline" @click="showResetPasswordModal = false">
            Cancel
          </Button>
          <Button type="submit" variant="primary" :loading="usersStore.loading">
            Reset Password
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
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

.user-name {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expiry-text {
  font-size: 12px;
  color: var(--text-muted);
}

.expiry-text.expired {
  color: var(--danger);
  font-weight: 500;
}

.invite-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--background-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
}

.invite-notice svg {
  flex-shrink: 0;
  color: var(--primary-color);
}
</style>
