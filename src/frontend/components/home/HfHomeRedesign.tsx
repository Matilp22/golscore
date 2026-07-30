import HomeDateNavigator from '@/frontend/components/home/matchday/HomeDateNavigator'
import HomeDiscovery from '@/frontend/components/home/matchday/HomeDiscovery'
import HomeFavoritesStrip from '@/frontend/components/home/matchday/HomeFavoritesStrip'
import HomeMatchSection from '@/frontend/components/home/matchday/HomeMatchSection'
import type {
  HfHomeCompetition,
  HfHomeMatch,
  HfHomeRedesignProps,
  HomeMatchEntry,
} from '@/frontend/components/home/matchday/types'
import {
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'

export type {
  HfHomeArticle,
  HfHomeCompetition,
  HfHomeMatch,
} from '@/frontend/components/home/matchday/types'

function getMatchKey(match: HfHomeMatch) {
  return String(match.externalId ?? match.id)
}

function buildUniqueMatchList(competitions: HfHomeCompetition[]) {
  const entries = new Map<string, HomeMatchEntry>()

  for (const competition of competitions) {
    for (const match of competition.matches) {
      const key = getMatchKey(match)
      if (!entries.has(key)) {
        entries.set(key, { match, competition })
      }
    }
  }

  return [...entries.values()].sort(
    (first, second) =>
      new Date(first.match.date).getTime() -
      new Date(second.match.date).getTime()
  )
}

function MatchdayJumpNavigation({
  live,
  scheduled,
  finished,
  special,
}: {
  live: number
  scheduled: number
  finished: number
  special: number
}) {
  const destinations = [
    { href: '#en-vivo', label: 'En vivo', count: live },
    { href: '#proximos', label: 'Programados', count: scheduled },
    { href: '#resultados', label: 'Resultados', count: finished },
    ...(special
      ? [{ href: '#otros-estados', label: 'Otros estados', count: special }]
      : []),
  ]

  return (
    <nav className="hf-matchday-jump-nav" aria-label="Secciones de la jornada">
      {destinations.map((destination) => (
        <a key={destination.href} href={destination.href}>
          <span>{destination.label}</span>
          <strong>{destination.count}</strong>
        </a>
      ))}
    </nav>
  )
}

export default function HfHomeRedesign({
  locale,
  dayOptions,
  selectedDate,
  competitions,
  articles,
  autoRefresh,
  dataError,
  noMatchesLabel,
}: HfHomeRedesignProps) {
  const matches = buildUniqueMatchList(competitions)
  const live = matches.filter(({ match }) => isLiveStatus(match.statusShort))
  const scheduled = matches.filter(({ match }) =>
    isUpcomingStatus(match.statusShort)
  )
  const finished = matches.filter(({ match }) =>
    isFinishedStatus(match.statusShort)
  )
  const special = matches.filter(
    ({ match }) =>
      !isLiveStatus(match.statusShort) &&
      !isUpcomingStatus(match.statusShort) &&
      !isFinishedStatus(match.statusShort)
  )

  return (
    <main className="hf-matchday-page">
      <HomeDateNavigator
        dayOptions={dayOptions}
        selectedDate={selectedDate}
        autoRefresh={autoRefresh}
      />

      {dataError ? (
        <div className="hf-matchday-data-error" role="alert">
          <strong>No pudimos actualizar toda la jornada.</strong>
          <span>{dataError}</span>
        </div>
      ) : null}

      <HomeFavoritesStrip />

      <MatchdayJumpNavigation
        live={live.length}
        scheduled={scheduled.length}
        finished={finished.length}
        special={special.length}
      />

      {matches.length ? (
        <div className="hf-matchday-sections">
          <HomeMatchSection
            id="en-vivo"
            eyebrow="Ahora"
            title="En vivo"
            description="Minuto, marcador e incidencias sin perder de vista la cancha."
            entries={live}
            locale={locale}
            tone="live"
            emptyMessage="No hay partidos en juego en este momento."
          />
          <HomeMatchSection
            id="proximos"
            eyebrow="Lo que viene"
            title="Programados"
            description="Horarios, televisión y recordatorios para organizar tu jornada."
            entries={scheduled}
            locale={locale}
            tone="scheduled"
            emptyMessage="No quedan partidos programados para esta fecha."
          />
          <HomeMatchSection
            id="resultados"
            eyebrow="Ya jugaron"
            title="Resultados"
            description="Marcadores finales y protagonistas de cada partido."
            entries={finished}
            locale={locale}
            tone="finished"
            emptyMessage="Todavía no hay resultados finales en esta jornada."
          />
          {special.length ? (
            <HomeMatchSection
              id="otros-estados"
              eyebrow="Atención"
              title="Otros estados"
              description="Partidos suspendidos, postergados o con una situación especial."
              entries={special}
              locale={locale}
              tone="special"
              emptyMessage="No hay partidos con estados especiales."
            />
          ) : null}
        </div>
      ) : (
        <section className="hf-matchday-no-fixtures" aria-live="polite">
          <span className="hf-type-overline">Jornada sin partidos</span>
          <h2>{noMatchesLabel}</h2>
          <p>
            Podés cambiar la fecha o seguir explorando competiciones, noticias y
            tus equipos favoritos.
          </p>
        </section>
      )}

      <HomeDiscovery competitions={competitions} articles={articles} />
    </main>
  )
}
