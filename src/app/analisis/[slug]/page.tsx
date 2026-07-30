import { notFound } from 'next/navigation'

import AnalysisArticleDetail from '@/frontend/components/AnalysisArticleDetail'
import {
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles,
  type EditorialArticle,
} from '@/server/editorial/articles'
import { getPublicPageIndexability } from '@/shared/content-quality'
import { absoluteUrl, buildSeoMetadata, SITE_NAME } from '@/shared/seo'

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    return buildSeoMetadata({
      title: 'Análisis no encontrado | Hay Fulbo',
      description: 'La guía solicitada no está disponible en Hay Fulbo.',
      path: `/analisis/${slug}`,
      noIndex: true,
    })
  }

  const indexability = getPublicPageIndexability({
    path: `/analisis/${article.slug}`,
    kind: 'article',
    content: {
      editorialWordCount: article.wordCount,
      hasMetadata: true,
    },
  })

  return buildSeoMetadata({
    title: `${article.title} | Hay Fulbo`,
    description: article.summary,
    path: `/analisis/${article.slug}`,
    noIndex: !indexability.index,
  })
}

function ArticleJsonLd({ article }: { article: EditorialArticle }) {
  const image = article.image?.trim() ? absoluteUrl(article.image) : undefined
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: absoluteUrl('/'),
    },
    mainEntityOfPage: absoluteUrl(`/analisis/${article.slug}`),
    isAccessibleForFree: true,
    ...(image ? { image } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}

export default async function AnalisisDetallePage({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) notFound()

  return (
    <>
      <ArticleJsonLd article={article} />
      <AnalysisArticleDetail
        article={article}
        relatedArticles={getRelatedArticles(article)}
      />
    </>
  )
}
