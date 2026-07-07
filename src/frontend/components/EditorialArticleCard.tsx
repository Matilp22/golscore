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
}

export default function EditorialArticleCard({
  article,
  href,
  actionLabel,
}: EditorialArticleCardProps) {
  const image = article.heroImage ?? article.image
  const hasImage = Boolean(image)

  return (
    <Link
      href={href}
      className="hf-card-hover block min-w-0 overflow-hidden rounded-2xl border border-[rgba(7,27,47,0.12)] bg-white text-[#071B2F] shadow-[0_16px_40px_rgba(7,27,47,0.08)] transition"
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="h-36 w-full bg-[#071B2F] object-contain p-3"
          loading="lazy"
        />
      ) : null}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#0F6B26]">
          <span>{formatEditorialCategory(article.category)}</span>
          <span className="text-[#8D979F]">/</span>
          <span>{article.author}</span>
          <span className="text-[#8D979F]">/</span>
          <time dateTime={article.updatedAt}>
            {formatEditorialDate(article.updatedAt)}
          </time>
          {article.readingMinutes ? (
            <>
              <span className="text-[#8D979F]">/</span>
              <span>{article.readingMinutes} min</span>
            </>
          ) : null}
        </div>
        <h2 className="mt-3 text-lg font-black leading-tight text-[#071B2F]">
          {article.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#68717A]">{article.summary}</p>
        <div className="mt-4 text-sm font-black text-[#0F6B26]">{actionLabel}</div>
      </div>
    </Link>
  )
}
