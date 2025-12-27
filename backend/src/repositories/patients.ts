import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Patient, Gender, Status, Prisma } from '@prisma/client'

export type { Gender, Status }

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

export type { Patient }

export class PatientRepository {
  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string; gender?: string }
  ): Promise<PaginatedResult<Patient>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.PatientWhereInput = { organizationId }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { identifier: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    if (params.status) {
      where.status = params.status as Status
    }

    if (params.gender) {
      where.gender = params.gender as Gender
    }

    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.patient.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string, organizationId?: string): Promise<Patient | null> {
    const where: Prisma.PatientWhereInput = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    return prisma.patient.findFirst({ where })
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Patient[]> {
    const where: Prisma.PatientWhereInput = { organizationId }
    if (status) {
      where.status = status
    }

    return prisma.patient.findMany({
      where,
      orderBy: { name: 'asc' }
    })
  }

  async create(data: PatientCreate): Promise<Patient> {
    return prisma.patient.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        name: data.name,
        identifier: data.identifier,
        gender: data.gender,
        sessionFrequency: data.sessionFrequency || 2,
        preferredTimes: data.preferredTimes || [],
        requiredCertifications: data.requiredCertifications || [],
        preferredRoom: data.preferredRoomId ? { connect: { id: data.preferredRoomId } } : undefined,
        requiredRoomCapabilities: data.requiredRoomCapabilities || [],
        notes: data.notes
      }
    })
  }

  async update(id: string, organizationId: string, data: PatientUpdate): Promise<Patient | null> {
    try {
      const updateData: Prisma.PatientUpdateInput = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.identifier !== undefined) updateData.identifier = data.identifier
      if (data.gender !== undefined) updateData.gender = data.gender
      if (data.sessionFrequency !== undefined) updateData.sessionFrequency = data.sessionFrequency
      if (data.preferredTimes !== undefined) updateData.preferredTimes = data.preferredTimes || []
      if (data.requiredCertifications !== undefined) updateData.requiredCertifications = data.requiredCertifications || []
      if (data.preferredRoomId !== undefined) {
        updateData.preferredRoom = data.preferredRoomId ? { connect: { id: data.preferredRoomId } } : { disconnect: true }
      }
      if (data.requiredRoomCapabilities !== undefined) updateData.requiredRoomCapabilities = data.requiredRoomCapabilities || []
      if (data.notes !== undefined) updateData.notes = data.notes
      if (data.status !== undefined) updateData.status = data.status

      return await prisma.patient.update({
        where: { id, organizationId },
        data: updateData
      })
    } catch {
      return null
    }
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.patient.update({
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
      await prisma.patient.delete({
        where: { id, organizationId }
      })
      return true
    } catch {
      return false
    }
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.patient.count({
      where: {
        organizationId,
        status: 'active'
      }
    })
  }
}

export const patientRepository = new PatientRepository()
