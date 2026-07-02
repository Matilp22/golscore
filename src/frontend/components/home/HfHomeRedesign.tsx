import Link from 'next/link'
import type { ReactNode } from 'react'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import MatchReminderButton from '@/frontend/components/matches/MatchReminderButton'
import SafeImage from '@/frontend/components/SafeImage'
import type { MatchGoalScorer, MatchListItemWithGoalScorers } from '@/lib/api-football'
import { formatEditorialCategory } from '@/shared/editorial-format'
import { t, type AppLocale } from '@/shared/i18n/locales'
import { getTeamDisplayName } from '@/shared/utils/team-display'
import { formatEventMinute } from '@/shared/utils/event-minute'
import {
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'

type HomeProdePrediction = {
  predictedHomeScore: number
  predictedAwayScore: number
}

export type HfHomeMatch = MatchListItemWithGoalScorers & {
  displayTime: string
  displayScore: string
  displayStatus: string
  prediction?: HomeProdePrediction | null
}

export type HfHomeCompetition = {
  key: string
  title: string
  logo?: string
  href?: string | null
  matches: HfHomeMatch[]
}

export type HfHomeArticle = {
  slug: string
  title: string
  summary: string
  category: string
  updatedAt: string
  heroImage?: string
  image?: string
}

type HfHomeRedesignProps = {
  locale: AppLocale
  dayOptions: Array<{ label: string; value: string }>
  selectedDate: string
  competitions: HfHomeCompetition[]
  articles: HfHomeArticle[]
  autoRefresh: ReactNode
  dataError?: string | null
  noMatchesLabel: string
}

function Icon({ name, className = 'h-4 w-4' }: { name: 'chevron' | 'ball' | 'tv'; className?: string }) {
  if (name === 'chevron') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    )
  }

  if (name === 'tv') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path d="M4 6h16v10H4zM9 20h6M12 16v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 8 4-2.4L16 8l-1.5 4.3H9.5L8 8Zm1.5 4.3L7 16m7.5-3.7L17 16m-5-10.4V3m-5 13 2.5 3.2m5-3.2L12 19.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  )
}

