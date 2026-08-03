import Link from 'next/link'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import Score from '@/frontend/components/sports/Score'
import {
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { getTeamDisplayName } from '@/shared/utils/team-display'

import type { HomeMatchEntry } from '@/frontend/components/home/matchday/types'
import type { AppLocale } from '@/shared/i18n/locales'

function getMatchHref(entry: HomeMatchEntry) {
  return `/partido/${entry.match.externalId ?? entry.match.id}`
}

function getStatusLabel(entry: HomeMatchEntry) {
  const { match } = entry
  if (isLiveStatus(match.statusShort)) {
    return match.minute ? `En vivo · ${match.minute}'` : 'En vivo'
  }
  if (isFinishedStatus(match.statusShort)) return 'Finalizado'
  if (isUpcomingStatus(match.statusShort)) return 'Próximo'
  return match.displayStatus
}

function getTeamNames(entry: HomeMatchEntry, locale: AppLocale) {
  const { match } = entry

  return {
    home: getTeamDisplayName({
      name: match.home,
      league: match.league,
      country: match.country,
      locale,
    }),
    away: getTeamDisplayName({
      name: match.away,
      league: match.league,
      country: match.country,
      locale,
    }),
  }
}

function TeamIdentity({
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
      <TeamLogo src={logo} team={{ id }} alt="" size={54} />
      <strong>{name}</strong>
    </>
  )

  if (!id) return <div className="hf-centre-spotlight-team">{content}</div>

  return (
    <Link
      href={`/equipo/${id}`}
      className="hf-centre-spotlight-team"
      aria-label={`Ver ${name}`}
    >
      {content}
    </Link>
  )
}

function SupportingMatch({
  entry,
  locale,
}: {
  entry: HomeMatchEntry
  locale: AppLocale
}) {
  const names = getTeamNames(entry, locale)
  const { match } = entry
  const upcoming = isUpcomingStatus(match.statusShort)

  return (
    <Link
      href={getMatchHref(entry)}
      className="hf-centre-next-row"
      aria-label={`Abrir ${names.home} vs ${names.away}`}
    >
      <span>{entry.competition.title}</span>
      <div>
        <strong>{names.home}</strong>
        <i>vs</i>
        <strong>{names.away}</strong>
      </div>
      {upcoming ? (
        <time dateTime={match.date}>{match.displayTime}</time>
      ) : (
        <Score
          home={match.goalsHome}
          away={match.goalsAway}
          homeTeam={names.home}
          awayTeam={names.away}
          homePenalties={match.homePenaltyScore}
          awayPenalties={match.awayPenaltyScore}
        />
      )}
    </Link>
  )
}

export default function HomePulseHero({
  featured,
  supporting,
  locale,
  totals,
}: {
  featured: HomeMatchEntry
  supporting: HomeMatchEntry[]
  locale: AppLocale
  totals: { all: number; live: number; upcoming: number; finished: number }
}) {
  const { match, competition } = featured
  const names = getTeamNames(featured, locale)
  const upcoming = isUpcomingStatus(match.statusShort)
  const broadcastNames = (match.broadcasters ?? [])
    .map((broadcaster) => broadcaster.name)
    .filter(Boolean)
  const broadcast =
    broadcastNames.join(' / ') || match.broadcastChannel || 'TV por confirmar'

  return (
    <section className="hf-centre-spotlight" aria-labelledby="centre-spotlight-title">
      <header className="hf-centre-spotlight-heading">
        <div>
          <span>{isLiveStatus(match.statusShort) ? 'Ahora' : 'En foco'}</span>
          <h2 id="centre-spotlight-title">
            {isLiveStatus(match.statusShort) ? 'Partido en vivo' : 'Próximo partido'}
          </h2>
        </div>
        <strong className={isLiveStatus(match.statusShort) ? 'is-live' : ''}>
          {getStatusLabel(featured)}
        </strong>
      </header>

      <article className="hf-centre-spotlight-card">
        <div className="hf-centre-spotlight-league">
          {competition.href ? (
            <Link href={competition.href}>
              <LeagueLogo src={competition.logo} alt="" size={24} />
              <span>{competition.title}</span>
            </Link>
          ) : (
            <div>
              <LeagueLogo src={competition.logo} alt="" size={24} />
              <span>{competition.title}</span>
            </div>
          )}
        </div>

        <div className="hf-centre-spotlight-fixture">
          <TeamIdentity id={match.homeId} name={names.home} logo={match.homeLogo} />

          <Link
            href={getMatchHref(featured)}
            className="hf-centre-spotlight-result"
            aria-label={`Abrir ${names.home} vs ${names.away}`}
          >
            {upcoming ? (
              <time dateTime={match.date}>{match.displayTime}</time>
            ) : (
              <Score
                home={match.goalsHome}
                away={match.goalsAway}
                homeTeam={names.home}
                awayTeam={names.away}
                homePenalties={match.homePenaltyScore}
                awayPenalties={match.awayPenaltyScore}
              />
            )}
            <span>Ver partido</span>
          </Link>

          <TeamIdentity id={match.awayId} name={names.away} logo={match.awayLogo} />
        </div>

        <footer className="hf-centre-spotlight-meta">
          <span>{broadcast}</span>
          <span>{match.displayStatus}</span>
        </footer>
      </article>

      {supporting.length ? (
        <div className="hf-centre-next" aria-label="También en la jornada">
          <span>A continuación</span>
          {supporting.map((entry) => (
            <SupportingMatch
              key={String(entry.match.externalId ?? entry.match.id)}
              entry={entry}
              locale={locale}
            />
          ))}
        </div>
      ) : null}

      <dl className="hf-centre-totals">
        <div>
          <dt>Total</dt>
          <dd>{totals.all}</dd>
        </div>
        <div>
          <dt>En vivo</dt>
          <dd>{totals.live}</dd>
        </div>
        <div>
          <dt>Próximos</dt>
          <dd>{totals.upcoming}</dd>
        </div>
        <div>
          <dt>Finales</dt>
          <dd>{totals.finished}</dd>
        </div>
      </dl>
    </section>
  )
}
