import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Staff, Gender, Status, Prisma } from '@prisma/client'

export type { Gender, Status }

export interface DefaultHours {
  [day: string]: { start: string; end: string } | null
}

export interface StaffCreate {
  organizationId: string
  userId?: string | null
  name: string
  gender: Gender
  email?: string | null
  phone?: string | null
  certifications?: string[]
  defaultHours?: DefaultHours
  hireDate?: Date | null
}

export interface StaffUpdate {
  name?: string
  gender?: Gender
  email?: string | null
  phone?: string | null
  certifications?: string[]
  defaultHours?: DefaultHours
  status?: Status
  hireDate?: Date | null
}

export type { Staff }

export class StaffRepository {
  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string; gender?: string }
  ): Promise<PaginatedResult<Staff>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.StaffWhereInput = { organizationId }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    if (params.status) {
      where.status = params.status as Status
    }

    if (params.gender) {
      where.gender = params.gender as Gender
    }

    const [data, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.staff.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string, organizationId?: string): Promise<Staff | null> {
    const where: Prisma.StaffWhereInput = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    return prisma.staff.findFirst({ where })
  }

  async findByUserId(userId: string): Promise<Staff | null> {
    return prisma.staff.findFirst({
      where: { userId }
    })
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Staff[]> {
    const where: Prisma.StaffWhereInput = { organizationId }
    if (status) {
      where.status = status
    }

    return prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' }
    })
  }

  async create(data: StaffCreate): Promise<Staff> {
    return prisma.staff.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        name: data.name,
        gender: data.gender,
        email: data.email,
        phone: data.phone,
        certifications: data.certifications || [],
        defaultHours: data.defaultHours as object,
        hireDate: data.hireDate
      }
    })
  }

  async update(id: string, organizationId: string, data: StaffUpdate): Promise<Staff | null> {
    try {
      return await prisma.staff.update({
        where: { id, organizationId },
        data: {
          ...data,
          defaultHours: data.defaultHours as object
        }
      })
    } catch {
      return null
    }
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.staff.update({
        where: { id, organizationId },
        data: { status: 'inactive' }
      })
      return true
    } catch {
      return false
    }
  }

  async hardDelete(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.staff.delete({
        where: { id, organizationId }
      })
      return true
    } catch {
      return false
    }
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.staff.count({
      where: {
        organizationId,
        status: 'active'
      }
    })
  }
}

export const staffRepository = new StaffRepository()