function SectionHeader({
  title,
  href,
  count,
  live,
}: {
  title: string
  href?: string
  count?: number
  live?: boolean
}) {
  return (
    <div className="hf-home-section-head">
      <h2>
        {title}
        {live ? <span className="hf-home-live-dot" aria-hidden="true" /> : null}
      </h2>
      {href ? (
        <Link href={href} className="hf-home-section-link">
          Ver todos{typeof count === 'number' ? ` (${count})` : ''}
          <Icon name="chevron" className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  )
}

function getMatchHref(match: HfHomeMatch) {
  return `/partido/${match.externalId ?? match.id}`
}

function getProgress(match: HfHomeMatch) {
  if (isFinishedStatus(match.statusShort)) return 100
  if (!isLiveStatus(match.statusShort)) return 8
  if (!match.minute || match.minute < 1) return 12

  return Math.min(96, Math.max(12, Math.round((match.minute / 90) * 100)))
}

function getMatchBadge(match: HfHomeMatch) {
  if (isLiveStatus(match.statusShort)) return 'EN VIVO'
  if (isFinishedStatus(match.statusShort)) return 'FINAL'
  if (isUpcomingStatus(match.statusShort)) return match.displayTime

  return match.displayStatus || match.statusShort
}

function getBroadcastInfo(match: HfHomeMatch) {
  const broadcasters = match.broadcasters || []
  const firstWithLogo = broadcasters.find((broadcaster) => broadcaster.logoUrl)
  const names = broadcasters.map((broadcaster) => broadcaster.name).filter(Boolean)
  const label = names.length ? names.join(' / ') : match.broadcastChannel || null

  return {
    label: label || 'TV no confirmada',
    logoUrl: firstWithLogo?.logoUrl ?? match.broadcastLogoUrl ?? null,
    confirmed: Boolean(label),
  }
}

function BroadcastPill({ match, compact = false }: { match: HfHomeMatch; compact?: boolean }) {
  const broadcast = getBroadcastInfo(match)

  return (
    <span className={`hf-home-tv-pill ${broadcast.confirmed ? '' : 'is-muted'} ${compact ? 'is-compact' : ''}`}>
      {broadcast.logoUrl ? (
        <SafeImage
          src={broadcast.logoUrl}
          alt={broadcast.label}
          imageType="broadcast"
          width={18}
          height={18}
          className="h-[18px] w-[18px] object-contain"
          fallbackClassName="h-4 w-4"
        />
      ) : (
        <Icon name="tv" className="h-4 w-4" />
      )}
      <span>{broadcast.label}</span>
    </span>
  )
}

function formatGoalScorer(goal: MatchGoalScorer) {
  const suffix =
    goal.kind === 'penalty'
      ? ' pen.'
      : goal.kind === 'own-goal'
        ? ' e/c'
        : ''

  return `${goal.player} ${formatEventMinute(goal.minute, goal.extraMinute)}${suffix}`
}

function TeamScorers({
  goals,
  align = 'center',
}: {
  goals?: MatchGoalScorer[]
  align?: 'left' | 'center' | 'right'
}) {
  if (!goals?.length) return null

  return (
    <small className={`hf-home-team-scorers is-${align}`}>
      {goals.map(formatGoalScorer).join('; ')}
    </small>
  )
}

function TeamBlock({
  name,
  logo,
  league,
  country,
  locale,
  scorers,
}: {
  name: string
  logo?: string
  league: string
  country?: string
  locale: AppLocale
  scorers?: MatchGoalScorer[]
}) {
  const displayName = getTeamDisplayName({ name, league, country, locale })

  return (
    <div className="hf-home-team-block">
      <TeamLogo
        src={logo}
        alt={displayName}
        size={62}
        className="h-full w-full object-contain"
        fallbackClassName="h-11 w-10"
      />
      <span>{displayName}</span>
      <TeamScorers goals={scorers} />
    </div>
  )
}

function LiveMatchCard({ match, locale }: { match: HfHomeMatch; locale: AppLocale }) {
  const isLive = isLiveStatus(match.statusShort)
  const centerValue = match.displayScore === '- - -' ? match.displayTime : match.displayScore
  const progress = getProgress(match)

  return (
    <Link href={getMatchHref(match)} className="hf-home-live-card">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <BroadcastPill match={match} compact />
        </div>
        <span className={isLive ? 'hf-home-live-badge' : 'hf-home-status-badge'}>
          {getMatchBadge(match)}
        </span>
      </div>

      <div className="hf-home-live-score">
        <TeamBlock
          name={match.home}
          logo={match.homeLogo}
          league={match.league}
          country={match.country}
          locale={locale}
          scorers={match.goalScorers?.home}
        />
        <div className="hf-home-score-center">
          <strong>{centerValue}</strong>
          <span className={isLive ? 'is-live' : ''}>
            {isLive && match.minute ? `${match.minute}'` : match.displayStatus}
          </span>
        </div>
        <TeamBlock
          name={match.away}
          logo={match.awayLogo}
          league={match.league}
          country={match.country}
          locale={locale}
          scorers={match.goalScorers?.away}
        />
      </div>

      <div className="hf-home-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
        <Icon name="ball" className="hf-home-progress-ball" />
      </div>
    </Link>
  )
}

function UpcomingMatchRow({ match, locale }: { match: HfHomeMatch; locale: AppLocale }) {
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
    <div className="hf-home-upcoming-row">
      <Link href={getMatchHref(match)} className="hf-home-upcoming-main">
        <div className="hf-home-upcoming-time">
          <span>{isUpcomingStatus(match.statusShort) ? 'HOY' : match.displayStatus}</span>
          <strong>{match.displayTime}</strong>
        </div>
        <div className="hf-home-upcoming-team is-home">
          <div className="hf-home-upcoming-team-copy">
            <span>{homeName}</span>
            <TeamScorers goals={match.goalScorers?.home} align="right" />
          </div>
          <TeamLogo src={match.homeLogo} alt={homeName} size={34} className="h-full w-full object-contain" />
        </div>
        <div className="hf-home-upcoming-center">
          <strong>{match.displayScore === '- - -' ? 'vs' : match.displayScore}</strong>
          <span>{match.displayStatus}</span>
        </div>
        <div className="hf-home-upcoming-team is-away">
          <TeamLogo src={match.awayLogo} alt={awayName} size={34} className="h-full w-full object-contain" />
          <div className="hf-home-upcoming-team-copy">
            <span>{awayName}</span>
            <TeamScorers goals={match.goalScorers?.away} align="left" />
          </div>
        </div>
      </Link>
      <div className="hf-home-upcoming-actions">
        <BroadcastPill match={match} />
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
            tvLabel: getBroadcastInfo(match).label,
            tvLogoUrl: getBroadcastInfo(match).logoUrl,
          }}
        />
      </div>
    </div>
  )
}

function CompetitionCard({ competition }: { competition: HfHomeCompetition }) {
  const content = (
    <>
      <LeagueLogo
        src={competition.logo}
        alt={competition.title}
        size={56}
        className="h-full w-full object-contain"
        fallbackClassName="h-10 w-9"
      />
      <span>{competition.title}</span>
    </>
  )

  if (!competition.href) {
    return <div className="hf-home-competition-card">{content}</div>
  }

  return (
    <Link href={competition.href} className="hf-home-competition-card">
      {content}
    </Link>
  )
}

function NewsCard({ article, index }: { article: HfHomeArticle; index: number }) {
  const image = article.heroImage ?? article.image

  return (
    <Link href={`/noticias/${article.slug}`} className="hf-home-news-card">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" />
      ) : (
        <div className={`hf-home-news-fallback is-${(index % 3) + 1}`} aria-hidden="true">
          <span>HF</span>
        </div>
      )}
      <div className="hf-home-news-overlay">
        <span>{formatEditorialCategory(article.category)}</span>
        <h3>{article.title}</h3>
        <p>Hace poco</p>
      </div>
    </Link>
  )
}

