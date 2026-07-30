import SafeImage from '@/frontend/components/SafeImage'
import { LeagueLogo, PlayerPhoto, TeamLogo } from '@/frontend/components/AssetImage'
import EntityNewsList from '@/frontend/components/entities/EntityNewsList'
import FavoriteTeamButton from '@/frontend/components/favorites/FavoriteTeamButton'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buildSeoMetadata } from '@/shared/seo'
import { getNewsArticles } from '@/content/editorial'

import {
  getTeamDetail,
  type TeamProfile,
  type TeamSquadPlayer,
} from '@/lib/api-football'
import { getRequestLocale } from '@/server/request-locale'
import {
  getTeamPageData,
  type TeamPageCompetition,
  type TeamPageMatch,
} from '@/server/team-page-data'
import { t } from '@/shared/i18n/locales'
import {
  getTeamSelectionFacts,
  type TeamInfoFact,
} from '@/shared/config/team-profile-extra'
import { translateCountryName } from '@/shared/utils/country-names'
import { matchesEntityContent } from '@/shared/utils/entity-content'
import { formatPlayerHeight } from '@/shared/utils/player-profile'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const teamId = Number(id)

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return buildSeoMetadata({
      title: 'Equipo no encontrado | Hay Fulbo',
      description: 'El equipo solicitado no está disponible en Hay Fulbo.',
      path: `/equipo/${id}`,
      noIndex: true,
    })
  }

  try {
    const data = await getTeamDetail(teamId, { allowApiEnrichment: false })
    const teamData = data.team as TeamProfile | null
    const team = teamData?.team
    const venue = teamData?.venue

    if (!team) {
      return buildSeoMetadata({
        title: 'Equipo no encontrado | Hay Fulbo',
        description: 'El equipo solicitado no está disponible en Hay Fulbo.',
        path: `/equipo/${id}`,
        noIndex: true,
      })
    }

    const venueText = venue?.name ? `, estadio ${venue.name}` : ''

    return buildSeoMetadata({
      title: `${team.name} | Plantel, Fixture y Estadísticas | Hay Fulbo`,
      description: `Conocé el plantel de ${team.name}, jugadores${venueText} y estadísticas del equipo en Hay Fulbo.`,
      path: `/equipo/${id}`,
    })
  } catch {
    return buildSeoMetadata({
      title: 'Equipo no disponible | Hay Fulbo',
      description: 'La ficha del equipo está temporalmente no disponible en Hay Fulbo.',
      path: `/equipo/${id}`,
      noIndex: true,
    })
  }
}

function formatCapacity(value?: number) {
  if (!value) return 'No disponible'
  return new Intl.NumberFormat('es-AR').format(value)
}

function normalizePlayerPosition(position?: string) {
  const normalized = (position || '').trim().toLowerCase()

  if (['goalkeeper', 'keeper', 'gk', 'g', 'arquero', 'portero'].includes(normalized)) {
    return 'Goalkeeper'
  }
  if (['defender', 'defence', 'defense', 'df', 'd', 'cb', 'lb', 'rb', 'defensor'].includes(normalized)) {
    return 'Defender'
  }
  if (['midfielder', 'midfield', 'mf', 'm', 'dm', 'cm', 'am', 'mediocampista', 'volante'].includes(normalized)) {
    return 'Midfielder'
  }
  if (['attacker', 'forward', 'fw', 'f', 'st', 'lw', 'rw', 'delantero'].includes(normalized)) {
    return 'Attacker'
  }

  return 'Other'
}

function translatePlayerPosition(position?: string) {
  const labels: Record<string, string> = {
    Goalkeeper: 'Arquero',
    Defender: 'Defensor',
    Midfielder: 'Mediocampista',
    Attacker: 'Delantero',
    Other: 'Posición no disponible',
  }

  return labels[normalizePlayerPosition(position)]
}

