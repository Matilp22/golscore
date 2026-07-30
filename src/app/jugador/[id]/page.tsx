import { PlayerPhoto } from '@/frontend/components/AssetImage'
import EntityNewsList from '@/frontend/components/entities/EntityNewsList'
import PlayerIncidentsList from '@/frontend/components/PlayerIncidentsList'
import { buildSeoMetadata } from '@/shared/seo'
import Link from 'next/link'
import { getNewsArticles } from '@/content/editorial'
import {
  getPlayerDetail,
  type LeaderStatType,
} from '@/lib/api-football'
import { TOURNAMENT_PAGE_CONFIGS } from '@/lib/tournament-pages'
import { translateCountryNameToSpanish } from '@/shared/utils/country-names'
import { matchesEntityContent } from '@/shared/utils/entity-content'
import { getTournamentExternalLeagueId } from '@/shared/utils/asset-urls'
import { formatPlayerHeight, formatPlayerWeight } from '@/shared/utils/player-profile'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    leagueId?: string
    season?: string
    statType?: string
    expectedCount?: string
    name?: string
    photo?: string
    teamId?: string
    teamName?: string
    teamLogo?: string
    number?: string
  }>
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const playerName = query.name || 'Jugador'

  return buildSeoMetadata({
    title: `${playerName} | Estadísticas de Jugador | Hay Fulbo`,
    description: `Ficha, estadísticas e incidencias de ${playerName} en Hay Fulbo.`,
    path: `/jugador/${id}`,
    noIndex: true,
  })
}

function isLeaderStatType(value?: string): value is LeaderStatType {
  return (
    value === 'scorers' ||
    value === 'assists' ||
    value === 'yellowCards' ||
    value === 'redCards'
  )
}

function formatDate(value?: string) {
  if (!value) return 'No disponible'

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'No disponible'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat('es-AR').format(value)
}

function formatPosition(value?: string | null) {
  if (!value) return 'No disponible'

  const normalized = value.trim().toLowerCase()

  if (normalized === 'goalkeeper') return 'Arquero'
  if (normalized === 'defender') return 'Defensor'
  if (normalized === 'midfielder') return 'Mediocampista'
  if (normalized === 'attacker') return 'Delantero'

  return value
}

function formatRating(value?: string | null) {
  return value || 'No disponible'
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="hf-entity-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SummaryStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getCompetitionHref(leagueId?: number) {
  if (!leagueId) return null

  const tournament = TOURNAMENT_PAGE_CONFIGS.find(
    (candidate) => getTournamentExternalLeagueId(candidate.key) === leagueId
  )

  return tournament ? `/liga/${tournament.key}` : null
}

