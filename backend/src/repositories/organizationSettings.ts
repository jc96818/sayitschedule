import { prisma } from './base.js'
import type { OrganizationSettings, Prisma } from '@prisma/client'

// Default business hours structure
export const DEFAULT_BUSINESS_HOURS = {
  monday: { open: true, start: '08:00', end: '18:00' },
  tuesday: { open: true, start: '08:00', end: '18:00' },
  wednesday: { open: true, start: '08:00', end: '18:00' },
  thursday: { open: true, start: '08:00', end: '18:00' },
  friday: { open: true, start: '08:00', end: '18:00' },
  saturday: { open: false, start: '08:00', end: '18:00' },
  sunday: { open: false, start: '08:00', end: '18:00' }
}

export interface BusinessHoursDay {
  open: boolean
  start: string
  end: string
}

export interface BusinessHours {
  monday: BusinessHoursDay
  tuesday: BusinessHoursDay
  wednesday: BusinessHoursDay
  thursday: BusinessHoursDay
  friday: BusinessHoursDay
  saturday: BusinessHoursDay
  sunday: BusinessHoursDay
}

export interface OrganizationSettingsUpdate {
  businessHours?: BusinessHours
  timezone?: string
  defaultSessionDuration?: number
  slotInterval?: number
  lateCancelWindowHours?: number
}

export type { OrganizationSettings }

export class OrganizationSettingsRepository {
  /**
   * Get settings for an organization.
   * Creates default settings if they don't exist.
   */
  async findByOrganizationId(organizationId: string): Promise<OrganizationSettings> {
    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationId }
    })

    if (!settings) {
      // Create default settings if they don't exist
      settings = await this.createDefaults(organizationId)
    }

    return settings
  }

  /**
   * Create default settings for an organization
   */
  async createDefaults(organizationId: string): Promise<OrganizationSettings> {
    return prisma.organizationSettings.create({
      data: {
        organizationId,
        businessHours: DEFAULT_BUSINESS_HOURS,
        timezone: 'America/New_York',
        defaultSessionDuration: 60,
        slotInterval: 30,
        lateCancelWindowHours: 24
      }
    })
  }

  /**
   * Update organization settings
   */
  async update(
    organizationId: string,
    data: OrganizationSettingsUpdate
  ): Promise<OrganizationSettings> {
    // Ensure settings exist
    await this.findByOrganizationId(organizationId)

    return prisma.organizationSettings.update({
      where: { organizationId },
      data: data as Prisma.OrganizationSettingsUpdateInput
    })
  }

  /**
   * Get business hours for an organization
   */
  async getBusinessHours(organizationId: string): Promise<BusinessHours> {
    const settings = await this.findByOrganizationId(organizationId)
    return settings.businessHours as unknown as BusinessHours
  }

  /**
   * Update just the business hours
   */
  async updateBusinessHours(
    organizationId: string,
    businessHours: BusinessHours
  ): Promise<OrganizationSettings> {
    return this.update(organizationId, { businessHours })
  }

  /**
   * Get the late cancellation window in hours
   */
  async getLateCancelWindowHours(organizationId: string): Promise<number> {
    const settings = await this.findByOrganizationId(organizationId)
    return settings.lateCancelWindowHours
  }

  /**
   * Check if a cancellation is considered "late" based on session time and org settings
   */
  async isLateCancellation(
    organizationId: string,
    sessionDateTime: Date
  ): Promise<boolean> {
    const windowHours = await this.getLateCancelWindowHours(organizationId)
    const now = new Date()
    const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilSession < windowHours
  }

  /**
   * Delete settings for an organization (usually cascades with org delete)
   */
  async delete(organizationId: string): Promise<boolean> {
    try {
      await prisma.organizationSettings.delete({
        where: { organizationId }
      })
      return true
    } catch {
      return false
    }
  }
}

export const organizationSettingsRepository = new OrganizationSettingsRepository()
