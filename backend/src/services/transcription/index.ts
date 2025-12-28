/**
 * Transcription service module
 * Provides speech-to-text capabilities using pluggable providers
 */

export * from './types.js'
export {
  getTranscriptionProvider,
  getDefaultProvider,
  isTranscriptionConfigured,
} from './providerFactory.js'
