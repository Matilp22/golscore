import Link from 'next/link'

import { LeagueLogo } from '@/frontend/components/AssetImage'
import SafeImage from '@/frontend/components/SafeImage'
import { formatEditorialCategory } from '@/shared/editorial-format'

import type {
  HfHomeArticle,
  HfHomeCompetition,
} from '@/frontend/components/home/matchday/types'

const DESTINATIONS = [
  { href: '/liga/selecciones-mundial', index: '01', label: 'Mundial 2026' },
  { href: '/tablas', index: '02', label: 'Tablas' },
  { href: '/prode', index: '03', label: 'Prode' },
  { href: '/mi-torneito', index: '04', label: 'Mi Torneito' },
]

function formatDate(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Fecha por confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp))
}

export default function HomePulseEditorial({
  articles,
  competitions,
}: {
  articles: HfHomeArticle[]
  competitions: HfHomeCompetition[]
}) {
  return (
    <div className="hf-stream-after">
      <section className="hf-stream-news" aria-labelledby="stream-news-title">
        <header>
          <div>
            <span>Últimas noticias</span>
            <h2 id="stream-news-title">Después del partido</h2>
          </div>
          <Link href="/noticias">Ver todas</Link>
        </header>

        {articles.length ? (
          <div className="hf-stream-news-list">
            {articles.slice(0, 5).map((article) => (
              <article key={article.slug}>
                {article.heroImage || article.image ? (
                  <Link
                    href={`/noticias/${article.slug}`}
                    className="hf-stream-news-image"
                    aria-label={`Leer ${article.title}`}
                  >
                    <SafeImage
                      src={article.heroImage ?? article.image}
                      alt=""
                      imageType="video"
                      fill
                      sizes="88px"
                    />
                  </Link>
                ) : (
                  <div className="hf-stream-news-image is-empty" aria-hidden="true">
                    HF
                  </div>
                )}
                <div>
                  <p>
                    <span>{formatEditorialCategory(article.category)}</span>
                    <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
                  </p>
                  <h3>
                    <Link href={`/noticias/${article.slug}`}>{article.title}</Link>
                  </h3>
                </div>
                <Link
                  href={`/noticias/${article.slug}`}
                  className="hf-stream-news-arrow"
                  aria-label={`Leer ${article.title}`}
                >
                  ›
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="hf-stream-news-empty">Todavía no hay noticias publicadas.</p>
        )}
      </section>

      <section
        className="hf-stream-competition-index"
        aria-labelledby="stream-competition-index-title"
      >
        <header>
          <span>Torneos de hoy</span>
          <h2 id="stream-competition-index-title">Competiciones</h2>
        </header>
        <div>
          {competitions.slice(0, 8).map((competition) => {
            const content = (
              <>
                <LeagueLogo src={competition.logo} alt="" size={28} />
                <strong>{competition.title}</strong>
                <small>{competition.matches.length}</small>
                <i aria-hidden="true">›</i>
              </>
            )

            return competition.href ? (
              <Link key={competition.key} href={competition.href}>
                {content}
              </Link>
            ) : (
              <div key={competition.key}>{content}</div>
            )
          })}
        </div>
      </section>

      <nav className="hf-stream-shortcuts" aria-label="Accesos destacados">
        {DESTINATIONS.map((item) => (
          <Link key={item.href} href={item.href}>
            <span>{item.index}</span>
            <strong>{item.label}</strong>
            <i aria-hidden="true">↗</i>
          </Link>
        ))}
      </nav>
    </div>
  )
}
