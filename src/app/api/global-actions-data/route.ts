import { NextResponse } from 'next/server'
import {
  readCachedHomeMatchesByDate,
  withGoalScorers,
  type MatchListItemWithGoalScorers,
} from '@/lib/api-football'
import { TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'
import type {
  GlobalActionCompetition,
  GlobalActionLiveEvent,
  GlobalActionMatch,
  GlobalActionPage,
  GlobalActionTeam,
  GlobalActionsData,
} from '@/shared/global-actions-data'
import {
  addDaysToISO,
  formatMatchTimeArgentina,
  getArgentinaTodayISO,
} from '@/shared/utils/argentina-time'
import {
  formatHomeMatchStatus,
  formatMatchScoreWithPenalties,
} from '@/shared/utils/match-display'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const PAGES: GlobalActionPage[] = [
  {
    key: 'inicio',
    title: 'Inicio',
    description: 'Resultados, partidos, competiciones y noticias.',
    href: '/',
  },
  {
    key: 'partidos',
    title: 'Partidos',
    description: 'Lista de partidos del dia.',
    href: '/#partidos',
  },
  {
    key: 'prode',
    title: 'Prode',
    description: 'Pronosticos, torneos privados y ranking.',
    href: '/prode',
  },
  {
    key: 'noticias',
    title: 'Noticias',
    description: 'Notas y guias de Hay Fulbo.',
    href: '/noticias',
  },
  {
    key: 'mundial',
    title: 'Copa del Mundo 2026',
    description: 'Fixture, posiciones y sede del Mundial.',
    href: '/liga/selecciones-mundial',
  },
  {
    key: 'perfil',
    title: 'Perfil',
    description: 'Cuenta, preferencias y sesion.',
    href: '/perfil',
  },
]

function getMatchId(match: MatchListItemWithGoalScorers) {
  return String(match.externalId ?? match.id)
}

function getMatchHref(match: MatchListItemWithGoalScorers) {
  return `/partido/${getMatchId(match)}`
}

function getBroadcastInfo(match: MatchListItemWithGoalScorers) {
  const broadcasters = match.broadcasters || []
  const firstWithLogo = broadcasters.find((broadcaster) => broadcaster.logoUrl)
  const names = broadcasters.map((broadcaster) => broadcaster.name).filter(Boolean)
  const label = names.length ? names.join(' / ') : match.broadcastChannel || null

  return {
    label,
    logoUrl: firstWithLogo?.logoUrl ?? match.broadcastLogoUrl ?? null,
  }
}

function addTeam(teams: Map<string, GlobalActionTeam>, team: GlobalActionTeam) {
  if (!team.id || teams.has(team.id)) return

  teams.set(team.id, team)
}

function mapMatch(match: MatchListItemWithGoalScorers): GlobalActionMatch {
  const tv = getBroadcastInfo(match)

  return {
    id: getMatchId(match),
    fixtureId: match.externalId ?? match.id,
    href: getMatchHref(match),
    date: match.date,
    displayTime: formatMatchTimeArgentina(match.date),
    displayScore: formatMatchScoreWithPenalties({
      goalsHome: match.goalsHome,
      goalsAway: match.goalsAway,
      homePenaltyScore: match.homePenaltyScore,
      awayPenaltyScore: match.awayPenaltyScore,
    }),
    displayStatus: formatHomeMatchStatus({
      statusShort: match.statusShort,
      minute: match.minute,
      date: match.date,
      locale: 'es',
    }),
    statusShort: match.statusShort,
    minute: match.minute,
    home: match.home,
    away: match.away,
    homeId: match.homeId ? String(match.homeId) : null,
    awayId: match.awayId ? String(match.awayId) : null,
    homeLogo: match.homeLogo ?? null,
    awayLogo: match.awayLogo ?? null,
    tvLabel: tv.label,
    tvLogoUrl: tv.logoUrl,
  }
}

async function readMatchesForDate(date: string) {
  try {
    return await withGoalScorers(await readCachedHomeMatchesByDate(date))
  } catch (error) {
    console.warn('[global-actions-data] No se pudieron leer partidos.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })

    return []
  }
}

export async function GET() {
  const today = getArgentinaTodayISO()
  const dates = [addDaysToISO(today, -1), today, addDaysToISO(today, 1)]
  const matchesByDate = await Promise.all(dates.map(readMatchesForDate))
  const matches = matchesByDate.flat()
  const uniqueMatches = new Map<string, MatchListItemWithGoalScorers>()

  for (const match of matches) {
    uniqueMatches.set(getMatchId(match), match)
  }

  const teams = new Map<string, GlobalActionTeam>()
  const mappedMatches = Array.from(uniqueMatches.values()).slice(0, 90).map((match) => {
    if (match.homeId) {
      addTeam(teams, {
        id: String(match.homeId),
        name: match.home,
        logoUrl: match.homeLogo ?? null,
        country: match.country ?? null,
        href: `/equipo/${match.homeId}`,
      })
    }

    if (match.awayId) {
      addTeam(teams, {
        id: String(match.awayId),
        name: match.away,
        logoUrl: match.awayLogo ?? null,
        country: match.country ?? null,
        href: `/equipo/${match.awayId}`,
      })
    }

    return mapMatch(match)
  })

  const competitions: GlobalActionCompetition[] = TOURNAMENT_PAGE_CONFIGS.map((competition) => ({
    key: competition.key,
    title: competition.title,
    country: competition.country === 'World' ? 'Internacional' : competition.country ?? null,
    href: `/liga/${competition.key}`,
  }))

  const liveEvents: GlobalActionLiveEvent[] = Array.from(uniqueMatches.values()).flatMap((match) =>
    (match.liveEvents || []).map((event) => ({
      id: event.id,
      matchId: getMatchId(match),
      fixtureId: match.externalId ?? match.id,
      href: getMatchHref(match),
      title: event.label,
      description: `${match.home} vs ${match.away}${event.minute ? ` · ${event.minute}'` : ''}`,
      teamName: event.teamName ?? null,
      createdAt: new Date().toISOString(),
    }))
  )

  const payload: GlobalActionsData = {
    generatedAt: new Date().toISOString(),
    teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    competitions,
    matches: mappedMatches,
    liveEvents,
    pages: PAGES,
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
