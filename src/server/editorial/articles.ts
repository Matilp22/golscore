import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

export type EditorialSource = {
  label: string
  url: string
}

export type EditorialChannel = 'analysis' | 'news' | 'transfers'

export type EditorialArticle = {
  title: string
  slug: string
  summary: string
  author: string
  publishedAt: string
  updatedAt: string
  category: string
  image?: string
  channels: EditorialChannel[]
  sources: EditorialSource[]
  related: string[]
  content: string
  wordCount: number
}

type ArticleFrontmatter = Omit<EditorialArticle, 'content' | 'wordCount'>

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'analisis')

function countArticleWords(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.trim().length > 1).length
}

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Articulo editorial sin ${field}.`)
  }

  return value.trim()
}

function assertStringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Articulo editorial con ${field} invalido.`)
  }

  return value.map((item) => assertString(item, field))
}

function parseChannels(value: unknown): EditorialChannel[] {
  if (typeof value === 'undefined') return ['analysis']

  const allowed = new Set<EditorialChannel>(['analysis', 'news', 'transfers'])
  const channels = assertStringArray(value, 'canales').filter((channel): channel is EditorialChannel =>
    allowed.has(channel as EditorialChannel)
  )

  return channels.length ? Array.from(new Set(channels)) : ['analysis']
}

function assertSources(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Articulo editorial con fuentes invalidas.')
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Articulo editorial con fuente invalida.')
    }

    const source = item as Record<string, unknown>

    return {
      label: assertString(source.label, 'fuente.label'),
      url: assertString(source.url, 'fuente.url'),
    }
  })
}

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    throw new Error('Articulo editorial sin frontmatter JSON.')
  }

  const metadata = JSON.parse(match[1]) as Record<string, unknown>
  const frontmatter: ArticleFrontmatter = {
    title: assertString(metadata.title, 'titulo'),
    slug: assertString(metadata.slug, 'slug'),
    summary: assertString(metadata.summary, 'resumen'),
    author: assertString(metadata.author, 'autor'),
    publishedAt: assertString(metadata.publishedAt, 'fecha de publicacion'),
    updatedAt: assertString(metadata.updatedAt, 'fecha de actualizacion'),
    category: assertString(metadata.category, 'categoria'),
    image: typeof metadata.image === 'string' ? metadata.image.trim() : undefined,
    channels: parseChannels(metadata.channels),
    sources: assertSources(metadata.sources),
    related: assertStringArray(metadata.related, 'relacionados'),
  }

  return {
    frontmatter,
    content: match[2].trim(),
  }
}

function readArticleFile(fileName: string): EditorialArticle {
  const absolutePath = path.join(ARTICLES_DIR, fileName)
  const raw = fs.readFileSync(absolutePath, 'utf8')
  const { frontmatter, content } = parseFrontmatter(raw)
  const expectedSlug = fileName.replace(/\.md$/, '')

  if (frontmatter.slug !== expectedSlug) {
    throw new Error(`El slug ${frontmatter.slug} no coincide con ${expectedSlug}.`)
  }

  return {
    ...frontmatter,
    content,
    wordCount: countArticleWords(content),
  }
}

export function getAllArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [] as EditorialArticle[]

  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((fileName) => fileName.endsWith('.md'))
    .map(readArticleFile)
    .sort((a, b) => {
      const updatedDiff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      if (updatedDiff !== 0) return updatedDiff

      return a.title.localeCompare(b.title)
    })
}

export function getArticlesByChannel(channel: EditorialChannel) {
  return getAllArticles().filter((article) => article.channels.includes(channel))
}

export function getNewsArticles() {
  return getArticlesByChannel('news')
}

export function getTransferMarketArticles() {
  return getArticlesByChannel('transfers')
}

export function getArticleBySlug(slug: string) {
  return getAllArticles().find((article) => article.slug === slug) ?? null
}

export function getRelatedArticles(article: EditorialArticle, limit = 3) {
  const articles = getAllArticles()
  const related = article.related
    .map((slug) => articles.find((item) => item.slug === slug))
    .filter((item): item is EditorialArticle => Boolean(item))

  if (related.length >= limit) return related.slice(0, limit)

  const fallback = articles.filter(
    (item) => item.slug !== article.slug && !related.some((relatedItem) => relatedItem.slug === item.slug)
  )

  return [...related, ...fallback].slice(0, limit)
}
