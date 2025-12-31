<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSuperAdminUsersStore } from '@/stores/superAdminUsers'
import { useAuthStore } from '@/stores/auth'
import { Modal, Alert, Badge, Button } from '@/components/ui'
import type { User } from '@/types'

interface SuperAdminUser extends User {
  invitationExpiresAt?: string | null
}

const usersStore = useSuperAdminUsersStore()
const authStore = useAuthStore()

// Filters
const searchQuery = ref('')

// Add/Edit modal
const showModal = ref(false)
const isEditing = ref(false)
const formData = ref<{ id?: string; name: string; email: string }>({
  name: '',
  email: ''
})

// Resend invite state
const resendingInviteId = ref<string | null>(null)

// Delete confirmation
const showDeleteModal = ref(false)
const deleteUserId = ref<string | null>(null)

const filteredUsers = computed(() => {
  let result = usersStore.users as SuperAdminUser[]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    )
  }

  return result
})

function isInvitationExpired(user: SuperAdminUser): boolean {
  if (!user.invitationExpiresAt) return false
  return new Date(user.invitationExpiresAt) < new Date()
}

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
    email: ''
  }
  showModal.value = true
}

function openEditModal(user: User) {
  isEditing.value = true
  formData.value = {
    id: user.id,
    name: user.name,
    email: user.email
  }
  showModal.value = true
}

async function handleSubmit() {
  try {
    if (isEditing.value && formData.value.id) {
      await usersStore.updateUser(formData.value.id, {
        name: formData.value.name,
        email: formData.value.email
      })
    } else {
      await usersStore.createUser({
        name: formData.value.name,
        email: formData.value.email
      })
    }
    showModal.value = false
  } catch (error) {
    console.error('Failed to save user:', error)
  }
}

async function handleResendInvite(userId: string) {
  resendingInviteId.value = userId
  try {
    await usersStore.resendInvite(userId)
  } catch (error) {
    console.error('Failed to resend invite:', error)
  } finally {
    resendingInviteId.value = null
  }
}

function openDeleteModal(userId: string) {
  deleteUserId.value = userId
  showDeleteModal.value = true
}

async function handleDeleteUser() {
  if (!deleteUserId.value) return

  try {
    await usersStore.deleteUser(deleteUserId.value)
    showDeleteModal.value = false
    deleteUserId.value = null
  } catch (error) {
    console.error('Failed to delete user:', error)
  }
}

function isCurrentUser(user: User): boolean {
  return user.id === authStore.user?.id
}

onMounted(() => {
  usersStore.fetchUsers()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Super Admin Users</h2>
        <p>Manage super admin accounts</p>
      </div>
      <div class="header-actions">
        <Button variant="primary" @click="openAddModal">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            width="18"
            height="18"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Super Admin
        </Button>
      </div>
    </header>

    <div class="page-content">
      <!-- Error Alert -->
      <Alert v-if="usersStore.error" variant="danger" class="mb-3" dismissible @dismiss="usersStore.error = null">
        {{ usersStore.error }}
      </Alert>

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
          <input v-model="searchQuery" type="text" placeholder="Search super admins..." class="form-control" />
        </div>
      </div>

      <!-- Users Table -->
      <div class="card">
        <div class="card-header">
          <h3>All Super Admins ({{ filteredUsers.length }})</h3>
        </div>

        <div v-if="usersStore.loading && usersStore.users.length === 0" class="card-body text-center">
          <p class="text-muted">Loading super admin users...</p>
        </div>

        <div v-else-if="filteredUsers.length === 0" class="card-body text-center">
          <p class="text-muted">No super admin users found.</p>
        </div>

        <div v-else class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>MFA</th>
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
                    <Badge v-if="isCurrentUser(user)" variant="secondary" style="margin-left: 8px"> You </Badge>
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td>
                  <Badge v-if="user.status === 'active'" variant="success">Active</Badge>
                  <Badge v-else-if="isInvitationExpired(user)" variant="danger">Invite Expired</Badge>
                  <Badge v-else variant="warning">Pending</Badge>
                </td>
                <td>
                  <Badge :variant="user.mfaEnabled ? 'success' : 'secondary'">
                    {{ user.mfaEnabled ? 'Enabled' : 'Disabled' }}
                  </Badge>
                </td>
                <td>{{ formatDate(user.lastLogin) }}</td>
                <td>
                  <div class="action-buttons">
                    <Button size="sm" variant="outline" @click="openEditModal(user)"> Edit </Button>
                    <Button
                      v-if="user.status === 'pending'"
                      size="sm"
                      variant="outline"
                      :loading="resendingInviteId === user.id"
                      @click="handleResendInvite(user.id)"
                    >
                      Resend Invite
                    </Button>
                    <Button
                      v-if="!isCurrentUser(user)"
                      size="sm"
                      variant="danger"
                      @click="openDeleteModal(user.id)"
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
    <Modal v-model="showModal" :title="isEditing ? 'Edit Super Admin' : 'Invite Super Admin'" size="md">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input id="name" v-model="formData.name" type="text" class="form-control" required />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="formData.email" type="email" class="form-control" required />
        </div>

        <Alert v-if="!isEditing" variant="info" class="mt-3">
          An invitation email will be sent to this address. The user will need to set up their password and configure two-factor authentication (MFA) before they can access the platform.
        </Alert>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px">
          <Button type="button" variant="outline" @click="showModal = false"> Cancel </Button>
          <Button type="submit" variant="primary" :loading="usersStore.loading">
            {{ isEditing ? 'Save Changes' : 'Send Invitation' }}
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <Modal v-model="showDeleteModal" title="Delete Super Admin" size="sm">
      <p>Are you sure you want to delete this super admin user? This action cannot be undone.</p>
      <Alert v-if="usersStore.totalCount <= 1" variant="warning" class="mt-3">
        You cannot delete the last super admin user.
      </Alert>
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px">
        <Button type="button" variant="outline" @click="showDeleteModal = false"> Cancel </Button>
        <Button
          type="button"
          variant="danger"
          :loading="usersStore.loading"
          :disabled="usersStore.totalCount <= 1"
          @click="handleDeleteUser"
        >
          Delete
        </Button>
      </div>
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
</style>
