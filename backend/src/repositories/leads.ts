import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Lead, LeadStatus, Prisma } from '@prisma/client'

export type { Lead, LeadStatus }

export interface LeadCreate {
  name: string
  email: string
  company?: string | null
  phone?: string | null
  role?: string | null
  message?: string | null
  source?: string
}

export interface LeadUpdate {
  status?: LeadStatus
  notes?: string | null
  convertedAt?: Date | null
}

export class LeadRepository {
  async findAll(
    params: PaginationParams & { search?: string; status?: LeadStatus }
  ): Promise<PaginatedResult<Lead>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.LeadWhereInput = {}

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { company: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    if (params.status) {
      where.status = params.status
    }

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string): Promise<Lead | null> {
    return prisma.lead.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<Lead | null> {
    return prisma.lead.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })
  }

  async create(data: LeadCreate): Promise<Lead> {
    return prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        role: data.role,
        message: data.message,
        source: data.source || 'landing_page'
      }
    })
  }

  async update(id: string, data: LeadUpdate): Promise<Lead | null> {
    try {
      const updateData: Prisma.LeadUpdateInput = {}
      if (data.status !== undefined) updateData.status = data.status
      if (data.notes !== undefined) updateData.notes = data.notes
      if (data.convertedAt !== undefined) updateData.convertedAt = data.convertedAt

      return await prisma.lead.update({
        where: { id },
        data: updateData
      })
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.lead.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async countByStatus(): Promise<Record<LeadStatus, number>> {
    const counts = await prisma.lead.groupBy({
      by: ['status'],
      _count: { status: true }
    })

    const result: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      closed: 0
    }

    for (const item of counts) {
      result[item.status] = item._count.status
    }

    return result
  }
}

export const leadRepository = new LeadRepository()
