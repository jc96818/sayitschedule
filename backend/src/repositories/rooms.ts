import { prisma, paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'
import type { Room, Status, Prisma } from '@prisma/client'

export type { Status }

export interface RoomCreate {
  organizationId: string
  name: string
  capabilities?: string[]
  description?: string | null
}

export interface RoomUpdate {
  name?: string
  capabilities?: string[]
  description?: string | null
  status?: Status
}

export type { Room }

export class RoomRepository {
  async findAll(
    organizationId: string,
    params: PaginationParams & { search?: string; status?: string }
  ): Promise<PaginatedResult<Room>> {
    const { take, skip } = getPaginationOffsets(params)

    const where: Prisma.RoomWhereInput = { organizationId }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } }
      ]
    }

    if (params.status) {
      where.status = params.status as Status
    }

    const [data, total] = await Promise.all([
      prisma.room.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      prisma.room.count({ where })
    ])

    return paginate(data, total, params)
  }

  async findById(id: string, organizationId?: string): Promise<Room | null> {
    const where: Prisma.RoomWhereInput = { id }
    if (organizationId) {
      where.organizationId = organizationId
    }

    return prisma.room.findFirst({ where })
  }

  async findByOrganization(organizationId: string, status?: Status): Promise<Room[]> {
    const where: Prisma.RoomWhereInput = { organizationId }
    if (status) {
      where.status = status
    }

    return prisma.room.findMany({
      where,
      orderBy: { name: 'asc' }
    })
  }

  async findByCapabilities(organizationId: string, requiredCapabilities: string[]): Promise<Room[]> {
    const activeRooms = await this.findByOrganization(organizationId, 'active')

    if (requiredCapabilities.length === 0) {
      return activeRooms
    }

    return activeRooms.filter(room => {
      const roomCaps = (room.capabilities as string[]) || []
      return requiredCapabilities.every(cap => roomCaps.includes(cap))
    })
  }

  async create(data: RoomCreate): Promise<Room> {
    return prisma.room.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        capabilities: data.capabilities || [],
        description: data.description
      }
    })
  }

  async update(id: string, organizationId: string, data: RoomUpdate): Promise<Room | null> {
    try {
      return await prisma.room.update({
        where: { id, organizationId },
        data
      })
    } catch {
      return null
    }
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.room.update({
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
      await prisma.room.delete({
        where: { id, organizationId }
      })
      return true
    } catch {
      return false
    }
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.room.count({
      where: {
        organizationId,
        status: 'active'
      }
    })
  }
}

export const roomRepository = new RoomRepository()
