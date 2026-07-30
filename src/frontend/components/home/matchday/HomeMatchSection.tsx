import Link from 'next/link'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import MatchReminderButton from '@/frontend/components/matches/MatchReminderButton'
import SafeImage from '@/frontend/components/SafeImage'
import MatchStatus from '@/frontend/components/sports/MatchStatus'
import Score from '@/frontend/components/sports/Score'
import { formatEventMinute } from '@/shared/utils/event-minute'
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

type HomeMatchSectionTone = 'live' | 'scheduled' | 'finished' | 'special'

function getMatchHref(match: HfHomeMatch) {
  return `/partido/${match.externalId ?? match.id}`
}

function getBroadcast(match: HfHomeMatch) {
  const broadcasters = match.broadcasters || []
  const firstWithLogo = broadcasters.find((broadcaster) => broadcaster.logoUrl)
  const names = broadcasters.map((broadcaster) => broadcaster.name).filter(Boolean)

  return {
    label:
      (names.length ? names.join(' / ') : match.broadcastChannel) ||
      'TV no confirmada',
    logoUrl: firstWithLogo?.logoUrl ?? match.broadcastLogoUrl ?? null,
    confirmed: names.length > 0 || Boolean(match.broadcastChannel),
  }
}

function formatGoalScorers(match: HfHomeMatch) {
  const formatSide = (goals: HfHomeMatch['goalScorers']['home']) =>
    goals.map((goal) => {
      const detail =
        goal.kind === 'penalty'
          ? ' pen.'
          : goal.kind === 'own-goal'
            ? ' e/c'
            : ''

      return `${goal.player} ${formatEventMinute(
        goal.minute,
        goal.extraMinute
      )}${detail}`
    })

  return [
    ...formatSide(match.goalScorers.home),
    ...formatSide(match.goalScorers.away),
    ...formatSide(match.goalScorers.unassigned ?? []),
  ]
}

function TeamLink({
  id,
  name,
  logo,
  side,
}: {
  id?: number
  name: string
  logo?: string
  side: 'home' | 'away'
}) {
  const content = (
    <>
      {side === 'away' ? (
        <TeamLogo src={logo} team={{ id }} alt="" size={38} />
      ) : null}
      <span>{name}</span>
      {side === 'home' ? (
        <TeamLogo src={logo} team={{ id }} alt="" size={38} />
      ) : null}
    </>
  )

  if (!id) {
    return <div className={`hf-matchday-team is-${side}`}>{content}</div>
  }

  return (
    <Link
      href={`/equipo/${id}`}
      className={`hf-matchday-team is-${side}`}
      aria-label={`Ver ${name}`}
    >
      {content}
    </Link>
  )
}

function MatchCenter({
  match,
  homeName,
  awayName,
}: {
  match: HfHomeMatch
  homeName: string
  awayName: string
}) {
  const upcoming = isUpcomingStatus(match.statusShort)
  const upcomingDetail =
    match.displayStatus !== match.displayTime
      ? match.displayStatus
      : 'Hora Argentina'

  return (
    <Link
      href={getMatchHref(match)}
      className="hf-matchday-score-link"
      aria-label={`Abrir ${homeName} vs ${awayName}`}
    >
      {upcoming ? (
        <>
          <time dateTime={match.date}>{match.displayTime}</time>
          <small>{upcomingDetail}</small>
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
          <small>
            {isLiveStatus(match.statusShort) && match.minute
              ? `${match.minute}'`
              : match.displayStatus}
          </small>
        </>
      )}
    </Link>
  )
}

