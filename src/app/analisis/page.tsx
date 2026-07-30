import EditorialArticleCard from '@/frontend/components/EditorialArticleCard'
import { getAllArticles } from '@/server/editorial/articles'
import { formatEditorialDate } from '@/shared/editorial-format'
import { buildSeoMetadata } from '@/shared/seo'

export const metadata = buildSeoMetadata({
  title: 'Análisis y guías de fútbol | Hay Fulbo',
  description:
    'Guías editoriales de Hay Fulbo para entender formatos, tablas, fixtures, estadísticas y competiciones principales.',
  path: '/analisis',
})

export default function AnalisisPage() {
  const articles = getAllArticles()
  const [leadArticle, ...secondaryArticles] = articles
  const categoryCount = new Set(articles.map((article) => article.category)).size

  return (
    <main className="hf-editorial-page is-analysis">
      <header className="hf-editorial-page-hero">
        <div>
          <p className="hf-type-overline">Entender el juego</p>
          <h1>Análisis</h1>
          <p>
            Guías propias para leer formatos, tablas, estadísticas y decisiones
            de producto sin mezclar explicación con datos oficiales.
          </p>
        </div>
        <dl>
          <div>
            <dt>Guías publicadas</dt>
            <dd className="hf-type-data">{articles.length}</dd>
          </div>
          <div>
            <dt>Temas</dt>
            <dd className="hf-type-data">{categoryCount}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>
              {articles[0]
                ? formatEditorialDate(articles[0].updatedAt)
                : 'Sin publicaciones'}
            </dd>
          </div>
        </dl>
      </header>

      {leadArticle ? (
        <section className="hf-editorial-feed" aria-labelledby="analysis-title">
          <div className="hf-editorial-feed-heading">
            <div>
              <p className="hf-type-overline">Biblioteca Hay Fulbo</p>
              <h2 id="analysis-title">Guías para ir más allá</h2>
            </div>
            <span>{articles.length} publicaciones</span>
          </div>
          <EditorialArticleCard
            article={{
              ...leadArticle,
              readingMinutes: Math.max(
                1,
                Math.ceil(leadArticle.wordCount / 220)
              ),
            }}
            href={`/analisis/${leadArticle.slug}`}
            actionLabel="Leer guía"
            featured
          />
          {secondaryArticles.length ? (
            <div className="hf-editorial-card-grid">
              {secondaryArticles.map((article) => (
                <EditorialArticleCard
                  key={article.slug}
                  article={{
                    ...article,
                    readingMinutes: Math.max(
                      1,
                      Math.ceil(article.wordCount / 220)
                    ),
                  }}
                  href={`/analisis/${article.slug}`}
                  actionLabel="Leer guía"
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="hf-editorial-empty">
          <span aria-hidden="true">00</span>
          <div>
            <h2>Todavía no hay guías publicadas</h2>
            <p>La biblioteca mostrará contenido cuando exista una fuente real.</p>
          </div>
        </section>
      )}
    </main>
  )
}
