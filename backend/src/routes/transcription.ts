/**
 * WebSocket route for real-time audio transcription
 * Streams audio to AWS Transcribe and returns transcription results
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { nanoid } from 'nanoid'
import {
  getTranscriptionProvider,
  getDefaultProvider,
  isTranscriptionConfigured,
  type TranscriptionConfig,
  type TranscriptionProviderType,
  type ClientMessage,
  type ServerMessage,
} from '../services/transcription/index.js'
import type { JWTPayload, UserRole } from '../types/index.js'

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'admin', 'admin_assistant']

function sendMessage(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === 1) { // WebSocket.OPEN
    socket.send(JSON.stringify(message))
  }
}

function sendError(
  socket: WebSocket,
  code: string,
  message: string,
  retryable: boolean = false
): void {
  sendMessage(socket, { type: 'error', code, message, retryable })
}

export async function transcriptionRoutes(fastify: FastifyInstance) {
  // WebSocket endpoint for streaming transcription
  fastify.get('/stream', { websocket: true }, async (socket: WebSocket, request: FastifyRequest) => {
    const sessionId = nanoid()
    let config: TranscriptionConfig | null = null
    const audioQueue: Buffer[] = []
    let isStreaming = false
    let streamEnded = false
    let finalTranscript = ''
    let audioResolve: (() => void) | null = null

    // Check if transcription is configured
    if (!isTranscriptionConfigured()) {
      sendError(socket, 'SERVICE_NOT_CONFIGURED', 'Transcription service not configured', false)
      socket.close()
      return
    }

    // Authenticate via query parameter (WebSocket can't use headers reliably)
    // Token should be passed as: /api/transcription/stream?token=<jwt>
    const url = new URL(request.url, `http://${request.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      sendError(socket, 'UNAUTHORIZED', 'Authentication required', false)
      socket.close()
      return
    }

    let user: JWTPayload
    try {
      // Verify the JWT token manually
      user = fastify.jwt.verify<JWTPayload>(token)
    } catch {
      sendError(socket, 'INVALID_TOKEN', 'Invalid authentication token', false)
      socket.close()
      return
    }

    // Check role authorization
    if (!ALLOWED_ROLES.includes(user.role)) {
      sendError(socket, 'FORBIDDEN', 'Insufficient permissions', false)
      socket.close()
      return
    }

    // Check organization context
    const organizationId = user.organizationId
    if (!organizationId && user.role !== 'super_admin') {
      sendError(socket, 'NO_ORG_CONTEXT', 'Organization context required', false)
      socket.close()
      return
    }

    console.log(`[Transcription] WebSocket connected: session=${sessionId}, user=${user.userId}`)

    // Create async iterable from audio queue
    async function* audioStream(): AsyncIterable<Buffer> {
      while (!streamEnded || audioQueue.length > 0) {
        if (audioQueue.length > 0) {
          yield audioQueue.shift()!
        } else {
          // Wait for more audio data
          await new Promise<void>((resolve) => {
            audioResolve = resolve
            // Timeout to prevent infinite waiting
            setTimeout(() => {
              if (audioResolve === resolve) {
                audioResolve = null
                resolve()
              }
            }, 100)
          })
        }
      }
    }

    // Start transcription with the configured provider
    async function startTranscription(): Promise<void> {
      if (!config) return

      try {
        const provider = getTranscriptionProvider(config.provider)
        console.log(`[Transcription] Starting stream with provider: ${config.provider}`)

        for await (const result of provider.startStream(audioStream(), config)) {
          // Track final transcript
          if (!result.isPartial) {
            finalTranscript = result.transcript
          }

          sendMessage(socket, {
            type: 'transcript',
            transcript: result.transcript,
            isPartial: result.isPartial,
            resultId: result.resultId,
            confidence: result.confidence,
          })
        }

        sendMessage(socket, {
          type: 'closed',
          reason: 'complete',
          finalTranscript: finalTranscript || undefined,
        })
      } catch (error) {
        console.error('[Transcription] Stream error:', error)
        sendError(
          socket,
          'TRANSCRIPTION_ERROR',
          error instanceof Error ? error.message : 'Transcription failed',
          true
        )
        sendMessage(socket, { type: 'closed', reason: 'error' })
      }
    }

    socket.on('message', (raw: Buffer | string) => {
      try {
        const message: ClientMessage = JSON.parse(
          typeof raw === 'string' ? raw : raw.toString()
        )

        switch (message.type) {
          case 'config': {
            // Determine provider type
            const providerType: TranscriptionProviderType = message.provider || getDefaultProvider()

            config = {
              provider: providerType,
              languageCode: 'en-US',
              sampleRate: message.sampleRate || 16000,
              mediaEncoding: message.encoding || 'pcm',
              medicalSpecialty: 'PRIMARYCARE',
              contentType: 'CONVERSATION',
            }

            console.log(`[Transcription] Config received: provider=${providerType}, sampleRate=${config.sampleRate}`)

            sendMessage(socket, {
              type: 'ready',
              sessionId,
              provider: providerType,
            })

            // Start streaming to AWS
            if (!isStreaming) {
              isStreaming = true
              startTranscription().catch((error) => {
                console.error('[Transcription] Fatal error:', error)
              })
            }
            break
          }

          case 'audio': {
            if (message.data) {
              const audioChunk = Buffer.from(message.data, 'base64')
              audioQueue.push(audioChunk)
              // Wake up the audio stream if waiting
              if (audioResolve) {
                const resolve = audioResolve
                audioResolve = null
                resolve()
              }
            }
            break
          }

          case 'end': {
            console.log(`[Transcription] End signal received: session=${sessionId}`)
            streamEnded = true
            // Wake up the audio stream to finish
            if (audioResolve) {
              const resolve = audioResolve
              audioResolve = null
              resolve()
            }
            break
          }
        }
      } catch (error) {
        console.error('[Transcription] Message parse error:', error)
        sendError(socket, 'MESSAGE_PARSE_ERROR', 'Failed to parse message', true)
      }
    })

    socket.on('close', () => {
      console.log(`[Transcription] WebSocket closed: session=${sessionId}`)
      streamEnded = true
      if (audioResolve) {
        const resolve = audioResolve
        audioResolve = null
        resolve()
      }
    })

    socket.on('error', (error: Error) => {
      console.error(`[Transcription] WebSocket error: session=${sessionId}`, error)
      streamEnded = true
      if (audioResolve) {
        const resolve = audioResolve
        audioResolve = null
        resolve()
      }
    })
  })

  // HTTP endpoint to check transcription service status
  fastify.get('/status', async () => {
    const configured = isTranscriptionConfigured()
    const defaultProvider = getDefaultProvider()

    return {
      configured,
      defaultProvider,
      providers: {
        'aws-medical': {
          available: configured,
          hipaaEligible: true,
        },
        'aws-standard': {
          available: configured,
          hipaaEligible: false,
        },
      },
    }
  })
}
