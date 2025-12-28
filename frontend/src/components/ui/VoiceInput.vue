<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { TranscriptionStream, type TranscriptResult } from '@/services/transcription'

interface Props {
  title?: string
  description?: string
  showHintsLink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Voice Input',
  description: 'Click the microphone and speak',
  showHintsLink: false
})

const emit = defineEmits<{
  result: [transcript: string]
  interim: [transcript: string]
  error: [error: string]
  showHints: []
}>()

const isRecording = ref(false)
const transcript = ref('')
const interimTranscript = ref('')
const status = ref('Click to start recording')

let transcriptionStream: TranscriptionStream | null = null

function handleTranscript(result: TranscriptResult) {
  if (result.isPartial) {
    interimTranscript.value = result.transcript
    emit('interim', result.transcript)
  } else {
    transcript.value = result.transcript
    interimTranscript.value = ''
  }
}

function handleFinalTranscript(finalText: string) {
  transcript.value = finalText
  interimTranscript.value = ''
  emit('result', finalText)
}

function handleError(error: { code: string; message: string; retryable: boolean }) {
  console.error('[VoiceInput] Error:', error)
  isRecording.value = false

  const errorMessages: Record<string, string> = {
    UNAUTHORIZED: 'Please log in to use voice input.',
    INVALID_TOKEN: 'Session expired. Please log in again.',
    AUDIO_CAPTURE_ERROR: 'Microphone access denied. Please allow microphone permissions.',
    WEBSOCKET_ERROR: 'Connection error. Please try again.',
    TRANSCRIPTION_ERROR: 'Transcription service error. Please try again.',
    SERVICE_NOT_CONFIGURED: 'Voice transcription is not configured.',
    NO_ORG_CONTEXT: 'Organization context required.',
    FORBIDDEN: 'You do not have permission to use voice input.'
  }

  status.value = errorMessages[error.code] || error.message
  emit('error', error.message)
}

async function toggleRecording() {
  if (isRecording.value) {
    // Stop recording
    transcriptionStream?.stop()
    status.value = 'Processing...'
  } else {
    // Start recording
    transcript.value = ''
    interimTranscript.value = ''

    transcriptionStream = new TranscriptionStream({
      onReady: (sessionId, provider) => {
        console.log(`[VoiceInput] Ready: session=${sessionId}, provider=${provider}`)
        isRecording.value = true
        status.value = 'Listening...'
      },
      onTranscript: handleTranscript,
      onFinalTranscript: handleFinalTranscript,
      onError: handleError,
      onClose: (reason) => {
        console.log(`[VoiceInput] Closed: ${reason}`)
        isRecording.value = false
        if (reason === 'complete') {
          status.value = 'Click to start recording'
        } else if (reason === 'error') {
          // Error message already set by handleError
        } else {
          status.value = 'Session timed out. Please try again.'
        }
      }
    })

    try {
      status.value = 'Connecting...'
      await transcriptionStream.start()
    } catch (error) {
      console.error('[VoiceInput] Start error:', error)
      status.value = error instanceof Error ? error.message : 'Failed to start. Please try again.'
      isRecording.value = false
    }
  }
}

onUnmounted(() => {
  transcriptionStream?.stop()
})
</script>

<template>
  <div class="voice-interface">
    <h3>{{ props.title }}</h3>
    <p class="voice-description">{{ props.description }}</p>

    <button class="mic-button" :class="{ recording: isRecording }" @click="toggleRecording">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>

    <p class="voice-status">{{ status }}</p>

    <button v-if="showHintsLink" class="hints-link" @click="emit('showHints')">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      View voice command examples
    </button>

    <div v-if="transcript || interimTranscript" class="transcription-box">
      <div class="label">Heard:</div>
      <div>
        <span>{{ transcript }}</span>
        <span v-if="interimTranscript" class="interim-transcript">{{ interimTranscript }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interim-transcript {
  color: var(--text-muted, #6b7280);
  font-style: italic;
}
</style>
