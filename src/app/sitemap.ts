import type { MetadataRoute } from 'next'
import {
  getAllArticles as getAnalysisArticles,
} from '@/server/editorial/articles'
import {
  getEditorialWordCount,
  getNewsArticles,
  getTransferMarketEditorialArticles,
  getTransferMarketEditorialWordCount,
  getTransferMarketItems,
  getTransferMarketItemsWordCount,
  getTransferMarketWordCount,
} from '@/content/editorial'
import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/lib/tournament-pages'
import {
  TRUST_PAGE_PATHS,
  getPublicPageIndexability,
} from '@/shared/content-quality'
import { getCompetitionEditorialWordCount } from '@/shared/competition-editorial'
import { absoluteUrl } from '@/shared/seo'

type SitemapEntry = MetadataRoute.Sitemap[number]

const staticRoutes = [
  { path: '/', priority: 1 },
  { path: '/prode', priority: 0.8 },
  { path: '/analisis', priority: 0.75 },
  ...TRUST_PAGE_PATHS.map((path) => ({ path, priority: 0.45 })),
] as const

function createUrl(path: string) {
  return absoluteUrl(path)
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const analysisArticles = getAnalysisArticles()
  const newsArticles = getNewsArticles()
  const transferEditorialArticles = getTransferMarketEditorialArticles()
  const transferItems = getTransferMarketItems()
  const editorialRoutes = [
    {
      path: '/noticias',
      kind: 'news' as const,
      wordCount: newsArticles.reduce(
        (sum, article) => sum + getEditorialWordCount(article),
        0
      ),
      sportsDataItems: 0,
      placeholderOnly: newsArticles.length === 0,
      updatedAtValues: newsArticles.map((article) => article.updatedAt),
      priority: 0.75,
    },
    {
      path: '/mercado-de-pases',
      kind: 'transfers' as const,
      wordCount:
        getTransferMarketEditorialWordCount() + getTransferMarketItemsWordCount(),
      sportsDataItems: transferItems.length,
      placeholderOnly: transferItems.length === 0,
      updatedAtValues: [
        ...transferEditorialArticles.map((article) => article.updatedAt),
        ...transferItems.map((item) => item.updatedAt),
      ],
      priority: 0.65,
    },
  ].filter((route) => {
    const indexability = getPublicPageIndexability({
      path: route.path,
      kind: route.kind,
      content: {
        editorialWordCount: route.wordCount,
        sportsDataItems: route.sportsDataItems ?? 0,
        hasMetadata: true,
        placeholderOnly: route.placeholderOnly ?? false,
      },
    })

    return indexability.index
  })
  const staticUrls: SitemapEntry[] = staticRoutes.map((route) => ({
    url: createUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === '/' ? 'daily' : 'weekly',
    priority: route.priority,
  }))
  const editorialUrls: SitemapEntry[] = editorialRoutes.map((route) => ({
    url: createUrl(route.path),
    lastModified: route.updatedAtValues.length
      ? new Date(
          Math.max(...route.updatedAtValues.map((updatedAt) => Date.parse(updatedAt)))
        )
      : now,
    changeFrequency: 'daily',
    priority: route.priority,
  }))
  const articleUrls: SitemapEntry[] = analysisArticles.map((article) => ({
    url: createUrl(`/analisis/${article.slug}`),
    lastModified: new Date(article.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
  const newsArticleUrls: SitemapEntry[] = newsArticles
    .filter((article) => {
      const indexability = getPublicPageIndexability({
        path: `/noticias/${article.slug}`,
        kind: 'article',
        content: {
          editorialWordCount: getEditorialWordCount(article),
          hasMetadata: true,
        },
      })

      return indexability.index
    })
    .map((article) => ({
      url: createUrl(`/noticias/${article.slug}`),
      lastModified: new Date(article.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    }))
  const transferArticleUrls: SitemapEntry[] = [
    ...transferEditorialArticles
      .filter((article) => {
        const indexability = getPublicPageIndexability({
          path: `/mercado-de-pases/${article.slug}`,
          kind: 'article',
          content: {
            editorialWordCount: getEditorialWordCount(article),
            hasMetadata: true,
          },
        })

        return indexability.index
      })
      .map((article) => ({
        url: createUrl(`/mercado-de-pases/${article.slug}`),
        lastModified: new Date(article.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.65,
      })),
    ...transferItems
      .filter((item) => {
        const indexability = getPublicPageIndexability({
          path: `/mercado-de-pases/${item.slug}`,
          kind: 'article',
          content: {
            editorialWordCount: getTransferMarketWordCount(item),
            hasMetadata: true,
          },
        })

        return indexability.index
      })
      .map((item) => ({
        url: createUrl(`/mercado-de-pases/${item.slug}`),
        lastModified: new Date(item.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
  ]
  const leagueUrls: SitemapEntry[] = VISIBLE_TOURNAMENT_PAGE_CONFIGS
    .filter((tournament) => {
      const indexability = getPublicPageIndexability({
        path: `/liga/${tournament.key}`,
        kind: 'competition',
        content: {
          editorialWordCount: getCompetitionEditorialWordCount(tournament.key),
          hasMetadata: true,
        },
      })

      return indexability.index
    })
    .map((tournament) => ({
      url: createUrl(`/liga/${tournament.key}`),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    }))

  return [
    ...staticUrls,
    ...editorialUrls,
    ...articleUrls,
    ...newsArticleUrls,
    ...transferArticleUrls,
    ...leagueUrls,
  ]
}
