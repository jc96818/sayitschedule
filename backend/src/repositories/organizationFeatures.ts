import { prisma } from './base.js'
import type { OrganizationFeatures, Prisma } from '@prisma/client'

// Feature tier presets
export const FEATURE_TIERS = {
  basic: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: false,
    reminderHours: [24],
    patientPortalEnabled: false,
    portalAllowCancel: false,
    portalAllowReschedule: false,
    portalRequireConfirmation: false,
    advancedReportsEnabled: false,
    reportExportEnabled: true,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    maxStaff: 10,
    maxPatients: 100,
    maxRemindersPerMonth: 500
  },
  professional: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: true,
    reminderHours: [24, 2],
    patientPortalEnabled: true,
    portalAllowCancel: true,
    portalAllowReschedule: false,
    portalRequireConfirmation: true,
    advancedReportsEnabled: true,
    reportExportEnabled: true,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: true,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    maxStaff: 50,
    maxPatients: 500,
    maxRemindersPerMonth: 5000
  },
  enterprise: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: true,
    reminderHours: [48, 24, 2],
    patientPortalEnabled: true,
    portalAllowCancel: true,
    portalAllowReschedule: true,
    portalRequireConfirmation: true,
    advancedReportsEnabled: true,
    reportExportEnabled: true,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: true,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    maxStaff: null, // unlimited
    maxPatients: null, // unlimited
    maxRemindersPerMonth: null // unlimited
  }
} as const

export type FeatureTier = keyof typeof FEATURE_TIERS

export interface OrganizationFeaturesUpdate {
  emailRemindersEnabled?: boolean
  smsRemindersEnabled?: boolean
  reminderHours?: number[]
  patientPortalEnabled?: boolean
  portalAllowCancel?: boolean
  portalAllowReschedule?: boolean
  portalRequireConfirmation?: boolean
  advancedReportsEnabled?: boolean
  reportExportEnabled?: boolean
  voiceCommandsEnabled?: boolean
  medicalTranscribeEnabled?: boolean
  apiAccessEnabled?: boolean
  webhooksEnabled?: boolean
  maxStaff?: number | null
  maxPatients?: number | null
  maxRemindersPerMonth?: number | null
}

export type { OrganizationFeatures }

export class OrganizationFeaturesRepository {
  /**
   * Get features for an organization.
   * Creates default (basic tier) features if they don't exist.
   */
  async findByOrganizationId(organizationId: string): Promise<OrganizationFeatures> {
    let features = await prisma.organizationFeatures.findUnique({
      where: { organizationId }
    })

    if (!features) {
      // Create default features (basic tier) if they don't exist
      features = await this.createWithTier(organizationId, 'basic')
    }

    return features
  }

  /**
   * Create features with a specific tier preset
   */
  async createWithTier(organizationId: string, tier: FeatureTier): Promise<OrganizationFeatures> {
    const tierConfig = FEATURE_TIERS[tier]

    return prisma.organizationFeatures.create({
      data: {
        organizationId,
        ...tierConfig,
        reminderHours: tierConfig.reminderHours
      }
    })
  }

  /**
   * Update organization features
   */
  async update(
    organizationId: string,
    data: OrganizationFeaturesUpdate
  ): Promise<OrganizationFeatures> {
    // Ensure features exist
    await this.findByOrganizationId(organizationId)

    return prisma.organizationFeatures.update({
      where: { organizationId },
      data: data as Prisma.OrganizationFeaturesUpdateInput
    })
  }

  /**
   * Apply a tier preset to an organization
   */
  async applyTier(organizationId: string, tier: FeatureTier): Promise<OrganizationFeatures> {
    const tierConfig = FEATURE_TIERS[tier]

    // Ensure features exist first
    await this.findByOrganizationId(organizationId)

    return prisma.organizationFeatures.update({
      where: { organizationId },
      data: {
        ...tierConfig,
        reminderHours: tierConfig.reminderHours
      }
    })
  }

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(
    organizationId: string,
    feature: keyof Omit<OrganizationFeatures, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'reminderHours' | 'maxStaff' | 'maxPatients' | 'maxRemindersPerMonth'>
  ): Promise<boolean> {
    const features = await this.findByOrganizationId(organizationId)
    return features[feature] as boolean
  }

  /**
   * Check if patient portal is enabled
   */
  async isPatientPortalEnabled(organizationId: string): Promise<boolean> {
    return this.isFeatureEnabled(organizationId, 'patientPortalEnabled')
  }

  /**
   * Check if SMS reminders are enabled
   */
  async isSmsRemindersEnabled(organizationId: string): Promise<boolean> {
    return this.isFeatureEnabled(organizationId, 'smsRemindersEnabled')
  }

  /**
   * Check if advanced reports are enabled
   */
  async isAdvancedReportsEnabled(organizationId: string): Promise<boolean> {
    return this.isFeatureEnabled(organizationId, 'advancedReportsEnabled')
  }

  /**
   * Check if API access is enabled
   */
  async isApiAccessEnabled(organizationId: string): Promise<boolean> {
    return this.isFeatureEnabled(organizationId, 'apiAccessEnabled')
  }

  /**
   * Get reminder hours configuration
   */
  async getReminderHours(organizationId: string): Promise<number[]> {
    const features = await this.findByOrganizationId(organizationId)
    return features.reminderHours as number[]
  }

  /**
   * Check if organization is within staff limit
   */
  async canAddStaff(organizationId: string, currentCount: number): Promise<boolean> {
    const features = await this.findByOrganizationId(organizationId)
    if (features.maxStaff === null) return true // unlimited
    return currentCount < features.maxStaff
  }

  /**
   * Check if organization is within patient limit
   */
  async canAddPatient(organizationId: string, currentCount: number): Promise<boolean> {
    const features = await this.findByOrganizationId(organizationId)
    if (features.maxPatients === null) return true // unlimited
    return currentCount < features.maxPatients
  }

  /**
   * Get portal configuration for an organization
   */
  async getPortalConfig(organizationId: string): Promise<{
    enabled: boolean
    allowCancel: boolean
    allowReschedule: boolean
    requireConfirmation: boolean
  }> {
    const features = await this.findByOrganizationId(organizationId)
    return {
      enabled: features.patientPortalEnabled,
      allowCancel: features.portalAllowCancel,
      allowReschedule: features.portalAllowReschedule,
      requireConfirmation: features.portalRequireConfirmation
    }
  }

  /**
   * Delete features for an organization (usually cascades with org delete)
   */
  async delete(organizationId: string): Promise<boolean> {
    try {
      await prisma.organizationFeatures.delete({
        where: { organizationId }
      })
      return true
    } catch {
      return false
    }
  }
}

export const organizationFeaturesRepository = new OrganizationFeaturesRepository()
