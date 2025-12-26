<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface Props {
  title?: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Voice Input',
  description: 'Click the microphone and speak'
})

const emit = defineEmits<{
  result: [transcript: string]
  error: [error: string]
}>()

const isRecording = ref(false)
const transcript = ref('')
const status = ref('Click to start recording')

let recognition: SpeechRecognitionInstance | null = null

onMounted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = window as any
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognitionClass = windowAny.SpeechRecognition || windowAny.webkitSpeechRecognition
    if (SpeechRecognitionClass) {
      recognition = new SpeechRecognitionClass() as SpeechRecognitionInstance
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        isRecording.value = true
        status.value = 'Listening...'
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const current = event.resultIndex
        transcript.value = event.results[current][0].transcript

        if (event.results[current].isFinal) {
          emit('result', transcript.value)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        isRecording.value = false
        status.value = `Error: ${event.error}`
        emit('error', event.error)
      }

      recognition.onend = () => {
        isRecording.value = false
        status.value = 'Click to start recording'
      }
    }
  }
})

onUnmounted(() => {
  if (recognition) {
    recognition.abort()
  }
})

function toggleRecording() {
  if (!recognition) {
    status.value = 'Speech recognition not supported'
    return
  }

  if (isRecording.value) {
    recognition.stop()
  } else {
    transcript.value = ''
    recognition.start()
  }
}
</script>

<template>
  <div class="voice-interface">
    <h3>{{ props.title }}</h3>
    <p>{{ props.description }}</p>

    <button class="mic-button" :class="{ recording: isRecording }" @click="toggleRecording">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>

    <p class="voice-status">{{ status }}</p>

    <div v-if="transcript" class="transcription-box">
      <div class="label">Heard:</div>
      <div>{{ transcript }}</div>
    </div>
  </div>
</template>
