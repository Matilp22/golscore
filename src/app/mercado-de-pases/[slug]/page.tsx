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
import TransferMovementDetail from '@/frontend/components/TransferMovementDetail'
import { getPublicPageIndexability } from '@/shared/content-quality'
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

export default async function MercadoDePasesDetallePage({
  params,
}: PageProps) {
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
    <TransferMovementDetail
      movement={movement}
      readingMinutes={getTransferMarketReadingMinutes(movement)}
    />
  )
}
