import { eq, and, count, desc } from 'drizzle-orm'
import { getDb, rules } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export type RuleCategory = 'gender_pairing' | 'session' | 'availability' | 'specific_pairing' | 'certification'

export interface RuleCreate {
  organizationId: string
  category: RuleCategory
  description: string
  ruleLogic: Record<string, unknown>
  priority?: number
  createdBy: string
}

export interface RuleUpdate {
  category?: RuleCategory
  description?: string
  ruleLogic?: Record<string, unknown>
  priority?: number
  isActive?: boolean
}

export type Rule = typeof rules.$inferSelect

export class RuleRepository {
  private get db() {
    return getDb()
  }

  async findAll(
    organizationId: string,
    params: PaginationParams & { category?: string; isActive?: boolean }
  ): Promise<PaginatedResult<Rule>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = [eq(rules.organizationId, organizationId)]

    if (params.category) {
      conditions.push(eq(rules.category, params.category as RuleCategory))
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(rules.isActive, params.isActive))
    }

    const whereClause = and(...conditions)

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(rules)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(rules.priority, desc(rules.createdAt)),
      this.db
        .select({ count: count() })
        .from(rules)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string, organizationId?: string): Promise<Rule | null> {
    const conditions = [eq(rules.id, id)]
    if (organizationId) {
      conditions.push(eq(rules.organizationId, organizationId))
    }

    const result = await this.db
      .select()
      .from(rules)
      .where(and(...conditions))
      .limit(1)

    return result[0] || null
  }

  async findActiveByOrganization(organizationId: string): Promise<Rule[]> {
    return this.db
      .select()
      .from(rules)
      .where(and(eq(rules.organizationId, organizationId), eq(rules.isActive, true)))
      .orderBy(rules.priority)
  }

  async findByCategory(organizationId: string, category: RuleCategory): Promise<Rule[]> {
    return this.db
      .select()
      .from(rules)
      .where(
        and(
          eq(rules.organizationId, organizationId),
          eq(rules.category, category),
          eq(rules.isActive, true)
        )
      )
      .orderBy(rules.priority)
  }

  async create(data: RuleCreate): Promise<Rule> {
    const result = await this.db
      .insert(rules)
      .values({
        organizationId: data.organizationId,
        category: data.category,
        description: data.description,
        ruleLogic: data.ruleLogic,
        priority: data.priority || 0,
        createdBy: data.createdBy
      })
      .returning()

    return result[0]
  }

  async update(id: string, organizationId: string, data: RuleUpdate): Promise<Rule | null> {
    const result = await this.db
      .update(rules)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(rules.id, id), eq(rules.organizationId, organizationId)))
      .returning()

    return result[0] || null
  }

  async toggleActive(id: string, organizationId: string): Promise<Rule | null> {
    const existing = await this.findById(id, organizationId)
    if (!existing) return null

    return this.update(id, organizationId, { isActive: !existing.isActive })
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.organizationId, organizationId)))
      .returning({ id: rules.id })

    return result.length > 0
  }
}

export const ruleRepository = new RuleRepository()
