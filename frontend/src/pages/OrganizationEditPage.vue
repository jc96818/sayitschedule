<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const orgId = route.params.id

const organization = ref({
  id: orgId,
  name: 'Project Hope',
  subdomain: 'projecthope',
  status: 'active',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af'
})

const saving = ref(false)

async function save() {
  saving.value = true
  // TODO: Save to API
  setTimeout(() => {
    saving.value = false
  }, 1000)
}
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Edit Organization</h2>
        <p>{{ organization.name }}</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/super-admin" class="btn btn-outline">Cancel</RouterLink>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </header>

    <div class="page-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Basic Information</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Organization Name</label>
              <input v-model="organization.name" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label>Subdomain</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input v-model="organization.subdomain" type="text" class="form-control" />
                <span class="text-muted">.sayitschedule.com</span>
              </div>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="organization.status" class="form-control">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Branding</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Primary Color</label>
              <input v-model="organization.primaryColor" type="color" class="form-control" style="height: 48px;" />
            </div>
            <div class="form-group">
              <label>Secondary Color</label>
              <input v-model="organization.secondaryColor" type="color" class="form-control" style="height: 48px;" />
            </div>
            <div class="form-group">
              <label>Logo</label>
              <input type="file" class="form-control" accept="image/*" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
