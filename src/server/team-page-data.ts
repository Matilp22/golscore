import 'server-only'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { TOURNAMENT_PAGE_CONFIGS } from '@/lib/tournament-pages'
import {
  getTournamentExternalLeagueId,
  pickLeagueLogoUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'

type DbId = string | number

type StoredTeamIdentity = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url: string | null
}

type StoredLeagueIdentity = {
  id: DbId
  external_id: DbId | null
  name: string | null
  country: string | null
  logo_url: string | null
}

type StoredTeamMatch = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  match_date: string | null
  round: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
}

export type TeamPageCompetition = {
  id: string
  externalId: number | null
  name: string
  country: string | null
  logoUrl: string | null
  href: string | null
}

export type TeamPageMatch = {
  id: string
  date: string | null
  round: string | null
  status: string
  home: {
    id: string | null
    name: string
    logoUrl: string | null
  }
  away: {
    id: string | null
    name: string
    logoUrl: string | null
  }
  homeScore: number | null
  awayScore: number | null
  competition: {
    name: string
    href: string | null
  }
}

export type TeamPageData = {
  competitions: TeamPageCompetition[]
  upcomingMatches: TeamPageMatch[]
  recentMatches: TeamPageMatch[]
  coachName: string | null
  summary: {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
  }
}

const EMPTY_TEAM_PAGE_DATA: TeamPageData = {
  competitions: [],
  upcomingMatches: [],
  recentMatches: [],
  coachName: null,
  summary: {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  },
}

