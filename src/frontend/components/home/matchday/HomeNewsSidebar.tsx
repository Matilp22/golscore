import Link from 'next/link'

import SafeImage from '@/frontend/components/SafeImage'
import AppIcon from '@/frontend/components/navigation/AppIcon'
import { formatEditorialCategory } from '@/shared/editorial-format'

import type { HfHomeArticle } from '@/frontend/components/home/matchday/types'

function formatArticleDate(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Fecha por confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp))
}

export default function HomeNewsSidebar({
  articles,
}: {
  articles: HfHomeArticle[]
}) {
  return (
    <section className="hf-home-news-sidebar" aria-labelledby="home-sidebar-news">
      <header>
        <div>
          <span className="hf-type-overline">Último minuto</span>
          <h2 id="home-sidebar-news">Noticias destacadas</h2>
        </div>
        <Link href="/noticias" aria-label="Ver todas las noticias">
          <AppIcon name="chevronRight" />
        </Link>
      </header>

      {articles.length ? (
        <div className="hf-home-news-list">
          {articles.slice(0, 4).map((article, index) => {
            const image = article.heroImage ?? article.image

            return (
              <Link
                key={article.slug}
                href={`/noticias/${article.slug}`}
                className={index === 0 ? 'is-featured' : ''}
              >
                <div className="hf-home-news-image">
                  {image ? (
                    <SafeImage
                      src={image}
                      alt=""
                      imageType="video"
                      width={index === 0 ? 560 : 144}
                      height={index === 0 ? 280 : 104}
                    />
                  ) : (
                    <span aria-hidden="true">HF</span>
                  )}
                </div>
                <div className="hf-home-news-text">
                  <span>{formatEditorialCategory(article.category)}</span>
                  <h3>{article.title}</h3>
                  <time dateTime={article.updatedAt}>
                    {formatArticleDate(article.updatedAt)}
                  </time>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="hf-home-news-empty">
          Todavía no hay noticias publicadas.
        </p>
      )}
    </section>
  )
}
