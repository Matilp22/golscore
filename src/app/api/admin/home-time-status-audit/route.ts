import { NextResponse } from 'next/server'

import { getMatchesByDate } from '@/lib/api-football'
import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'
import {
  formatMatchDateTimeArgentina,
  formatMatchTimeArgentina,
  getArgentinaDateISO,
  getArgentinaMatchTimestamp,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { getExcludedCompetitionReason } from '@/shared/utils/competition-filter'
import {
  formatHomeMatchStatus,
  formatMatchStatusUnderScore,
} from '@/shared/utils/match-display'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'

type VisibleHomeMatch = Awaited<ReturnType<typeof getMatchesByDate>>[number]
type AuditIssue =
  | 'OK'
  | 'TIMEZONE_MISMATCH'
  | 'STATUS_STALE'
  | 'STARTED_BUT_RENDERED_UPCOMING'
  | 'FINISHED_BUT_RENDERED_LIVE'
  | 'FUTURE_OK'
  | 'PAST_NS_NEEDS_SYNC'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return false
  return request.headers.get('x-cron-secret') === cronSecret
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function containsNormalizedPhrase(value: string, phrase: string) {
  if (!value || !phrase) return false

  return ` ${value} `.includes(` ${phrase} `)
}

function isVisibleHomeCompetition(match: VisibleHomeMatch) {
  const excludedReason = getExcludedCompetitionReason({
    leagueId: match.leagueId,
    league: match.league,
    leagueName: match.league,
    country: match.country,
    home: match.home,
    away: match.away,
  })

  if (excludedReason) return false

  return VISIBLE_TOURNAMENT_PAGE_CONFIGS.some((tournament) => {
    const country = normalizeText(match.country)
    const tournamentCountry = normalizeText(tournament.country)
    const countryMatches =
      !tournamentCountry ||
      tournamentCountry === country ||
      tournamentCountry === 'world'

    if (!countryMatches) return false

    const league = normalizeText(match.league)

    return tournament.searchTerms.some((term) => {
      const normalizedTerm = normalizeText(term)

      return league === normalizedTerm || containsNormalizedPhrase(league, normalizedTerm)
    })
  })
}

function legacyFormatMatchTime(date: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))
}

function getExpectedDisplay(match: VisibleHomeMatch) {
  return formatHomeMatchStatus({
    statusShort: match.statusShort,
    minute: match.minute,
    date: match.date,
  })
}

function getIssue(match: VisibleHomeMatch, expectedDisplay: string, displayedTime: string): AuditIssue {
  const now = Date.now()
  const matchTimestamp = getArgentinaMatchTimestamp(match.date)
  const legacyDisplayedTime = legacyFormatMatchTime(match.date)
  const wouldRenderUpcoming = expectedDisplay === displayedTime
  const isPast = Number.isFinite(matchTimestamp) && matchTimestamp < now
  const hoursSinceStart = isPast ? (now - matchTimestamp) / 3_600_000 : 0

  if (legacyDisplayedTime !== displayedTime) return 'TIMEZONE_MISMATCH'

  if (isLiveStatus(match.statusShort)) {
    return wouldRenderUpcoming ? 'STARTED_BUT_RENDERED_UPCOMING' : 'OK'
  }

  if (isFinishedStatus(match.statusShort)) {
    return expectedDisplay.toLowerCase().includes('vivo') ? 'FINISHED_BUT_RENDERED_LIVE' : 'OK'
  }

  if (isPostponedStatus(match.statusShort)) return 'OK'

  if (isUpcomingStatus(match.statusShort)) {
    if (isPast && hoursSinceStart >= 2) return 'PAST_NS_NEEDS_SYNC'
    if (isPast) return 'STATUS_STALE'
    return 'FUTURE_OK'
  }

  return 'OK'
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getArgentinaTodayISO()
    const matches = (await getMatchesByDate(date)).filter(isVisibleHomeCompetition)
    const visibleMatches = matches.map((match) => {
      const displayedTime = formatMatchTimeArgentina(match.date)
      const expectedDisplay = getExpectedDisplay(match)
      const issue = getIssue(match, expectedDisplay, displayedTime)

      return {
        external_id: match.externalId ?? match.id,
        local: match.home,
        visitante: match.away,
        league: match.league,
        match_date_utc: toArgentinaDate(match.date).toISOString(),
        match_date_argentina: formatMatchDateTimeArgentina(match.date),
        argentina_date: getArgentinaDateISO(match.date),
        displayed_time: displayedTime,
        legacy_displayed_time: legacyFormatMatchTime(match.date),
        status: match.statusShort,
        status_long: match.statusLong,
        elapsed: match.minute,
        home_score: match.goalsHome,
        away_score: match.goalsAway,
        expected_display: expectedDisplay,
        status_under_score: formatMatchStatusUnderScore({
          statusShort: match.statusShort,
          minute: match.minute,
          date: match.date,
        }),
        issue,
      }
    })

    const liveMatches = visibleMatches.filter((match) => isLiveStatus(match.status)).length
    const finishedMatches = visibleMatches.filter((match) => isFinishedStatus(match.status)).length
    const upcomingMatches = visibleMatches.filter((match) => isUpcomingStatus(match.status)).length
    const staleMatches = visibleMatches.filter((match) =>
      ['STATUS_STALE', 'PAST_NS_NEEDS_SYNC', 'STARTED_BUT_RENDERED_UPCOMING'].includes(match.issue)
    ).length

    return NextResponse.json(
      {
        ok: true,
        date,
        total_visible_matches: visibleMatches.length,
        live_matches: liveMatches,
        finished_matches: finishedMatches,
        upcoming_matches: upcomingMatches,
        stale_matches: staleMatches,
        visible_matches: visibleMatches,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    console.error('[home-time-status-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar Home.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