function abbreviateClubName(value?: string) {
  const name = value?.replace(/\s+/g, ' ').trim()
  if (!name) return null

  const replacements: Array<[RegExp, string]> = [
    [/^F[uú]tbol Club\s+/i, 'FC '],
    [/^Football Club\s+/i, 'FC '],
    [/^Club de F[uú]tbol\s+/i, 'CF '],
    [/^Club Atl[eé]tico\s+/i, 'CA '],
    [/^Athletic Club\s+/i, 'AC '],
    [/^Atl[eé]tico Club\s+/i, 'AC '],
    [/^Association Sportive\s+/i, 'AS '],
    [/^Associazione Calcio\s+/i, 'AC '],
    [/^Real Club Deportivo\s+/i, 'RCD '],
    [/^Sociedade Esportiva\s+/i, 'SE '],
    [/^Sporting Clube de\s+/i, 'SC '],
    [/^Sport Club\s+/i, 'SC '],
    [/^Club Deportivo\s+/i, 'CD '],
    [/^Unión Deportiva\s+/i, 'UD '],
    [/^Union Deportiva\s+/i, 'UD '],
  ]

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    name
  )
}

function groupPlayersByPosition(players: TeamSquadPlayer[]) {
  const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker', 'Other']
  const labels: Record<string, string> = {
    Goalkeeper: 'Arqueros',
    Defender: 'Defensores',
    Midfielder: 'Mediocampistas',
    Attacker: 'Delanteros',
    Other: 'Otros',
  }

  return order
    .map((position) => ({
      key: position,
      title: labels[position] || position,
      players: players.filter((player) => normalizePlayerPosition(player.position) === position),
    }))
    .filter((group) => group.players.length > 0)
}

function getEntityNews(entityName: string) {
  return getNewsArticles()
    .filter((article) => matchesEntityContent(entityName, article))
    .slice(0, 3)
}

