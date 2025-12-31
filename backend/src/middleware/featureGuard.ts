import type { FastifyRequest, FastifyReply } from 'fastify'
import { organizationFeaturesRepository, type OrganizationFeatures } from '../repositories/organizationFeatures.js'

// Feature names that can be checked
export type FeatureName =
  | 'emailReminders'
  | 'smsReminders'
  | 'patientPortal'
  | 'advancedReports'
  | 'reportExport'
  | 'voiceCommands'
  | 'medicalTranscribe'
  | 'apiAccess'
  | 'webhooks'

// Map feature names to their database field names
const featureFieldMap: Record<FeatureName, keyof OrganizationFeatures> = {
  emailReminders: 'emailRemindersEnabled',
  smsReminders: 'smsRemindersEnabled',
  patientPortal: 'patientPortalEnabled',
  advancedReports: 'advancedReportsEnabled',
  reportExport: 'reportExportEnabled',
  voiceCommands: 'voiceCommandsEnabled',
  medicalTranscribe: 'medicalTranscribeEnabled',
  apiAccess: 'apiAccessEnabled',
  webhooks: 'webhooksEnabled'
}

// Feature display names for error messages
const featureDisplayNames: Record<FeatureName, string> = {
  emailReminders: 'Email Reminders',
  smsReminders: 'SMS Reminders',
  patientPortal: 'Patient Portal',
  advancedReports: 'Advanced Reports',
  reportExport: 'Report Export',
  voiceCommands: 'Voice Commands',
  medicalTranscribe: 'Medical Transcribe',
  apiAccess: 'API Access',
  webhooks: 'Webhooks'
}

/**
 * Middleware factory that creates a feature guard for specific features.
 * Returns 403 if the feature is not enabled for the organization.
 *
 * @example
 * // Single feature check
 * app.get('/api/patient-portal', { preHandler: [authenticate, requireFeature('patientPortal')] }, handler)
 *
 * // Multiple features (all must be enabled)
 * app.post('/api/sms-reminder', { preHandler: [authenticate, requireFeature('smsReminders', 'patientPortal')] }, handler)
 */
export function requireFeature(...features: FeatureName[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Get organization ID from authenticated user context
    const organizationId = request.ctx.user?.organizationId

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Organization context required for feature check'
      })
    }

    try {
      const orgFeatures = await organizationFeaturesRepository.findByOrganizationId(organizationId)

      // Check each required feature
      for (const feature of features) {
        const fieldName = featureFieldMap[feature]
        const isEnabled = orgFeatures[fieldName] as boolean

        if (!isEnabled) {
          return reply.status(403).send({
            error: 'Feature Not Available',
            message: `The ${featureDisplayNames[feature]} feature is not enabled for your organization.`,
            feature: feature,
            upgradeRequired: true
          })
        }
      }
    } catch (error) {
      request.log.error({ error, organizationId }, 'Error checking organization features')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Unable to verify feature access'
      })
    }
  }
}

/**
 * Middleware factory that checks if organization has capacity for more staff.
 * Returns 403 if the limit is reached.
 */
export function requireStaffCapacity() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.user?.organizationId

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Organization context required'
      })
    }

    try {
      // Import here to avoid circular dependency
      const { staffRepository } = await import('../repositories/staff.js')
      const staffCount = await staffRepository.countByOrganization(organizationId)
      const canAdd = await organizationFeaturesRepository.canAddStaff(organizationId, staffCount)

      if (!canAdd) {
        const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)
        return reply.status(403).send({
          error: 'Limit Reached',
          message: `Your organization has reached the maximum of ${features.maxStaff} staff members.`,
          limit: features.maxStaff,
          current: staffCount,
          upgradeRequired: true
        })
      }
    } catch (error) {
      request.log.error({ error, organizationId }, 'Error checking staff capacity')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Unable to verify staff capacity'
      })
    }
  }
}

/**
 * Middleware factory that checks if organization has capacity for more patients.
 * Returns 403 if the limit is reached.
 */
export function requirePatientCapacity() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = request.ctx.user?.organizationId

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Organization context required'
      })
    }

    try {
      // Import here to avoid circular dependency
      const { patientRepository } = await import('../repositories/patients.js')
      const patientCount = await patientRepository.countByOrganization(organizationId)
      const canAdd = await organizationFeaturesRepository.canAddPatient(organizationId, patientCount)

      if (!canAdd) {
        const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)
        return reply.status(403).send({
          error: 'Limit Reached',
          message: `Your organization has reached the maximum of ${features.maxPatients} patients.`,
          limit: features.maxPatients,
          current: patientCount,
          upgradeRequired: true
        })
      }
    } catch (error) {
      request.log.error({ error, organizationId }, 'Error checking patient capacity')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Unable to verify patient capacity'
      })
    }
  }
}

/**
 * Helper function to check if a feature is enabled (non-middleware version).
 * Useful for conditional logic within route handlers.
 */
export async function isFeatureEnabled(
  organizationId: string,
  feature: FeatureName
): Promise<boolean> {
  const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)
  const fieldName = featureFieldMap[feature]
  return features[fieldName] as boolean
}

/**
 * Helper function to get all feature statuses for an organization.
 * Useful for frontend to conditionally show/hide features.
 */
export async function getFeatureStatuses(organizationId: string): Promise<Record<FeatureName, boolean>> {
  const features = await organizationFeaturesRepository.findByOrganizationId(organizationId)

  return {
    emailReminders: features.emailRemindersEnabled,
    smsReminders: features.smsRemindersEnabled,
    patientPortal: features.patientPortalEnabled,
    advancedReports: features.advancedReportsEnabled,
    reportExport: features.reportExportEnabled,
    voiceCommands: features.voiceCommandsEnabled,
    medicalTranscribe: features.medicalTranscribeEnabled,
    apiAccess: features.apiAccessEnabled,
    webhooks: features.webhooksEnabled
  }
}
