import type { Metadata } from 'next'
import type { AppLocale } from '@/shared/i18n/locales'

export const SITE_URL = 'https://hayfulbo.com'
export const SITE_NAME = 'Hay Fulbo'
export const DEFAULT_SEO_TITLE =
  'Hay Fulbo | Resultados, Fixtures, Tablas y Estadísticas de Fútbol'
export const DEFAULT_SEO_DESCRIPTION =
  'Seguí resultados en vivo, fixtures, posiciones, estadísticas, formaciones y toda la información del fútbol argentino e internacional.'

const SEO_COPY_BY_LOCALE: Record<AppLocale, { title: string; description: string; ogLocale: string }> = {
  es: {
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    ogLocale: 'es_AR',
  },
  en: {
    title: 'Hay Fulbo | Football Scores, Fixtures, Tables and Stats',
    description:
      'Follow live scores, fixtures, standings, stats, lineups and football coverage from Argentina and around the world.',
    ogLocale: 'en_US',
  },
  pt: {
    title: 'Hay Fulbo | Resultados, Jogos, Tabelas e Estatísticas de Futebol',
    description:
      'Acompanhe resultados ao vivo, jogos, classificações, estatísticas, escalações e informações do futebol argentino e internacional.',
    ogLocale: 'pt_BR',
  },
  fr: {
    title: 'Hay Fulbo | Scores, Calendriers, Classements et Stats de Football',
    description:
      'Suivez les scores en direct, calendriers, classements, statistiques, compositions et infos du football argentin et international.',
    ogLocale: 'fr_FR',
  },
}

type BuildSeoMetadataInput = {
  title: string
  description: string
  path: string
  locale?: AppLocale
  noIndex?: boolean
}

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString()
}

export function buildSeoMetadata({
  title,
  description,
  path,
  locale = 'es',
  noIndex = false,
}: BuildSeoMetadataInput): Metadata {
  const canonical = absoluteUrl(path)
  const seoLocale = SEO_COPY_BY_LOCALE[locale] ?? SEO_COPY_BY_LOCALE.es

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      locale: seoLocale.ogLocale,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  }
}

export function getDefaultSeoCopy(locale: AppLocale = 'es') {
  return SEO_COPY_BY_LOCALE[locale] ?? SEO_COPY_BY_LOCALE.es
}

export function buildNoIndexMetadata(title: string, description: string, path: string) {
  return buildSeoMetadata({
    title,
    description,
    path,
    noIndex: true,
  })
}
