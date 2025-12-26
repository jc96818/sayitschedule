import { eq, and, desc, gte, lte, count } from 'drizzle-orm'
import { getDb, auditLogs } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export interface AuditLogCreate {
  organizationId?: string | null
  userId: string
  action: string
  entityType: string
  entityId: string
  changes?: Record<string, unknown>
}

export type AuditLog = typeof auditLogs.$inferSelect

export class AuditRepository {
  private get db() {
    return getDb()
  }

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
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = []

    if (organizationId) {
      conditions.push(eq(auditLogs.organizationId, organizationId))
    }

    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId))
    }

    if (params.entityType) {
      conditions.push(eq(auditLogs.entityType, params.entityType))
    }

    if (params.action) {
      conditions.push(eq(auditLogs.action, params.action))
    }

    if (params.startDate) {
      conditions.push(gte(auditLogs.timestamp, params.startDate))
    }

    if (params.endDate) {
      conditions.push(lte(auditLogs.timestamp, params.endDate))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(auditLogs.timestamp)),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.timestamp))
  }

  async create(data: AuditLogCreate): Promise<AuditLog> {
    const result = await this.db
      .insert(auditLogs)
      .values({
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes
      })
      .returning()

    return result[0]
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
