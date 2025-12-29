import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Organization, Status, Prisma, TranscriptionProvider, MedicalSpecialty } from '@prisma/client'

export interface OrganizationCreate {
  name: string
  subdomain: string
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
  requiresHipaa?: boolean
  transcriptionProvider?: TranscriptionProvider
  medicalSpecialty?: MedicalSpecialty
}

export interface OrganizationUpdate {
  name?: string
  subdomain?: string
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
  status?: Status
  requiresHipaa?: boolean
  transcriptionProvider?: TranscriptionProvider
  medicalSpecialty?: MedicalSpecialty
}

export type { Organization }

export class OrganizationRepository {
  async findAll(params: PaginationParams & { search?: string; status?: string }): Promise<PaginatedResult<Organization>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.OrganizationWhereInput = {}

    if (params.status) {
      where.status = params.status as Status
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { subdomain: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.organization.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { id }
    })
  }

  async findBySubdomain(subdomain: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { subdomain }
    })
  }

  async create(data: OrganizationCreate): Promise<Organization> {
    return prisma.organization.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor || '#2563eb',
        secondaryColor: data.secondaryColor || '#1e40af',
        requiresHipaa: data.requiresHipaa ?? false
      }
    })
  }

  async update(id: string, data: OrganizationUpdate): Promise<Organization | null> {
    try {
      return await prisma.organization.update({
        where: { id },
        data
      })
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.organization.delete({
        where: { id }
      })
      return true
    } catch {
      return false
    }
  }

  async getStats(id: string): Promise<{ users: number; staff: number; patients: number }> {
    const [users, staff, patients] = await Promise.all([
      prisma.user.count({ where: { organizationId: id } }),
      prisma.staff.count({ where: { organizationId: id } }),
      prisma.patient.count({ where: { organizationId: id } })
    ])

    return { users, staff, patients }
  }

  async getTranscriptionSettings(id: string): Promise<{
    transcriptionProvider: TranscriptionProvider
    medicalSpecialty: MedicalSpecialty
  } | null> {
    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        transcriptionProvider: true,
        medicalSpecialty: true
      }
    })

    return org
  }
}

export const organizationRepository = new OrganizationRepository()
