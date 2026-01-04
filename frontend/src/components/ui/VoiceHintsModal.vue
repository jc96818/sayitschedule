<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Modal from './Modal.vue'
import Button from './Button.vue'
import { useLabels } from '@/composables/useLabels'

type PageType = 'rules' | 'staff' | 'patients' | 'room' | 'schedule' | 'schedule_generate'

interface VoiceHint {
  example: string
  description: string
}

interface Props {
  pageType: PageType
  storageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  storageKey: ''
})

const showModal = ref(false)
const {
  staffLabelSingular,
  staffLabelSingularLower,
  staffLabelLower,
  patientLabelSingular,
  patientLabelSingularLower,
  patientLabelLower,
  roomLabelSingular,
  roomLabelSingularLower,
  roomLabelLower,
  equipmentLabel
} = useLabels()
const equipmentLabelLower = computed(() => equipmentLabel.value.toLowerCase())

// Generate storage key based on page type
const getStorageKey = () => props.storageKey || `voice-hints-seen-${props.pageType}`

// Check if user has seen hints for this page
const hasSeenHints = () => {
  return localStorage.getItem(getStorageKey()) === 'true'
}

// Mark hints as seen
const markAsSeen = () => {
  localStorage.setItem(getStorageKey(), 'true')
}

// Voice hints for each page type
const hintsData = computed<Record<PageType, { title: string; intro: string; hints: VoiceHint[] }>>(() => ({
  rules: {
    title: 'Voice Commands for Scheduling Rules',
    intro: 'Create or search for scheduling rules by speaking naturally. The AI will interpret your intent.',
    hints: [
      {
        example: `Male ${staffLabelLower.value} can only work with male ${patientLabelLower.value}`,
        description: `Creates a gender pairing rule that restricts male ${staffLabelLower.value} to male ${patientLabelLower.value} only.`
      },
      {
        example: `Sarah should always be scheduled with ${patientLabelSingularLower.value} Emily`,
        description: 'Creates a specific pairing rule that ensures Sarah is always assigned to Emily.'
      },
      {
        example: `Maximum 2 sessions per ${staffLabelSingularLower.value} per day`,
        description: `Limits the number of sessions any ${staffLabelSingularLower.value} can have in a single day.`
      },
      {
        example: 'No scheduling on federal holidays',
        description: 'Creates an availability rule that excludes all federal holidays from the schedule.'
      },
      {
        example: 'Find all rules for Emily',
        description: 'Searches for rules that mention "Emily" in the description.'
      },
      {
        example: 'Show me gender pairing rules',
        description: 'Searches for rules related to gender pairing.'
      },
      {
        example: 'Search for certification rules',
        description: 'Finds all rules that mention certifications.'
      }
    ]
  },
  staff: {
    title: `Voice Commands for ${staffLabelSingular.value} Management`,
    intro: `Add ${staffLabelLower.value} using voice commands. Speak naturally and the AI will understand your intent.`,
    hints: [
      {
        example: `Add a new ${staffLabelSingularLower.value} named Sarah Johnson, female`,
        description: `Creates a new female ${staffLabelSingularLower.value} with the specified name.`
      },
      {
        example: `New ${staffLabelSingularLower.value} Adam Smith, male, certified in ABA therapy`,
        description: `Adds a new male ${staffLabelSingularLower.value} with a specific certification.`
      },
      {
        example: `Add ${staffLabelSingularLower.value} Maria Garcia with speech therapy and pediatrics certifications`,
        description: `Creates a ${staffLabelSingularLower.value} with multiple certifications listed.`
      }
    ]
  },
  patients: {
    title: `Voice Commands for ${patientLabelSingular.value} Management`,
    intro: `Add ${patientLabelSingularLower.value} records using voice commands. The AI will interpret your request and help you fill in the details.`,
    hints: [
      {
        example: `Add a new ${patientLabelSingularLower.value} named Emily Carter, female`,
        description: `Creates a new female ${patientLabelSingularLower.value} with the specified name.`
      },
      {
        example: `New ${patientLabelSingularLower.value} Michael Brown, male, needs 3 sessions per week`,
        description: `Adds a ${patientLabelSingularLower.value} with a specific weekly session requirement.`
      },
      {
        example: `Add ${patientLabelSingularLower.value} Lisa Wong who requires an ABA certified ${staffLabelSingularLower.value}`,
        description: `Creates a ${patientLabelSingularLower.value} with specific certification requirements for their ${staffLabelSingularLower.value}.`
      }
    ]
  },
  room: {
    title: `Voice Commands for ${roomLabelSingular.value} Management`,
    intro: `Add ${roomLabelLower.value} using voice commands. Specify the ${roomLabelSingularLower.value} name and any ${equipmentLabelLower.value} or capabilities it has.`,
    hints: [
      {
        example: `Create ${roomLabelSingularLower.value} 101 with sensory ${equipmentLabelLower.value}`,
        description: `Creates a new ${roomLabelSingularLower.value} with the specified name and sensory ${equipmentLabelLower.value} capability.`
      },
      {
        example: `Add a new ${roomLabelSingularLower.value} called Therapy Suite A with wheelchair access`,
        description: `Creates a ${roomLabelSingularLower.value} with wheelchair accessibility as a capability.`
      },
      {
        example: `New ${roomLabelSingularLower.value} B2 with sensory ${equipmentLabelLower.value}, computer station, and wheelchair access`,
        description: `Creates a ${roomLabelSingularLower.value} with multiple capabilities listed.`
      }
    ]
  },
  schedule: {
    title: 'Voice Commands for Schedule Modifications',
    intro: 'Modify your schedule using voice commands. Add, move, cancel, or reschedule sessions by speaking naturally.',
    hints: [
      {
        example: `Add a session for Sarah with Emma on Tuesday at 10 AM`,
        description: `Creates a new session for the specified ${staffLabelSingularLower.value} and ${patientLabelSingularLower.value}.`
      },
      {
        example: `Schedule John to see Noah on Friday at 2 PM`,
        description: `Adds a new session on the specified day and time.`
      },
      {
        example: "Move John's 9 AM session to 2 PM",
        description: 'Reschedules a specific session to a new time on the same day.'
      },
      {
        example: "Cancel Sarah's Friday 10 AM",
        description: 'Removes a session from the schedule entirely.'
      },
      {
        example: "Reschedule Monday's 11 AM to Wednesday",
        description: 'Moves a session to a different day of the week.'
      },
      {
        example: 'Remove the 3 PM session with Emma',
        description: `Cancels a session identified by the ${patientLabelSingularLower.value} name and time.`
      },
      {
        example: `Change the ${staffLabelSingularLower.value} for Monday's 9 AM to Emily`,
        description: `Reassigns a session to a different ${staffLabelSingularLower.value}.`
      },
      {
        example: `Move Sarah's 10 AM session to ${roomLabelSingular.value} B`,
        description: `Changes the ${roomLabelSingularLower.value} for a session without changing the time.`
      }
    ]
  },
  schedule_generate: {
    title: 'Voice Commands for Schedule Generation',
    intro: 'Generate a new weekly schedule using voice commands. Be sure to specify which week you want to generate.',
    hints: [
      {
        example: 'Generate a schedule for next week',
        description: 'Creates a new schedule starting from the Monday of the following week.'
      },
      {
        example: 'Create a schedule for this week',
        description: 'Generates a schedule for the current week, starting from this Monday.'
      },
      {
        example: 'Generate the schedule for the week of January 13th',
        description: 'Creates a schedule for the specific week containing that date.'
      },
      {
        example: 'Make a schedule starting Monday the 20th',
        description: 'Generates a schedule beginning on the specified Monday date.'
      }
    ]
  }
}))

