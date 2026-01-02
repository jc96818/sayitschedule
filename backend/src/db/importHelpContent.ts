import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { prisma, closeDb } from './index.js'

type HelpFrontMatter = {
  id?: string
  slug: string
  title: string
  category: string
  summary?: string
  audienceRoles?: string[]
  tags?: string[]
  aliases?: string[]
  prerequisites?: {
    features?: string[]
    settings?: string[]
    org?: string[]
  }
}

function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ')
}

function parseArray(value: string): string[] {
  const trimmed = value.trim()
  if (trimmed === '[]') return []
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [parseScalar(trimmed)]
  const inner = trimmed.slice(1, -1).trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => parseScalar(s.trim()))
    .filter((s) => s.length > 0)
}

function parseScalar(value: string): string {
  const trimmed = value.trim()
  const singleQuoted = trimmed.match(/^'(.*)'$/)
  if (singleQuoted) return singleQuoted[1]
  const doubleQuoted = trimmed.match(/^"(.*)"$/)
  if (doubleQuoted) return doubleQuoted[1]
  return trimmed
}

function parseYamlFrontMatter(yaml: string): HelpFrontMatter {
  const lines = yaml.split(/\r?\n/)
  const result: Record<string, unknown> = {}

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line || !line.trim()) {
      i += 1
      continue
    }

    const top = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!top) {
      i += 1
      continue
    }

    const key = top[1]
    const rawValue = top[2]

    if (!rawValue) {
      const nested: Record<string, unknown> = {}
      i += 1
      while (i < lines.length) {
        const nestedLine = lines[i]
        if (!nestedLine || !nestedLine.trim()) {
          i += 1
          continue
        }
        if (!nestedLine.startsWith('  ')) break

        const child = nestedLine.trim().match(/^([A-Za-z0-9_]+):\s*(.*)$/)
        if (child) {
          nested[child[1]] = parseArray(child[2])
        }
        i += 1
      }
      result[key] = nested
      continue
    }

    if (rawValue.trim().startsWith('[')) {
      result[key] = parseArray(rawValue)
    } else {
      result[key] = parseScalar(rawValue)
    }

    i += 1
  }

  if (typeof result.slug !== 'string' || typeof result.title !== 'string' || typeof result.category !== 'string') {
    throw new Error(`Invalid front matter: required keys slug/title/category missing`)
  }

  return result as HelpFrontMatter
}

function splitFrontMatter(markdown: string): { frontMatter: HelpFrontMatter; bodyMarkdown: string } {
  const trimmed = markdown.replace(/^\uFEFF/, '')
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    throw new Error('Missing YAML front matter (expected leading ---)')
  }

  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    throw new Error('Unterminated YAML front matter (missing closing ---)')
  }

  const after = trimmed.indexOf('\n', endIndex + 1)
  const yaml = trimmed.slice(4, endIndex).trimEnd()
  const body = trimmed.slice(after + 1).trimStart()
  return { frontMatter: parseYamlFrontMatter(yaml), bodyMarkdown: body }
}

function normalizeForSearch(markdown: string): string {
  const withDefaultLabels = markdown
    .replaceAll('{{labels.staff.singular}}', 'staff member')
    .replaceAll('{{labels.staff.plural}}', 'staff')
    .replaceAll('{{labels.patient.singular}}', 'patient')
    .replaceAll('{{labels.patient.plural}}', 'patients')
    .replaceAll('{{labels.room.singular}}', 'room')
    .replaceAll('{{labels.room.plural}}', 'rooms')
    .replaceAll('{{labels.certification.plural}}', 'certifications')
    .replaceAll('{{labels.equipment.plural}}', 'equipment')

  return withDefaultLabels
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1 ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^(\s*[-*+]\s+|\s*\d+\.\s+)/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
  return files.sort()
}

const CATEGORY_SORT_ORDER: Record<string, number> = {
  'getting-started': 10,
  schedules: 20,
  people: 30,
  rooms: 40,
  rules: 50,
  settings: 60,
  voice: 70,
  portal: 80,
  security: 90,
  troubleshooting: 100
}

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const contentRoot = path.resolve(__dirname, '../../../docs/help/content')

  const files = await listMarkdownFiles(contentRoot)
  if (files.length === 0) {
    throw new Error(`No markdown files found under ${contentRoot}`)
  }

  let categoriesUpserted = 0
  let articlesUpserted = 0

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8')
    const { frontMatter, bodyMarkdown } = splitFrontMatter(raw)

    const categorySlug = frontMatter.category
    const categoryTitle = toTitleCaseFromSlug(categorySlug)
    const sortOrder = CATEGORY_SORT_ORDER[categorySlug] ?? 999

    const category = await prisma.helpCategory.upsert({
      where: { slug: categorySlug },
      create: {
        slug: categorySlug,
        title: categoryTitle,
        sortOrder: sortOrder
      },
      update: {
        title: categoryTitle,
        sortOrder: sortOrder
      }
    })
    categoriesUpserted += 1

    const prerequisites = frontMatter.prerequisites ?? {}

    await prisma.helpArticle.upsert({
      where: { slug: frontMatter.slug },
      create: {
        slug: frontMatter.slug,
        title: frontMatter.title,
        summary: frontMatter.summary ?? null,
        status: 'published',
        categoryId: category.id,
        bodyMarkdown,
        bodyText: normalizeForSearch(bodyMarkdown),
        tags: frontMatter.tags ?? [],
        aliases: frontMatter.aliases ?? [],
        audienceRoles: frontMatter.audienceRoles ?? [],
        prerequisitesFeatures: prerequisites.features ?? [],
        prerequisitesSettings: prerequisites.settings ?? [],
        prerequisitesOrg: prerequisites.org ?? []
      },
      update: {
        title: frontMatter.title,
        summary: frontMatter.summary ?? null,
        status: 'published',
        categoryId: category.id,
        bodyMarkdown,
        bodyText: normalizeForSearch(bodyMarkdown),
        tags: frontMatter.tags ?? [],
        aliases: frontMatter.aliases ?? [],
        audienceRoles: frontMatter.audienceRoles ?? [],
        prerequisitesFeatures: prerequisites.features ?? [],
        prerequisitesSettings: prerequisites.settings ?? [],
        prerequisitesOrg: prerequisites.org ?? []
      }
    })

    articlesUpserted += 1
  }

  // eslint-disable-next-line no-console
  console.log(`Help import complete: processed ${files.length} files (${categoriesUpserted} category upserts, ${articlesUpserted} article upserts).`)
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDb()
  })
