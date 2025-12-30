import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { BusinessTypeTemplate, Prisma } from '@prisma/client'

export interface TemplateCreate {
  name: string
  description?: string | null
  isDefault?: boolean
  staffLabel?: string
  staffLabelSingular?: string
  patientLabel?: string
  patientLabelSingular?: string
  roomLabel?: string
  roomLabelSingular?: string
  certificationLabel?: string
  equipmentLabel?: string
  suggestedCertifications?: string[]
  suggestedRoomEquipment?: string[]
}

export interface TemplateUpdate {
  name?: string
  description?: string | null
  isDefault?: boolean
  isActive?: boolean
  staffLabel?: string
  staffLabelSingular?: string
  patientLabel?: string
  patientLabelSingular?: string
  roomLabel?: string
  roomLabelSingular?: string
  certificationLabel?: string
  equipmentLabel?: string
  suggestedCertifications?: string[]
  suggestedRoomEquipment?: string[]
}

export type { BusinessTypeTemplate }

export class TemplateRepository {
  async findAll(params: PaginationParams & { isActive?: boolean; search?: string }): Promise<PaginatedResult<BusinessTypeTemplate>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.BusinessTypeTemplateWhereInput = {}

    if (params.isActive !== undefined) {
      where.isActive = params.isActive
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    const [data, total] = await Promise.all([
      prisma.businessTypeTemplate.findMany({
        where,
        take,
        skip,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
      }),
      prisma.businessTypeTemplate.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string): Promise<BusinessTypeTemplate | null> {
    return prisma.businessTypeTemplate.findUnique({
      where: { id }
    })
  }

  async findDefault(): Promise<BusinessTypeTemplate | null> {
    return prisma.businessTypeTemplate.findFirst({
      where: { isDefault: true, isActive: true }
    })
  }

  async create(data: TemplateCreate): Promise<BusinessTypeTemplate> {
    // If this is being set as default, unset any existing default
    if (data.isDefault) {
      await prisma.businessTypeTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    return prisma.businessTypeTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false,
        isActive: true,
        staffLabel: data.staffLabel ?? 'Staff',
        staffLabelSingular: data.staffLabelSingular ?? 'Staff Member',
        patientLabel: data.patientLabel ?? 'Patients',
        patientLabelSingular: data.patientLabelSingular ?? 'Patient',
        roomLabel: data.roomLabel ?? 'Rooms',
        roomLabelSingular: data.roomLabelSingular ?? 'Room',
        certificationLabel: data.certificationLabel ?? 'Certifications',
        equipmentLabel: data.equipmentLabel ?? 'Equipment',
        suggestedCertifications: data.suggestedCertifications ?? [],
        suggestedRoomEquipment: data.suggestedRoomEquipment ?? []
      }
    })
  }

  async update(id: string, data: TemplateUpdate): Promise<BusinessTypeTemplate | null> {
    try {
      // If this is being set as default, unset any existing default
      if (data.isDefault) {
        await prisma.businessTypeTemplate.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false }
        })
      }

      return await prisma.businessTypeTemplate.update({
        where: { id },
        data
      })
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Soft delete by setting isActive to false
      await prisma.businessTypeTemplate.update({
        where: { id },
        data: { isActive: false }
      })
      return true
    } catch {
      return false
    }
  }

  async getOrganizationCount(id: string): Promise<number> {
    return prisma.organization.count({
      where: { businessTypeTemplateId: id }
    })
  }
}

export const templateRepository = new TemplateRepository()
