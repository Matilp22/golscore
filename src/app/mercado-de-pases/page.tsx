import Link from 'next/link'

import {
  getEditorialReadingMinutes,
  getTransferMarketEditorialArticles,
  getTransferMarketEditorialWordCount,
  getTransferMarketItems,
  getTransferMarketItemsWordCount,
  type TransferMarketStatus,
  type TransferMarketType,
} from '@/content/editorial'
import EditorialArticleCard from '@/frontend/components/EditorialArticleCard'
import { getPublicPageIndexability } from '@/shared/content-quality'
import {
  formatEditorialDate,
  formatTransferStatus,
  formatTransferType,
} from '@/shared/editorial-format'
import { buildSeoMetadata } from '@/shared/seo'

type MercadoPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const STATUS_FILTERS: TransferMarketStatus[] = [
  'confirmado',
  'rumor',
  'negociacion',
  'caido',
]

const TYPE_FILTERS: TransferMarketType[] = [
  'alta',
  'baja',
  'prestamo',
  'renovacion',
]

function isTransferMarketStatus(value: string): value is TransferMarketStatus {
  return STATUS_FILTERS.includes(value as TransferMarketStatus)
}

function isTransferMarketType(value: string): value is TransferMarketType {
  return [...TYPE_FILTERS, 'jugador-libre'].includes(value as TransferMarketType)
}

export function generateMetadata() {
  const transferItems = getTransferMarketItems()
  const editorialWordCount =
    getTransferMarketEditorialWordCount() + getTransferMarketItemsWordCount()
  const indexability = getPublicPageIndexability({
    path: '/mercado-de-pases',
    kind: 'transfers',
    content: {
      editorialWordCount,
      sportsDataItems: transferItems.length,
      hasMetadata: true,
      placeholderOnly: transferItems.length === 0,
    },
  })

  return buildSeoMetadata({
    title: 'Mercado de pases, altas, bajas y rumores | Hay Fulbo',
    description:
      'Últimas novedades del mercado de pases, transferencias, altas, bajas y rumores del fútbol argentino e internacional.',
    path: '/mercado-de-pases',
    noIndex: !indexability.index,
  })
}

function createFilterHref(params: { estado?: string; tipo?: string }) {
  const searchParams = new URLSearchParams()
  if (params.estado) searchParams.set('estado', params.estado)
  if (params.tipo) searchParams.set('tipo', params.tipo)
  const query = searchParams.toString()

  return query ? `/mercado-de-pases?${query}` : '/mercado-de-pases'
}

export default async function MercadoDePasesPage({
  searchParams,
}: MercadoPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawStatus = Array.isArray(params.estado) ? params.estado[0] : params.estado
  const rawType = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo
  const selectedStatus =
    rawStatus && isTransferMarketStatus(rawStatus)
      ? rawStatus
      : undefined
  const selectedType =
    rawType && isTransferMarketType(rawType) ? rawType : undefined
  const movements = getTransferMarketItems({
    status: selectedStatus,
    type: selectedType,
  })
  const guides = getTransferMarketEditorialArticles()

  return (
    <main className="min-w-0 space-y-5 text-white">
      <header className="hf-card hf-section-head rounded-2xl px-4 py-5 sm:px-5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#f0c66f]">
          Editorial
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
          Mercado de pases
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
          Altas, bajas, rumores y negociaciones del fútbol argentino e
          internacional, con fuente visible y estado claro para cada movimiento.
        </p>
      </header>

      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#f0c66f]">
          Filtros
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={createFilterHref({ tipo: selectedType })}
            className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
              selectedStatus
                ? 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#f0c66f]/30 hover:text-white'
                : 'border-[#f0c66f]/30 bg-[#f0c66f]/10 text-white'
            }`}
            aria-current={!selectedStatus ? 'page' : undefined}
          >
            Todos
          </Link>
          {STATUS_FILTERS.map((status) => {
            const active = selectedStatus === status

            return (
              <Link
                key={status}
                href={createFilterHref({ estado: status, tipo: selectedType })}
                className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                  active
                    ? 'border-[#f0c66f]/30 bg-[#f0c66f]/10 text-white'
                    : 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#f0c66f]/30 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {formatTransferStatus(status)}
              </Link>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={createFilterHref({ estado: selectedStatus })}
            className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
              selectedType
                ? 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#f0c66f]/30 hover:text-white'
                : 'border-[#f0c66f]/30 bg-[#f0c66f]/10 text-white'
            }`}
            aria-current={!selectedType ? 'page' : undefined}
          >
            Todos los tipos
          </Link>
          {TYPE_FILTERS.map((type) => {
            const active = selectedType === type

            return (
              <Link
                key={type}
                href={createFilterHref({ estado: selectedStatus, tipo: type })}
                className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                  active
                    ? 'border-[#f0c66f]/30 bg-[#f0c66f]/10 text-white'
                    : 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#f0c66f]/30 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {formatTransferType(type)}
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="movimientos-title">
        <h2 id="movimientos-title" className="text-xl font-black text-white">
          Movimientos y rumores
        </h2>
        {movements.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {movements.map((movement) => (
              <article key={movement.slug} className="hf-card rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#f0c66f]">
                  <span>{formatTransferStatus(movement.status)}</span>
                  <span className="text-[#6f7c75]">/</span>
                  <span>{formatTransferType(movement.type)}</span>
                  <span className="text-[#6f7c75]">/</span>
                  <time dateTime={movement.updatedAt}>
                    {formatEditorialDate(movement.updatedAt)}
                  </time>
                </div>
                <h3 className="mt-3 text-lg font-black text-white">
                  {movement.playerName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#c8d3cf]">
                  De {movement.fromTeam} a {movement.toTeam}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#aebbb6]">
                  {movement.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm font-black">
                  <Link
                    href={`/mercado-de-pases/${movement.slug}`}
                    className="text-[#f0c66f] transition hover:text-white"
                  >
                    Ver detalle
                  </Link>
                  <a
                    href={movement.sourceUrl}
                    className="text-[#c8d3cf] transition hover:text-white"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Fuente: {movement.sourceName}
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="hf-card rounded-2xl p-5 text-sm leading-6 text-[#c8d3cf]">
            Próximamente vas a encontrar acá las últimas novedades del mercado
            de pases.
          </div>
        )}
      </section>

      {guides.length ? (
        <section className="space-y-3" aria-labelledby="guias-mercado-title">
          <h2 id="guias-mercado-title" className="text-xl font-black text-white">
            Guías editoriales
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {guides.map((article) => (
              <EditorialArticleCard
                key={article.slug}
                article={{
                  ...article,
                  readingMinutes: getEditorialReadingMinutes(article),
                }}
                href={`/mercado-de-pases/${article.slug}`}
                actionLabel="Leer guía"
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
