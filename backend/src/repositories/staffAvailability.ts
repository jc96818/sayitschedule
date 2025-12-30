import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { StaffAvailability, AvailabilityStatus, Prisma } from '@prisma/client'

export type { StaffAvailability, AvailabilityStatus }

// StaffAvailability with staff name joined
export interface StaffAvailabilityWithStaff extends StaffAvailability {
  staffName: string
  staffEmail: string | null
}

export interface StaffAvailabilityCreate {
  staffId: string
  date: Date
  available: boolean
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
  status?: AvailabilityStatus
  requestedAt?: Date | null
  requestedById?: string | null
}

export interface StaffAvailabilityUpdate {
  date?: Date
  available?: boolean
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
  status?: AvailabilityStatus
  reviewedAt?: Date | null
  reviewedById?: string | null
  reviewerNotes?: string | null
}

export interface DateRangeOptions {
  startDate?: Date
  endDate?: Date
  status?: AvailabilityStatus | AvailabilityStatus[]
}

export class StaffAvailabilityRepository {
  /**
   * Find availability records for a specific staff member
   */
  async findByStaffId(
    staffId: string,
    options?: DateRangeOptions
  ): Promise<StaffAvailability[]> {
    const where: Prisma.StaffAvailabilityWhereInput = { staffId }

    if (options?.startDate) {
      where.date = { ...where.date as object, gte: options.startDate }
    }
    if (options?.endDate) {
      where.date = { ...where.date as object, lte: options.endDate }
    }
    if (options?.status) {
      if (Array.isArray(options.status)) {
        where.status = { in: options.status }
      } else {
        where.status = options.status
      }
    }

    return prisma.staffAvailability.findMany({
      where,
      orderBy: { date: 'asc' }
    })
  }

  /**
   * Find all availability records for an organization (via staff relationship)
   */
  async findByOrganization(
    organizationId: string,
    options?: DateRangeOptions & { staffId?: string }
  ): Promise<StaffAvailabilityWithStaff[]> {
    const where: Prisma.StaffAvailabilityWhereInput = {
      staff: { organizationId }
    }

    if (options?.staffId) {
      where.staffId = options.staffId
    }
    if (options?.startDate) {
      where.date = { ...where.date as object, gte: options.startDate }
    }
    if (options?.endDate) {
      where.date = { ...where.date as object, lte: options.endDate }
    }
    if (options?.status) {
      if (Array.isArray(options.status)) {
        where.status = { in: options.status }
      } else {
        where.status = options.status
      }
    }

    const records = await prisma.staffAvailability.findMany({
      where,
      include: {
        staff: {
          select: { name: true, email: true }
        }
      },
      orderBy: { date: 'asc' }
    })

    return records.map(record => {
      const { staff, ...rest } = record
      return {
        ...rest,
        staffName: staff.name,
        staffEmail: staff.email
      }
    })
  }

  /**
   * Get pending requests for admin review (paginated)
   */
  async findPendingByOrganization(
    organizationId: string,
    params: PaginationParams
  ): Promise<PaginatedResult<StaffAvailabilityWithStaff>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.StaffAvailabilityWhereInput = {
      staff: { organizationId },
      status: 'pending'
    }

    const [records, total] = await Promise.all([
      prisma.staffAvailability.findMany({
        where,
        include: {
          staff: {
            select: { name: true, email: true }
          }
        },
        take,
        skip,
        orderBy: { requestedAt: 'desc' }
      }),
      prisma.staffAvailability.count({ where })
    ])

    const data = records.map(record => ({
      ...record,
      staffName: record.staff.name,
      staffEmail: record.staff.email,
      staff: undefined as never
    }))

