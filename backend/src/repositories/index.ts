// Export all repositories
export * from './base.js'
export * from './organizations.js'
export * from './users.js'
// Note: staff and patients both export Gender and Status types
// Export them explicitly to avoid conflicts
export {
  StaffRepository,
  staffRepository,
  type Staff,
  type StaffCreate,
  type StaffUpdate,
  type Gender as StaffGender,
  type Status as StaffStatus
} from './staff.js'
export {
  PatientRepository,
  patientRepository,
  type Patient,
  type PatientCreate,
  type PatientUpdate,
  type Gender as PatientGender,
  type Status as PatientStatus
} from './patients.js'
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
