/**
 * Transcription service types and interfaces
 * Provides abstraction for multiple speech-to-text providers
 */

export type TranscriptionProviderType = 'aws-medical' | 'aws-standard'

export type MedicalSpecialty =
  | 'PRIMARYCARE'
  | 'CARDIOLOGY'
  | 'NEUROLOGY'
  | 'ONCOLOGY'
  | 'RADIOLOGY'
  | 'UROLOGY'

export type ContentType = 'CONVERSATION' | 'DICTATION'

export interface TranscriptionConfig {
  provider: TranscriptionProviderType
  languageCode: string
  sampleRate: number
  mediaEncoding: 'pcm' | 'ogg-opus' | 'flac'
  medicalSpecialty?: MedicalSpecialty
  contentType?: ContentType
}

export interface TranscriptionResult {
  transcript: string
  isPartial: boolean
  resultId: string
  startTime?: number
  endTime?: number
  confidence?: number
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

export interface TranscriptionError {
  code: string
  message: string
  retryable: boolean
}

export interface ProviderCapabilities {
  supportedSampleRates: number[]
  supportedEncodings: string[]
  supportedLanguages: string[]
  maxStreamDuration: number // seconds
  supportsInterimResults: boolean
  isHIPAAEligible: boolean
}

export interface TranscriptionProvider {
  /**
   * Start a streaming transcription session
   * Returns an async iterator that yields TranscriptionResult
   */
  startStream(
    audioStream: AsyncIterable<Buffer>,
    config: TranscriptionConfig
  ): AsyncIterable<TranscriptionResult>

  /**
   * Get provider capabilities and constraints
   */
  getCapabilities(): ProviderCapabilities
}

// WebSocket protocol message types

export interface ClientConfigMessage {
  type: 'config'
  sampleRate: number
  encoding: 'pcm' | 'ogg-opus' | 'flac'
  provider?: TranscriptionProviderType
}

export interface ClientAudioMessage {
  type: 'audio'
  data: string // Base64 encoded audio chunk
}

export interface ClientEndMessage {
  type: 'end'
}

export type ClientMessage = ClientConfigMessage | ClientAudioMessage | ClientEndMessage

export interface ServerReadyMessage {
  type: 'ready'
  sessionId: string
  provider: TranscriptionProviderType
}

export interface ServerTranscriptMessage {
  type: 'transcript'
  transcript: string
  isPartial: boolean
  resultId: string
  confidence?: number
}

export interface ServerErrorMessage {
  type: 'error'
  code: string
  message: string
  retryable: boolean
}

export interface ServerClosedMessage {
  type: 'closed'
  reason: 'complete' | 'error' | 'timeout'
  finalTranscript?: string
}

export type ServerMessage =
  | ServerReadyMessage
  | ServerTranscriptMessage
  | ServerErrorMessage
  | ServerClosedMessage
