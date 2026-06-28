import { notFound } from 'next/navigation'

import {
  getEditorialReadingMinutes,
  getEditorialWordCount,
  getRelatedEditorialArticles,
  getTransferMarketEditorialArticleBySlug,
  getTransferMarketEditorialArticles,
  getTransferMarketItemBySlug,
  getTransferMarketItems,
  getTransferMarketReadingMinutes,
  getTransferMarketWordCount,
} from '@/content/editorial'
import { EditorialArticleDetail } from '@/frontend/components/EditorialArticleDetail'
import { EditorialArticleStructuredData } from '@/frontend/components/EditorialArticleStructuredData'
import { getPublicPageIndexability } from '@/shared/content-quality'
import {
  formatEditorialDate,
  formatTransferStatus,
  formatTransferType,
} from '@/shared/editorial-format'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return [
    ...getTransferMarketEditorialArticles().map((article) => ({
      slug: article.slug,
    })),
    ...getTransferMarketItems().map((item) => ({ slug: item.slug })),
  ]
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const article = getTransferMarketEditorialArticleBySlug(slug)
  const movement = getTransferMarketItemBySlug(slug)

  if (article) {
    const indexability = getPublicPageIndexability({
      path: `/mercado-de-pases/${article.slug}`,
      kind: 'article',
      content: {
        editorialWordCount: getEditorialWordCount(article),
        hasMetadata: true,
      },
    })

    return buildSeoMetadata({
      title: `${article.title} | Hay Fulbo`,
      description: article.summary,
      path: `/mercado-de-pases/${article.slug}`,
      noIndex: !indexability.index,
    })
  }

  if (movement) {
    const indexability = getPublicPageIndexability({
      path: `/mercado-de-pases/${movement.slug}`,
      kind: 'article',
      content: {
        editorialWordCount: getTransferMarketWordCount(movement),
        hasMetadata: true,
      },
    })

    return buildSeoMetadata({
      title: `${movement.playerName}: ${movement.fromTeam} a ${movement.toTeam} | Hay Fulbo`,
      description: movement.summary,
      path: `/mercado-de-pases/${movement.slug}`,
      noIndex: !indexability.index,
    })
  }

  return buildSeoMetadata({
    title: 'Movimiento no encontrado | Hay Fulbo',
    description: 'La información solicitada no está disponible en Hay Fulbo.',
    path: `/mercado-de-pases/${slug}`,
    noIndex: true,
  })
}

export default async function MercadoDePasesDetallePage({ params }: PageProps) {
  const { slug } = await params
  const article = getTransferMarketEditorialArticleBySlug(slug)

  if (article) {
    return (
      <>
        <EditorialArticleStructuredData
          article={article}
          path={`/mercado-de-pases/${article.slug}`}
        />
        <EditorialArticleDetail
          article={article}
          relatedArticles={getRelatedEditorialArticles(article, {
            channel: 'mercado-de-pases',
          })}
          relatedBasePath="/mercado-de-pases"
          readingMinutes={getEditorialReadingMinutes(article)}
        />
      </>
    )
  }

  const movement = getTransferMarketItemBySlug(slug)
  if (!movement) notFound()

  return (
    <main className="min-w-0 space-y-4 text-white">
      <article className="hf-card overflow-hidden rounded-2xl">
        <header className="hf-section-head px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#f0c66f]">
            <span>{formatTransferStatus(movement.status)}</span>
            <span className="text-[#6f7c75]">/</span>
            <span>{formatTransferType(movement.type)}</span>
            <span className="text-[#6f7c75]">/</span>
            <span>{getTransferMarketReadingMinutes(movement)} min</span>
          </div>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
            {movement.playerName}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
            {movement.summary}
          </p>
          <dl className="mt-4 grid gap-2 text-xs text-[#aebbb6] sm:grid-cols-2">
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#f0c66f]">
                Origen
              </dt>
              <dd className="mt-1">{movement.fromTeam}</dd>
            </div>
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#f0c66f]">
                Destino
              </dt>
              <dd className="mt-1">{movement.toTeam}</dd>
            </div>
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#f0c66f]">
                Fecha
              </dt>
              <dd className="mt-1">
                <time dateTime={movement.updatedAt}>
                  {formatEditorialDate(movement.updatedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="font-black uppercase tracking-[0.12em] text-[#f0c66f]">
                Fuente
              </dt>
              <dd className="mt-1">
                <a
                  href={movement.sourceUrl}
                  className="font-bold text-[#f0c66f] transition hover:text-white"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {movement.sourceName}
                </a>
              </dd>
            </div>
          </dl>
        </header>

        <div className="px-4 py-6 sm:px-5">
          {movement.status === 'rumor' ? (
            <p className="mb-5 rounded-xl border border-[#f0c66f]/25 bg-[#f0c66f]/10 px-3 py-3 text-sm font-bold leading-6 text-[#f6dfae]">
              Esta información está marcada como rumor y puede cambiar.
            </p>
          ) : null}
          <div className="space-y-7">
            {movement.body.map((block) => (
              <section key={block.heading ?? block.paragraphs[0]} className="space-y-3">
                {block.heading ? (
                  <h2 className="text-xl font-black text-white">{block.heading}</h2>
                ) : null}
                {block.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-[#dbe5df]">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  )
}
