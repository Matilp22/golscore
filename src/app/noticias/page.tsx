import Link from 'next/link'

import {
  getEditorialReadingMinutes,
  getEditorialWordCount,
  getNewsArticles,
  type EditorialCategory,
} from '@/content/editorial'
import EditorialArticleCard from '@/frontend/components/EditorialArticleCard'
import { getPublicPageIndexability } from '@/shared/content-quality'
import { buildSeoMetadata } from '@/shared/seo'

type NoticiasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export function generateMetadata() {
  const articles = getNewsArticles()
  const indexability = getPublicPageIndexability({
    path: '/noticias',
    kind: 'news',
    content: {
      editorialWordCount: articles.reduce(
        (sum, article) => sum + getEditorialWordCount(article),
        0
      ),
      hasMetadata: true,
      placeholderOnly: articles.length === 0,
    },
  })

  return buildSeoMetadata({
    title: 'Noticias de fútbol, análisis y actualidad | Hay Fulbo',
    description:
      'Últimas noticias, análisis y actualidad del fútbol argentino e internacional en Hay Fulbo.',
    path: '/noticias',
    noIndex: !indexability.index,
  })
}

const NEWS_LEAGUE_FILTERS: Array<{
  key: string
  label: string
  category: EditorialCategory
}> = [
  { key: 'liga-profesional', label: 'Liga Profesional', category: 'futbol-argentino' },
  { key: 'libertadores', label: 'Copa Libertadores', category: 'libertadores' },
  { key: 'champions', label: 'Champions League', category: 'champions' },
]

export default async function NoticiasPage({ searchParams }: NoticiasPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawLeague = Array.isArray(params.liga) ? params.liga[0] : params.liga
  const allArticles = getNewsArticles()
  const selectedLeague = NEWS_LEAGUE_FILTERS.find((filter) => filter.key === rawLeague)
  const articles = selectedLeague
    ? getNewsArticles(selectedLeague.category)
    : allArticles
  const [leadArticle, ...secondaryArticles] = articles
  const editorialWordCount = allArticles.reduce(
    (sum, article) => sum + getEditorialWordCount(article),
    0
  )
  const indexability = getPublicPageIndexability({
    path: '/noticias',
    kind: 'news',
    content: {
      editorialWordCount,
      hasMetadata: true,
    },
  })

  return (
    <main className="hf-editorial-page">
      <header className="hf-editorial-page-hero">
        <div>
          <p className="hf-type-overline">La conversación futbolera</p>
          <h1>Noticias</h1>
          <p>
            Contexto, análisis y actualidad para entender qué pasó y qué viene,
            con autoría y fuentes visibles.
          </p>
        </div>
      </header>

      <nav
        aria-label="Filtrar noticias por liga"
        className="hf-editorial-filters"
      >
        <Link
          href="/noticias"
          className={!selectedLeague ? 'is-active' : ''}
          aria-current={!selectedLeague ? 'page' : undefined}
        >
          Todas
          <span>{allArticles.length}</span>
        </Link>
        {NEWS_LEAGUE_FILTERS.map((filter) => {
          const active = selectedLeague?.key === filter.key
          const categoryCount = allArticles.filter(
            (article) => article.category === filter.category
          ).length

          return (
            <Link
              key={filter.key}
              href={`/noticias?liga=${filter.key}`}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              {filter.label}
              <span>{categoryCount}</span>
            </Link>
          )
        })}
      </nav>

      {leadArticle ? (
        <section
          className="hf-editorial-feed"
          aria-labelledby="editorial-feed-title"
        >
          <div className="hf-editorial-feed-heading">
            <div>
              <p className="hf-type-overline">
                {selectedLeague
                  ? selectedLeague.label
                  : 'Últimas publicaciones'}
              </p>
              <h2 id="editorial-feed-title">
                {selectedLeague ? 'Noticias de esta liga' : 'Para empezar'}
              </h2>
            </div>
            <span>
              {articles.length} {articles.length === 1 ? 'nota' : 'notas'}
            </span>
          </div>
          <EditorialArticleCard
            article={{
              ...leadArticle,
              readingMinutes: getEditorialReadingMinutes(leadArticle),
            }}
            href={`/noticias/${leadArticle.slug}`}
            actionLabel="Leer artículo"
            featured
          />
          {secondaryArticles.length ? (
            <div className="hf-editorial-card-grid">
              {secondaryArticles.map((article) => (
                <EditorialArticleCard
                  key={article.slug}
                  article={{
                    ...article,
                    readingMinutes: getEditorialReadingMinutes(article),
                  }}
                  href={`/noticias/${article.slug}`}
                  actionLabel="Leer artículo"
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="hf-editorial-empty">
          <div>
            <h2>No hay notas en esta sección</h2>
            <p>
              No completamos el espacio con contenido ficticio. Probá otra
              categoría o volvé a todas las noticias.
            </p>
            <Link href="/noticias">Ver todas las noticias</Link>
          </div>
        </section>
      )}

      {!indexability.index ? (
        <p className="hf-editorial-index-note">
          Esta sección se mantiene fuera de indexación hasta tener contenido
          editorial suficiente.
        </p>
      ) : null}
    </main>
  )
}
