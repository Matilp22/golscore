'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import MatchReminderButton from '@/frontend/components/matches/MatchReminderButton'
import Score from '@/frontend/components/sports/Score'
import {
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { getTeamDisplayName } from '@/shared/utils/team-display'

import type {
  HfHomeMatch,
  HomeMatchEntry,
} from '@/frontend/components/home/matchday/types'
import type { AppLocale } from '@/shared/i18n/locales'

type FeedTone = 'live' | 'upcoming' | 'finished' | 'special'
type FilterKey = 'all' | FeedTone
type ViewMode = 'time' | 'competition'

function getMatchHref(match: HfHomeMatch) {
  return `/partido/${match.externalId ?? match.id}`
}

function getBroadcast(match: HfHomeMatch) {
  const names = (match.broadcasters ?? [])
    .map((broadcaster) => broadcaster.name)
    .filter(Boolean)

  return names.join(' / ') || match.broadcastChannel || null
}

function getTone(match: HfHomeMatch): FeedTone {
  if (isLiveStatus(match.statusShort)) return 'live'
  if (isUpcomingStatus(match.statusShort)) return 'upcoming'
  if (isFinishedStatus(match.statusShort)) return 'finished'
  return 'special'
}

function getStatusLabel(match: HfHomeMatch) {
  if (isLiveStatus(match.statusShort)) {
    return match.minute ? `${match.minute}'` : 'Vivo'
  }
  if (isFinishedStatus(match.statusShort)) return 'Final'
  if (isUpcomingStatus(match.statusShort)) return 'Hora'
  return match.displayStatus
}

function compareEntries(a: HomeMatchEntry, b: HomeMatchEntry) {
  const firstTime = Date.parse(a.match.date)
  const secondTime = Date.parse(b.match.date)

  if (!Number.isFinite(firstTime)) return Number.isFinite(secondTime) ? 1 : 0
  if (!Number.isFinite(secondTime)) return -1
  return firstTime - secondTime
}

function MatchTeam({
  id,
  name,
  logo,
}: {
  id?: number
  name: string
  logo?: string
}) {
  const content = (
    <>
      <TeamLogo src={logo} team={{ id }} alt="" size={26} />
      <strong>{name}</strong>
    </>
  )

  if (!id) return <div className="hf-stream-team">{content}</div>

  return (
    <Link href={`/equipo/${id}`} className="hf-stream-team" aria-label={`Ver ${name}`}>
      {content}
    </Link>
  )
}

function MatchRow({
  entry,
  locale,
  showCompetition,
}: {
  entry: HomeMatchEntry
  locale: AppLocale
  showCompetition: boolean
}) {
  const { match, competition } = entry
  const tone = getTone(match)
  const homeName = getTeamDisplayName({
    name: match.home,
    league: match.league,
    country: match.country,
    locale,
  })
  const awayName = getTeamDisplayName({
    name: match.away,
    league: match.league,
    country: match.country,
    locale,
  })
  const matchHref = getMatchHref(match)
  const broadcast = getBroadcast(match)
  const upcoming = tone === 'upcoming'
  const latestEvent = (match.liveEvents ?? []).at(-1)?.label
  const prediction = match.prediction
    ? `Tu Prode ${match.prediction.predictedHomeScore}–${match.prediction.predictedAwayScore}`
    : null

  return (
    <article className={`hf-stream-match is-${tone}`}>
      <div className="hf-stream-match-clock">
        <strong>{tone === 'live' ? getStatusLabel(match) : match.displayTime}</strong>
        <span>{getStatusLabel(match)}</span>
      </div>

      <div className="hf-stream-match-content">
        {showCompetition ? (
          <div className="hf-stream-match-league">
            <LeagueLogo src={competition.logo} alt="" size={17} />
            {competition.href ? (
              <Link href={competition.href}>{competition.title}</Link>
            ) : (
              <span>{competition.title}</span>
            )}
            {broadcast ? <small title={broadcast}>TV · {broadcast}</small> : null}
          </div>
        ) : broadcast ? (
          <div className="hf-stream-match-league">
            <small title={broadcast}>TV · {broadcast}</small>
          </div>
        ) : null}

        <div className="hf-stream-match-teams">
          <MatchTeam id={match.homeId} name={homeName} logo={match.homeLogo} />
          <MatchTeam id={match.awayId} name={awayName} logo={match.awayLogo} />
        </div>

        {latestEvent || prediction ? (
          <p className="hf-stream-match-note">{latestEvent || prediction}</p>
        ) : null}
      </div>

      {upcoming ? (
        <div className="hf-stream-match-reminder">
          <MatchReminderButton
            compact
            reminder={{
              matchId: String(match.externalId ?? match.id),
              href: matchHref,
              home: homeName,
              away: awayName,
              homeLogo: match.homeLogo,
              awayLogo: match.awayLogo,
              date: match.date,
              displayTime: match.displayTime,
              status: match.displayStatus,
              tvLabel: broadcast || 'TV por confirmar',
              tvLogoUrl: match.broadcastLogoUrl ?? null,
            }}
          />
        </div>
      ) : null}

      <Link
        href={matchHref}
        className="hf-stream-match-outcome"
        aria-label={`Abrir ${homeName} vs ${awayName}`}
      >
        {upcoming ? (
          <>
            <span>Ficha</span>
            <strong aria-hidden="true">›</strong>
          </>
        ) : (
          <>
            <Score
              home={match.goalsHome}
              away={match.goalsAway}
              homeTeam={homeName}
              awayTeam={awayName}
              homePenalties={match.homePenaltyScore}
              awayPenalties={match.awayPenaltyScore}
            />
            <span>Ver</span>
          </>
        )}
      </Link>
    </article>
  )
}

export default function HomePulseMatchFeed({
  locale,
  entries,
}: {
  locale: AppLocale
  entries: HomeMatchEntry[]
}) {
  const filters = useMemo(() => {
    const byTone = {
      live: entries.filter(({ match }) => getTone(match) === 'live'),
      upcoming: entries.filter(({ match }) => getTone(match) === 'upcoming'),
      finished: entries.filter(({ match }) => getTone(match) === 'finished'),
      special: entries.filter(({ match }) => getTone(match) === 'special'),
    }

    return [
      { key: 'all' as const, label: 'Todo', entries },
      { key: 'live' as const, label: 'En vivo', entries: byTone.live },
      { key: 'upcoming' as const, label: 'Próximos', entries: byTone.upcoming },
      { key: 'finished' as const, label: 'Finales', entries: byTone.finished },
      ...(byTone.special.length
        ? [{ key: 'special' as const, label: 'Otros', entries: byTone.special }]
        : []),
    ]
  }, [entries])
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [view, setView] = useState<ViewMode>('time')
  const selected = filters.find((filter) => filter.key === activeFilter) ?? filters[0]
  const orderedEntries = useMemo(
    () => [...selected.entries].sort(compareEntries),
    [selected.entries]
  )
  const groups = useMemo(
    () =>
      orderedEntries.reduce<
        Array<{ competition: HomeMatchEntry['competition']; entries: HomeMatchEntry[] }>
      >((result, entry) => {
        const group = result.find(
          (candidate) => candidate.competition.key === entry.competition.key
        )
        if (group) group.entries.push(entry)
        else result.push({ competition: entry.competition, entries: [entry] })
        return result
      }, []),
    [orderedEntries]
  )

  return (
    <section id="partidos" className="hf-stream-feed" aria-labelledby="stream-feed-title">
      <header className="hf-stream-feed-heading">
        <div>
          <span>Partidos y resultados</span>
          <h2 id="stream-feed-title">La jornada</h2>
        </div>
        <strong>{selected.entries.length.toString().padStart(2, '0')}</strong>
      </header>

      <div className="hf-stream-controls">
        <div className="hf-stream-filters" aria-label="Filtrar partidos">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={filter.key === selected.key ? 'is-active' : ''}
              aria-pressed={filter.key === selected.key}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
              <span>{filter.entries.length}</span>
            </button>
          ))}
        </div>

        <div className="hf-stream-view-switch" aria-label="Organizar partidos">
          <button
            type="button"
            className={view === 'time' ? 'is-active' : ''}
            aria-pressed={view === 'time'}
            onClick={() => setView('time')}
          >
            Por horario
          </button>
          <button
            type="button"
            className={view === 'competition' ? 'is-active' : ''}
            aria-pressed={view === 'competition'}
            onClick={() => setView('competition')}
          >
            Por torneo
          </button>
        </div>
      </div>

      {orderedEntries.length ? (
        view === 'time' ? (
          <div className="hf-stream-timeline">
            {orderedEntries.map((entry) => (
              <MatchRow
                key={String(entry.match.externalId ?? entry.match.id)}
                entry={entry}
                locale={locale}
                showCompetition
              />
            ))}
          </div>
        ) : (
          <div className="hf-stream-groups">
            {groups.map(({ competition, entries: competitionEntries }) => (
              <section key={competition.key} className="hf-stream-league-group">
                <header>
                  <LeagueLogo src={competition.logo} alt="" size={26} />
                  <div>
                    {competition.href ? (
                      <Link href={competition.href}>{competition.title}</Link>
                    ) : (
                      <strong>{competition.title}</strong>
                    )}
                    <span>
                      {competitionEntries.length}{' '}
                      {competitionEntries.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>
                </header>
                <div className="hf-stream-timeline is-grouped">
                  {competitionEntries.map((entry) => (
                    <MatchRow
                      key={String(entry.match.externalId ?? entry.match.id)}
                      entry={entry}
                      locale={locale}
                      showCompetition={false}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="hf-stream-feed-empty">
          <strong>Sin partidos en esta vista</strong>
          <p>Probá otro estado o elegí una fecha diferente.</p>
        </div>
      )}
    </section>
  )
}
