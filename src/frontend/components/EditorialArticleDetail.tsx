import Link from 'next/link'

import type { EditorialArticle } from '@/content/editorial'
import {
  formatEditorialCategory,
  formatEditorialDate,
} from '@/shared/editorial-format'

type EditorialArticleDetailProps = {
  article: EditorialArticle
  relatedArticles: EditorialArticle[]
  relatedBasePath: '/noticias' | '/mercado-de-pases'
  readingMinutes: number
}

export function EditorialArticleDetail({
  article,
  relatedArticles,
  relatedBasePath,
  readingMinutes,
}: EditorialArticleDetailProps) {
  return (
    <main className="min-w-0 space-y-4 text-white">
      <article className="hf-card overflow-hidden rounded-2xl">
        <header className="hf-section-head px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#70ff9d]">
            <span>{formatEditorialCategory(article.category)}</span>
            <span className="text-[#6f7c75]">/</span>
            <span>{article.author}</span>
            <span className="text-[#6f7c75]">/</span>
            <span>{readingMinutes} min de lectura</span>
          </div>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
            {article.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
            {article.summary}
          </p>
          <dl className="mt-4 grid gap-2 text-xs text-[#aebbb6] sm:grid-cols-2">
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#7ff0b2]">
                Publicado
              </dt>
              <dd className="mt-1">
                <time dateTime={article.publishedAt}>
                  {formatEditorialDate(article.publishedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#7ff0b2]">
                Actualizado
              </dt>
              <dd className="mt-1">
                <time dateTime={article.updatedAt}>
                  {formatEditorialDate(article.updatedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </header>

        <div className="px-4 py-6 sm:px-5">
          <div className="space-y-7">
            {article.body.map((block) => (
              <section key={block.heading ?? block.paragraphs[0]} className="space-y-3">
                {block.heading ? (
                  <h2 className="text-xl font-black text-white">{block.heading}</h2>
                ) : null}
                {block.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-[#dbe5df]"
                  >
                    {paragraph}
                  </p>
                ))}
                {block.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#dbe5df]">
                    {block.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <section className="mt-8 border-t border-white/8 pt-5">
            <h2 className="text-lg font-black text-white">Fuentes</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="font-bold text-[#70ff9d] transition hover:text-white"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      {relatedArticles.length ? (
        <section className="hf-card rounded-2xl p-4">
          <h2 className="text-lg font-black text-white">Lecturas relacionadas</h2>
          <div className="mt-3 grid gap-2">
            {relatedArticles.map((related) => (
              <Link
                key={related.slug}
                href={`${relatedBasePath}/${related.slug}`}
                className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3 text-sm font-bold text-[#dbe5df] transition hover:border-[#70ff9d]/25 hover:bg-[#70ff9d]/10 hover:text-white"
              >
                {related.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
