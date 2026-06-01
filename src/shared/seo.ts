import type { Metadata } from 'next'

export const SITE_URL = 'https://hayfulbo.com'
export const SITE_NAME = 'Hay Fulbo'
export const DEFAULT_SEO_TITLE =
  'Hay Fulbo | Resultados, Fixtures, Tablas y Estadísticas de Fútbol'
export const DEFAULT_SEO_DESCRIPTION =
  'Seguí resultados en vivo, fixtures, posiciones, estadísticas, formaciones y toda la información del fútbol argentino e internacional.'

type BuildSeoMetadataInput = {
  title: string
  description: string
  path: string
  noIndex?: boolean
}

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString()
}

export function buildSeoMetadata({
  title,
  description,
  path,
  noIndex = false,
}: BuildSeoMetadataInput): Metadata {
  const canonical = absoluteUrl(path)

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
      locale: 'es_AR',
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

export function buildNoIndexMetadata(title: string, description: string, path: string) {
  return buildSeoMetadata({
    title,
    description,
    path,
    noIndex: true,
  })
}
