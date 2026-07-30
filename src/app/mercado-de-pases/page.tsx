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
  return [...TYPE_FILTERS, 'jugador-libre'].includes(
    value as TransferMarketType
  )
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
    rawStatus && isTransferMarketStatus(rawStatus) ? rawStatus : undefined
  const selectedType =
    rawType && isTransferMarketType(rawType) ? rawType : undefined
  const movements = getTransferMarketItems({
    status: selectedStatus,
    type: selectedType,
  })
  const allMovements = getTransferMarketItems()
  const guides = getTransferMarketEditorialArticles()
  const filtersActive = Boolean(selectedStatus || selectedType)

  return (
    <main className="hf-editorial-page is-market">
      <header className="hf-editorial-page-hero">
        <div>
          <p className="hf-type-overline">Información con estado y fuente</p>
          <h1>Mercado de pases</h1>
          <p>
            Altas, bajas y negociaciones sin convertir rumores en confirmaciones.
            Cada movimiento conserva su fecha, estado y fuente.
          </p>
        </div>
        <dl>
          <div>
            <dt>Movimientos verificados</dt>
            <dd className="hf-type-data">{allMovements.length}</dd>
          </div>
          <div>
            <dt>Guías editoriales</dt>
            <dd className="hf-type-data">{guides.length}</dd>
          </div>
          <div>
            <dt>Criterio</dt>
            <dd>Primero la certeza</dd>
          </div>
        </dl>
      </header>

      <section
        className="hf-transfer-filters"
        aria-labelledby="transfer-filter-title"
      >
        <div>
          <p className="hf-type-overline">Encontrar un movimiento</p>
          <h2 id="transfer-filter-title">Filtros</h2>
        </div>
        <div>
          <span>Estado</span>
          <nav aria-label="Filtrar por estado">
            <Link
              href={createFilterHref({ tipo: selectedType })}
              className={!selectedStatus ? 'is-active' : ''}
              aria-current={!selectedStatus ? 'page' : undefined}
            >
              Todos
            </Link>
            {STATUS_FILTERS.map((status) => (
              <Link
                key={status}
                href={createFilterHref({
                  estado: status,
                  tipo: selectedType,
                })}
                className={selectedStatus === status ? 'is-active' : ''}
                aria-current={selectedStatus === status ? 'page' : undefined}
              >
                {formatTransferStatus(status)}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <span>Tipo</span>
          <nav aria-label="Filtrar por tipo">
            <Link
              href={createFilterHref({ estado: selectedStatus })}
              className={!selectedType ? 'is-active' : ''}
              aria-current={!selectedType ? 'page' : undefined}
            >
              Todos
            </Link>
            {TYPE_FILTERS.map((type) => (
              <Link
                key={type}
                href={createFilterHref({
                  estado: selectedStatus,
                  tipo: type,
                })}
                className={selectedType === type ? 'is-active' : ''}
                aria-current={selectedType === type ? 'page' : undefined}
              >
                {formatTransferType(type)}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section
        className="hf-transfer-feed"
        aria-labelledby="transfer-feed-title"
      >
        <div className="hf-editorial-feed-heading">
          <div>
            <p className="hf-type-overline">Datos publicados</p>
            <h2 id="transfer-feed-title">Movimientos y rumores</h2>
          </div>
          <span>{movements.length}</span>
        </div>

        {movements.length ? (
          <div className="hf-transfer-grid">
            {movements.map((movement) => (
              <article key={movement.slug} className="hf-transfer-card">
                <header>
                  <span className={`is-${movement.status}`}>
                    {formatTransferStatus(movement.status)}
                  </span>
                  <time dateTime={movement.updatedAt}>
                    {formatEditorialDate(movement.updatedAt)}
                  </time>
                </header>
                <p>{formatTransferType(movement.type)}</p>
                <h3>{movement.playerName}</h3>
                <div>
                  <span>{movement.fromTeam}</span>
                  <span aria-hidden="true">→</span>
                  <strong>{movement.toTeam}</strong>
                </div>
                <p>{movement.summary}</p>
                <footer>
                  <Link href={`/mercado-de-pases/${movement.slug}`}>
                    Ver detalle
                  </Link>
                  <a
                    href={movement.sourceUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Fuente: {movement.sourceName}
                  </a>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="hf-transfer-empty">
            <span className="hf-type-data" aria-hidden="true">
              0
            </span>
            <div>
              <h3>
                {filtersActive
                  ? 'No hay movimientos con estos filtros'
                  : 'Todavía no hay movimientos verificados'}
              </h3>
              <p>
                {filtersActive
                  ? 'Probá otro estado o tipo. No completamos el resultado con operaciones que no coinciden.'
                  : 'No publicamos pases ficticios para llenar la pantalla. La sección queda lista para mostrar operaciones reales con su fuente y estado.'}
              </p>
              {filtersActive ? (
                <Link href="/mercado-de-pases">Limpiar filtros</Link>
              ) : guides[0] ? (
                <Link href={`/mercado-de-pases/${guides[0].slug}`}>
                  Conocer nuestro criterio editorial
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {guides.length ? (
        <section
          className="hf-editorial-feed"
          aria-labelledby="transfer-guides-title"
        >
          <div className="hf-editorial-feed-heading">
            <div>
              <p className="hf-type-overline">Transparencia</p>
              <h2 id="transfer-guides-title">Guías editoriales</h2>
            </div>
          </div>
          <div className="hf-editorial-card-grid">
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
