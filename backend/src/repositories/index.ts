// Export all repositories
export * from './base.js'
export * from './organizations.js'
export * from './users.js'
export * from './staff.js'
export * from './staffAvailability.js'
export * from './patients.js'
export * from './rules.js'
export * from './rooms.js'
export * from './schedules.js'
export * from './audit.js'
export * from './baa.js'
export * from './passwordResetTokens.js'
export * from './leads.js'

// Re-export common types from Prisma
export type { Gender, Status, UserRole, ScheduleStatus, RuleCategory, BaaStatus, AvailabilityStatus, TokenType, LeadStatus } from '@prisma/client'

// Import singleton instances
import { organizationRepository } from './organizations.js'
import { userRepository } from './users.js'
import { staffRepository } from './staff.js'
import { staffAvailabilityRepository } from './staffAvailability.js'
import { patientRepository } from './patients.js'
import { ruleRepository } from './rules.js'
import { roomRepository } from './rooms.js'
import { scheduleRepository } from './schedules.js'
import { auditRepository } from './audit.js'
import { baaAgreementRepository } from './baa.js'
import { passwordResetTokenRepository } from './passwordResetTokens.js'
import { leadRepository } from './leads.js'

// Export singleton instances as default repositories
export const repositories = {
  organizations: organizationRepository,
  users: userRepository,
  staff: staffRepository,
  staffAvailability: staffAvailabilityRepository,
  patients: patientRepository,
  rules: ruleRepository,
  rooms: roomRepository,
  schedules: scheduleRepository,
  audit: auditRepository,
  baaAgreements: baaAgreementRepository,
  passwordResetTokens: passwordResetTokenRepository,
  leads: leadRepository
}

export default repositories
