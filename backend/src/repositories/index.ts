// Export all repositories
export * from './base.js'
export * from './organizations.js'
export * from './users.js'
export * from './staff.js'
export * from './patients.js'
export * from './rules.js'
export * from './schedules.js'
export * from './audit.js'

// Import singleton instances
import { organizationRepository } from './organizations.js'
import { userRepository } from './users.js'
import { staffRepository } from './staff.js'
import { patientRepository } from './patients.js'
import { ruleRepository } from './rules.js'
import { scheduleRepository } from './schedules.js'
import { auditRepository } from './audit.js'

// Export singleton instances as default repositories
export const repositories = {
  organizations: organizationRepository,
  users: userRepository,
  staff: staffRepository,
  patients: patientRepository,
  rules: ruleRepository,
  schedules: scheduleRepository,
  audit: auditRepository
}

export default repositories
