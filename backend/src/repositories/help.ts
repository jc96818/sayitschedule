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
    const categories = await prisma.helpCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: {
        articles: {
          where: { status: 'published' },
          orderBy: [{ title: 'asc' }],
          select: {
            slug: true,
            title: true,
            summary: true
          }
        }
      }
    })

    return categories.map((c) => ({
      slug: c.slug,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
      articles: c.articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        summary: a.summary
      }))
    }))
  }

  async findPublishedArticleBySlug(slug: string): Promise<HelpArticleDetail | null> {
    const article = await prisma.helpArticle.findFirst({
      where: { slug, status: 'published' },
      include: {
        category: { select: { slug: true, title: true } }
      }
    })

    if (!article) return null

    return {
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      status: article.status,
      bodyMarkdown: article.bodyMarkdown,
      tags: article.tags,
      aliases: article.aliases,
      audienceRoles: article.audienceRoles,
      prerequisites: {
        features: article.prerequisitesFeatures,
        settings: article.prerequisitesSettings,
        org: article.prerequisitesOrg
      },
      category: article.category,
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
