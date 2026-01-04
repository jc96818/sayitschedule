import { computed } from 'vue'
import { useLabels } from './useLabels'

/**
 * Composable that provides label token replacement for help content.
 * Replaces {{labels.staff.plural}}, {{labels.patient.singular}}, etc.
 * with the organization's configured labels.
 */
export function useHelpLabels() {
  const labels = useLabels()

  /**
   * Replace label tokens in text with organization-specific values.
   * Tokens use the format: {{labels.entity.form}}
   * Examples: {{labels.staff.plural}}, {{labels.patient.singular}}
   */
  function applyLabelTokens(text: string): string {
    if (!text) return text

    const map: Record<string, string> = {
      'labels.staff.plural': labels.staffLabel.value,
      'labels.staff.singular': labels.staffLabelSingular.value,
      'labels.patient.plural': labels.patientLabel.value,
      'labels.patient.singular': labels.patientLabelSingular.value,
      'labels.room.plural': labels.roomLabel.value,
      'labels.room.singular': labels.roomLabelSingular.value,
      'labels.certification.plural': labels.certificationLabel.value,
      'labels.equipment.plural': labels.equipmentLabel.value
    }

    return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => map[key] ?? _m)
  }

  /**
   * Reactive computed that applies label tokens to a string.
   * Use this when you need the result to update when labels change.
   */
  function computedWithLabels(getText: () => string) {
    return computed(() => applyLabelTokens(getText()))
  }

  return {
    applyLabelTokens,
    computedWithLabels
  }
}