function TeamInfoRow({
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

function PlayerCard({
  player,
  team,
  showExtendedInfo = false,
}: {
  player: TeamSquadPlayer
  team?: {
    id?: number
    name?: string
    logo?: string
  }
  showExtendedInfo?: boolean
}) {
  const height = showExtendedInfo ? formatPlayerHeight(player.height) : null
  const clubName = showExtendedInfo ? abbreviateClubName(player.clubName) : null
  const fullClubName = player.clubName?.trim()
  const playerPhoto = player.photo_url ?? player.photo ?? player.photoUrl ?? ''
  const href = player.id
    ? `/jugador/${player.id}?${new URLSearchParams({
        name: player.name || 'Jugador',
        photo: playerPhoto,
        teamId: team?.id ? String(team.id) : '',
        teamName: team?.name || '',
        teamLogo: team?.logo || '',
        number:
          player.number !== null && player.number !== undefined
            ? String(player.number)
            : '',
      }).toString()}`
    : null
  const cardClassName = 'hf-squad-player'

  const content = (
    <>
      <div className="hf-squad-player-photo">
        <PlayerPhoto
          player={player}
          src={player.photo_url ?? player.photo}
          alt={player.name || 'Jugador'}
          size={48}
          className="h-full w-full rounded-full object-cover"
          fallbackClassName="h-12 w-12 rounded-full"
          unoptimized
        />
      </div>

      <div className="hf-squad-player-copy">
        <p>
          {player.name || 'Jugador'}
        </p>
        <div>
          <span className="shrink-0">N° {player.number ?? '-'}</span>
          <span className="shrink-0">Edad {player.age ?? '-'}</span>
          <span className="shrink-0">{translatePlayerPosition(player.position)}</span>
          {height ? <span className="shrink-0">{height}</span> : null}
          {clubName ? (
            <span
              className="min-w-0 max-w-[11rem] truncate sm:max-w-[16rem]"
              title={fullClubName || clubName}
            >
              {clubName}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    )
  }

  return (
    <div className={cardClassName}>
      {content}
    </div>
  )
}

function SelectionFactsCard({
  title,
  items,
}: {
  title: string
  items: TeamInfoFact[]
}) {
  return (
    <section className="hf-entity-panel">
      <header className="hf-entity-panel-heading">
        <h2>{title}</h2>
      </header>
      <div className="hf-entity-info-list">
        {items.map((item) => (
          <TeamInfoRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  )
}

function TeamCompetitionsCard({
  competitions,
}: {
  competitions: TeamPageCompetition[]
}) {
  return (
    <section id="competiciones" className="hf-team-competitions">
      <header>
        <div>
          <p className="hf-type-overline">Actividad</p>
          <h2>Competiciones</h2>
        </div>
        <span>{competitions.length}</span>
      </header>

      {competitions.length ? (
        <div className="hf-team-competition-grid">
          {competitions.map((competition) => {
            const content = (
              <>
                <span className="hf-team-competition-logo">
                  <LeagueLogo
                    src={competition.logoUrl}
                    alt={competition.name}
                    size={36}
                    className="h-9 w-9 object-contain"
                    fallbackClassName="h-8 w-7"
                    unoptimized
                  />
                </span>
                <span>
                  <strong>{competition.name}</strong>
                  <small>{competition.country || 'Competición internacional'}</small>
                </span>
                {competition.href ? <span aria-hidden="true">→</span> : null}
              </>
            )

            return competition.href ? (
              <Link key={competition.id} href={competition.href}>
                {content}
              </Link>
            ) : (
              <div key={competition.id}>{content}</div>
            )
          })}
        </div>
      ) : (
        <div className="hf-competition-empty">
          No hay competiciones sincronizadas para este equipo.
        </div>
      )}
    </section>
  )
}

function formatMatchDate(value: string | null) {
  if (!value) return 'Fecha a confirmar'

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Fecha a confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

function getMatchStatus(match: TeamPageMatch) {
  if (['FT', 'AET', 'PEN'].includes(match.status)) return 'Final'
  if (['1H', '2H', 'HT', 'ET', 'LIVE'].includes(match.status)) return 'En vivo'
  if (match.status === 'PST') return 'Postergado'
  if (match.status === 'CANC') return 'Cancelado'

  return 'Programado'
}

function TeamMatchList({
  title,
  eyebrow,
  matches,
}: {
  title: string
  eyebrow: string
  matches: TeamPageMatch[]
}) {
  return (
    <section className="hf-entity-panel">
      <header className="hf-entity-panel-heading">
        <div>
          <p className="hf-type-overline">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{matches.length}</span>
      </header>

      {matches.length ? (
        <div className="hf-team-match-list">
          {matches.map((match) => (
            <Link key={match.id} href={`/partido/${match.id}`} className="hf-team-match-row">
              <div className="hf-team-match-meta">
                <span>{match.competition.name}</span>
                <small>{formatMatchDate(match.date)}</small>
              </div>
              <div className="hf-team-match-teams">
                <span>
                  {match.home.name}
                  <TeamLogo
                    src={match.home.logoUrl}
                    alt=""
                    size={22}
                    className="h-[22px] w-[22px] object-contain"
                    fallbackClassName="h-5 w-4"
                    unoptimized
                  />
                </span>
                <strong>
                  {match.homeScore !== null || match.awayScore !== null
                    ? `${match.homeScore ?? '-'} – ${match.awayScore ?? '-'}`
                    : 'vs'}
                </strong>
                <span>
                  <TeamLogo
                    src={match.away.logoUrl}
                    alt=""
                    size={22}
                    className="h-[22px] w-[22px] object-contain"
                    fallbackClassName="h-5 w-4"
                    unoptimized
                  />
                  {match.away.name}
                </span>
              </div>
              <span className={`hf-team-match-status is-${match.status.toLowerCase()}`}>
                {getMatchStatus(match)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="hf-competition-empty">
          No hay partidos sincronizados en este período.
        </div>
      )}
    </section>
  )
}

function TeamPerformanceCard({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getTeamPageData>>['summary']
}) {
  const items = [
    ['PJ', summary.played],
    ['G', summary.wins],
    ['E', summary.draws],
    ['P', summary.losses],
    ['GF', summary.goalsFor],
    ['GC', summary.goalsAgainst],
  ] as const

  return (
    <section className="hf-entity-panel">
      <header className="hf-entity-panel-heading">
        <div>
          <p className="hf-type-overline">Últimos 12 meses</p>
          <h2>Rendimiento</h2>
        </div>
      </header>
      {summary.played ? (
        <dl className="hf-team-performance">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="hf-competition-empty">
          No hay resultados suficientes para calcular el rendimiento.
        </div>
      )}
    </section>
  )
}

export default async function EquipoPage({ params }: PageProps) {
  const { id } = await params
  const locale = await getRequestLocale()
  const teamId = Number(id)
  const allowApiEnrichment =
    process.env.FOOTBALL_PUBLIC_READ_MODE !== 'cache-only' &&
    process.env.VERCEL_ENV !== 'preview'

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return (
      <main className="hf-state-page">
        <section className="hf-state-surface">
          <span className="hf-state-surface-icon" aria-hidden="true">?</span>
          <p className="hf-type-overline">Sin ficha</p>
          <h1>Equipo no encontrado</h1>
          <p>No existe información para este equipo.</p>
          <Link className="hf-button" href="/equipos">Buscar otro equipo</Link>
        </section>
      </main>
    )
  }

  let data: Awaited<ReturnType<typeof getTeamDetail>>
  let teamPageData: Awaited<ReturnType<typeof getTeamPageData>>

  try {
    ;[data, teamPageData] = await Promise.all([
      getTeamDetail(teamId, {
        allowApiEnrichment,
        deepPlayerProfileLimit: 8,
        persistApiEnrichment: false,
      }),
      getTeamPageData(teamId),
    ])
  } catch {
    const message = 'Datos temporalmente no disponibles. Intentá nuevamente en unos minutos.'

    return (
      <main className="hf-state-page">
        <section className="hf-state-surface">
          <span className="hf-state-surface-icon" aria-hidden="true">!</span>
          <p className="hf-type-overline">Error de datos</p>
          <h1>Equipo no disponible</h1>
          <p>{message}</p>
          <Link className="hf-button-secondary" href="/equipos">Volver a equipos</Link>
        </section>
      </main>
    )
  }

  const teamData = data.team as TeamProfile | null
  const team = teamData?.team
  const venue = teamData?.venue
  const squad = data.squad?.players || []
  const groupedSquad = groupPlayersByPosition(squad)

  if (!team) {
    return (
      <main className="hf-state-page">
        <section className="hf-state-surface">
          <span className="hf-state-surface-icon" aria-hidden="true">?</span>
          <p className="hf-type-overline">Sin ficha</p>
          <h1>Equipo no encontrado</h1>
          <p>No existe información para este equipo.</p>
          <Link className="hf-button" href="/equipos">Buscar otro equipo</Link>
        </section>
      </main>
    )
  }

  const selectionFacts = getTeamSelectionFacts(team.name)
  const isNationalTeam = Boolean(team.national || selectionFacts)
  const teamCountry = translateCountryName(
    team.country || (isNationalTeam ? team.name : undefined),
    locale
  )
  const showExtendedSquadInfo = Boolean(
    isNationalTeam ||
    squad.some((player) => player.height || player.clubName || player.clubLogoUrl)
  )
  const teamSummary = {
    id: team.id,
    name: team.name,
    logo: team.logo_url ?? team.logo ?? team.logoUrl,
  }
  const relatedNews = getEntityNews(team.name)

  return (
    <main className="hf-team-page" data-team-id={String(team.id || id)} data-national={isNationalTeam ? 'true' : 'false'}>
      <header className="hf-entity-hero">
        <div className="hf-entity-identity">
          <div className="hf-entity-mark">
            <TeamLogo
              team={team}
              src={team.logo_url ?? team.logo}
              alt={team.name}
              size={88}
              className="h-[88px] w-[88px] object-contain"
              fallbackClassName="h-16 w-14"
              priority
              unoptimized
            />
          </div>

          <div className="hf-entity-title">
            <p className="hf-type-overline">{isNationalTeam ? 'Selección' : 'Equipo'}</p>
            <h1>{team.name}</h1>
            <p>{teamCountry || t(locale, 'common.notAvailable')}</p>
          </div>
        </div>

        <div className="hf-entity-hero-side">
          <FavoriteTeamButton
            team={{
              id: String(team.id || id),
              name: team.name,
              logoUrl: team.logo_url ?? team.logo ?? team.logoUrl ?? null,
              country: teamCountry,
              href: `/equipo/${team.id || id}`,
            }}
          />
          <dl className="hf-entity-quick-facts">
            <div>
              <dt>Fundado</dt>
              <dd>{team.founded || '—'}</dd>
            </div>
            <div>
              <dt>Código</dt>
              <dd>{team.code || '—'}</dd>
            </div>
            <div>
              <dt>Estadio</dt>
              <dd>{venue?.name || 'No disponible'}</dd>
            </div>
          </dl>
        </div>
      </header>

      <nav className="hf-entity-nav" aria-label={`Secciones de ${team.name}`}>
        <a href="#competiciones">Competiciones</a>
        <a href="#partidos">Partidos</a>
        <a href="#plantel">Plantel</a>
        <a href="#ficha">Ficha</a>
      </nav>

      <TeamCompetitionsCard competitions={teamPageData.competitions} />

      <div className="hf-team-layout">
        <div className="hf-team-primary">
          <section id="partidos" className="hf-team-match-grid">
            <TeamMatchList
              title="Próximos partidos"
              eyebrow="Agenda"
              matches={teamPageData.upcomingMatches}
            />
            <TeamMatchList
              title="Últimos resultados"
              eyebrow="Forma reciente"
              matches={teamPageData.recentMatches}
            />
          </section>

          <section id="plantel" className="hf-entity-panel">
            <header className="hf-entity-panel-heading">
              <div>
                <p className="hf-type-overline">Integrantes</p>
                <h2>Plantel</h2>
              </div>
              <span>{squad.length} jugadores</span>
            </header>

            {groupedSquad.length ? (
              <div className="hf-squad-groups">
                {groupedSquad.map((group) => (
                  <section key={group.key}>
                    <header>
                      <span aria-hidden="true" />
                      <h3>{group.title}</h3>
                      <small>{group.players.length}</small>
                    </header>

                    <div className="hf-squad-grid">
                      {group.players.map((player) => (
                        <PlayerCard
                          key={player.id || `${group.key}-${player.name}`}
                          player={player}
                          team={teamSummary}
                          showExtendedInfo={showExtendedSquadInfo}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="hf-competition-empty">
                No hay plantel disponible para este equipo.
              </div>
            )}
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
              emptyMessage={`Todavía no hay noticias etiquetadas para ${team.name}.`}
            />
          </section>
        </div>

        <aside id="ficha" className="hf-team-aside">
          <TeamPerformanceCard summary={teamPageData.summary} />

          <section className="hf-entity-panel">
            <header className="hf-entity-panel-heading">
              <h2>Ficha</h2>
            </header>
            <div className="hf-entity-info-list">
              <TeamInfoRow label="País" value={teamCountry || t(locale, 'common.notAvailable')} />
              <TeamInfoRow label="Fundación" value={String(team.founded || 'No disponible')} />
              <TeamInfoRow label="Código" value={team.code || 'No disponible'} />
              <TeamInfoRow label="Estadio" value={venue?.name || 'No disponible'} />
              <TeamInfoRow
                label="Entrenador"
                value={teamPageData.coachName || 'No sincronizado'}
              />
              <TeamInfoRow label="Ciudad" value={venue?.city || 'No disponible'} />
              <TeamInfoRow label="Capacidad" value={formatCapacity(venue?.capacity)} />
              <TeamInfoRow label="Superficie" value={venue?.surface || 'No disponible'} />
            </div>
          </section>

          {venue?.image ? (
            <section className="hf-entity-panel">
              <header className="hf-entity-panel-heading">
                <h2>Estadio</h2>
              </header>
              <div className="hf-entity-media">
                <SafeImage
                  src={venue.image}
                  alt={venue.name || 'Estadio'}
                  imageType="venue"
                  width={600}
                  height={340}
                  className="h-auto w-full rounded-xl object-cover"
                  fallbackClassName="h-44 w-full rounded-xl"
                  unoptimized
                />
              </div>
            </section>
          ) : null}

          {selectionFacts ? (
            <>
              <SelectionFactsCard title="Datos en Mundiales" items={selectionFacts.worldCup} />
              <SelectionFactsCard title="Ranking y títulos" items={selectionFacts.titles} />
            </>
          ) : (
            <section className="hf-entity-panel">
              <header className="hf-entity-panel-heading">
                <h2>Palmarés y participaciones</h2>
              </header>
              <div className="hf-competition-empty">
                La fuente actual no ofrece un historial completo de títulos,
                participaciones y descensos para este club.
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}
