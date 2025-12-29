<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { TranscriptionStream, type TranscriptResult } from '@/services/transcription'

interface Props {
  title?: string
  description?: string
  showHintsLink?: boolean
  enableTextInput?: boolean
  textPlaceholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Voice Input',
  description: 'Click the microphone and speak',
  showHintsLink: false,
  enableTextInput: true,
  textPlaceholder: 'Type your command… (Enter to send)'
})

const emit = defineEmits<{
  result: [transcript: string]
  interim: [transcript: string]
  error: [error: string]
  showHints: []
}>()

type InputMode = 'voice' | 'text'

const isRecording = ref(false)
const transcript = ref('')
const interimTranscript = ref('')
const status = ref('Click to start recording')

const inputMode = ref<InputMode>('voice')
const typedText = ref('')

let transcriptionStream: TranscriptionStream | null = null

const canSendTyped = computed(() => typedText.value.trim().length > 0)

function setInputMode(mode: InputMode) {
  if (!props.enableTextInput) {
    inputMode.value = 'voice'
    return
  }

  if (mode === 'text' && isRecording.value) {
    transcriptionStream?.stop()
    isRecording.value = false
  }

  inputMode.value = mode
  try {
    window.localStorage.setItem('sayitschedule.voiceInputMode', mode)
  } catch {
    // ignore
  }
}

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

  if (
    props.enableTextInput &&
    (error.code === 'AUDIO_CAPTURE_ERROR' || error.code === 'SERVICE_NOT_CONFIGURED' || error.code === 'FORBIDDEN')
  ) {
    setInputMode('text')
  }
}

async function toggleRecording() {
  if (!props.enableTextInput) {
    inputMode.value = 'voice'
  }
  if (inputMode.value !== 'voice') {
    setInputMode('voice')
  }

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

function sendTyped() {
  const text = typedText.value.trim()
  if (!text) return
  typedText.value = ''
  emit('result', text)
}

function handleTypedKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  if (event.shiftKey) return
  event.preventDefault()
  sendTyped()
}

onMounted(() => {
  if (!props.enableTextInput) return
  try {
    const savedMode = window.localStorage.getItem('sayitschedule.voiceInputMode') as InputMode | null
    if (savedMode === 'voice' || savedMode === 'text') {
      inputMode.value = savedMode
    }
  } catch {
    // ignore
  }
})

onUnmounted(() => {
  transcriptionStream?.stop()
})
</script>

<template>
  <div class="voice-interface">
    <h3>{{ props.title }}</h3>
    <p class="voice-description">{{ props.description }}</p>

    <div v-if="props.enableTextInput" class="voice-mode-toggle">
      <button
        type="button"
        class="voice-mode-button"
        :class="{ active: inputMode === 'voice' }"
        @click="setInputMode('voice')"
      >
        Speak
      </button>
      <button
        type="button"
        class="voice-mode-button"
        :class="{ active: inputMode === 'text' }"
        @click="setInputMode('text')"
      >
        Type
      </button>
    </div>

    <template v-if="inputMode === 'voice'">
      <button class="mic-button" :class="{ recording: isRecording }" @click="toggleRecording">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <p class="voice-status">{{ status }}</p>

      <div v-if="transcript || interimTranscript" class="transcription-box">
        <div class="label">Heard:</div>
        <div>
          <span>{{ transcript }}</span>
          <span v-if="interimTranscript" class="interim-transcript">{{ interimTranscript }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="voice-textbox">
        <textarea
          v-model="typedText"
          class="voice-textarea"
          :placeholder="props.textPlaceholder"
          rows="3"
          @keydown="handleTypedKeydown"
        />
        <div class="voice-send-row">
          <button type="button" class="voice-send" :disabled="!canSendTyped" @click="sendTyped">
            Send
          </button>
        </div>
      </div>
    </template>

    <button v-if="showHintsLink" class="hints-link" @click="emit('showHints')">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      View command examples
    </button>
  </div>
</template>

<style scoped>
.interim-transcript {
  color: var(--text-muted, #6b7280);
  font-style: italic;
}
</style>
