/**
 * AWS Medical Transcribe provider
 * HIPAA-eligible speech-to-text service for medical applications
 */

import {
  TranscribeStreamingClient,
  StartMedicalStreamTranscriptionCommand,
  LanguageCode,
  MediaEncoding,
  Specialty,
  Type,
} from '@aws-sdk/client-transcribe-streaming'
import type {
  TranscriptionProvider,
  TranscriptionConfig,
  TranscriptionResult,
  ProviderCapabilities,
  MedicalSpecialty,
} from '../types.js'

const SPECIALTY_MAP: Record<MedicalSpecialty, Specialty> = {
  PRIMARYCARE: Specialty.PRIMARYCARE,
  CARDIOLOGY: Specialty.CARDIOLOGY,
  NEUROLOGY: Specialty.NEUROLOGY,
  ONCOLOGY: Specialty.ONCOLOGY,
  RADIOLOGY: Specialty.RADIOLOGY,
  UROLOGY: Specialty.UROLOGY,
}

export class AWSMedicalTranscribeProvider implements TranscriptionProvider {
  private client: TranscribeStreamingClient

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1'
    this.client = new TranscribeStreamingClient({ region })
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedSampleRates: [16000, 32000, 44100, 48000],
      supportedEncodings: ['pcm', 'ogg-opus', 'flac'],
      supportedLanguages: ['en-US', 'en-GB', 'en-AU'],
      maxStreamDuration: 14400, // 4 hours
      supportsInterimResults: true,
      isHIPAAEligible: true,
    }
  }

  async *startStream(
    audioStream: AsyncIterable<Buffer>,
    config: TranscriptionConfig
  ): AsyncIterable<TranscriptionResult> {
    const audioGenerator = this.createAudioEventStream(audioStream)

    const command = new StartMedicalStreamTranscriptionCommand({
      LanguageCode: config.languageCode as LanguageCode,
      MediaEncoding: config.mediaEncoding as MediaEncoding,
      MediaSampleRateHertz: config.sampleRate,
      Specialty: config.medicalSpecialty
        ? SPECIALTY_MAP[config.medicalSpecialty]
        : Specialty.PRIMARYCARE,
      Type: config.contentType === 'DICTATION' ? Type.DICTATION : Type.CONVERSATION,
      AudioStream: audioGenerator,
    })

    let response
    try {
      response = await this.client.send(command)
    } catch (error) {
      console.error('AWS Medical Transcribe error:', error)
      throw new Error(
        `Medical transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    if (!response.TranscriptResultStream) {
      throw new Error('No transcript stream in response')
    }

    try {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent?.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (result.Alternatives && result.Alternatives.length > 0) {
              const primary = result.Alternatives[0]
              yield {
                transcript: primary.Transcript || '',
                isPartial: result.IsPartial || false,
                resultId: result.ResultId || '',
                startTime: result.StartTime,
                endTime: result.EndTime,
                confidence: undefined, // Medical transcribe doesn't provide confidence in streaming
                alternatives: result.Alternatives.map((alt) => ({
                  transcript: alt.Transcript || '',
                  confidence: 0,
                })),
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing transcription stream:', error)
      throw new Error(
        `Stream processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async *createAudioEventStream(
    audioStream: AsyncIterable<Buffer>
  ): AsyncIterable<{ AudioEvent: { AudioChunk: Uint8Array } }> {
    for await (const chunk of audioStream) {
      yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } }
    }
  }
}
