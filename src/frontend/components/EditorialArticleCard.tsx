import Link from 'next/link'

import {
  formatEditorialCategory,
  formatEditorialDate,
} from '@/shared/editorial-format'

type EditorialArticleCardArticle = {
  title: string
  summary: string
  category: string
  author: string
  updatedAt: string
  publishedAt?: string
  heroImage?: string
  image?: string
  readingMinutes?: number
}

type EditorialArticleCardProps = {
  article: EditorialArticleCardArticle
  href: string
  actionLabel: string
  featured?: boolean
}

export default function EditorialArticleCard({
  article,
  href,
  actionLabel,
  featured = false,
}: EditorialArticleCardProps) {
  const image = article.heroImage ?? article.image

  return (
    <Link
      href={href}
      className={`hf-editorial-card ${featured ? 'is-featured' : ''}`}
    >
      <span className="hf-editorial-card-media">
        {image ? (
          // Editorial content can point to local or allow-listed remote assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading={featured ? 'eager' : 'lazy'} />
        ) : (
          <span className="hf-editorial-card-placeholder" aria-hidden="true">
            <span>HF</span>
          </span>
        )}
      </span>
      <span className="hf-editorial-card-copy">
        <span className="hf-editorial-card-meta">
          <span>{formatEditorialCategory(article.category)}</span>
          <time dateTime={article.updatedAt}>
            {formatEditorialDate(article.updatedAt)}
          </time>
          {article.readingMinutes ? (
            <span>{article.readingMinutes} min</span>
          ) : null}
        </span>
        <strong>{article.title}</strong>
        <span className="hf-editorial-card-summary">{article.summary}</span>
        <span className="hf-editorial-card-footer">
          <span>Por {article.author}</span>
          <span>{actionLabel} →</span>
        </span>
      </span>
    </Link>
  )
}