function AllCompetitionMatches({
  competitions,
  locale,
}: {
  competitions: HfHomeCompetition[]
  locale: AppLocale
}) {
  return (
    <section id="partidos" className="hf-home-all-matches">
      <SectionHeader title="Todos los partidos" />
      <div className="space-y-3">
        {competitions.map((competition) => (
          <div key={competition.key} id={competition.key} className="hf-home-competition-list">
            <div className="hf-home-competition-list-head">
              <div className="flex min-w-0 items-center gap-2">
                <LeagueLogo
                  src={competition.logo}
                  alt={competition.title}
                  size={28}
                  className="h-full w-full object-contain"
                />
                <h3>{competition.title}</h3>
              </div>
              <span>
                {competition.matches.length}{' '}
                {t(locale, competition.matches.length === 1 ? 'home.matchSingular' : 'home.matchPlural')}
              </span>
            </div>
            <div>
              {competition.matches.map((match) => (
                <UpcomingMatchRow key={match.id} match={match} locale={locale} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
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
  const allMatches = competitions.flatMap((competition) => competition.matches)
  const liveMatches = allMatches.filter((match) => isLiveStatus(match.statusShort))
  const upcomingMatches = allMatches.filter((match) => isUpcomingStatus(match.statusShort)).slice(0, 3)
  const featuredCompetitions = competitions.slice(0, 5)
  const featuredArticles = articles.slice(0, 3)
  const todayValue = dayOptions.find((day) => day.label.toLowerCase() === 'hoy')?.value
  const isPastDate = Boolean(todayValue && selectedDate < todayValue)
  const allCompetitionMatchesSection = competitions.length ? (
    <AllCompetitionMatches competitions={competitions} locale={locale} />
  ) : dataError ? null : (
    <div className="hf-home-empty-card">{noMatchesLabel}</div>
  )

  return (
    <div className="hf-home-page">
      <div className="hf-home-topbar">
        <nav className="hf-date-switcher" aria-label="Seleccionar fecha">
          {dayOptions.map((day) => {
            const active = selectedDate === day.value

            return (
              <Link
                key={day.value}
                href={`/?date=${day.value}`}
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
              >
                {day.label}
              </Link>
            )
          })}
        </nav>
        <div className="hf-home-refresh">{autoRefresh}</div>
      </div>

      {dataError ? (
        <div className="hf-home-alert">{dataError}</div>
      ) : null}

      {isPastDate ? (
        allCompetitionMatchesSection
      ) : (
        <>
          <section>
            <SectionHeader title="En vivo" href="/#partidos" count={liveMatches.length} live />
            {liveMatches.length ? (
              <>
                <div className="hf-home-live-grid">
                  {liveMatches.slice(0, 3).map((match) => (
                    <LiveMatchCard key={match.id} match={match} locale={locale} />
                  ))}
                </div>
                <div className="hf-home-carousel-dots" aria-hidden="true">
                  <span className="is-active" />
                  <span />
                  <span />
                  <span />
                </div>
              </>
            ) : (
              <div className="hf-home-empty-card">No hay partidos en vivo ahora.</div>
            )}
          </section>

          <section>
            <SectionHeader title="Proximos partidos" href="/#partidos" />
            {upcomingMatches.length ? (
              <div className="hf-home-upcoming-list">
                {upcomingMatches.map((match) => (
                  <UpcomingMatchRow key={match.id} match={match} locale={locale} />
                ))}
              </div>
            ) : (
              <div className="hf-home-empty-card">No hay proximos partidos para esta fecha.</div>
            )}
          </section>
        </>
      )}

      <section>
        <SectionHeader title="Competiciones destacadas" href="/competiciones" />
        {featuredCompetitions.length ? (
          <div className="hf-home-competitions">
            {featuredCompetitions.map((competition) => (
              <CompetitionCard key={competition.key} competition={competition} />
            ))}
            <Link href="/competiciones" className="hf-home-competition-card is-more">
              <span className="hf-home-more-circle">
                <Icon name="chevron" className="h-5 w-5" />
              </span>
              <span>Ver todas</span>
            </Link>
          </div>
        ) : (
          <div className="hf-home-empty-card">No hay competiciones destacadas para mostrar.</div>
        )}
      </section>

      <section>
        <SectionHeader title="Noticias destacadas" href="/noticias" />
        {featuredArticles.length ? (
          <div className="hf-home-news-grid">
            {featuredArticles.map((article, index) => (
              <NewsCard key={article.slug} article={article} index={index} />
            ))}
          </div>
        ) : (
          <div className="hf-home-empty-card">Todavia no hay noticias publicadas.</div>
        )}
      </section>

      {isPastDate ? null : allCompetitionMatchesSection}
    </div>
  )
}
