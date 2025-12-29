import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  baaService,
  type BaaStatusResponse,
  type BaaAgreement,
  type BaaStatusInfo,
  type BaaSignRequest,
  type BaaAgreementWithOrg,
  type BaaStats,
  type BaaStatus
} from '@/services/api'

export const useBaaStore = defineStore('baa', () => {
  // Organization BAA state
  const baaStatus = ref<BaaStatusResponse | null>(null)
  const baaHistory = ref<Array<BaaAgreement & { statusInfo: BaaStatusInfo }>>([])
  const baaPreview = ref<string | null>(null)
  const loading = ref(false)
  const signing = ref(false)
  const error = ref<string | null>(null)

  // Superadmin state
  const adminBaaList = ref<Array<BaaAgreementWithOrg & { statusInfo: BaaStatusInfo }>>([])
  const adminBaaStats = ref<BaaStats | null>(null)
  const adminSelectedOrg = ref<{
    current: BaaAgreement & { statusInfo: BaaStatusInfo }
    history: Array<BaaAgreement & { statusInfo: BaaStatusInfo }>
    canCountersign: boolean
  } | null>(null)
  const adminPagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

  // Computed properties
  const hasExecutedBaa = computed(() =>
    baaStatus.value?.agreement?.status === 'executed'
  )

  const canSign = computed(() => baaStatus.value?.canSign ?? false)

  const currentStatus = computed(() => baaStatus.value?.agreement?.status ?? 'not_started')

  const statusInfo = computed(() => baaStatus.value?.statusInfo ?? null)

  // Organization BAA actions
  async function fetchBaaStatus() {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.getStatus()
      baaStatus.value = response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch BAA status'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchBaaPreview() {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.getPreview()
      baaPreview.value = response.data.content
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch BAA preview'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchBaaHistory() {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.getHistory()
      baaHistory.value = response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch BAA history'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function initializeBaa() {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.initialize()
      // Update the status after initialization
      await fetchBaaStatus()
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize BAA'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function signBaa(request: BaaSignRequest) {
    signing.value = true
    error.value = null
    try {
      const response = await baaService.sign(request)
      // Update the status after signing
      await fetchBaaStatus()
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to sign BAA'
      throw e
    } finally {
      signing.value = false
    }
  }

  async function downloadBaa() {
    try {
      const blob = await baaService.download()
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BAA-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to download BAA'
      throw e
    }
  }

  // Superadmin BAA actions
  async function fetchAdminBaaList(params?: { page?: number; search?: string; status?: BaaStatus }) {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.adminList({
        page: params?.page || adminPagination.value.page,
        limit: adminPagination.value.limit,
        search: params?.search,
        status: params?.status
      })
      adminBaaList.value = response.data
      adminPagination.value = {
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch BAA list'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAdminBaaStats() {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.adminGetStats()
      adminBaaStats.value = response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch BAA stats'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAdminOrgBaa(organizationId: string) {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.adminGetOrgBaa(organizationId)
      adminSelectedOrg.value = response.data
    } catch (e) {
      // If 404, org has no BAA
      adminSelectedOrg.value = null
      if ((e as { response?: { status?: number } }).response?.status !== 404) {
        error.value = e instanceof Error ? e.message : 'Failed to fetch organization BAA'
        throw e
      }
    } finally {
      loading.value = false
    }
  }

  async function countersignBaa(organizationId: string, signerName: string, signerTitle: string) {
    signing.value = true
    error.value = null
    try {
      const response = await baaService.adminCountersign(organizationId, { signerName, signerTitle })
      // Refresh the org BAA data
      await fetchAdminOrgBaa(organizationId)
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to countersign BAA'
      throw e
    } finally {
      signing.value = false
    }
  }

  async function voidBaa(organizationId: string, reason: string) {
    loading.value = true
    error.value = null
    try {
      const response = await baaService.adminVoid(organizationId, reason)
      // Refresh the org BAA data
      await fetchAdminOrgBaa(organizationId)
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to void BAA'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function adminDownloadBaa(baaId: string) {
    try {
      const blob = await baaService.adminDownload(baaId)
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BAA-${baaId}-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to download BAA'
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  function reset() {
    baaStatus.value = null
    baaHistory.value = []
    baaPreview.value = null
    adminBaaList.value = []
    adminBaaStats.value = null
    adminSelectedOrg.value = null
    loading.value = false
    signing.value = false
    error.value = null
  }

  return {
    // Organization state
    baaStatus,
    baaHistory,
    baaPreview,
    loading,
    signing,
    error,
    // Computed
    hasExecutedBaa,
    canSign,
    currentStatus,
    statusInfo,
    // Organization actions
    fetchBaaStatus,
    fetchBaaPreview,
    fetchBaaHistory,
    initializeBaa,
    signBaa,
    downloadBaa,
    // Superadmin state
    adminBaaList,
    adminBaaStats,
    adminSelectedOrg,
    adminPagination,
    // Superadmin actions
    fetchAdminBaaList,
    fetchAdminBaaStats,
    fetchAdminOrgBaa,
    countersignBaa,
    voidBaa,
    adminDownloadBaa,
    // Utilities
    clearError,
    reset
  }
})
