import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { buildMatchDetailViewModel } from '@/server/match-detail-view-model'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'
import {
  getCompetitionStageDisplayLabel,
  normalizeCompetitionDisplayName,
} from '@/shared/utils/competition-display'
import { isFinishedStatus } from '@/shared/utils/match-status'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  round: string | number | null
  match_date: string | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
}

type TeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url: string | null
}

type LeagueRow = {
  id: DbId
  name: string | null
  country: string | null
  season: number | null
}

export type MatchHistoryTeam = {
  id: string | null
  externalId: number | null
  name: string
  logoUrl: string | null
}

export type MatchHistoryItem = {
  id: string
  externalId: string | null
  date: string | null
  competition: string
  stage: string
  status: string | null
  homeTeam: MatchHistoryTeam
  awayTeam: MatchHistoryTeam
  scoreLabel: string
  isCurrentMatch: boolean
}

export type MatchHistoryViewModel = {
  currentMatchId: string
  homeTeam: MatchHistoryTeam
  awayTeam: MatchHistoryTeam
  summary: {
    total: number
    homePerspectiveWins: number
    awayPerspectiveWins: number
    draws: number
    homePerspectiveGoals: number
    awayPerspectiveGoals: number
  }
  items: MatchHistoryItem[]
  warnings: string[]
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeLeagueName(name: string | null | undefined) {
  const translated = normalizeCompetitionDisplayName(name)
  if (translated !== (name?.trim() || 'Competencia')) return translated

  const value = name?.trim() || 'Competencia'
  const lower = value.toLowerCase()

  if (
    lower.includes('international friendlies') ||
    lower.includes('friendly international') ||
    lower.includes('friendlies')
  ) {
    return 'Amistoso'
  }

  if (value === 'World Cup') return 'Copa del Mundo'
  if (value === 'Copa America') return 'Copa América'

  return value
}

function getStageLabel(leagueName: string, round: string | number | null | undefined) {
  return getCompetitionStageDisplayLabel(leagueName, round)
}

function getScoreLabel(match: Pick<MatchRow, 'home_score' | 'away_score' | 'status'>) {
  if (match.home_score !== null || match.away_score !== null) {
    return `${match.home_score ?? '-'} - ${match.away_score ?? '-'}`
  }

  const status = String(match.status ?? '').toUpperCase()
  if (status === 'NS' || status === 'TBD') return 'vs'

  return 'Sin resultado'
}

function createEmptyHistorySummary(): MatchHistoryViewModel['summary'] {
  return {
    total: 0,
    homePerspectiveWins: 0,
    awayPerspectiveWins: 0,
    draws: 0,
    homePerspectiveGoals: 0,
    awayPerspectiveGoals: 0,
  }
}

function isSameHistoryTeam(a: MatchHistoryTeam, b: MatchHistoryTeam) {
  if (a.externalId !== null && b.externalId !== null) return a.externalId === b.externalId
  if (a.id && b.id) return a.id === b.id

  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
}

function parseScoreLabel(scoreLabel: string) {
  const match = scoreLabel.match(/(\d+)\s*-\s*(\d+)/)
  if (!match) return null

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  }
}

function buildHistorySummary(
  items: MatchHistoryItem[],
  perspectiveHome: MatchHistoryTeam
): MatchHistoryViewModel['summary'] {
  return items.reduce((summary, item) => {
    const score = parseScoreLabel(item.scoreLabel)
    if (!score) return summary

    const itemHomeIsPerspectiveHome = isSameHistoryTeam(item.homeTeam, perspectiveHome)
    const homePerspectiveGoals = itemHomeIsPerspectiveHome ? score.home : score.away
    const awayPerspectiveGoals = itemHomeIsPerspectiveHome ? score.away : score.home

    summary.total += 1
    summary.homePerspectiveGoals += homePerspectiveGoals
    summary.awayPerspectiveGoals += awayPerspectiveGoals

    if (homePerspectiveGoals > awayPerspectiveGoals) {
      summary.homePerspectiveWins += 1
    } else if (awayPerspectiveGoals > homePerspectiveGoals) {
      summary.awayPerspectiveWins += 1
    } else {
      summary.draws += 1
    }

    return summary
  }, createEmptyHistorySummary())
}

