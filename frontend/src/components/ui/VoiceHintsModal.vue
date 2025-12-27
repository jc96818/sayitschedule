<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Modal from './Modal.vue'
import Button from './Button.vue'

type PageType = 'rules' | 'staff' | 'patients'

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
const hintsData: Record<PageType, { title: string; intro: string; hints: VoiceHint[] }> = {
  rules: {
    title: 'Voice Commands for Scheduling Rules',
    intro: 'Create scheduling rules by speaking naturally. The AI will interpret your intent and create the appropriate rule.',
    hints: [
      {
        example: 'Male therapists can only work with male patients',
        description: 'Creates a gender pairing rule that restricts male therapists to male patients only.'
      },
      {
        example: 'Sarah should always be scheduled with patient Emily',
        description: 'Creates a specific pairing rule that ensures Sarah is always assigned to Emily.'
      },
      {
        example: 'Maximum 2 sessions per therapist per day',
        description: 'Limits the number of sessions any therapist can have in a single day.'
      },
      {
        example: 'No scheduling on federal holidays',
        description: 'Creates an availability rule that excludes all federal holidays from the schedule.'
      }
    ]
  },
  staff: {
    title: 'Voice Commands for Staff Management',
    intro: 'Add staff members using voice commands. Speak naturally and the AI will understand your intent.',
    hints: [
      {
        example: 'Add a new therapist named Sarah Johnson, female',
        description: 'Creates a new female staff member with the specified name.'
      },
      {
        example: 'New staff member Adam Smith, male, certified in ABA therapy',
        description: 'Adds a new male therapist with a specific certification.'
      },
      {
        example: 'Add therapist Maria Garcia with speech therapy and pediatrics certifications',
        description: 'Creates a staff member with multiple certifications listed.'
      }
    ]
  },
  patients: {
    title: 'Voice Commands for Patient Management',
    intro: 'Add patient records using voice commands. The AI will interpret your request and help you fill in the details.',
    hints: [
      {
        example: 'Add a new patient named Emily Carter, female',
        description: 'Creates a new female patient with the specified name.'
      },
      {
        example: 'New patient Michael Brown, male, needs 3 sessions per week',
        description: 'Adds a patient with a specific weekly session requirement.'
      },
      {
        example: 'Add patient Lisa Wong who requires an ABA certified therapist',
        description: 'Creates a patient with specific certification requirements for their therapist.'
      }
    ]
  }
}

// Get current page hints
const currentHints = hintsData[props.pageType]

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
