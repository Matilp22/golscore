import Link from 'next/link'

import { LeagueLogo } from '@/frontend/components/AssetImage'
import AppIcon, {
  type AppIconName,
} from '@/frontend/components/navigation/AppIcon'
import { formatEditorialCategory } from '@/shared/editorial-format'

import type {
  HfHomeArticle,
  HfHomeCompetition,
} from '@/frontend/components/home/matchday/types'

const QUICK_LINKS: Array<{
  label: string
  description: string
  href: string
  icon: AppIconName
}> = [
  {
    label: 'Competiciones',
    description: 'Ligas, copas y torneos',
    href: '/competiciones',
    icon: 'tournament',
  },
  {
    label: 'Tablas',
    description: 'Posiciones y promedios',
    href: '/tablas',
    icon: 'stats',
  },
  {
    label: 'Prode',
    description: 'Pronosticá y competí',
    href: '/prode',
    icon: 'prode',
  },
  {
    label: 'Mi Torneito',
    description: 'Tu torneo, en un solo lugar',
    href: '/mi-torneito',
    icon: 'tournament',
  },
]

function SectionHeading({
  id,
  eyebrow,
  title,
  href,
  action,
}: {
  id: string
  eyebrow: string
  title: string
  href?: string
  action?: string
}) {
  return (
    <header className="hf-matchday-discovery-heading">
      <div>
        <span className="hf-type-overline">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {href && action ? (
        <Link href={href}>
          {action}
          <AppIcon name="chevronRight" />
        </Link>
      ) : null}
    </header>
  )
}

function formatArticleDate(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Fecha por confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp))
}

export default function HomeDiscovery({
  competitions,
  articles,
  showNews = true,
}: {
  competitions: HfHomeCompetition[]
  articles: HfHomeArticle[]
  showNews?: boolean
}) {
  return (
    <div className="hf-matchday-discovery">
      <section aria-labelledby="home-competitions-title">
        <SectionHeading
          id="home-competitions-title"
          eyebrow="Seguí el torneo"
          title="Competiciones de la jornada"
          href="/competiciones"
          action="Ver todas"
        />

        {competitions.length ? (
          <div className="hf-matchday-competition-grid">
            {competitions.slice(0, 8).map((competition) => {
              const content = (
                <>
                  <LeagueLogo
                    src={competition.logo}
                    alt=""
                    size={42}
                  />
                  <span>
                    <strong>{competition.title}</strong>
                    <small>
                      {competition.matches.length}{' '}
                      {competition.matches.length === 1
                        ? 'partido'
                        : 'partidos'}
                    </small>
                  </span>
                  <AppIcon name="chevronRight" />
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
        ) : (
          <div className="hf-matchday-discovery-empty">
            No hay competiciones para esta jornada.
          </div>
        )}
      </section>

      <section aria-labelledby="home-quick-title">
        <SectionHeading
          id="home-quick-title"
          eyebrow="Atajos"
          title="Entrá directo"
        />
        <div className="hf-matchday-quick-grid">
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>
              <span aria-hidden="true">
                <AppIcon name={item.icon} />
              </span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </Link>
          ))}
        </div>
      </section>

      {showNews ? (
        <section aria-labelledby="home-news-title">
          <SectionHeading
            id="home-news-title"
            eyebrow="Historias y contexto"
            title="Noticias"
            href="/noticias"
            action="Ver portada"
          />

          {articles.length ? (
            <div className="hf-matchday-news-grid">
              {articles.slice(0, 4).map((article, index) => {
                const image = article.heroImage ?? article.image

                return (
                  <Link
                    key={article.slug}
                    href={`/noticias/${article.slug}`}
                    className={index === 0 ? 'is-featured' : ''}
                  >
                    <div className="hf-matchday-news-media">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">HF</span>
                      )}
                    </div>
                    <div className="hf-matchday-news-copy">
                      <span>{formatEditorialCategory(article.category)}</span>
                      <h3>{article.title}</h3>
                      <p>{article.summary}</p>
                      <time dateTime={article.updatedAt}>
                        {formatArticleDate(article.updatedAt)}
                      </time>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="hf-matchday-discovery-empty">
              Todavía no hay noticias publicadas.
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
