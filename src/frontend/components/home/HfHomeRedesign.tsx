import Link from 'next/link'

import HomePulseDateBar from '@/frontend/components/home/matchday/HomePulseDateBar'
import HomePulseEditorial from '@/frontend/components/home/matchday/HomePulseEditorial'
import HomePulseFavorites from '@/frontend/components/home/matchday/HomePulseFavorites'
import HomePulseMatchFeed from '@/frontend/components/home/matchday/HomePulseMatchFeed'
import HomeStreamContext from '@/frontend/components/home/matchday/HomeStreamContext'
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
      if (!entries.has(key)) entries.set(key, { match, competition })
    }
  }

  return [...entries.values()].sort(
    (first, second) =>
      new Date(first.match.date).getTime() - new Date(second.match.date).getTime()
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
  const upcoming = matches.filter(({ match }) => isUpcomingStatus(match.statusShort))
  const finished = matches.filter(({ match }) => isFinishedStatus(match.statusShort))
  return (
    <main className="hf-orbit-home">
      <aside className="hf-pulse-banner-rail" aria-label="Espacio publicitario lateral">
        <span>Espacio para banner</span>
      </aside>

      <div className="hf-pulse-canvas">
        <HomePulseDateBar
          dayOptions={dayOptions}
          selectedDate={selectedDate}
          autoRefresh={autoRefresh}
        />

        {dataError ? (
          <div className="hf-pulse-data-error" role="alert">
            <strong>La jornada puede estar incompleta.</strong>
            <span>{dataError}</span>
          </div>
        ) : null}

        {matches.length ? (
          <>
            <div className="hf-stream-layout">
              <div className="hf-stream-main">
                <HomePulseMatchFeed locale={locale} entries={matches} />
                <HomePulseEditorial
                  articles={articles}
                  competitions={competitions}
                />
              </div>

              <aside className="hf-stream-side" aria-label="Contexto de la jornada">
                <HomeStreamContext
                  competitions={competitions}
                  totals={{
                    all: matches.length,
                    live: live.length,
                    upcoming: upcoming.length,
                    finished: finished.length,
                  }}
                />
                <HomePulseFavorites />
              </aside>
            </div>
          </>
        ) : (
          <section className="hf-pulse-no-fixtures" aria-live="polite">
            <span>Sin actividad</span>
            <h2>{noMatchesLabel}</h2>
            <p>Cambiá la fecha o explorá noticias, competiciones y tus equipos.</p>
            <Link href="/competiciones">Explorar competiciones →</Link>
          </section>
        )}
      </div>
    </main>
  )
}
