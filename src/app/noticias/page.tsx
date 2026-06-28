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
import { formatEditorialCategory } from '@/shared/editorial-format'
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
    <main className="min-w-0 space-y-5 text-white">
      <header className="hf-card hf-section-head rounded-2xl px-4 py-5 sm:px-5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7ff0b2]">
          Editorial
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
          Noticias
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
          Guías, análisis y actualidad del fútbol argentino e internacional con
          contenido propio de Hay Fulbo.
        </p>
      </header>

      {categories.length ? (
        <nav
          aria-label="Filtrar noticias por categoria"
          className="flex min-w-0 flex-wrap gap-2"
        >
          <Link
            href="/noticias"
            className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
              selectedCategory
                ? 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#70ff9d]/25 hover:text-white'
                : 'border-[#70ff9d]/30 bg-[#70ff9d]/12 text-white'
            }`}
            aria-current={!selectedCategory ? 'page' : undefined}
          >
            Todas
          </Link>
          {categories.map((category) => {
            const active = selectedCategory === category

            return (
              <Link
                key={category}
                href={`/noticias?categoria=${category}`}
                className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                  active
                    ? 'border-[#70ff9d]/30 bg-[#70ff9d]/12 text-white'
                    : 'border-white/10 bg-white/[0.035] text-[#c8d3cf] hover:border-[#70ff9d]/25 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {formatEditorialCategory(category)}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {articles.length ? (
        <section
          aria-label="Articulos disponibles"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {articles.map((article) => (
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
        </section>
      ) : (
        <section className="hf-card rounded-2xl p-5 text-sm leading-6 text-[#c8d3cf]">
          Todavía no hay noticias publicadas.
        </section>
      )}

      {!indexability.index ? (
        <p className="text-xs leading-5 text-[#83938d]">
          Esta seccion se mantiene fuera de indexacion hasta tener contenido
          editorial suficiente.
        </p>
      ) : null}
    </main>
  )
}
