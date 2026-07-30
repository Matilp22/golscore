import Link from 'next/link'
import type { Metadata } from 'next'

import { TeamLogo } from '@/frontend/components/AssetImage'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import { getFootballPublicReadMode } from '@/server/football-public-read-mode'
import { runWithFootballApiReadAudit } from '@/server/football-public-read-guard'
import {
  buildMatchHistoryViewModel,
  type MatchHistoryItem,
  type MatchHistoryTeam,
} from '@/server/match-history'
import { buildSeoMetadata } from '@/shared/seo'
import { formatMatchDateTimeArgentina } from '@/shared/utils/argentina-time'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return buildSeoMetadata({
    title: 'Historial del partido | Hay Fulbo',
    description:
      'Historial de enfrentamientos entre selecciones y equipos en Hay Fulbo.',
    path: `/partido/${id}/historial`,
  })
}

function formatHistoryDate(date: string | null) {
  return date ? formatMatchDateTimeArgentina(date) : 'Fecha no disponible'
}

function TeamIdentity({
  team,
  align = 'start',
}: {
  team: MatchHistoryTeam
  align?: 'start' | 'end'
}) {
  const content = (
    <>
      {align === 'start' ? (
        <TeamLogo
          src={team.logoUrl}
          alt={team.name}
          size={38}
          className="h-10 w-10 object-contain"
          fallbackClassName="h-8 w-7"
          unoptimized
        />
      ) : null}
      <span>{team.name}</span>
      {align === 'end' ? (
        <TeamLogo
          src={team.logoUrl}
          alt={team.name}
          size={38}
          className="h-10 w-10 object-contain"
          fallbackClassName="h-8 w-7"
          unoptimized
        />
      ) : null}
    </>
  )

  if (team.externalId) {
    return (
      <Link
        href={`/equipo/${team.externalId}`}
        className={`hf-history-team is-${align}`}
      >
        {content}
      </Link>
    )
  }

  return <div className={`hf-history-team is-${align}`}>{content}</div>
}

function HistoryMatchRow({ item }: { item: MatchHistoryItem }) {
  const content = (
    <>
      <div className="hf-history-match-meta">
        <time dateTime={item.date ?? undefined}>
          {formatHistoryDate(item.date)}
        </time>
        <span>{item.status ?? 'Sin estado confirmado'}</span>
      </div>

      <div className="hf-history-match-score">
        <div>
          <TeamLogo
            src={item.homeTeam.logoUrl}
            alt={item.homeTeam.name}
            size={24}
            className="h-6 w-6 object-contain"
            fallbackClassName="h-5 w-4"
            unoptimized
          />
          <span>{item.homeTeam.name}</span>
        </div>
        <strong>{item.scoreLabel}</strong>
        <div>
          <TeamLogo
            src={item.awayTeam.logoUrl}
            alt={item.awayTeam.name}
            size={24}
            className="h-6 w-6 object-contain"
            fallbackClassName="h-5 w-4"
            unoptimized
          />
          <span>{item.awayTeam.name}</span>
        </div>
      </div>

      <div className="hf-history-match-competition">
        <strong>{item.competition}</strong>
        <span>{item.stage}</span>
      </div>
    </>
  )

  return item.externalId ? (
    <Link
      href={`/partido/${item.externalId}`}
      className="hf-history-match"
      aria-label={`${item.homeTeam.name} ${item.scoreLabel} ${item.awayTeam.name}`}
    >
      {content}
    </Link>
  ) : (
    <article className="hf-history-match">{content}</article>
  )
}

export default async function MatchHistoryPage({ params }: PageProps) {
  const { id } = await params
  let history: Awaited<ReturnType<typeof buildMatchHistoryViewModel>> | null =
    null

  try {
    history = (
      await runWithFootballApiReadAudit(
        {
          route: 'match-history',
          cacheOnly:
            getFootballPublicReadMode('match-detail') === 'cache-only',
        },
        () => buildMatchHistoryViewModel(id)
      )
    ).result
  } catch {
    history = null
  }

  if (!history) {
    return (
      <main className="hf-history-page">
        <section className="hf-history-unavailable" role="alert">
          <p className="hf-type-overline">Historial</p>
          <h1>No pudimos cargar estos enfrentamientos</h1>
          <p>
            El partido sigue disponible. Volvé a intentarlo más tarde para
            consultar los cruces anteriores.
          </p>
          <Link href={`/partido/${id}`}>Volver al partido</Link>
        </section>
      </main>
    )
  }

  const historyShareId = `match-history-card-${id}`
  const historyShareTitle = `${history.homeTeam.name} vs ${history.awayTeam.name} | Historial Hay Fulbo`

  return (
    <main className="hf-history-page" data-match-history-page="true">
      <nav className="hf-history-breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/partido/${id}`}>Partido</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Historial</span>
      </nav>

      <header className="hf-history-hero">
        <div className="hf-history-hero-copy">
          <p className="hf-type-overline">Enfrentamientos directos</p>
          <h1>
            {history.homeTeam.name} vs {history.awayTeam.name}
          </h1>
          <p>
            Copas, eliminatorias y amistosos registrados entre ambos equipos.
          </p>
        </div>

        <div className="hf-history-versus" aria-label="Equipos">
          <TeamIdentity team={history.homeTeam} align="end" />
          <span>VS</span>
          <TeamIdentity team={history.awayTeam} />
        </div>

        <Link href={`/partido/${id}`} className="hf-button-secondary">
          Volver al partido
        </Link>
      </header>

      <dl className="hf-history-summary" aria-label="Resumen del historial">
        <div>
          <dt>Partidos con resultado</dt>
          <dd>{history.summary.total}</dd>
        </div>
        <div>
          <dt>Ganó {history.homeTeam.name}</dt>
          <dd>{history.summary.homePerspectiveWins}</dd>
        </div>
        <div>
          <dt>Empates</dt>
          <dd>{history.summary.draws}</dd>
        </div>
        <div>
          <dt>Ganó {history.awayTeam.name}</dt>
          <dd>{history.summary.awayPerspectiveWins}</dd>
        </div>
        <div>
          <dt>Goles</dt>
          <dd>
            {history.summary.homePerspectiveGoals}
            <span aria-hidden="true">–</span>
            {history.summary.awayPerspectiveGoals}
          </dd>
        </div>
      </dl>

      {history.warnings.length ? (
        <p className="hf-history-notice" role="note">
          El historial puede estar incompleto mientras se actualizan algunas
          fuentes.
        </p>
      ) : null}

      <section
        id={historyShareId}
        className="hf-history-list"
        aria-labelledby="history-list-title"
      >
        <header>
          <div>
            <p className="hf-type-overline">Archivo de partidos</p>
            <h2 id="history-list-title">Enfrentamientos</h2>
          </div>
          <ShareCardButton
            targetId={historyShareId}
            fileName={`hay-fulbo-historial-${id}.png`}
            title={historyShareTitle}
            text={`Historial: ${history.homeTeam.name} vs ${history.awayTeam.name}`}
            url={`/partido/${id}/historial`}
          />
        </header>

        {history.items.length ? (
          <div>
            {history.items.map((item) => (
              <HistoryMatchRow
                key={`${item.id}-${item.externalId ?? 'local'}`}
                item={item}
              />
            ))}
          </div>
        ) : (
          <div className="hf-history-empty">
            <strong>Todavía no hay cruces anteriores registrados</strong>
            <p>
              Mostramos este estado sin completar el historial con partidos
              estimados.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