    return paginate(data, total, params)
  }

  /**
   * Find a single availability record by ID
   */
  async findById(id: string, staffId?: string): Promise<StaffAvailability | null> {
    const where: Prisma.StaffAvailabilityWhereInput = { id }
    if (staffId) {
      where.staffId = staffId
    }

    return prisma.staffAvailability.findFirst({ where })
  }

  /**
   * Find availability record by ID with organization check
   */
  async findByIdWithOrg(id: string, organizationId: string): Promise<StaffAvailabilityWithStaff | null> {
    const record = await prisma.staffAvailability.findFirst({
      where: {
        id,
        staff: { organizationId }
      },
      include: {
        staff: {
          select: { name: true, email: true }
        }
      }
    })

    if (!record) return null

    const { staff, ...rest } = record
    return {
      ...rest,
      staffName: staff.name,
      staffEmail: staff.email
    }
  }

  /**
   * Create a new availability record
   */
  async create(data: StaffAvailabilityCreate): Promise<StaffAvailability> {
    return prisma.staffAvailability.create({
      data: {
        staffId: data.staffId,
        date: data.date,
        available: data.available,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
        status: data.status || 'approved',
        requestedAt: data.requestedAt,
        requestedById: data.requestedById
      }
    })
  }

  /**
   * Update an existing availability record
   */
  async update(
    id: string,
    staffId: string,
    data: StaffAvailabilityUpdate
  ): Promise<StaffAvailability | null> {
    try {
      return await prisma.staffAvailability.update({
        where: { id, staffId },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Update by ID with organization check
   */
  async updateByIdWithOrg(
    id: string,
    organizationId: string,
    data: StaffAvailabilityUpdate
  ): Promise<StaffAvailability | null> {
    // First verify the record belongs to this organization
    const existing = await this.findByIdWithOrg(id, organizationId)
    if (!existing) return null

    try {
      return await prisma.staffAvailability.update({
        where: { id },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Delete an availability record
   */
  async delete(id: string, staffId: string): Promise<boolean> {
    try {
      await prisma.staffAvailability.delete({
        where: { id, staffId }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete by ID with organization check
   */
  async deleteByIdWithOrg(id: string, organizationId: string): Promise<boolean> {
    // First verify the record belongs to this organization
    const existing = await this.findByIdWithOrg(id, organizationId)
    if (!existing) return false

    try {
      await prisma.staffAvailability.delete({
        where: { id }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Approve a pending request
   */
  async approve(
    id: string,
    organizationId: string,
    reviewedById: string,
    reviewerNotes?: string
  ): Promise<StaffAvailability | null> {
    // First verify the record belongs to this organization and is pending
    const existing = await this.findByIdWithOrg(id, organizationId)
    if (!existing || existing.status !== 'pending') return null

    try {
      return await prisma.staffAvailability.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedById,
          reviewerNotes
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Reject a pending request
   */
  async reject(
    id: string,
    organizationId: string,
    reviewedById: string,
    reviewerNotes?: string
  ): Promise<StaffAvailability | null> {
    // First verify the record belongs to this organization and is pending
    const existing = await this.findByIdWithOrg(id, organizationId)
    if (!existing || existing.status !== 'pending') return null

    try {
      return await prisma.staffAvailability.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedById,
          reviewerNotes
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Get all approved unavailability for scheduling purposes
   * Returns only records where available=false (time off) and status=approved
   */
  async getApprovedUnavailability(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StaffAvailability[]> {
    return prisma.staffAvailability.findMany({
      where: {
        staff: { organizationId },
        status: 'approved',
        available: false,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    })
  }

  /**
   * Check if staff has any approved unavailability on a specific date
   */
  async hasUnavailabilityOnDate(
    staffId: string,
    date: Date
  ): Promise<StaffAvailability | null> {
    // Normalize date to start of day for comparison
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return prisma.staffAvailability.findFirst({
      where: {
        staffId,
        status: 'approved',
        available: false,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })
  }

  /**
   * Count pending requests for an organization
   */
  async countPending(organizationId: string): Promise<number> {
    return prisma.staffAvailability.count({
      where: {
        staff: { organizationId },
        status: 'pending'
      }
    })
  }
}

export const staffAvailabilityRepository = new StaffAvailabilityRepository()
