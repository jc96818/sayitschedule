import { prisma } from '../db/index.js'

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = params.page || 1
  const limit = params.limit || 20
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

export function getPaginationOffsets(params: PaginationParams) {
  const page = params.page || 1
  const limit = params.limit || 20
  const skip = (page - 1) * limit
  return { take: limit, skip }
}

// Re-export prisma for use in repositories
export { prisma }
