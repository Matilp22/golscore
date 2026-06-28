import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles,
  type EditorialArticle,
} from '@/server/editorial/articles'
import { countWords, getPublicPageIndexability } from '@/shared/content-quality'
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
      title: 'Analisis no encontrado | Hay Fulbo',
      description: 'La guia solicitada no esta disponible en Hay Fulbo.',
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

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(Date.UTC(year, month - 1, day, 12))
    : new Date(value)

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

function renderInlineText(value: string) {
  return value
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/)
  const blocks: Array<{ type: 'heading' | 'paragraph' | 'list'; text?: string; items?: string[] }> = []
  let paragraph: string[] = []
  let listItems: string[] = []

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  function flushList() {
    if (!listItems.length) return
    blocks.push({ type: 'list', items: listItems })
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'heading', text: trimmed.replace(/^##\s+/, '') })
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph()
      listItems.push(trimmed.replace(/^-\s+/, ''))
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h2 key={`${block.type}-${index}`} className="text-xl font-black text-white">
              {renderInlineText(block.text ?? '')}
            </h2>
          )
        }

        if (block.type === 'list') {
          return (
            <ul
              key={`${block.type}-${index}`}
              className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#dbe5df]"
            >
              {(block.items ?? []).map((item) => (
                <li key={item}>{renderInlineText(item)}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`${block.type}-${index}`} className="text-sm leading-7 text-[#dbe5df]">
            {renderInlineText(block.text ?? '')}
          </p>
        )
      })}
    </div>
  )
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

function RelatedArticles({ article }: { article: EditorialArticle }) {
  const relatedArticles = getRelatedArticles(article)

  if (!relatedArticles.length) return null

  return (
    <section className="hf-card rounded-2xl p-4">
      <h2 className="text-lg font-black text-white">Lecturas relacionadas</h2>
      <div className="mt-3 grid gap-2">
        {relatedArticles.map((related) => (
          <Link
            key={related.slug}
            href={`/analisis/${related.slug}`}
            className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3 text-sm font-bold text-[#dbe5df] transition hover:border-[#70ff9d]/25 hover:bg-[#70ff9d]/10 hover:text-white"
          >
            {related.title}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default async function AnalisisDetallePage({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) notFound()

  return (
    <main className="min-w-0 space-y-4 text-white">
      <ArticleJsonLd article={article} />
      <article className="hf-card overflow-hidden rounded-2xl">
        <header className="hf-section-head px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#70ff9d]">
            <span>{article.category}</span>
            <span className="text-[#6f7c75]">/</span>
            <span>{article.author}</span>
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
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#7ff0b2]">
                Actualizado
              </dt>
              <dd className="mt-1">
                <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
              </dd>
            </div>
          </dl>
        </header>

        <div className="px-4 py-6 sm:px-5">
          <MarkdownContent content={article.content} />

          <section className="mt-8 border-t border-white/8 pt-5">
            <h2 className="text-lg font-black text-white">Fuentes</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="font-bold text-[#70ff9d] transition hover:text-white"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <RelatedArticles article={article} />
      <p className="text-xs leading-5 text-[#83938d]">
        {countWords(article.content)} palabras editoriales revisadas.
      </p>
    </main>
  )
}
