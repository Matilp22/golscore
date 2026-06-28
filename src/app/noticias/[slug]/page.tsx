import { notFound } from 'next/navigation'

import {
  getEditorialReadingMinutes,
  getEditorialWordCount,
  getNewsArticleBySlug,
  getNewsArticles,
  getRelatedEditorialArticles,
} from '@/content/editorial'
import { EditorialArticleDetail } from '@/frontend/components/EditorialArticleDetail'
import { EditorialArticleStructuredData } from '@/frontend/components/EditorialArticleStructuredData'
import { getPublicPageIndexability } from '@/shared/content-quality'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getNewsArticles().map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const article = getNewsArticleBySlug(slug)

  if (!article) {
    return buildSeoMetadata({
      title: 'Noticia no encontrada | Hay Fulbo',
      description: 'La noticia solicitada no está disponible en Hay Fulbo.',
      path: `/noticias/${slug}`,
      noIndex: true,
    })
  }

  const indexability = getPublicPageIndexability({
    path: `/noticias/${article.slug}`,
    kind: 'article',
    content: {
      editorialWordCount: getEditorialWordCount(article),
      hasMetadata: true,
    },
  })

  return buildSeoMetadata({
    title: `${article.title} | Hay Fulbo`,
    description: article.summary,
    path: `/noticias/${article.slug}`,
    noIndex: !indexability.index,
  })
}

export default async function NoticiaDetallePage({ params }: PageProps) {
  const { slug } = await params
  const article = getNewsArticleBySlug(slug)

  if (!article) notFound()

  return (
    <>
      <EditorialArticleStructuredData
        article={article}
        path={`/noticias/${article.slug}`}
      />
      <EditorialArticleDetail
        article={article}
        relatedArticles={getRelatedEditorialArticles(article, {
          channel: 'noticias',
        })}
        relatedBasePath="/noticias"
        readingMinutes={getEditorialReadingMinutes(article)}
      />
    </>
  )
}
