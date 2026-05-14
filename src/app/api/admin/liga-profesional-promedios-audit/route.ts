import { NextResponse } from 'next/server'

import {
  getLeagueStandings,
  resolveTournament,
  type LeagueStandingGroup,
  type LeagueStandingRow,
} from '@/lib/api-football'
import { getTournamentConfig } from '@/lib/tournament-pages'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type AuditTeam = {
  key: string
  teamId?: number
  teamName: string
  seasons: Array<{ season: number; points: number; played: number }>
  totalPoints: number
  totalPlayed: number
  source: string
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function normalizeTeamLookupText(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTeamKey(row: Pick<LeagueStandingRow, 'teamId' | 'teamName'>) {
  return row.teamId !== undefined && row.teamId !== null
    ? `id:${row.teamId}`
    : `name:${normalizeTeamLookupText(row.teamName)}`
}

function isDerivedTableGroup(name: string) {
  const normalized = normalizeTeamLookupText(name)

  return (
    normalized.includes('anual') ||
    normalized.includes('annual') ||
    normalized.includes('promedio') ||
    normalized.includes('average') ||
    normalized.includes('relegation') ||
    normalized.includes('descenso') ||
    normalized.includes('overall')
  )
}

function getBaseRows(groups: LeagueStandingGroup[]) {
  return groups
    .filter((group) => !isDerivedTableGroup(group.name))
    .flatMap((group) => group.rows)
}

function dedupeRows(rows: LeagueStandingRow[]) {
  const byTeam = new Map<string, LeagueStandingRow>()

  for (const row of rows) {
    const key = getTeamKey(row)
    const current = byTeam.get(key)

    if (!current || row.played * 1000 + row.points > current.played * 1000 + current.points) {
      byTeam.set(key, row)
    }
  }

  return [...byTeam.values()]
}

function buildAuditTeams(
  standingsBySeason: Array<{ season: number; standings: LeagueStandingGroup[] }>
) {
  const teams = new Map<string, AuditTeam>()

  for (const seasonEntry of standingsBySeason) {
    for (const row of dedupeRows(getBaseRows(seasonEntry.standings))) {
      const key = getTeamKey(row)
      const current = teams.get(key) ?? {
        key,
        teamId: row.teamId,
        teamName: row.teamName,
        seasons: [],
        totalPoints: 0,
        totalPlayed: 0,
        source: 'standings',
      }

      current.seasons.push({
        season: seasonEntry.season,
        points: row.points,
        played: row.played,
      })
      current.totalPoints += row.points
      current.totalPlayed += row.played
      teams.set(key, current)
    }
  }

  return [...teams.values()].sort((a, b) => a.teamName.localeCompare(b.teamName, 'es-AR'))
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401, headers: NO_STORE_HEADERS }
    )
  }

  try {
    const tournament = getTournamentConfig('argentina-liga-profesional')
    if (!tournament) {
      return NextResponse.json(
        { ok: false, error: 'No se encontro configuracion de Liga Profesional.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }

    const resolved = await resolveTournament(tournament.searchTerms, tournament.country)
    if (!resolved) {
      return NextResponse.json(
        { ok: false, error: 'No se pudo resolver Liga Profesional.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }

    const seasons = [resolved.season - 2, resolved.season - 1, resolved.season]
    const standingsBySeason = await Promise.all(
      seasons.map((season) =>
        getLeagueStandings(resolved.leagueId, season).then((standings) => ({
          season,
          standings,
        }))
      )
    )
    const currentSeason = standingsBySeason.find((entry) => entry.season === resolved.season)
    const currentTeamKeys = new Set(
      dedupeRows(getBaseRows(currentSeason?.standings ?? [])).map((row) => getTeamKey(row))
    )
    const teams = buildAuditTeams(standingsBySeason)
    const included = teams.filter((team) => currentTeamKeys.has(team.key))
    const excludedHistoricalOnly = teams.filter((team) => !currentTeamKeys.has(team.key))

    return NextResponse.json(
      {
        ok: true,
        league: {
          id: resolved.leagueId,
          name: resolved.name,
          season: resolved.season,
        },
        seasons,
        totals: {
          currentTeams: currentTeamKeys.size,
          historicalTeams: teams.length,
          includedInPromedios: included.length,
          excludedHistoricalOnly: excludedHistoricalOnly.length,
        },
        includedTeams: included.map((team) => ({
          teamId: team.teamId ?? null,
          teamName: team.teamName,
          totalPoints: team.totalPoints,
          totalPlayed: team.totalPlayed,
          source: team.source,
          reasonIncluded: 'current_season_participant',
          seasons: team.seasons,
        })),
        excludedHistoricalOnlyTeams: excludedHistoricalOnly.map((team) => ({
          teamId: team.teamId ?? null,
          teamName: team.teamName,
          totalPoints: team.totalPoints,
          totalPlayed: team.totalPlayed,
          source: team.source,
          reasonExcluded: 'not_current_season_participant',
          seasons: team.seasons,
        })),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.error('[liga-profesional-promedios-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar la tabla de promedios.',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
