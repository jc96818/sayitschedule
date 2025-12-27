import { staffRepository } from '../repositories/staff.js'
import { patientRepository } from '../repositories/patients.js'
import { roomRepository } from '../repositories/rooms.js'

export interface SessionEntityIds {
  staffId?: string
  patientId?: string
  roomId?: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates that session entity IDs (staff, patient, room) belong to the
 * specified organization.
 *
 * This prevents cross-tenant data leakage where an attacker could reference
 * entities from another organization when creating/updating sessions.
 *
 * @param organizationId - The organization to validate against
 * @param entities - Object containing optional staffId, patientId, roomId
 * @returns ValidationResult with valid flag and array of error messages
 */
export async function validateSessionEntities(
  organizationId: string,
  entities: SessionEntityIds
): Promise<ValidationResult> {
  const errors: string[] = []
  const checks: Promise<void>[] = []

  // Validate staffId if provided
  if (entities.staffId) {
    checks.push(
      staffRepository.findById(entities.staffId, organizationId).then(staff => {
        if (!staff) {
          errors.push('Staff member not found or does not belong to this organization')
        }
      })
    )
  }

  // Validate patientId if provided
  if (entities.patientId) {
    checks.push(
      patientRepository.findById(entities.patientId, organizationId).then(patient => {
        if (!patient) {
          errors.push('Patient not found or does not belong to this organization')
        }
      })
    )
  }

  // Validate roomId if provided (null/undefined means no room, which is valid)
  if (entities.roomId) {
    checks.push(
      roomRepository.findById(entities.roomId, organizationId).then(room => {
        if (!room) {
          errors.push('Room not found or does not belong to this organization')
        }
      })
    )
  }

  // Run all checks in parallel for efficiency
  await Promise.all(checks)

  return {
    valid: errors.length === 0,
    errors
  }
}
