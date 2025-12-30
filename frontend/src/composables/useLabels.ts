import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Composable that provides access to organization-specific labels.
 * Returns reactive computed properties that update when the organization changes.
 */
export function useLabels() {
  const authStore = useAuthStore()
  const organization = computed(() => authStore.organization)

  return {
    // Plural labels (for headings, navigation, list pages)
    staffLabel: computed(() => organization.value?.staffLabel || 'Staff'),
    patientLabel: computed(() => organization.value?.patientLabel || 'Patients'),
    roomLabel: computed(() => organization.value?.roomLabel || 'Rooms'),
    certificationLabel: computed(() => organization.value?.certificationLabel || 'Certifications'),
    equipmentLabel: computed(() => organization.value?.equipmentLabel || 'Equipment'),

    // Singular labels (for buttons, forms, single items)
    staffLabelSingular: computed(() => organization.value?.staffLabelSingular || 'Staff Member'),
    patientLabelSingular: computed(() => organization.value?.patientLabelSingular || 'Patient'),
    roomLabelSingular: computed(() => organization.value?.roomLabelSingular || 'Room'),

    // Suggested options (for dropdowns and autocomplete)
    suggestedCertifications: computed(() => organization.value?.suggestedCertifications || []),
    suggestedRoomEquipment: computed(() => organization.value?.suggestedRoomEquipment || []),

    // Helper to get lowercase versions for descriptions
    staffLabelLower: computed(() => (organization.value?.staffLabel || 'Staff').toLowerCase()),
    patientLabelLower: computed(() => (organization.value?.patientLabel || 'Patients').toLowerCase()),
    roomLabelLower: computed(() => (organization.value?.roomLabel || 'Rooms').toLowerCase()),
    staffLabelSingularLower: computed(() => (organization.value?.staffLabelSingular || 'Staff Member').toLowerCase()),
    patientLabelSingularLower: computed(() => (organization.value?.patientLabelSingular || 'Patient').toLowerCase()),
    roomLabelSingularLower: computed(() => (organization.value?.roomLabelSingular || 'Room').toLowerCase())
  }
}
