import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { getEditorialReadingMinutes, getNewsArticles } from '@/content/editorial'
import { TeamLogo } from '@/frontend/components/AssetImage'
import CompetitionSectionNav from '@/frontend/components/competition/CompetitionSectionNav'
import MatchReminderButton from '@/frontend/components/matches/MatchReminderButton'
import type {
  LeagueFixtureSummary,
  LeagueStandingGroup,
} from '@/lib/api-football'
import {
  formatMatchTimeArgentina,
  getArgentinaDateISO,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { translateCountryName } from '@/shared/utils/country-names'
import {
  formatMatchScoreWithPenalties,
  formatMatchStatusUnderScore,
  hasPenaltyShootoutScore,
} from '@/shared/utils/match-display'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import type { AppLocale } from '@/shared/i18n/locales'

type WorldCupRedesignProps = {
  title: string
  subtitle: string
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
  locale: AppLocale
  errorMessage?: string | null
  hasTournamentData: boolean
  bracketSection?: ReactNode
  groupStageSection?: ReactNode
  leaderStatsSection?: ReactNode
}

type FixtureSection = {
  key: 'live' | 'upcoming' | 'finished' | 'special'
  title: string
  description: string
  fixtures: LeagueFixtureSummary[]
}

const WORLD_CUP_TROPHY_SRC =
  '/brand/competitions/world-cup-trophy-transparent.png'

const WORLD_CUP_VENUES = [
  {
    country: 'México',
    venues: [
      ['Estadio Azteca', 'Ciudad de México'],
      ['Estadio Guadalajara', 'Guadalajara'],
      ['Estadio Monterrey', 'Monterrey'],
    ],
  },
  {
    country: 'Canadá',
    venues: [
      ['BC Place', 'Vancouver'],
      ['Toronto Stadium', 'Toronto'],
    ],
  },
  {
    country: 'Estados Unidos',
    venues: [
      ['New York New Jersey Stadium', 'Nueva York / Nueva Jersey'],
      ['Dallas Stadium', 'Dallas'],
      ['Los Angeles Stadium', 'Los Ángeles'],
      ['Miami Stadium', 'Miami'],
      ['Boston Stadium', 'Boston'],
      ['Houston Stadium', 'Houston'],
      ['Philadelphia Stadium', 'Filadelfia'],
      ['Seattle Stadium', 'Seattle'],
      ['San Francisco Bay Area Stadium', 'Área de la Bahía'],
      ['Atlanta Stadium', 'Atlanta'],
      ['Kansas City Stadium', 'Kansas City'],
    ],
  },
] as const

const WORLD_CUP_HISTORY = [
  ['1930', 'Uruguay', 'Uruguay'],
  ['1934', 'Italia', 'Italia'],
  ['1938', 'Francia', 'Italia'],
  ['1950', 'Brasil', 'Uruguay'],
  ['1954', 'Suiza', 'Alemania Federal'],
  ['1958', 'Suecia', 'Brasil'],
  ['1962', 'Chile', 'Brasil'],
  ['1966', 'Inglaterra', 'Inglaterra'],
  ['1970', 'México', 'Brasil'],
  ['1974', 'Alemania Federal', 'Alemania Federal'],
  ['1978', 'Argentina', 'Argentina'],
  ['1982', 'España', 'Italia'],
  ['1986', 'México', 'Argentina'],
  ['1990', 'Italia', 'Alemania Federal'],
  ['1994', 'Estados Unidos', 'Brasil'],
  ['1998', 'Francia', 'Francia'],
  ['2002', 'Corea del Sur / Japón', 'Brasil'],
  ['2006', 'Alemania', 'Italia'],
  ['2010', 'Sudáfrica', 'España'],
  ['2014', 'Brasil', 'Alemania'],
  ['2018', 'Rusia', 'Francia'],
  ['2022', 'Qatar', 'Argentina'],
] as const

function getFixtureTimestamp(fixture: Pick<LeagueFixtureSummary, 'date'>) {
  if (!fixture.date) return Number.MAX_SAFE_INTEGER

  const timestamp = toArgentinaDate(fixture.date).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function sortFixtures(fixtures: LeagueFixtureSummary[]) {
  return [...fixtures].sort((a, b) => {
    const dateDifference = getFixtureTimestamp(a) - getFixtureTimestamp(b)
    if (dateDifference !== 0) return dateDifference

    return String(a.id).localeCompare(String(b.id), 'es-AR', { numeric: true })
  })
}

function getTeamName(name: string, locale: AppLocale) {
  return translateCountryName(name, locale) || name
}

function getMatchScore(fixture: LeagueFixtureSummary) {
  if (fixture.goalsHome === null || fixture.goalsAway === null) return null

  return formatMatchScoreWithPenalties({
    goalsHome: fixture.goalsHome,
    goalsAway: fixture.goalsAway,
    homePenaltyScore: fixture.homePenaltyScore,
    awayPenaltyScore: fixture.awayPenaltyScore,
  })
}

function getStatusLabel(fixture: LeagueFixtureSummary) {
  if (isLiveStatus(fixture.statusShort)) {
    return fixture.minute ? `En vivo · ${fixture.minute}'` : 'En vivo'
  }
  if (isFinishedStatus(fixture.statusShort)) return 'Finalizado'
  if (isUpcomingStatus(fixture.statusShort)) return 'Programado'
  if (isPostponedStatus(fixture.statusShort)) return 'Postergado'

  return formatMatchStatusUnderScore({
    statusShort: fixture.statusShort,
    minute: fixture.minute,
    date: fixture.date,
  })
}

function getFixtureDateLabel(fixture: LeagueFixtureSummary) {
  if (!fixture.date) return 'Fecha y hora a confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(toArgentinaDate(fixture.date))
}

function getFixtureSections(fixtures: LeagueFixtureSummary[]): FixtureSection[] {
  const ordered = sortFixtures(fixtures)
  const live = ordered.filter((fixture) => isLiveStatus(fixture.statusShort))
  const upcoming = ordered.filter((fixture) => isUpcomingStatus(fixture.statusShort))
  const finished = [...ordered]
    .filter((fixture) => isFinishedStatus(fixture.statusShort))
    .reverse()
  const special = ordered.filter(
    (fixture) =>
      !isLiveStatus(fixture.statusShort) &&
      !isUpcomingStatus(fixture.statusShort) &&
      !isFinishedStatus(fixture.statusShort)
  )

  return [
    {
      key: 'live',
      title: 'Ahora',
      description: 'Partidos que se están jugando.',
      fixtures: live,
    },
    {
      key: 'upcoming',
      title: 'Próximos partidos',
      description: 'Agenda completa en horario de Argentina.',
      fixtures: upcoming,
    },
    {
      key: 'finished',
      title: 'Resultados',
      description: 'Últimos partidos finalizados, del más reciente al más antiguo.',
      fixtures: finished,
    },
    {
      key: 'special',
      title: 'Otros estados',
      description: 'Partidos postergados, suspendidos o con estado especial.',
      fixtures: special,
    },
  ]
}

function getFeaturedFixture(fixtures: LeagueFixtureSummary[]) {
  const ordered = sortFixtures(fixtures)
  const today = getArgentinaTodayISO()

  return (
    ordered.find((fixture) => isLiveStatus(fixture.statusShort)) ??
    ordered.find(
      (fixture) =>
        fixture.date &&
        getArgentinaDateISO(fixture.date) === today &&
        !isFinishedStatus(fixture.statusShort)
    ) ??
    ordered.find((fixture) => isUpcomingStatus(fixture.statusShort)) ??
    [...ordered].reverse().find((fixture) => isFinishedStatus(fixture.statusShort)) ??
    ordered[0] ??
    null
  )
}

function getUniqueTeams(standings: LeagueStandingGroup[]) {
  const teams = new Map<
    string,
    { id?: number; name: string; logo?: string }
  >()

  standings.forEach((group) => {
    group.rows.forEach((row) => {
      const key = row.teamId ? String(row.teamId) : row.teamName.toLowerCase()
      if (!teams.has(key)) {
        teams.set(key, {
          id: row.teamId,
          name: row.teamName,
          logo: row.teamLogo,
        })
      }
    })
  })

  return [...teams.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es-AR')
  )
}

function WorldCupHero({
  title,
  subtitle,
  fixtures,
  standings,
}: {
  title: string
  subtitle: string
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
}) {
  const liveCount = fixtures.filter((fixture) =>
    isLiveStatus(fixture.statusShort)
  ).length
  const teamCount = getUniqueTeams(standings).length

  return (
    <header className="hf-world26-hero">
      <div className="hf-world26-hero-copy">
        <p className="hf-type-overline">El torneo de selecciones</p>
        <h1>{title}</h1>
        <p>
          Partidos, grupos, llaves y protagonistas en una sola cobertura.
          Los horarios se muestran en Argentina.
        </p>
        <dl className="hf-world26-hero-facts">
          <div>
            <dt>Sedes</dt>
            <dd>{subtitle}</dd>
          </div>
          <div>
            <dt>Fechas</dt>
            <dd>11 de junio — 19 de julio</dd>
          </div>
          <div>
            <dt>En vivo</dt>
            <dd>{liveCount ? `${liveCount} ahora` : 'Sin partidos'}</dd>
          </div>
          <div>
            <dt>Selecciones cargadas</dt>
            <dd>{teamCount || 'A confirmar'}</dd>
          </div>
        </dl>
        <div className="hf-world26-hero-actions">
          <a className="hf-ui-button" href="#partidos">
            Ver partidos
          </a>
          <Link className="hf-ui-button is-secondary" href="/liga/selecciones-mundial/campeones">
            Campeones
          </Link>
        </div>
      </div>
      <div className="hf-world26-trophy" aria-hidden="true">
        <span>2026</span>
        <Image
          src={WORLD_CUP_TROPHY_SRC}
          alt=""
          width={360}
          height={520}
          priority
          sizes="(max-width: 767px) 42vw, 300px"
        />
      </div>
    </header>
  )
}

function TeamIdentity({
  fixture,
  side,
  locale,
}: {
  fixture: LeagueFixtureSummary
  side: 'home' | 'away'
  locale: AppLocale
}) {
  const name = side === 'home' ? fixture.home : fixture.away
  const id = side === 'home' ? fixture.homeId : fixture.awayId
  const logo = side === 'home' ? fixture.homeLogo : fixture.awayLogo
  const content = (
    <>
      <span className="hf-world26-team-logo">
        <TeamLogo
          src={logo}
          team={{ id, name, logo }}
          alt=""
          size={34}
          className="h-full w-full object-contain"
        />
      </span>
      <strong>{getTeamName(name, locale)}</strong>
    </>
  )

  return id ? (
    <Link href={`/equipo/${id}`} className="hf-world26-team">
      {content}
    </Link>
  ) : (
    <span className="hf-world26-team">{content}</span>
  )
}

function MatchCard({
  fixture,
  locale,
  featured = false,
}: {
  fixture: LeagueFixtureSummary
  locale: AppLocale
  featured?: boolean
}) {
  const score = getMatchScore(fixture)
  const statusClass = isLiveStatus(fixture.statusShort)
    ? 'is-live'
    : isFinishedStatus(fixture.statusShort)
      ? 'is-finished'
      : isUpcomingStatus(fixture.statusShort)
        ? 'is-upcoming'
        : 'is-special'

  return (
    <article
      className={`hf-world26-match ${statusClass} ${featured ? 'is-featured' : ''}`}
    >
      <header>
        <span>{fixture.round || 'Mundial 2026'}</span>
        <span className={`hf-world26-status ${statusClass}`}>
          {getStatusLabel(fixture)}
        </span>
      </header>
      <div
        className="hf-world26-match-link"
      >
        <TeamIdentity fixture={fixture} side="home" locale={locale} />
        <Link
          href={`/partido/${fixture.id}`}
          className="hf-world26-score"
          aria-label={`Abrir ${getTeamName(fixture.home, locale)} contra ${getTeamName(fixture.away, locale)}`}
        >
          <strong className="hf-type-data">
            {score ??
              (fixture.date
                ? formatMatchTimeArgentina(fixture.date)
                : 'A confirmar')}
          </strong>
          {hasPenaltyShootoutScore(
            fixture.homePenaltyScore,
            fixture.awayPenaltyScore
          ) ? <small>Incluye penales</small> : null}
        </Link>
        <TeamIdentity fixture={fixture} side="away" locale={locale} />
      </div>
      <footer>
        <span>
          {getFixtureDateLabel(fixture)}
          {fixture.venueName ? ` · ${fixture.venueName}` : ''}
        </span>
        {isUpcomingStatus(fixture.statusShort) && fixture.date ? (
          <MatchReminderButton
            compact
            reminder={{
              matchId: String(fixture.id),
              home: fixture.home,
              away: fixture.away,
              homeLogo: fixture.homeLogo,
              awayLogo: fixture.awayLogo,
              date: fixture.date,
              displayTime: formatMatchTimeArgentina(fixture.date),
              status: fixture.statusShort,
              href: `/partido/${fixture.id}`,
            }}
          />
        ) : null}
      </footer>
    </article>
  )
}

function MatchAgenda({
  fixtures,
  locale,
}: {
  fixtures: LeagueFixtureSummary[]
  locale: AppLocale
}) {
  const featured = getFeaturedFixture(fixtures)
  const sections = getFixtureSections(fixtures).map((section) => ({
    ...section,
    fixtures: section.fixtures.filter(
      (fixture) => String(fixture.id) !== String(featured?.id)
    ),
  }))

  return (
    <section id="partidos" className="hf-world26-panel hf-world26-agenda">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">La pelota</p>
          <h2>Partidos</h2>
          <p>Fixture real, sin proyecciones ni encuentros duplicados.</p>
        </div>
        <strong>{fixtures.length} en el torneo</strong>
      </div>

      {!fixtures.length ? (
        <div className="hf-world26-empty">
          Todavía no hay partidos sincronizados para esta competencia.
        </div>
      ) : (
        <>
          {featured ? (
            <div className="hf-world26-featured">
              <p className="hf-type-overline">Para mirar ahora</p>
              <MatchCard fixture={featured} locale={locale} featured />
            </div>
          ) : null}
          <div className="hf-world26-fixture-sections">
            {sections
              .filter((section) => section.fixtures.length)
              .map((section) => (
                <section key={section.key} className="hf-world26-fixture-section">
                  <header>
                    <div>
                      <h3>{section.title}</h3>
                      <p>{section.description}</p>
                    </div>
                    <span>{section.fixtures.length}</span>
                  </header>
                  <div className="hf-world26-match-list">
                    {section.fixtures.map((fixture) => (
                      <MatchCard
                        key={fixture.id}
                        fixture={fixture}
                        locale={locale}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
    </section>
  )
}

function DataSection({
  id,
  overline,
  title,
  description,
  children,
  emptyMessage,
}: {
  id: string
  overline: string
  title: string
  description: string
  children?: ReactNode
  emptyMessage: string
}) {
  return (
    <section id={id} className="hf-world26-panel">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">{overline}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children ? (
        <div className="hf-world26-data">{children}</div>
      ) : (
        <div className="hf-world26-empty">{emptyMessage}</div>
      )}
    </section>
  )
}

function SelectionsSection({
  standings,
  locale,
}: {
  standings: LeagueStandingGroup[]
  locale: AppLocale
}) {
  const teams = getUniqueTeams(standings)

  return (
    <section id="selecciones" className="hf-world26-panel">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">Los protagonistas</p>
          <h2>Selecciones</h2>
          <p>Acceso directo a cada plantel cargado en las tablas del torneo.</p>
        </div>
        {teams.length ? <strong>{teams.length}</strong> : null}
      </div>
      {teams.length ? (
        <div className="hf-world26-team-grid">
          {teams.map((team) => {
            const content = (
              <>
                <span>
                  <TeamLogo
                    src={team.logo}
                    team={{ id: team.id, name: team.name, logo: team.logo }}
                    alt=""
                    size={42}
                    className="h-full w-full object-contain"
                  />
                </span>
                <strong>{getTeamName(team.name, locale)}</strong>
                <small>{team.id ? 'Ver selección' : 'Ficha no disponible'}</small>
              </>
            )

            return team.id ? (
              <Link key={team.id} href={`/equipo/${team.id}`}>
                {content}
              </Link>
            ) : (
              <div key={team.name}>{content}</div>
            )
          })}
        </div>
      ) : (
        <div className="hf-world26-empty">
          Las selecciones aparecerán cuando la clasificación esté sincronizada.
        </div>
      )}
    </section>
  )
}

function NewsSection() {
  const articles = getNewsArticles('mundial-2026').slice(0, 6)

  return (
    <section id="noticias" className="hf-world26-panel">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">Historias del torneo</p>
          <h2>Noticias</h2>
          <p>Análisis y guías editoriales publicadas por Hay Fulbo.</p>
        </div>
        <Link href="/noticias?categoria=mundial-2026">Ver todas</Link>
      </div>
      {articles.length ? (
        <div className="hf-world26-news-grid">
          {articles.map((article, index) => (
            <Link
              key={article.slug}
              href={`/noticias/${article.slug}`}
              className={index === 0 ? 'is-lead' : ''}
            >
              <span>
                <small>
                  {getEditorialReadingMinutes(article)} min · {article.author}
                </small>
                <strong>{article.title}</strong>
                <span>{article.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="hf-world26-empty">
          Todavía no hay noticias publicadas para el Mundial.
        </div>
      )}
    </section>
  )
}

function VenuesSection() {
  return (
    <section id="sedes" className="hf-world26-panel">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">Tres países</p>
          <h2>Sedes</h2>
          <p>Ciudades y estadios de referencia del torneo.</p>
        </div>
      </div>
      <div className="hf-world26-venue-grid">
        {WORLD_CUP_VENUES.map((country) => (
          <section key={country.country}>
            <h3>{country.country}</h3>
            <ul>
              {country.venues.map(([name, city]) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span>{city}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="hf-world26-reference-note">
        Información editorial de referencia. El estadio confirmado de cada
        encuentro se muestra en su ficha cuando está disponible en los datos.
      </p>
    </section>
  )
}

function HistorySection() {
  return (
    <section id="historia" className="hf-world26-panel">
      <div className="hf-world26-section-heading">
        <div>
          <p className="hf-type-overline">Archivo mundialista</p>
          <h2>Historia</h2>
          <p>Campeones y anfitriones de las ediciones disputadas.</p>
        </div>
        <Link href="/liga/selecciones-mundial/campeones">Ver palmarés</Link>
      </div>
      <div className="hf-world26-history-table" role="region" aria-label="Historial de campeones" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Año</th>
              <th>Sede</th>
              <th>Campeón</th>
            </tr>
          </thead>
          <tbody>
            {[...WORLD_CUP_HISTORY].reverse().map(([year, host, champion]) => (
              <tr key={year}>
                <td className="hf-type-data">{year}</td>
                <td>{host}</td>
                <td>
                  <strong>{champion}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function WorldCupRedesign({
  title,
  subtitle,
  fixtures,
  standings,
  locale,
  errorMessage,
  hasTournamentData,
  bracketSection,
  groupStageSection,
  leaderStatsSection,
}: WorldCupRedesignProps) {
  return (
    <main className="hf-world26-page">
      <WorldCupHero
        title={title}
        subtitle={subtitle}
        fixtures={fixtures}
        standings={standings}
      />

      <CompetitionSectionNav
        label="Secciones del Mundial 2026"
        variant="quick"
        className="hf-world26-nav"
        items={[
          { key: 'partidos', label: 'Partidos', href: '#partidos', active: true },
          { key: 'grupos', label: 'Grupos', href: '#grupos' },
          { key: 'llaves', label: 'Llaves', href: '#llaves' },
          { key: 'estadisticas', label: 'Estadísticas', href: '#estadisticas' },
          { key: 'selecciones', label: 'Selecciones', href: '#selecciones' },
        ]}
        moreItems={[
          { key: 'noticias', label: 'Noticias', href: '#noticias' },
          { key: 'sedes', label: 'Sedes', href: '#sedes' },
          { key: 'historia', label: 'Historia', href: '#historia' },
        ]}
      />

      {errorMessage ? (
        <div className="hf-world26-alert" role="alert">
          <strong>No pudimos actualizar el torneo.</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!errorMessage && !hasTournamentData ? (
        <div className="hf-world26-alert is-neutral">
          <strong>El torneo todavía no tiene datos sincronizados.</strong>
          <span>
            Esta pantalla se completará automáticamente cuando existan partidos,
            tablas o estadísticas reales.
          </span>
        </div>
      ) : null}

      <div className="hf-world26-content">
        <MatchAgenda fixtures={fixtures} locale={locale} />
        <DataSection
          id="grupos"
          overline="Primera fase"
          title="Grupos y clasificación"
          description="Posiciones oficiales y comparación de los mejores terceros."
          emptyMessage="La clasificación aparecerá cuando haya tablas sincronizadas."
        >
          {groupStageSection}
        </DataSection>
        <DataSection
          id="llaves"
          overline="Partidos sin mañana"
          title="Fase eliminatoria"
          description="Solo cruces confirmados o estados pendientes explícitos."
          emptyMessage="La llave aparecerá cuando los cruces estén definidos."
        >
          {bracketSection}
        </DataSection>
        <DataSection
          id="estadisticas"
          overline="Rendimiento"
          title="Estadísticas"
          description="Goleadores, asistencias y disciplina según los datos disponibles."
          emptyMessage="Todavía no hay estadísticas individuales sincronizadas."
        >
          {leaderStatsSection}
        </DataSection>
        <SelectionsSection standings={standings} locale={locale} />
        <NewsSection />
        <VenuesSection />
        <HistorySection />
      </div>
    </main>
  )
}
