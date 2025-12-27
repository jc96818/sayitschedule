import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { AuditLog, Prisma } from '@prisma/client'

export type { AuditLog }

export interface AuditLogCreate {
  organizationId?: string | null
  userId: string
  action: string
  entityType: string
  entityId: string
  changes?: Record<string, unknown>
}

export class AuditRepository {
  async findAll(
    organizationId: string | null,
    params: PaginationParams & {
      userId?: string
      entityType?: string
      action?: string
      startDate?: Date
      endDate?: Date
    }
  ): Promise<PaginatedResult<AuditLog>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.AuditLogWhereInput = {}

    if (organizationId) {
      where.organizationId = organizationId
    }

    if (params.userId) {
      where.userId = params.userId
    }

    if (params.entityType) {
      where.entityType = params.entityType
    }

    if (params.action) {
      where.action = params.action
    }

    if (params.startDate || params.endDate) {
      where.timestamp = {}
      if (params.startDate) {
        where.timestamp.gte = params.startDate
      }
      if (params.endDate) {
        where.timestamp.lte = params.endDate
      }
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { timestamp: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'desc' }
    })
  }

  async create(data: AuditLogCreate): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes as Prisma.InputJsonValue
      }
    })
  }

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    organizationId?: string | null,
    changes?: Record<string, unknown>
  ): Promise<void> {
    await this.create({
      userId,
      action,
      entityType,
      entityId,
      organizationId,
      changes
    })
  }
}

export const auditRepository = new AuditRepository()

// Convenience function for logging
export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  organizationId?: string | null,
  changes?: Record<string, unknown>
): Promise<void> {
  await auditRepository.log(userId, action, entityType, entityId, organizationId, changes)
}
