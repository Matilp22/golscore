import { Fragment } from 'react'
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
    <main className="min-w-0 space-y-4 text-[#071B2F]">
      <article className="overflow-hidden rounded-2xl border border-[rgba(7,27,47,0.12)] bg-white shadow-[0_16px_40px_rgba(7,27,47,0.08)]">
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

        {article.heroImage ? (
          <figure className="border-b border-[rgba(7,27,47,0.12)] bg-[#071B2F] px-4 pb-5 sm:px-5">
            <div className="overflow-hidden rounded-2xl bg-[#0B2742]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.heroImage}
                alt={article.title}
                className="h-52 w-full object-contain p-4 sm:h-72"
                loading="eager"
              />
            </div>
          </figure>
        ) : null}

        <div className="px-4 py-6 sm:px-5">
          <div className="space-y-7">
            {article.body.map((block) => (
              <section key={block.heading ?? block.paragraphs[0]} className="space-y-3">
                {block.heading ? (
                  <h2 className="text-xl font-black text-[#071B2F]">{block.heading}</h2>
                ) : null}
                {block.paragraphs.map((paragraph, index) => (
                  <Fragment key={paragraph}>
                    <p className="text-[15px] leading-8 text-[#223344]">
                      {paragraph}
                    </p>
                    {index === 0 && block.image ? (
                      <figure className="my-5 overflow-hidden rounded-2xl border border-[rgba(7,27,47,0.12)] bg-[#071B2F] shadow-[0_16px_34px_rgba(7,27,47,0.12)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.image.src}
                          alt={block.image.alt}
                          className="h-52 w-full object-contain p-4 sm:h-72"
                          loading="lazy"
                        />
                        {block.image.caption ? (
                          <figcaption className="border-t border-white/10 px-4 py-3 text-xs font-bold leading-5 text-white/80">
                            {block.image.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                  </Fragment>
                ))}
                {block.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-[15px] leading-8 text-[#223344]">
                    {block.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          {article.sources.length ? (
            <section className="mt-8 border-t border-[rgba(7,27,47,0.12)] pt-5">
              <h2 className="text-lg font-black text-[#071B2F]">Fuentes</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6">
                {article.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      className="font-bold text-[#0F6B26] transition hover:text-[#071B2F]"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </article>

      {relatedArticles.length ? (
        <section className="rounded-2xl border border-[rgba(7,27,47,0.12)] bg-white p-4 shadow-[0_16px_40px_rgba(7,27,47,0.08)]">
          <h2 className="text-lg font-black text-[#071B2F]">Lecturas relacionadas</h2>
          <div className="mt-3 grid gap-2">
            {relatedArticles.map((related) => (
              <Link
                key={related.slug}
                href={`${relatedBasePath}/${related.slug}`}
                className="rounded-xl border border-[rgba(7,27,47,0.12)] bg-[#F6F3EC] px-3 py-3 text-sm font-bold text-[#071B2F] transition hover:border-[#58C91F]/40 hover:bg-[#EAF6E3]"
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
