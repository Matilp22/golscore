import type { EditorialArticle } from '@/content/editorial'
import { absoluteUrl, SITE_NAME } from '@/shared/seo'

type EditorialArticleStructuredDataProps = {
  article: EditorialArticle
  path: string
}

export function EditorialArticleStructuredData({
  article,
  path,
}: EditorialArticleStructuredDataProps) {
  const image = article.heroImage?.trim()
    ? absoluteUrl(article.heroImage)
    : undefined
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
    mainEntityOfPage: absoluteUrl(path),
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
