import { eq, sql, ilike, or, and, count } from 'drizzle-orm'
import { getDb, organizations } from '../db/index.js'
import { paginate, getPaginationOffsets, type PaginationParams, type PaginatedResult } from './base.js'

export interface OrganizationCreate {
  name: string
  subdomain: string
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
}

export interface OrganizationUpdate {
  name?: string
  subdomain?: string
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
  status?: 'active' | 'inactive'
}

export type Organization = typeof organizations.$inferSelect
export type OrganizationInsert = typeof organizations.$inferInsert

export class OrganizationRepository {
  private get db() {
    return getDb()
  }

  async findAll(params: PaginationParams & { search?: string; status?: string }): Promise<PaginatedResult<Organization>> {
    const { limit, offset } = getPaginationOffsets(params)

    const conditions = []
    if (params.status) {
      conditions.push(eq(organizations.status, params.status as 'active' | 'inactive'))
    }
    if (params.search) {
      conditions.push(
        or(
          ilike(organizations.name, `%${params.search}%`),
          ilike(organizations.subdomain, `%${params.search}%`)
        )
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(organizations)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(organizations.name),
      this.db
        .select({ count: count() })
        .from(organizations)
        .where(whereClause)
    ])

    return paginate(data, totalResult[0]?.count || 0, params)
  }

  async findById(id: string): Promise<Organization | null> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1)

    return result[0] || null
  }

  async findBySubdomain(subdomain: string): Promise<Organization | null> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain))
      .limit(1)

    return result[0] || null
  }

  async create(data: OrganizationCreate): Promise<Organization> {
    const result = await this.db
      .insert(organizations)
      .values({
        name: data.name,
        subdomain: data.subdomain,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor || '#2563eb',
        secondaryColor: data.secondaryColor || '#1e40af'
      })
      .returning()

    return result[0]
  }

  async update(id: string, data: OrganizationUpdate): Promise<Organization | null> {
    const result = await this.db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning({ id: organizations.id })

    return result.length > 0
  }

  async getStats(id: string): Promise<{ users: number; staff: number; patients: number }> {
    // This will be implemented with proper joins once other repositories are set up
    const result = await this.db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE organization_id = ${id}) as users,
        (SELECT COUNT(*) FROM staff WHERE organization_id = ${id}) as staff,
        (SELECT COUNT(*) FROM patients WHERE organization_id = ${id}) as patients
    `)

    const row = result[0] as { users: string; staff: string; patients: string } | undefined
    return {
      users: parseInt(row?.users || '0', 10),
      staff: parseInt(row?.staff || '0', 10),
      patients: parseInt(row?.patients || '0', 10)
    }
  }
}

export const organizationRepository = new OrganizationRepository()