// Get current page hints
const currentHints = computed(() => hintsData.value[props.pageType])

// Open modal
function openModal() {
  showModal.value = true
}

// Close modal and mark as seen
function closeModal() {
  showModal.value = false
  markAsSeen()
}

// Expose openModal for parent components
defineExpose({ openModal })

// Show modal on first visit
onMounted(() => {
  if (!hasSeenHints()) {
    showModal.value = true
  }
})

// Also mark as seen when modal is closed via v-model
watch(showModal, (isOpen) => {
  if (!isOpen && !hasSeenHints()) {
    markAsSeen()
  }
})
</script>

<template>
  <Modal v-model="showModal" :title="currentHints.title" size="lg">
    <div class="hints-content">
      <p class="hints-intro">{{ currentHints.intro }}</p>

      <div class="hints-tips">
        <h4>Tips for Best Results</h4>
        <ul>
          <li>Speak clearly and at a normal pace</li>
          <li>Use natural language - you don't need to use exact phrases</li>
          <li>You can review and edit the AI's interpretation before confirming</li>
          <li>If the result isn't quite right, click "Edit Details" to make adjustments</li>
        </ul>
      </div>

      <div class="hints-section">
        <h4>Example Commands</h4>
        <div class="hints-list">
          <div v-for="(hint, index) in currentHints.hints" :key="index" class="hint-item">
            <div class="hint-example">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mic-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>"{{ hint.example }}"</span>
            </div>
            <p class="hint-description">{{ hint.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="primary" @click="closeModal">Got it, thanks!</Button>
    </template>
  </Modal>
</template>

<style scoped>
.hints-content {
  color: var(--text-primary);
}

.hints-intro {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.hints-section h4,
.hints-tips h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.hints-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.hint-item {
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.hint-example {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.mic-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.hint-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  padding-left: 30px;
  line-height: 1.5;
}

.hints-tips {
  background-color: var(--background-color);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 24px;
}

.hints-tips ul {
  margin: 0;
  padding-left: 20px;
}

.hints-tips li {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}
</style>
