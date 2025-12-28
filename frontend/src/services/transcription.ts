/**
 * Transcription service for real-time speech-to-text
 * Streams audio to backend WebSocket which proxies to AWS Transcribe
 */

export type TranscriptionProvider = 'aws-medical' | 'aws-standard'

export interface TranscriptionConfig {
  sampleRate?: number
  provider?: TranscriptionProvider
}

export interface TranscriptResult {
  transcript: string
  isPartial: boolean
  resultId: string
  confidence?: number
}

export interface TranscriptionCallbacks {
  onReady?: (sessionId: string, provider: TranscriptionProvider) => void
  onTranscript?: (result: TranscriptResult) => void
  onFinalTranscript?: (transcript: string) => void
  onError?: (error: { code: string; message: string; retryable: boolean }) => void
  onClose?: (reason: 'complete' | 'error' | 'timeout') => void
}

interface ServerMessage {
  type: 'ready' | 'transcript' | 'error' | 'closed'
  sessionId?: string
  provider?: TranscriptionProvider
  transcript?: string
  isPartial?: boolean
  resultId?: string
  confidence?: number
  code?: string
  message?: string
  retryable?: boolean
  reason?: 'complete' | 'error' | 'timeout'
  finalTranscript?: string
}

export class TranscriptionStream {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private finalTranscript = ''
  private isActive = false
  private config: TranscriptionConfig

  constructor(
    private callbacks: TranscriptionCallbacks,
    config: TranscriptionConfig = {}
  ) {
    this.config = {
      sampleRate: config.sampleRate || 16000,
      provider: config.provider,
    }
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Transcription already active')
    }

    // Get auth token
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('Authentication required')
    }

    // Build WebSocket URL with token as query param
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/transcription/stream?token=${encodeURIComponent(token)}`

    // Connect WebSocket
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      // Send config message
      this.ws?.send(
        JSON.stringify({
          type: 'config',
          sampleRate: this.config.sampleRate,
          encoding: 'pcm',
          provider: this.config.provider,
        })
      )
    }

    this.ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('[Transcription] Failed to parse message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('[Transcription] WebSocket error:', error)
      this.callbacks.onError?.({
        code: 'WEBSOCKET_ERROR',
        message: 'Connection error',
        retryable: true,
      })
    }

    this.ws.onclose = () => {
      if (this.isActive) {
        // Unexpected close
        this.callbacks.onClose?.('error')
      }
      this.cleanup()
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'ready':
        this.isActive = true
        this.startAudioCapture()
        if (message.sessionId && message.provider) {
          this.callbacks.onReady?.(message.sessionId, message.provider)
        }
        break

      case 'transcript':
        if (message.transcript !== undefined) {
          if (!message.isPartial) {
            this.finalTranscript = message.transcript
          }
          this.callbacks.onTranscript?.({
            transcript: message.transcript,
            isPartial: message.isPartial ?? false,
            resultId: message.resultId ?? '',
            confidence: message.confidence,
          })
        }
        break

      case 'error':
        this.callbacks.onError?.({
          code: message.code ?? 'UNKNOWN_ERROR',
          message: message.message ?? 'Unknown error',
          retryable: message.retryable ?? false,
        })
        if (!message.retryable) {
          this.stop()
        }
        break

      case 'closed':
        if (message.finalTranscript || this.finalTranscript) {
          this.callbacks.onFinalTranscript?.(message.finalTranscript || this.finalTranscript)
        }
        this.callbacks.onClose?.(message.reason ?? 'complete')
        this.cleanup()
        break
    }
  }

  private async startAudioCapture(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Create audio context at the requested sample rate
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      })

      this.source = this.audioContext.createMediaStreamSource(this.stream)

      // Use ScriptProcessor to access raw PCM data
      // Note: ScriptProcessor is deprecated but AudioWorklet requires more setup
      // and has cross-origin restrictions. For production, consider migrating to AudioWorklet.
      const bufferSize = 4096
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

      this.processor.onaudioprocess = (event) => {
        if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return
        }

        // Get audio data from the input buffer
        const inputData = event.inputBuffer.getChannelData(0)

        // Convert float32 to 16-bit PCM
        const pcmData = this.floatTo16BitPCM(inputData)

        // Send as base64 encoded data
        this.ws.send(
          JSON.stringify({
            type: 'audio',
            data: this.arrayBufferToBase64(pcmData.buffer),
          })
        )
      }

      // Connect the audio processing chain
      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
    } catch (error) {
      console.error('[Transcription] Audio capture error:', error)
      this.callbacks.onError?.({
        code: 'AUDIO_CAPTURE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to capture audio',
        retryable: false,
      })
      this.stop()
    }
  }

  /**
   * Convert Float32Array audio samples to Int16Array (16-bit PCM)
   */
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp value between -1 and 1
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      // Convert to 16-bit integer
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Stop the transcription stream
   */
  stop(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end' }))
    }
    this.isActive = false
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    this.isActive = false

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore errors when closing audio context
      })
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Check if transcription is currently active
   */
  get active(): boolean {
    return this.isActive
  }
}

/**
 * Check transcription service status
 */
export async function getTranscriptionStatus(): Promise<{
  configured: boolean
  defaultProvider: TranscriptionProvider
  providers: Record<
    TranscriptionProvider,
    { available: boolean; hipaaEligible: boolean }
  >
}> {
  const token = localStorage.getItem('token')
  const response = await fetch('/api/transcription/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new Error('Failed to get transcription status')
  }
  return response.json()
}
