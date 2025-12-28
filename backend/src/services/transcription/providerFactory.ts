/**
 * Transcription provider factory
 * Creates and manages singleton instances of transcription providers
 */

import type { TranscriptionProvider, TranscriptionProviderType } from './types.js'
import { AWSMedicalTranscribeProvider } from './providers/awsMedicalTranscribe.js'
import { AWSStandardTranscribeProvider } from './providers/awsStandardTranscribe.js'

let medicalProvider: AWSMedicalTranscribeProvider | null = null
let standardProvider: AWSStandardTranscribeProvider | null = null

/**
 * Get a transcription provider by type
 * Uses singleton pattern to reuse provider instances
 */
export function getTranscriptionProvider(type: TranscriptionProviderType): TranscriptionProvider {
  switch (type) {
    case 'aws-medical':
      if (!medicalProvider) {
        medicalProvider = new AWSMedicalTranscribeProvider()
      }
      return medicalProvider

    case 'aws-standard':
      if (!standardProvider) {
        standardProvider = new AWSStandardTranscribeProvider()
      }
      return standardProvider

    default:
      throw new Error(`Unknown transcription provider: ${type}`)
  }
}

/**
 * Get the default transcription provider type
 * Can be configured via environment variable
 */
export function getDefaultProvider(): TranscriptionProviderType {
  const envProvider = process.env.DEFAULT_TRANSCRIPTION_PROVIDER
  if (envProvider === 'aws-standard' || envProvider === 'aws-medical') {
    return envProvider
  }
  return 'aws-medical' // Default to HIPAA-compliant provider
}

/**
 * Check if AWS credentials are configured
 */
export function isTranscriptionConfigured(): boolean {
  // AWS SDK will use:
  // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 2. Shared credentials file (~/.aws/credentials)
  // 3. IAM role (when running on AWS)
  // We check for the environment variables as the primary method
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    || !!(process.env.AWS_PROFILE)
    || !!(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) // ECS task role
}
