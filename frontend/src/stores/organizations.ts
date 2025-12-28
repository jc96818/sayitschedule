import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Organization } from '@/types'
import { organizationService } from '@/services/api'

export const useOrganizationsStore = defineStore('organizations', () => {
  const organizations = ref<Organization[]>([])
  const currentOrganization = ref<Organization | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  async function fetchOrganizations() {
    loading.value = true
    error.value = null
    try {
      const response = await organizationService.list()
      organizations.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch organizations'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchOrganizationById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await organizationService.get(id)
      currentOrganization.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch organization'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createOrganization(data: Partial<Organization>) {
    loading.value = true
    error.value = null
    try {
      const response = await organizationService.create(data)
      organizations.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create organization'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateOrganization(id: string, data: Partial<Organization>) {
    loading.value = true
    error.value = null
    try {
      const response = await organizationService.update(id, data)
      const index = organizations.value.findIndex((o) => o.id === id)
      if (index !== -1) {
        organizations.value[index] = response.data
      }
      if (currentOrganization.value?.id === id) {
        currentOrganization.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update organization'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function switchContext(id: string): Promise<{ token: string; organization: Organization }> {
    try {
      const result = await organizationService.switchContext(id)
      currentOrganization.value = result.organization
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to switch organization context'
      throw e
    }
  }

  function clearCurrent() {
    currentOrganization.value = null
  }

  return {
    organizations,
    currentOrganization,
    loading,
    error,
    totalCount,
    fetchOrganizations,
    fetchOrganizationById,
    createOrganization,
    updateOrganization,
    switchContext,
    clearCurrent
  }
})
