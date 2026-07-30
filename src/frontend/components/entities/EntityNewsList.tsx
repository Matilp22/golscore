import Link from 'next/link'

import SafeImage from '@/frontend/components/SafeImage'

export type EntityNewsItem = {
  slug: string
  title: string
  summary: string
  category: string
  publishedAt: string
  heroImage?: string
}

type EntityNewsListProps = {
  articles: EntityNewsItem[]
  emptyMessage: string
}

function formatDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Fecha no disponible'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function EntityNewsList({
  articles,
  emptyMessage,
}: EntityNewsListProps) {
  if (!articles.length) {
    return <div className="hf-competition-empty">{emptyMessage}</div>
  }

  return (
    <div className="hf-entity-news-list">
      {articles.map((article) => (
        <Link
          key={article.slug}
          href={`/noticias/${article.slug}`}
          className="hf-entity-news-item"
        >
          {article.heroImage ? (
            <SafeImage
              src={article.heroImage}
              alt=""
              imageType="video"
              width={160}
              height={96}
              className="hf-entity-news-image"
              fallbackClassName="hf-entity-news-image"
            />
          ) : (
            <span className="hf-entity-news-placeholder" aria-hidden="true">
              HF
            </span>
          )}
          <span>
            <small>
              {article.category} · {formatDate(article.publishedAt)}
            </small>
            <strong>{article.title}</strong>
            <span>{article.summary}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
