/**
 * AWS Standard Transcribe provider
 * General-purpose speech-to-text service (NOT HIPAA-eligible)
 */

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  LanguageCode,
  MediaEncoding,
  PartialResultsStability,
} from '@aws-sdk/client-transcribe-streaming'
import type {
  TranscriptionProvider,
  TranscriptionConfig,
  TranscriptionResult,
  ProviderCapabilities,
} from '../types.js'

export class AWSStandardTranscribeProvider implements TranscriptionProvider {
  private client: TranscribeStreamingClient

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1'
    this.client = new TranscribeStreamingClient({ region })
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedSampleRates: [8000, 16000, 32000, 44100, 48000],
      supportedEncodings: ['pcm', 'ogg-opus', 'flac'],
      supportedLanguages: [
        'en-US',
        'en-GB',
        'en-AU',
        'es-US',
        'fr-FR',
        'fr-CA',
        'de-DE',
        'it-IT',
        'pt-BR',
        'ja-JP',
        'ko-KR',
        'zh-CN',
      ],
      maxStreamDuration: 14400, // 4 hours
      supportsInterimResults: true,
      isHIPAAEligible: false, // Standard Transcribe is NOT HIPAA-eligible
    }
  }

  async *startStream(
    audioStream: AsyncIterable<Buffer>,
    config: TranscriptionConfig
  ): AsyncIterable<TranscriptionResult> {
    const audioGenerator = this.createAudioEventStream(audioStream)

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: config.languageCode as LanguageCode,
      MediaEncoding: config.mediaEncoding as MediaEncoding,
      MediaSampleRateHertz: config.sampleRate,
      AudioStream: audioGenerator,
      EnablePartialResultsStabilization: true,
      PartialResultsStability: PartialResultsStability.MEDIUM,
    })

    let response
    try {
      response = await this.client.send(command)
    } catch (error) {
      console.error('AWS Standard Transcribe error:', error)
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
                confidence: undefined,
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
