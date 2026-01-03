/**
 * AI Provider Abstraction Layer
 *
 * This module provides a unified interface for AI services, supporting both
 * AWS Nova (via Bedrock) and OpenAI as providers. The active provider is
 * determined by the AI_PROVIDER environment variable.
 *
 * Environment variables:
 * - AI_PROVIDER: 'openai' (default) or 'nova'
 * - For Nova: AWS_REGION (default: us-east-1), plus AWS credentials via IAM or env vars
 * - For OpenAI: OPENAI_API_KEY
 */

import * as novaProvider from './novaProvider.js'
import * as openaiProvider from './openaiProvider.js'
import type { BusinessHours } from '../repositories/organizationSettings.js'

// Re-export types from providers
export type {
  StaffForScheduling,
  PatientForScheduling,
  RuleForScheduling,
  RoomForScheduling,
  GeneratedSession,
  ScheduleGenerationResult,
  RuleConflict,
  RuleDuplicate,
  SuggestedRule,
  RuleEnhancement,
  RuleAnalysisResult,
  EntityNamesContext,
} from './novaProvider.js'

export type { BusinessHours } from '../repositories/organizationSettings.js'

type AIProvider = 'nova' | 'openai'

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase()
  if (provider === 'nova') {
    return 'nova'
  }
  return 'openai' // Default to OpenAI
}

/**
 * Check if the current AI provider is properly configured
 */
export function isProviderConfigured(): boolean {
  const provider = getProvider()
  if (provider === 'openai') {
    return openaiProvider.isConfigured()
  }
  return novaProvider.isConfigured()
}

/**
 * Get the name of the currently active provider
 */
export function getActiveProvider(): string {
  return getProvider()
}

/**
 * Generate a weekly therapy schedule using AI
 */
export async function generateScheduleWithAI(
  weekStartDate: Date,
  staff: novaProvider.StaffForScheduling[],
  patients: novaProvider.PatientForScheduling[],
  rules: novaProvider.RuleForScheduling[],
  rooms: novaProvider.RoomForScheduling[] = [],
  timezone: string = 'UTC',
  businessHours?: BusinessHours
): Promise<novaProvider.ScheduleGenerationResult> {
  const provider = getProvider()

  if (provider === 'openai') {
    return openaiProvider.generateScheduleWithAI(weekStartDate, staff, patients, rules, rooms, timezone, businessHours)
  }

  return novaProvider.generateScheduleWithAI(weekStartDate, staff, patients, rules, rooms, timezone, businessHours)
}

/**
 * Analyze scheduling rules for conflicts, duplicates, and enhancements
 */
export async function analyzeRulesWithAI(
  rules: novaProvider.RuleForScheduling[],
  context: novaProvider.EntityNamesContext
): Promise<novaProvider.RuleAnalysisResult> {
  const provider = getProvider()

  if (provider === 'openai') {
    return openaiProvider.analyzeRulesWithAI(rules, context)
  }

  return novaProvider.analyzeRulesWithAI(rules, context)
}

interface ChatCompletionOptions {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
}

/**
 * Generic chat completion for voice parsing and other AI tasks
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const provider = getProvider()

  if (provider === 'openai') {
    return openaiProvider.chatCompletion(options)
  }

  return novaProvider.chatCompletion(options)
}