export default async function JugadorPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const playerId = Number(id)
  const leagueId = Number(query.leagueId)
  const requestedSeason = Number(query.season)
  const season = Number.isFinite(requestedSeason) && requestedSeason > 0
    ? requestedSeason
    : new Date().getFullYear()
  const statType = isLeaderStatType(query.statType) ? query.statType : 'scorers'
  const expectedCount = Number(query.expectedCount) || undefined
  const fallbackName = query.name || 'Jugador'
  const fallbackPhoto = query.photo || undefined
  const fallbackTeamId = Number(query.teamId) || undefined
  const fallbackTeamName = query.teamName || undefined
  const fallbackTeamLogo = query.teamLogo || undefined
  const fallbackNumber = query.number || undefined
  const allowApiEnrichment =
    process.env.FOOTBALL_PUBLIC_READ_MODE !== 'cache-only' &&
    process.env.VERCEL_ENV !== 'preview'

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return (
      <main className="hf-state-page">
        <section className="hf-state-surface">
          <span className="hf-state-surface-icon" aria-hidden="true">?</span>
          <p className="hf-type-overline">Ficha incompleta</p>
          <h1>Jugador no disponible</h1>
          <p>Faltan datos para mostrar la ficha del jugador.</p>
          <Link className="hf-button-secondary" href="/">Volver al inicio</Link>
        </section>
      </main>
    )
  }

  try {
    const playerDetail = await getPlayerDetail(playerId, season, leagueId || undefined, {
      allowApiEnrichment,
      persistApiEnrichment: false,
    })

    const player = playerDetail?.player || {
      id: playerId,
      name: fallbackName,
      photo: fallbackPhoto,
    }
    const team = playerDetail?.team || {
      id: fallbackTeamId,
      name: fallbackTeamName,
      logo: fallbackTeamLogo,
    }
    const league = playerDetail?.league
    const leagueCountry = translateCountryNameToSpanish(league?.country)
    const birthCountry = translateCountryNameToSpanish(player.birthCountry)
    const statistics = playerDetail?.statistics || {
      appearances: 0,
      lineups: 0,
      minutes: 0,
      position: null,
      rating: null,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    }
    const competitionHref = getCompetitionHref(league?.id)
    const relatedNews = getNewsArticles()
      .filter((article) => matchesEntityContent(player.name, article))
      .slice(0, 3)

    return (
      <main className="hf-player-page" data-player-id={playerId}>
        <header className="hf-entity-hero">
          <div className="hf-entity-identity">
            <div className="hf-entity-mark is-player">
              <PlayerPhoto
                player={player}
                src={player.photo_url ?? player.photo}
                alt={player.name}
                size={96}
                className="h-24 w-24 rounded-full object-cover"
                fallbackClassName="h-24 w-24 rounded-full"
                priority
                unoptimized
              />
            </div>

            <div className="hf-entity-title">
              <p className="hf-type-overline">Jugador</p>
              <h1>{player.name}</h1>
              <p>
                {team?.id && team.name ? (
                  <Link href={`/equipo/${team.id}`}>{team.name}</Link>
                ) : (
                  team?.name || 'Sin equipo'
                )}
                {league?.name ? (
                  <>
                    {' · '}
                    {competitionHref ? (
                      <Link href={competitionHref}>{league.name}</Link>
                    ) : (
                      league.name
                    )}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <dl className="hf-player-summary">
            <SummaryStat label="Goles" value={statistics.goals} />
            <SummaryStat label="Asistencias" value={statistics.assists} />
            <SummaryStat
              label="Tarjetas"
              value={`${statistics.yellowCards}/${statistics.redCards}`}
            />
          </dl>
        </header>

        <nav className="hf-entity-nav" aria-label={`Secciones de ${player.name}`}>
          <a href="#temporada">Temporada</a>
          <a href="#partidos">Partidos</a>
          <a href="#ficha">Ficha</a>
        </nav>

        <div className="hf-player-layout">
          <div className="hf-player-primary">
            <section id="temporada" className="hf-entity-panel">
              <header className="hf-entity-panel-heading">
                <div>
                  <p className="hf-type-overline">{season}</p>
                  <h2>Rendimiento de temporada</h2>
                </div>
                {competitionHref && league?.name ? (
                  <Link href={competitionHref}>Ver competencia →</Link>
                ) : null}
              </header>
              <dl className="hf-player-stat-grid">
                <div><dt>Partidos</dt><dd>{statistics.appearances}</dd></div>
                <div><dt>Titular</dt><dd>{statistics.lineups}</dd></div>
                <div><dt>Minutos</dt><dd>{formatMinutes(statistics.minutes)}</dd></div>
                <div><dt>Posición</dt><dd>{formatPosition(statistics.position)}</dd></div>
                <div><dt>Valoración</dt><dd>{formatRating(statistics.rating)}</dd></div>
                <div><dt>Competencia</dt><dd>{league?.name || 'No disponible'}</dd></div>
              </dl>
            </section>

            <section id="partidos">
              <PlayerIncidentsList
                leagueId={leagueId || undefined}
                season={season}
                playerId={playerId}
                playerName={fallbackName}
                teamId={team?.id}
                expectedCount={expectedCount}
                tournamentName={league?.name}
                statType={statType}
              />
            </section>

            <section className="hf-state-inline">
              <strong>Trayectoria no sincronizada</strong>
              <p>La fuente actual todavía no ofrece un historial completo de clubes para esta ficha.</p>
            </section>

            <section className="hf-entity-panel">
              <header className="hf-entity-panel-heading">
                <div>
                  <p className="hf-type-overline">Editorial</p>
                  <h2>Noticias relacionadas</h2>
                </div>
                <Link href="/noticias">Ver noticias →</Link>
              </header>
              <EntityNewsList
                articles={relatedNews}
                emptyMessage={`Todavía no hay noticias etiquetadas para ${player.name}.`}
              />
            </section>
          </div>

          <aside id="ficha" className="hf-player-aside">
            <section className="hf-entity-panel">
              <header className="hf-entity-panel-heading">
                <h2>Ficha personal</h2>
              </header>
              <div className="hf-entity-info-list">
                <InfoRow label="Edad" value={String(player.age || 'No disponible')} />
                <InfoRow label="Dorsal" value={fallbackNumber || 'No disponible'} />
                <InfoRow
                  label="Nacionalidad"
                  value={translateCountryNameToSpanish(player.nationality) || 'No disponible'}
                />
                <InfoRow label="Nacimiento" value={formatDate(player.birthDate)} />
                <InfoRow
                  label="Lugar"
                  value={
                    [player.birthPlace, birthCountry].filter(Boolean).join(', ') ||
                    'No disponible'
                  }
                />
                <InfoRow
                  label="Altura"
                  value={formatPlayerHeight(player.height) || 'No disponible'}
                />
                <InfoRow
                  label="Peso"
                  value={formatPlayerWeight(player.weight) || 'No disponible'}
                />
                <InfoRow label="Lesionado" value={player.injured ? 'Sí' : 'No'} />
                <InfoRow label="País de liga" value={leagueCountry || 'No disponible'} />
              </div>
            </section>
          </aside>
        </div>
      </main>
    )
  } catch {
    const message = 'Datos temporalmente no disponibles. Intentá nuevamente en unos minutos.'

    return (
      <main className="hf-state-page">
        <section className="hf-state-surface">
          <span className="hf-state-surface-icon" aria-hidden="true">!</span>
          <p className="hf-type-overline">Error de datos</p>
          <h1>Jugador no disponible</h1>
          <p>{message}</p>
          <Link className="hf-button-secondary" href="/">Volver al inicio</Link>
        </section>
      </main>
    )
  }
}
