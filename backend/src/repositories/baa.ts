import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { BaaAgreement, BaaStatus, Prisma } from '@prisma/client'

export interface BaaAgreementCreate {
  organizationId: string
  status?: BaaStatus
  templateName: string
  templateVersion: string
  templateSha256: string
}

export interface BaaAgreementUpdate {
  status?: BaaStatus
  executedPdfSha256?: string | null
  executedPdfPath?: string | null
  // Organization signature fields
  orgSignedAt?: Date | null
  orgSignerUserId?: string | null
  orgSignerName?: string | null
  orgSignerTitle?: string | null
  orgSignerEmail?: string | null
  orgSignerIp?: string | null
  orgSignerUserAgent?: string | null
  // Vendor signature fields
  vendorSignedAt?: Date | null
  vendorSignerUserId?: string | null
  vendorSignerName?: string | null
  vendorSignerTitle?: string | null
  // E-sign provider fields
  esignProvider?: string | null
  esignEnvelopeId?: string | null
  esignStatus?: string | null
}

export interface OrgSignatureData {
  orgSignerUserId: string
  orgSignerName: string
  orgSignerTitle: string
  orgSignerEmail: string
  orgSignerIp: string
  orgSignerUserAgent: string
}

export interface VendorSignatureData {
  vendorSignerUserId: string
  vendorSignerName: string
  vendorSignerTitle: string
}

export type { BaaAgreement, BaaStatus }

// BAA with organization info for superadmin views
export interface BaaAgreementWithOrg extends BaaAgreement {
  organization: {
    id: string
    name: string
    subdomain: string
    status: string
  }
}

export class BaaAgreementRepository {
  /**
   * Find all BAA agreements (superadmin use)
   */
  async findAll(params: PaginationParams & {
    status?: BaaStatus
    search?: string
  }): Promise<PaginatedResult<BaaAgreementWithOrg>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.BaaAgreementWhereInput = {}

    if (params.status) {
      where.status = params.status
    }

    if (params.search) {
      where.organization = {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { subdomain: { contains: params.search, mode: 'insensitive' } }
        ]
      }
    }

    const [data, total] = await Promise.all([
      prisma.baaAgreement.findMany({
        where,
        take,
        skip,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.baaAgreement.count({ where })
    ])

    return paginate(data as BaaAgreementWithOrg[], total, params)
  }

  /**
   * Find BAA by ID
   */
  async findById(id: string): Promise<BaaAgreement | null> {
    return prisma.baaAgreement.findUnique({
      where: { id }
    })
  }

  /**
   * Find BAA by ID with organization info
   */
  async findByIdWithOrg(id: string): Promise<BaaAgreementWithOrg | null> {
    return prisma.baaAgreement.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        }
      }
    }) as Promise<BaaAgreementWithOrg | null>
  }

  /**
   * Find the current (most recent non-voided) BAA for an organization
   */
  async findCurrentByOrganizationId(organizationId: string): Promise<BaaAgreement | null> {
    return prisma.baaAgreement.findFirst({
      where: {
        organizationId,
        status: {
          notIn: ['voided', 'superseded']
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Find all BAAs for an organization (including voided/superseded for history)
   */
  async findAllByOrganizationId(organizationId: string): Promise<BaaAgreement[]> {
    return prisma.baaAgreement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Check if an organization has an executed BAA
   */
  async hasExecutedBaa(organizationId: string): Promise<boolean> {
    const baa = await prisma.baaAgreement.findFirst({
      where: {
        organizationId,
        status: 'executed'
      },
      select: { id: true }
    })
    return baa !== null
  }

  /**
   * Create a new BAA agreement
   */
  async create(data: BaaAgreementCreate): Promise<BaaAgreement> {
    return prisma.baaAgreement.create({
      data: {
        organizationId: data.organizationId,
        status: data.status || 'not_started',
        templateName: data.templateName,
        templateVersion: data.templateVersion,
        templateSha256: data.templateSha256
      }
    })
  }

  /**
   * Update a BAA agreement
   */
  async update(id: string, data: BaaAgreementUpdate): Promise<BaaAgreement | null> {
    try {
      return await prisma.baaAgreement.update({
        where: { id },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Record organization signature on a BAA
   */
  async recordOrgSignature(
    id: string,
    signatureData: OrgSignatureData
  ): Promise<BaaAgreement | null> {
    try {
      return await prisma.baaAgreement.update({
        where: { id },
        data: {
          status: 'awaiting_vendor_signature',
          orgSignedAt: new Date(),
          orgSignerUserId: signatureData.orgSignerUserId,
          orgSignerName: signatureData.orgSignerName,
          orgSignerTitle: signatureData.orgSignerTitle,
          orgSignerEmail: signatureData.orgSignerEmail,
          orgSignerIp: signatureData.orgSignerIp,
          orgSignerUserAgent: signatureData.orgSignerUserAgent
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Record vendor (Say It Schedule) countersignature on a BAA
   */
  async recordVendorSignature(
    id: string,
    signatureData: VendorSignatureData,
    executedPdfSha256: string,
    executedPdfPath: string
  ): Promise<BaaAgreement | null> {
    try {
      return await prisma.baaAgreement.update({
        where: { id },
        data: {
          status: 'executed',
          vendorSignedAt: new Date(),
          vendorSignerUserId: signatureData.vendorSignerUserId,
          vendorSignerName: signatureData.vendorSignerName,
          vendorSignerTitle: signatureData.vendorSignerTitle,
          executedPdfSha256,
          executedPdfPath
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Void a BAA (e.g., when superseded by a new version)
   */
  async void(id: string): Promise<BaaAgreement | null> {
    try {
      return await prisma.baaAgreement.update({
        where: { id },
        data: { status: 'voided' }
      })
    } catch {
      return null
    }
  }

  /**
   * Mark a BAA as superseded (replaced by newer version)
   */
  async supersede(id: string): Promise<BaaAgreement | null> {
    try {
      return await prisma.baaAgreement.update({
        where: { id },
        data: { status: 'superseded' }
      })
    } catch {
      return null
    }
  }

  /**
   * Get summary statistics for BAAs (superadmin dashboard)
   */
  async getStats(): Promise<{
    total: number
    executed: number
    awaitingOrgSignature: number
    awaitingVendorSignature: number
    notStarted: number
  }> {
    const [total, executed, awaitingOrgSignature, awaitingVendorSignature, notStarted] = await Promise.all([
      prisma.baaAgreement.count({
        where: { status: { notIn: ['voided', 'superseded'] } }
      }),
      prisma.baaAgreement.count({ where: { status: 'executed' } }),
      prisma.baaAgreement.count({ where: { status: 'awaiting_org_signature' } }),
      prisma.baaAgreement.count({ where: { status: 'awaiting_vendor_signature' } }),
      prisma.baaAgreement.count({ where: { status: 'not_started' } })
    ])

    return { total, executed, awaitingOrgSignature, awaitingVendorSignature, notStarted }
  }
}

export const baaAgreementRepository = new BaaAgreementRepository()
