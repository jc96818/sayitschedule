import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Patient } from '@/types'
import { patientService } from '@/services/api'

export const usePatientsStore = defineStore('patients', () => {
  const patients = ref<Patient[]>([])
  const currentPatient = ref<Patient | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  async function fetchPatients(params?: { search?: string; status?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await patientService.list(params)
      patients.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch patients'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchPatientById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await patientService.get(id)
      currentPatient.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch patient'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createPatient(data: Partial<Patient>) {
    loading.value = true
    error.value = null
    try {
      const response = await patientService.create(data)
      patients.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create patient'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updatePatient(id: string, data: Partial<Patient>) {
    loading.value = true
    error.value = null
    try {
      const response = await patientService.update(id, data)
      const index = patients.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        patients.value[index] = response.data
      }
      if (currentPatient.value?.id === id) {
        currentPatient.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update patient'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePatient(id: string) {
    loading.value = true
    error.value = null
    try {
      await patientService.delete(id)
      patients.value = patients.value.filter((p) => p.id !== id)
      totalCount.value--
      if (currentPatient.value?.id === id) {
        currentPatient.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete patient'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearCurrent() {
    currentPatient.value = null
  }

  return {
    patients,
    currentPatient,
    loading,
    error,
    totalCount,
    fetchPatients,
    fetchPatientById,
    createPatient,
    updatePatient,
    deletePatient,
    clearCurrent
  }
})