function toFiniteNumber(value: DbId | null | undefined) {
  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function getTournamentHref(leagueExternalId: number | null) {
  if (!leagueExternalId) return null

  const tournament = TOURNAMENT_PAGE_CONFIGS.find(
    (candidate) => getTournamentExternalLeagueId(candidate.key) === leagueExternalId
  )

  return tournament ? `/liga/${tournament.key}` : null
}

function getEntityIds(rows: StoredTeamMatch[], key: 'league_id' | 'home_team_id' | 'away_team_id') {
  return [
    ...new Set(
      rows
        .map((row) => row[key])
        .filter((value): value is DbId => value !== null && value !== undefined)
        .map(String)
    ),
  ]
}

function buildMatch(
  row: StoredTeamMatch,
  teams: Map<string, StoredTeamIdentity>,
  leagues: Map<string, StoredLeagueIdentity>
): TeamPageMatch | null {
  const fixtureId = row.external_id ?? row.id
  const home = row.home_team_id ? teams.get(String(row.home_team_id)) : null
  const away = row.away_team_id ? teams.get(String(row.away_team_id)) : null
  const league = row.league_id ? leagues.get(String(row.league_id)) : null

  if (!fixtureId || !home?.name || !away?.name || !league?.name) return null

  const homeExternalId = toFiniteNumber(home.external_id)
  const awayExternalId = toFiniteNumber(away.external_id)
  const leagueExternalId = toFiniteNumber(league.external_id)

  return {
    id: String(fixtureId),
    date: row.match_date,
    round: row.round,
    status: row.status || 'TBD',
    home: {
      id: homeExternalId ? String(homeExternalId) : null,
      name: home.name,
      logoUrl: pickTeamLogoUrl(home.logo_url, homeExternalId) ?? null,
    },
    away: {
      id: awayExternalId ? String(awayExternalId) : null,
      name: away.name,
      logoUrl: pickTeamLogoUrl(away.logo_url, awayExternalId) ?? null,
    },
    homeScore: row.home_score,
    awayScore: row.away_score,
    competition: {
      name: league.name,
      href: getTournamentHref(leagueExternalId),
    },
  }
}

function getCoachName(
  details: Array<{ lineups: unknown }>,
  teamExternalId: number
) {
  for (const detail of details) {
    if (!Array.isArray(detail.lineups)) continue

    for (const value of detail.lineups) {
      if (!value || typeof value !== 'object') continue

      const lineup = value as {
        team?: { id?: string | number | null }
        coach?: { name?: string | null }
      }
      if (
        Number(lineup.team?.id) === teamExternalId &&
        lineup.coach?.name?.trim()
      ) {
        return lineup.coach.name.trim()
      }
    }
  }

  return null
}

export async function getTeamPageData(teamExternalId: number): Promise<TeamPageData> {
  if (!Number.isFinite(teamExternalId) || teamExternalId <= 0) return EMPTY_TEAM_PAGE_DATA

  const supabase = getSupabaseAdminClient()
  const teamResponse = await supabase
    .from('teams')
    .select('id, external_id, name, logo_url')
    .eq('external_id', String(teamExternalId))
    .maybeSingle()

  if (teamResponse.error || !teamResponse.data) return EMPTY_TEAM_PAGE_DATA

  const storedTeam = teamResponse.data as StoredTeamIdentity
  const now = new Date()
  const rangeStart = new Date(now)
  const rangeEnd = new Date(now)
  rangeStart.setUTCFullYear(rangeStart.getUTCFullYear() - 1)
  rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 1)

  const matchesResponse = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, round, status, home_score, away_score')
    .or(`home_team_id.eq.${storedTeam.id},away_team_id.eq.${storedTeam.id}`)
    .gte('match_date', rangeStart.toISOString())
    .lte('match_date', rangeEnd.toISOString())
    .order('match_date', { ascending: true })
    .limit(300)

  if (matchesResponse.error) return EMPTY_TEAM_PAGE_DATA

  const rows = (matchesResponse.data ?? []) as StoredTeamMatch[]
  const leagueIds = getEntityIds(rows, 'league_id')
  const teamIds = [
    ...new Set([
      ...getEntityIds(rows, 'home_team_id'),
      ...getEntityIds(rows, 'away_team_id'),
    ]),
  ]
  const fixtureExternalIds = rows
    .map((row) => row.external_id)
    .filter((value): value is DbId => value !== null && value !== undefined)
    .slice(-30)
    .map(String)
  const [leaguesResponse, teamsResponse, detailsResponse] = await Promise.all([
    leagueIds.length
      ? supabase
          .from('leagues')
          .select('id, external_id, name, country, logo_url')
          .in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase
          .from('teams')
          .select('id, external_id, name, logo_url')
          .in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    fixtureExternalIds.length
      ? supabase
          .from('football_match_detail_cache')
          .select('lineups, updated_at')
          .in('fixture_external_id', fixtureExternalIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (leaguesResponse.error || teamsResponse.error) return EMPTY_TEAM_PAGE_DATA

  const leagueRows = (leaguesResponse.data ?? []) as StoredLeagueIdentity[]
  const teamRows = (teamsResponse.data ?? []) as StoredTeamIdentity[]
  const leagues = new Map(leagueRows.map((league) => [String(league.id), league]))
  const teams = new Map(teamRows.map((team) => [String(team.id), team]))
  const matches = rows
    .map((row) => buildMatch(row, teams, leagues))
    .filter((match): match is TeamPageMatch => Boolean(match))
  const nowTimestamp = now.getTime()
  const completedMatches = matches.filter(
    (match) =>
      ['FT', 'AET', 'PEN'].includes(match.status) &&
      match.homeScore !== null &&
      match.awayScore !== null
  )
  const summary = completedMatches.reduce(
    (totals, match) => {
      const isHome = match.home.id === String(teamExternalId)
      const goalsFor = isHome ? match.homeScore! : match.awayScore!
      const goalsAgainst = isHome ? match.awayScore! : match.homeScore!

      totals.played += 1
      totals.goalsFor += goalsFor
      totals.goalsAgainst += goalsAgainst
      if (goalsFor > goalsAgainst) totals.wins += 1
      else if (goalsFor === goalsAgainst) totals.draws += 1
      else totals.losses += 1

      return totals
    },
    {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }
  )
  const upcomingMatches = matches
    .filter((match) => {
      const timestamp = match.date ? new Date(match.date).getTime() : Number.NaN
      return Number.isFinite(timestamp) && timestamp >= nowTimestamp
    })
    .slice(0, 6)
  const recentMatches = matches
    .filter((match) => {
      const timestamp = match.date ? new Date(match.date).getTime() : Number.NaN
      return Number.isFinite(timestamp) && timestamp < nowTimestamp
    })
    .slice(-6)
    .reverse()
  const competitionIds = [
    ...new Set(
      rows
        .map((row) => row.league_id)
        .filter((value): value is DbId => value !== null && value !== undefined)
        .map(String)
    ),
  ]
  const competitions = competitionIds
    .map((leagueId): TeamPageCompetition | null => {
      const league = leagues.get(leagueId)
      if (!league?.name) return null

      const externalId = toFiniteNumber(league.external_id)

      return {
        id: leagueId,
        externalId,
        name: league.name,
        country: league.country,
        logoUrl: pickLeagueLogoUrl(league.logo_url, externalId) ?? null,
        href: getTournamentHref(externalId),
      }
    })
    .filter((competition): competition is TeamPageCompetition => Boolean(competition))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'))

  return {
    competitions,
    upcomingMatches,
    recentMatches,
    coachName: detailsResponse.error
      ? null
      : getCoachName(
          (detailsResponse.data ?? []) as Array<{ lineups: unknown }>,
          teamExternalId
        ),
    summary,
  }
}