function MatchMeta({
  match,
  homeName,
  awayName,
}: {
  match: HfHomeMatch
  homeName: string
  awayName: string
}) {
  const broadcast = getBroadcast(match)
  const scorers = formatGoalScorers(match)
  const recentEvents = (match.liveEvents ?? []).slice(-2).reverse()
  const upcoming = isUpcomingStatus(match.statusShort)

  if (
    !broadcast.confirmed &&
    !recentEvents.length &&
    !scorers.length &&
    !match.prediction &&
    !upcoming
  ) {
    return null
  }

  return (
    <footer className="hf-matchday-match-meta">
      {broadcast.confirmed ? (
        <div className="hf-matchday-tv">
          {broadcast.logoUrl ? (
            <SafeImage
              src={broadcast.logoUrl}
              alt=""
              imageType="broadcast"
              width={18}
              height={18}
            />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16v11H4zM9 21h6M12 17v4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          )}
          <span>{broadcast.label}</span>
        </div>
      ) : null}

      {recentEvents.length ? (
        <div className="hf-matchday-incidents" aria-label="Últimas incidencias">
          {recentEvents.map((event) => (
            <span key={event.id}>{event.label}</span>
          ))}
        </div>
      ) : scorers.length ? (
        <div className="hf-matchday-incidents" aria-label="Goleadores">
          {scorers.slice(0, 3).map((scorer) => (
            <span key={scorer}>{scorer}</span>
          ))}
        </div>
      ) : null}

      {match.prediction ? (
        <span className="hf-matchday-prode">
          Tu Prode {match.prediction.predictedHomeScore}–
          {match.prediction.predictedAwayScore}
        </span>
      ) : null}

      {upcoming ? (
        <div className="hf-matchday-reminder">
          <span>Recordatorio</span>
          <MatchReminderButton
            compact
            reminder={{
              matchId: String(match.externalId ?? match.id),
              href: getMatchHref(match),
              home: homeName,
              away: awayName,
              homeLogo: match.homeLogo,
              awayLogo: match.awayLogo,
              date: match.date,
              displayTime: match.displayTime,
              status: match.displayStatus,
              tvLabel: broadcast.label,
              tvLogoUrl: broadcast.logoUrl,
            }}
          />
        </div>
      ) : null}
    </footer>
  )
}

function HomeMatchRow({
  entry,
  locale,
  tone,
}: {
  entry: HomeMatchEntry
  locale: AppLocale
  tone: HomeMatchSectionTone
}) {
  const { match, competition } = entry
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

  const competitionIdentity = (
    <>
      <LeagueLogo
        src={competition.logo}
        alt=""
        size={22}
      />
      <span>{competition.title}</span>
    </>
  )

  return (
    <article className={`hf-matchday-match is-${tone}`}>
      <header>
        {competition.href ? (
          <Link href={competition.href}>{competitionIdentity}</Link>
        ) : (
          <div>{competitionIdentity}</div>
        )}
        <MatchStatus
          status={match.statusShort}
          label={
            isLiveStatus(match.statusShort)
              ? 'En vivo'
              : isFinishedStatus(match.statusShort)
                ? 'Final'
                : isUpcomingStatus(match.statusShort)
                  ? 'Programado'
                  : match.displayStatus
          }
          minute={match.minute}
        />
      </header>

      <div className="hf-matchday-match-main">
        <TeamLink
          id={match.homeId}
          name={homeName}
          logo={match.homeLogo}
          side="home"
        />
        <MatchCenter match={match} homeName={homeName} awayName={awayName} />
        <TeamLink
          id={match.awayId}
          name={awayName}
          logo={match.awayLogo}
          side="away"
        />
      </div>

      <MatchMeta match={match} homeName={homeName} awayName={awayName} />
    </article>
  )
}

export default function HomeMatchSection({
  id,
  eyebrow,
  title,
  description,
  entries,
  locale,
  tone,
  emptyMessage,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  entries: HomeMatchEntry[]
  locale: AppLocale
  tone: HomeMatchSectionTone
  emptyMessage: string
}) {
  return (
    <section
      id={id}
      className={`hf-matchday-section is-${tone}`}
      aria-labelledby={`${id}-title`}
    >
      <header className="hf-matchday-section-heading">
        <div>
          <span className="hf-type-overline">{eyebrow}</span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="hf-matchday-section-count">
          {entries.length}
          <small>{entries.length === 1 ? 'partido' : 'partidos'}</small>
        </span>
      </header>

      {entries.length ? (
        <div className="hf-matchday-match-list">
          {entries.map((entry) => (
            <HomeMatchRow
              key={String(entry.match.externalId ?? entry.match.id)}
              entry={entry}
              locale={locale}
              tone={tone}
            />
          ))}
        </div>
      ) : (
        <div className="hf-matchday-section-empty">
          <span aria-hidden="true">—</span>
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  )
}
