import Link from 'next/link'

import {
  getEditorialCategories,
  getEditorialReadingMinutes,
  getEditorialWordCount,
  getNewsArticles,
  type EditorialCategory,
} from '@/content/editorial'
import EditorialArticleCard from '@/frontend/components/EditorialArticleCard'
import { getPublicPageIndexability } from '@/shared/content-quality'
import {
  formatEditorialCategory,
  formatEditorialDate,
} from '@/shared/editorial-format'
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

function isEditorialCategory(value: string, categories: EditorialCategory[]) {
  return categories.includes(value as EditorialCategory)
}

export default async function NoticiasPage({ searchParams }: NoticiasPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawCategory = Array.isArray(params.categoria)
    ? params.categoria[0]
    : params.categoria
  const allArticles = getNewsArticles()
  const categories = getEditorialCategories(allArticles)
  const selectedCategory =
    rawCategory && isEditorialCategory(rawCategory, categories)
      ? (rawCategory as EditorialCategory)
      : undefined
  const articles = selectedCategory
    ? getNewsArticles(selectedCategory)
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
        <dl>
          <div>
            <dt>Notas publicadas</dt>
            <dd className="hf-type-data">{allArticles.length}</dd>
          </div>
          <div>
            <dt>Secciones</dt>
            <dd className="hf-type-data">{categories.length}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>
              {allArticles[0]
                ? formatEditorialDate(allArticles[0].updatedAt)
                : 'Sin publicaciones'}
            </dd>
          </div>
        </dl>
      </header>

      <nav
        aria-label="Filtrar noticias por categoría"
        className="hf-editorial-filters"
      >
        <Link
          href="/noticias"
          className={!selectedCategory ? 'is-active' : ''}
          aria-current={!selectedCategory ? 'page' : undefined}
        >
          Todas
          <span>{allArticles.length}</span>
        </Link>
        {categories.map((category) => {
          const active = selectedCategory === category
          const categoryCount = allArticles.filter(
            (article) => article.category === category
          ).length

          return (
            <Link
              key={category}
              href={`/noticias?categoria=${category}`}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              {formatEditorialCategory(category)}
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
                {selectedCategory
                  ? formatEditorialCategory(selectedCategory)
                  : 'Últimas publicaciones'}
              </p>
              <h2 id="editorial-feed-title">
                {selectedCategory ? 'En esta sección' : 'Para empezar'}
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
          <span aria-hidden="true">00</span>
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
