import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Rule, RuleCategory, Prisma } from '@prisma/client'

export type { RuleCategory }

export interface RuleCreate {
  organizationId: string
  category: RuleCategory
  description: string
  ruleLogic: Record<string, unknown>
  priority?: number
  createdById: string
}

export interface RuleUpdate {
  category?: RuleCategory
  description?: string
  ruleLogic?: Record<string, unknown>
  priority?: number
  isActive?: boolean
}

export type { Rule }

export class RuleRepository {
  async findAll(
    organizationId: string,
    params: PaginationParams & { category?: string; isActive?: boolean }
  ): Promise<PaginatedResult<Rule>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.RuleWhereInput = { organizationId }

    if (params.category) {
      where.category = params.category as RuleCategory
    }

    if (params.isActive !== undefined) {
      where.isActive = params.isActive
    }

    const [data, total] = await Promise.all([
      prisma.rule.findMany({
        where,
        take,
        skip,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.rule.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string, organizationId?: string): Promise<Rule | null> {
    const where: Prisma.RuleWhereInput = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    return prisma.rule.findFirst({ where })
  }

  async findActiveByOrganization(organizationId: string): Promise<Rule[]> {
    return prisma.rule.findMany({
      where: {
        organizationId,
        isActive: true
      },
      orderBy: { priority: 'asc' }
    })
  }

  async findByCategory(organizationId: string, category: RuleCategory): Promise<Rule[]> {
    return prisma.rule.findMany({
      where: {
        organizationId,
        category,
        isActive: true
      },
      orderBy: { priority: 'asc' }
    })
  }

  async create(data: RuleCreate): Promise<Rule> {
    return prisma.rule.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        category: data.category,
        description: data.description,
        ruleLogic: data.ruleLogic as Prisma.InputJsonValue,
        priority: data.priority || 0,
        createdBy: { connect: { id: data.createdById } }
      }
    })
  }

  async update(id: string, organizationId: string, data: RuleUpdate): Promise<Rule | null> {
    try {
      const updateData: Prisma.RuleUpdateInput = {}
      if (data.category !== undefined) updateData.category = data.category
      if (data.description !== undefined) updateData.description = data.description
      if (data.ruleLogic !== undefined) updateData.ruleLogic = data.ruleLogic as Prisma.InputJsonValue
      if (data.priority !== undefined) updateData.priority = data.priority
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      return await prisma.rule.update({
        where: { id, organizationId },
        data: updateData
      })
    } catch {
      return null
    }
  }

  async toggleActive(id: string, organizationId: string): Promise<Rule | null> {
    const existing = await this.findById(id, organizationId)
    if (!existing) return null

    return this.update(id, organizationId, { isActive: !existing.isActive })
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.rule.delete({
        where: { id, organizationId }
      })
      return true
    } catch {
      return false
    }
  }
}

export const ruleRepository = new RuleRepository()