function getMatchTimestamp(date: string | null | undefined) {
  if (!date) return 0

  const timestamp = new Date(date).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function hasStoredMatchResult(match: Pick<MatchRow, 'home_score' | 'away_score'>) {
  return match.home_score !== null && match.away_score !== null
}

function isPreviousStoredHistoryMatch(
  match: MatchRow,
  currentExternalId: string,
  currentMatchDate: string | null | undefined
) {
  if (String(match.external_id ?? match.id) === currentExternalId) return false
  if (!isFinishedStatus(match.status) && !hasStoredMatchResult(match)) return false

  const matchTimestamp = getMatchTimestamp(match.match_date)
  if (!matchTimestamp) return false

  const currentTimestamp = getMatchTimestamp(currentMatchDate)
  if (currentTimestamp) return matchTimestamp < currentTimestamp

  return matchTimestamp < Date.now()
}

function getTeamFromRow(row: TeamRow | null | undefined, fallback: MatchHistoryTeam) {
  if (!row) return fallback

  return {
    id: String(row.id),
    externalId: toNumber(row.external_id),
    name: row.name?.trim() || fallback.name,
    logoUrl: pickTeamLogoUrl(row.logo_url, row.external_id),
  }
}

function getFixtureTeam(input: {
  id?: number | null
  name?: string | null
  logo?: string | null
  logo_url?: string | null
}) {
  return {
    id: null,
    externalId: input.id ?? null,
    name: input.name?.trim() || 'Equipo',
    logoUrl: pickTeamLogoUrl(input.logo_url ?? input.logo ?? null, input.id ?? null),
  }
}

export async function buildMatchHistoryViewModel(
  matchId: string | number
): Promise<MatchHistoryViewModel> {
  const detail = await buildMatchDetailViewModel({
    fixtureExternalId: matchId,
    matchId,
  })
  const fixture = detail.fixture

  if (!fixture) {
    throw new Error('Partido no encontrado.')
  }

  if (detail.headToHead.matches.length) {
    const homeTeam = getFixtureTeam(fixture.teams.home)
    const awayTeam = getFixtureTeam(fixture.teams.away)

    return {
      currentMatchId: String(fixture.fixture.id),
      homeTeam,
      awayTeam,
      summary: detail.headToHead.summary,
      items: detail.headToHead.matches.map((match) => ({
        id: match.fixtureExternalId ?? `${match.date ?? 'sin-fecha'}-${match.homeTeam.name}-${match.awayTeam.name}`,
        externalId: match.fixtureExternalId,
        date: match.date,
        competition: match.leagueName,
        stage: match.stageLabel || (match.season ? `Temporada ${match.season}` : 'Partido'),
        status: match.status,
        homeTeam: {
          id: null,
          externalId: match.homeTeam.externalId,
          name: match.homeTeam.name,
          logoUrl: match.homeLogoUrl,
        },
        awayTeam: {
          id: null,
          externalId: match.awayTeam.externalId,
          name: match.awayTeam.name,
          logoUrl: match.awayLogoUrl,
        },
        scoreLabel: match.scoreLabel,
        isCurrentMatch: false,
      })),
      warnings: [...detail.headToHead.warnings, ...detail.headToHead.errors],
    }
  }

  const supabase = getSupabaseAdminClient()
  const warnings: string[] = []
  const currentExternalId = String(fixture.fixture.id)
  const fallbackHomeTeam = getFixtureTeam(fixture.teams.home)
  const fallbackAwayTeam = getFixtureTeam(fixture.teams.away)
  const currentMatchResponse = await supabase
    .from('matches')
    .select('id, external_id, home_team_id, away_team_id')
    .eq('external_id', currentExternalId)
    .maybeSingle()

  if (currentMatchResponse.error) throw currentMatchResponse.error

  const currentMatch = currentMatchResponse.data as {
    id: DbId
    external_id: DbId | null
    home_team_id: DbId | null
    away_team_id: DbId | null
  } | null

  const teamExternalIds = [
    fixture.teams.home.id,
    fixture.teams.away.id,
  ].filter((id): id is number => typeof id === 'number')
  const teamsByExternalIdResponse = teamExternalIds.length
    ? await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .in('external_id', teamExternalIds)
    : { data: [], error: null }

  if (teamsByExternalIdResponse.error) throw teamsByExternalIdResponse.error

  const teamsByExternalId = new Map(
    ((teamsByExternalIdResponse.data ?? []) as TeamRow[])
      .map((team) => [String(team.external_id), team])
  )
  const currentHomeTeamRow =
    currentMatch?.home_team_id
      ? null
      : teamsByExternalId.get(String(fixture.teams.home.id))
  const currentAwayTeamRow =
    currentMatch?.away_team_id
      ? null
      : teamsByExternalId.get(String(fixture.teams.away.id))
  const homeTeamId = currentMatch?.home_team_id ?? currentHomeTeamRow?.id ?? null
  const awayTeamId = currentMatch?.away_team_id ?? currentAwayTeamRow?.id ?? null

  if (!homeTeamId || !awayTeamId) {
    warnings.push('No se pudieron resolver equipos internos para buscar historial.')

    return {
      currentMatchId: currentExternalId,
      homeTeam: fallbackHomeTeam,
      awayTeam: fallbackAwayTeam,
      summary: createEmptyHistorySummary(),
      items: [],
      warnings,
    }
  }

  const historyResponse = await supabase
    .from('matches')
    .select(
      'id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score'
    )
    .or(
      `and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`
    )
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(100)

  if (historyResponse.error) throw historyResponse.error

  const matches = ((historyResponse.data ?? []) as MatchRow[])
    .filter((match) =>
      isPreviousStoredHistoryMatch(match, currentExternalId, fixture.fixture.date)
    )
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map((id) => String(id))
    ),
  ]
  const leagueIds = [
    ...new Set(
      matches
        .map((match) => match.league_id)
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map((id) => String(id))
    ),
  ]
  const [teamsResponse, leaguesResponse] = await Promise.all([
    teamIds.length
      ? supabase
          .from('teams')
          .select('id, external_id, name, logo_url')
          .in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? supabase
          .from('leagues')
          .select('id, name, country, season')
          .in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (teamsResponse.error) throw teamsResponse.error
  if (leaguesResponse.error) throw leaguesResponse.error

  const teamsById = new Map(
    ((teamsResponse.data ?? []) as TeamRow[]).map((team) => [String(team.id), team])
  )
  const leaguesById = new Map(
    ((leaguesResponse.data ?? []) as LeagueRow[]).map((league) => [String(league.id), league])
  )
  const resolvedHomeTeam = getTeamFromRow(
    teamsById.get(String(homeTeamId)) ?? currentHomeTeamRow,
    fallbackHomeTeam
  )
  const resolvedAwayTeam = getTeamFromRow(
    teamsById.get(String(awayTeamId)) ?? currentAwayTeamRow,
    fallbackAwayTeam
  )
  const items = matches.map((match) => {
    const league = match.league_id ? leaguesById.get(String(match.league_id)) : null
    const competition = normalizeLeagueName(league?.name)
    const homeTeam = getTeamFromRow(
      match.home_team_id ? teamsById.get(String(match.home_team_id)) : null,
      resolvedHomeTeam
    )
    const awayTeam = getTeamFromRow(
      match.away_team_id ? teamsById.get(String(match.away_team_id)) : null,
      resolvedAwayTeam
    )

    return {
      id: String(match.id),
      externalId: match.external_id === null ? null : String(match.external_id),
      date: match.match_date,
      competition,
      stage: getStageLabel(league?.name ?? competition, match.round),
      status: match.status,
      homeTeam,
      awayTeam,
      scoreLabel: getScoreLabel(match),
      isCurrentMatch: false,
    }
  })

  return {
    currentMatchId: currentExternalId,
    homeTeam: resolvedHomeTeam,
    awayTeam: resolvedAwayTeam,
    summary: buildHistorySummary(items, resolvedHomeTeam),
    items,
    warnings,
  }
}
