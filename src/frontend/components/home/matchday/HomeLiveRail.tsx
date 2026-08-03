import Link from 'next/link'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import Score from '@/frontend/components/sports/Score'
import { getTeamDisplayName } from '@/shared/utils/team-display'

import type { HomeMatchEntry } from '@/frontend/components/home/matchday/types'
import type { AppLocale } from '@/shared/i18n/locales'

function getMatchHref(entry: HomeMatchEntry) {
  return `/partido/${entry.match.externalId ?? entry.match.id}`
}

function FeaturedMatch({
  entry,
  locale,
  live,
  featured,
}: {
  entry: HomeMatchEntry
  locale: AppLocale
  live: boolean
  featured: boolean
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

  return (
    <article
      className={`hf-home-live-card${featured ? ' is-featured' : ''}`}
    >
      <div className="hf-home-live-competition">
        <LeagueLogo src={competition.logo} alt="" size={22} />
        <span>{competition.title}</span>
      </div>

      <Link
        href={getMatchHref(entry)}
        className="hf-home-live-match"
        aria-label={`Abrir ${homeName} vs ${awayName}`}
      >
        <span className="hf-home-live-team">
          <TeamLogo
            src={match.homeLogo}
            team={{ id: match.homeId }}
            alt=""
            size={featured ? 42 : 34}
          />
          <strong>{homeName}</strong>
        </span>

        <span className="hf-home-live-score">
          {live ? (
            <Score
              home={match.goalsHome}
              away={match.goalsAway}
              homeTeam={homeName}
              awayTeam={awayName}
              homePenalties={match.homePenaltyScore}
              awayPenalties={match.awayPenaltyScore}
            />
          ) : (
            <time dateTime={match.date}>{match.displayTime}</time>
          )}
          <small>
            {live && match.minute
              ? `${match.minute}'`
              : live
                ? match.displayStatus
                : 'Hora Argentina'}
          </small>
        </span>

        <span className="hf-home-live-team is-away">
          <TeamLogo
            src={match.awayLogo}
            team={{ id: match.awayId }}
            alt=""
            size={featured ? 42 : 34}
          />
          <strong>{awayName}</strong>
        </span>
      </Link>
    </article>
  )
}

export default function HomeLiveRail({
  entries,
  locale,
  live,
}: {
  entries: HomeMatchEntry[]
  locale: AppLocale
  live: boolean
}) {
  const matchLabel =
    entries.length === 1 ? '1 partido en juego' : `${entries.length} partidos en juego`

  return (
    <section
      className={`hf-home-live-rail${live ? ' is-live' : ' is-upcoming'}`}
      aria-labelledby="home-live-title"
    >
      <div className="hf-home-live-rail-inner">
        <header className="hf-home-live-heading">
          <span>{live ? 'Ahora' : 'Lo próximo'}</span>
          <div>
            <i aria-hidden="true" />
            <h1 id="home-live-title">
              {entries.length
                ? live
                  ? matchLabel
                  : 'La jornada sigue'
                : 'Sin partidos confirmados'}
            </h1>
          </div>
        </header>

        {entries.length ? (
          <div className="hf-home-live-grid">
            {entries.slice(0, 3).map((entry, index) => (
              <FeaturedMatch
                key={String(entry.match.externalId ?? entry.match.id)}
                entry={entry}
                locale={locale}
                live={live}
                featured={index === 0}
              />
            ))}
          </div>
        ) : (
          <p className="hf-home-live-empty">
            Elegí otra fecha para explorar la agenda completa.
          </p>
        )}
      </div>
    </section>
  )
}
