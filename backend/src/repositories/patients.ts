import { eq, and, ilike, or, count } from 'drizzle-orm'
import { getDb, patients } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export type Gender = 'male' | 'female' | 'other'
export type Status = 'active' | 'inactive'

export interface PatientCreate {
  organizationId: string
  name: string
  identifier?: string | null
  gender: Gender
  sessionFrequency?: number
  preferredTimes?: string[] | null
  requiredCertifications?: string[]
  preferredRoomId?: string | null
  requiredRoomCapabilities?: string[]
  notes?: string | null
}

export interface PatientUpdate {
  name?: string
  identifier?: string | null
  gender?: Gender
  sessionFrequency?: number
  preferredTimes?: string[] | null
  requiredCertifications?: string[]
  preferredRoomId?: string | null
  requiredRoomCapabilities?: string[]
  notes?: string | null
  status?: Status
}

export type Patient = typeof patients.$inferSelect

export class PatientRepository {
  private get db() {
    return getDb()
  }

  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string; gender?: string }
  ): Promise<PaginatedResult<Patient>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = [eq(patients.organizationId, organizationId)]

    if (params.search) {
      conditions.push(
        or(
          ilike(patients.name, `%${params.search}%`),
          ilike(patients.identifier, `%${params.search}%`)
        )!
      )
    }

    if (params.status) {
      conditions.push(eq(patients.status, params.status as Status))
    }

    if (params.gender) {
      conditions.push(eq(patients.gender, params.gender as Gender))
    }

    const whereClause = and(...conditions)

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(patients)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(patients.name),
      this.db
        .select({ count: count() })
        .from(patients)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string, organizationId?: string): Promise<Patient | null> {
    const conditions = [eq(patients.id, id)]
    if (organizationId) {
      conditions.push(eq(patients.organizationId, organizationId))
    }

    const result = await this.db
      .select()
      .from(patients)
      .where(and(...conditions))
      .limit(1)

    return result[0] || null
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Patient[]> {
    const conditions = [eq(patients.organizationId, organizationId)]
    if (status) {
      conditions.push(eq(patients.status, status))
    }

    return this.db
      .select()
      .from(patients)
      .where(and(...conditions))
      .orderBy(patients.name)
  }

  async create(data: PatientCreate): Promise<Patient> {
    const result = await this.db
      .insert(patients)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        identifier: data.identifier,
        gender: data.gender,
        sessionFrequency: data.sessionFrequency || 2,
        preferredTimes: data.preferredTimes,
        requiredCertifications: data.requiredCertifications || [],
        preferredRoomId: data.preferredRoomId,
        requiredRoomCapabilities: data.requiredRoomCapabilities || [],
        notes: data.notes
      })
      .returning()

    return result[0]
  }

  async update(id: string, organizationId: string, data: PatientUpdate): Promise<Patient | null> {
    const result = await this.db
      .update(patients)
      .set(data)
      .where(and(eq(patients.id, id), eq(patients.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    // Soft delete by setting status to inactive
    const result = await this.db
      .update(patients)
      .set({ status: 'inactive' })
      .where(and(eq(patients.id, id), eq(patients.organizationId, organizationId)))
      .returning({ id: patients.id })

    return result.length > 0
  }

  async hardDelete(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.organizationId, organizationId)))
      .returning({ id: patients.id })

    return result.length > 0
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(patients)
      .where(and(eq(patients.organizationId, organizationId), eq(patients.status, 'active')))

    return result[0]?.count || 0
  }
}

export const patientRepository = new PatientRepository()
