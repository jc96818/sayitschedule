import { Prisma } from '@prisma/client'
import { prisma } from './base.js'

export type HelpCategoryListItem = {
  slug: string
  title: string
  description: string | null
  sortOrder: number
  articles: Array<{
    slug: string
    title: string
    summary: string | null
  }>
}

export type HelpArticleDetail = {
  slug: string
  title: string
  summary: string | null
  status: string
  bodyMarkdown: string
  tags: string[]
  aliases: string[]
  audienceRoles: string[]
  prerequisites: {
    features: string[]
    settings: string[]
    org: string[]
  }
  category: {
    slug: string
    title: string
  }
  createdAt: Date
  updatedAt: Date
}

export type HelpSearchResult = {
  slug: string
  title: string
  summary: string | null
  categorySlug: string
  categoryTitle: string
  rank: number
}

export class HelpRepository {
  async listCategories(): Promise<HelpCategoryListItem[]> {
    // Use SQL instead of model delegates so the endpoint works even if the Prisma Client
    // hasn't been regenerated in the running environment (common in Docker dev volumes).
    const rows = await prisma.$queryRaw<
      Array<{
        slug: string
        title: string
        description: string | null
        sortOrder: number
        articles: Array<{ slug: string; title: string; summary: string | null }>
      }>
    >(Prisma.sql`
      SELECT
        c.slug,
        c.title,
        c.description,
        c.sort_order AS "sortOrder",
        COALESCE(
          json_agg(
            json_build_object(
              'slug', a.slug,
              'title', a.title,
              'summary', a.summary
            )
            ORDER BY a.title ASC
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) AS articles
      FROM help_categories c
      LEFT JOIN help_articles a
        ON a.category_id = c.id
       AND a.status = 'published'
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.title ASC;
    `)

    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      description: r.description,
      sortOrder: r.sortOrder,
      articles: r.articles ?? []
    }))
  }

  async findPublishedArticleBySlug(slug: string): Promise<HelpArticleDetail | null> {
    const rows = await prisma.$queryRaw<
      Array<{
        slug: string
        title: string
        summary: string | null
        status: string
        bodyMarkdown: string
        tags: string[]
        aliases: string[]
        audienceRoles: string[]
        prerequisitesFeatures: string[]
        prerequisitesSettings: string[]
        prerequisitesOrg: string[]
        createdAt: Date
        updatedAt: Date
        categorySlug: string
        categoryTitle: string
      }>
    >(Prisma.sql`
      SELECT
        a.slug,
        a.title,
        a.summary,
        a.status,
        a.body_markdown AS "bodyMarkdown",
        a.tags,
        a.aliases,
        a.audience_roles AS "audienceRoles",
        a.prerequisites_features AS "prerequisitesFeatures",
        a.prerequisites_settings AS "prerequisitesSettings",
        a.prerequisites_org AS "prerequisitesOrg",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt",
        c.slug AS "categorySlug",
        c.title AS "categoryTitle"
      FROM help_articles a
      JOIN help_categories c ON c.id = a.category_id
      WHERE a.slug = ${slug}
        AND a.status = 'published'
      LIMIT 1;
    `)

    const article = rows[0]
    if (!article) return null

    return {
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      status: article.status,
      bodyMarkdown: article.bodyMarkdown,
      tags: article.tags ?? [],
      aliases: article.aliases ?? [],
      audienceRoles: article.audienceRoles ?? [],
      prerequisites: {
        features: article.prerequisitesFeatures ?? [],
        settings: article.prerequisitesSettings ?? [],
        org: article.prerequisitesOrg ?? []
      },
      category: {
        slug: article.categorySlug,
        title: article.categoryTitle
      },
      createdAt: article.createdAt,
      updatedAt: article.updatedAt
    }
  }

  async searchPublishedArticles(q: string, opts?: { limit?: number }): Promise<HelpSearchResult[]> {
    const limit = Math.max(1, Math.min(opts?.limit ?? 20, 50))

    const rows = await prisma.$queryRaw<
      Array<{
        slug: string
        title: string
        summary: string | null
        categorySlug: string
        categoryTitle: string
        rank: number
      }>
    >(Prisma.sql`
      SELECT
        a.slug,
        a.title,
        a.summary,
        c.slug AS "categorySlug",
        c.title AS "categoryTitle",
        ts_rank_cd(a.search_vector, websearch_to_tsquery('english', ${q})) AS rank
      FROM help_articles a
      JOIN help_categories c ON c.id = a.category_id
      WHERE a.status = 'published'
        AND a.search_vector @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC, a.updated_at DESC
      LIMIT ${limit};
    `)

    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      categorySlug: r.categorySlug,
      categoryTitle: r.categoryTitle,
      rank: Number(r.rank)
    }))
  }
}

export const helpRepository = new HelpRepository()
