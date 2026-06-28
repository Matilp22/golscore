import { EDITORIAL_ARTICLES } from './articles'
import { TRANSFER_MARKET_ITEMS } from './transfers'
import type {
  EditorialArticle,
  EditorialBodyBlock,
  EditorialCategory,
  TransferMarketItem,
  TransferMarketStatus,
  TransferMarketType,
} from './types'

export type {
  EditorialArticle,
  EditorialBodyBlock,
  EditorialCategory,
  EditorialSource,
  TransferMarketItem,
  TransferMarketStatus,
  TransferMarketType,
} from './types'

const NEWS_TAG = 'noticias'
const TRANSFERS_TAG = 'mercado-de-pases'
const WORDS_PER_MINUTE = 220

function countWords(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.trim().length > 1).length
}

function countBodyWords(body: EditorialBodyBlock[]) {
  return body.reduce((total, block) => {
    const headingWords = block.heading ? countWords(block.heading) : 0
    const paragraphWords = block.paragraphs.reduce(
      (sum, paragraph) => sum + countWords(paragraph),
      0
    )
    const bulletWords = (block.bullets ?? []).reduce(
      (sum, bullet) => sum + countWords(bullet),
      0
    )

    return total + headingWords + paragraphWords + bulletWords
  }, 0)
}

function sortByUpdatedAt<T extends { updatedAt: string; title?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const updatedDiff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    if (updatedDiff !== 0) return updatedDiff

    return (a.title ?? '').localeCompare(b.title ?? '')
  })
}

export function getAllEditorialArticles() {
  return sortByUpdatedAt(EDITORIAL_ARTICLES)
}

export function getEditorialCategories(articles = getNewsArticles()) {
  return Array.from(new Set(articles.map((article) => article.category)))
}

export function getEditorialWordCount(article: EditorialArticle) {
  return countBodyWords(article.body)
}

export function getEditorialReadingMinutes(article: EditorialArticle) {
  return Math.max(1, Math.ceil(getEditorialWordCount(article) / WORDS_PER_MINUTE))
}

export function getNewsArticles(category?: EditorialCategory) {
  const articles = getAllEditorialArticles().filter((article) =>
    article.tags.includes(NEWS_TAG)
  )

  return category
    ? articles.filter((article) => article.category === category)
    : articles
}

export function getNewsArticleBySlug(slug: string) {
  return getNewsArticles().find((article) => article.slug === slug) ?? null
}

export function getTransferMarketEditorialArticles() {
  return getAllEditorialArticles().filter((article) =>
    article.tags.includes(TRANSFERS_TAG)
  )
}

export function getTransferMarketEditorialArticleBySlug(slug: string) {
  return (
    getTransferMarketEditorialArticles().find(
      (article) => article.slug === slug
    ) ?? null
  )
}

export function getRelatedEditorialArticles(
  article: EditorialArticle,
  options: { channel: 'noticias' | 'mercado-de-pases' }
) {
  const pool =
    options.channel === 'noticias'
      ? getNewsArticles()
      : getTransferMarketEditorialArticles()
  const related = article.relatedSlugs
    .map((slug) => pool.find((item) => item.slug === slug))
    .filter((item): item is EditorialArticle => Boolean(item))
  const fallback = pool.filter(
    (item) =>
      item.slug !== article.slug &&
      !related.some((relatedItem) => relatedItem.slug === item.slug)
  )

  return [...related, ...fallback].slice(0, 3)
}

export function getTransferMarketEditorialWordCount() {
  return getTransferMarketEditorialArticles().reduce(
    (sum, article) => sum + getEditorialWordCount(article),
    0
  )
}

export function getTransferMarketItems(filters: {
  status?: TransferMarketStatus
  type?: TransferMarketType
} = {}) {
  return TRANSFER_MARKET_ITEMS.filter((item) => {
    if (filters.status && item.status !== filters.status) return false
    if (filters.type && item.type !== filters.type) return false

    return true
  })
}

export function getTransferMarketItemBySlug(slug: string) {
  return TRANSFER_MARKET_ITEMS.find((item) => item.slug === slug) ?? null
}

export function getTransferMarketWordCount(item: TransferMarketItem) {
  return countBodyWords(item.body)
}

export function getTransferMarketReadingMinutes(item: TransferMarketItem) {
  return Math.max(1, Math.ceil(getTransferMarketWordCount(item) / WORDS_PER_MINUTE))
}

export function getTransferMarketItemsWordCount() {
  return TRANSFER_MARKET_ITEMS.reduce(
    (sum, item) => sum + getTransferMarketWordCount(item),
    0
  )
}
