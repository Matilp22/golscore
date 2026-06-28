import EditorialArticleCard from '@/frontend/components/EditorialArticleCard'
import { getAllArticles } from '@/server/editorial/articles'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Analisis y guias de futbol | Hay Fulbo',
  description:
    'Guias editoriales de Hay Fulbo para entender formatos, tablas, fixtures, estadisticas y competiciones principales.',
  path: '/analisis',
})

export default function AnalisisPage() {
  const articles = getAllArticles()

  return (
    <main className="min-w-0 space-y-4 text-white">
      <header className="hf-hero overflow-hidden rounded-3xl px-4 py-5 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
          Editorial
        </p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Analisis y guias</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
          Explicaciones propias sobre formatos de competicion, lectura de tablas,
          fixtures, estadisticas y metodologia de cobertura.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        {articles.map((article) => (
          <EditorialArticleCard
            key={article.slug}
            article={article}
            href={`/analisis/${article.slug}`}
            actionLabel="Leer guia"
          />
        ))}
      </section>
    </main>
  )
}
