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
  businessTypeTemplateId?: string | null
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
  businessTypeTemplateId?: string | null
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

export interface OrganizationLabels {
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
    // If a template is specified, fetch it and use its labels as defaults
    let templateLabels: OrganizationLabels = {}
    if (data.businessTypeTemplateId) {
      const template = await prisma.businessTypeTemplate.findUnique({
        where: { id: data.businessTypeTemplateId }
      })
      if (template) {
        templateLabels = {
          staffLabel: template.staffLabel,
          staffLabelSingular: template.staffLabelSingular,
          patientLabel: template.patientLabel,
          patientLabelSingular: template.patientLabelSingular,
          roomLabel: template.roomLabel,
          roomLabelSingular: template.roomLabelSingular,
          certificationLabel: template.certificationLabel,
          equipmentLabel: template.equipmentLabel,
          suggestedCertifications: template.suggestedCertifications as string[],
          suggestedRoomEquipment: template.suggestedRoomEquipment as string[]
        }
      }
    }

    return prisma.organization.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor || '#2563eb',
        secondaryColor: data.secondaryColor || '#1e40af',
        requiresHipaa: data.requiresHipaa ?? false,
        businessTypeTemplateId: data.businessTypeTemplateId,
        // Use provided labels, fall back to template, then to defaults
        staffLabel: data.staffLabel ?? templateLabels.staffLabel ?? 'Staff',
        staffLabelSingular: data.staffLabelSingular ?? templateLabels.staffLabelSingular ?? 'Staff Member',
        patientLabel: data.patientLabel ?? templateLabels.patientLabel ?? 'Patients',
        patientLabelSingular: data.patientLabelSingular ?? templateLabels.patientLabelSingular ?? 'Patient',
        roomLabel: data.roomLabel ?? templateLabels.roomLabel ?? 'Rooms',
        roomLabelSingular: data.roomLabelSingular ?? templateLabels.roomLabelSingular ?? 'Room',
        certificationLabel: data.certificationLabel ?? templateLabels.certificationLabel ?? 'Certifications',
        equipmentLabel: data.equipmentLabel ?? templateLabels.equipmentLabel ?? 'Equipment',
        suggestedCertifications: data.suggestedCertifications ?? templateLabels.suggestedCertifications ?? [],
        suggestedRoomEquipment: data.suggestedRoomEquipment ?? templateLabels.suggestedRoomEquipment ?? []
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

  async getLabels(id: string): Promise<OrganizationLabels | null> {
    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        staffLabel: true,
        staffLabelSingular: true,
        patientLabel: true,
        patientLabelSingular: true,
        roomLabel: true,
        roomLabelSingular: true,
        certificationLabel: true,
        equipmentLabel: true,
        suggestedCertifications: true,
        suggestedRoomEquipment: true
      }
    })

    if (!org) return null

    return {
      staffLabel: org.staffLabel,
      staffLabelSingular: org.staffLabelSingular,
      patientLabel: org.patientLabel,
      patientLabelSingular: org.patientLabelSingular,
      roomLabel: org.roomLabel,
      roomLabelSingular: org.roomLabelSingular,
      certificationLabel: org.certificationLabel,
      equipmentLabel: org.equipmentLabel,
      suggestedCertifications: org.suggestedCertifications as string[],
      suggestedRoomEquipment: org.suggestedRoomEquipment as string[]
    }
  }

  async updateLabels(id: string, labels: OrganizationLabels): Promise<Organization | null> {
    try {
      return await prisma.organization.update({
        where: { id },
        data: labels
      })
    } catch {
      return null
    }
  }
}

export const organizationRepository = new OrganizationRepository()
