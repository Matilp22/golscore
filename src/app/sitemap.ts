import type { MetadataRoute } from 'next'
import {
  SIDEBAR_SECTION_CONFIGS,
  VISIBLE_TOURNAMENT_PAGE_CONFIGS,
} from '@/lib/tournament-pages'
import { absoluteUrl } from '@/shared/seo'

type SitemapEntry = MetadataRoute.Sitemap[number]

const staticRoutes = [
  { path: '/', priority: 1 },
  { path: '/prode', priority: 0.8 },
  { path: '/privacy-policy', priority: 0.4 },
  { path: '/terms', priority: 0.4 },
  { path: '/contact', priority: 0.4 },
] as const

function createUrl(path: string) {
  return absoluteUrl(path)
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const staticUrls: SitemapEntry[] = staticRoutes.map((route) => ({
    url: createUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === '/' ? 'daily' : 'weekly',
    priority: route.priority,
  }))
  const sectionUrls: SitemapEntry[] = SIDEBAR_SECTION_CONFIGS.map((section) => ({
    url: createUrl(`/seccion/${section.key}`),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  }))
  const leagueUrls: SitemapEntry[] = VISIBLE_TOURNAMENT_PAGE_CONFIGS.map((tournament) => ({
    url: createUrl(`/liga/${tournament.key}`),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.75,
  }))

  return [...staticUrls, ...sectionUrls, ...leagueUrls]
}
