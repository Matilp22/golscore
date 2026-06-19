import { randomBytes } from 'node:crypto'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getProdeRoundLabel,
  getProdeRoundSortValue,
  isVisibleProdeRound,
  normalizeProdeRound,
} from '@/shared/config/prode-rounds'
import { SITE_URL } from '@/shared/seo'
import { isFinalMatchStatus } from '@/shared/utils/match-status'
import { isPredictionLocked } from '@/shared/utils/prediction-lock'
import { getPredictionLockMinutesForMatch } from '@/shared/utils/prode-lock-exceptions'

export type PrivateTournamentRole = 'owner' | 'member'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export const PRIVATE_TOURNAMENT_LEAGUE_OPTIONS = [
  {
    externalId: '1',
    name: 'Copa del Mundo 2026',
  },
  {
    externalId: '128',
    name: 'Liga Profesional Argentina',
  },
  {
    externalId: '129',
    name: 'Primera Nacional',
  },
  {
    externalId: '906',
    name: 'Torneo Proyección',
  },
] as const

type ApiErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
}

type TournamentRow = {
  id: string
  name: string
  base_name: string | null
  display_name: string | null
  league_id: string | null
  league_external_id: string | number | null
  league_name: string | null
  normalized_name: string
  normalized_base_name: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type MemberRow = {
  id: string
  tournament_id: string
  user_id: string
  role: PrivateTournamentRole
  joined_at: string
}

type JoinRequestRow = {
  id: string
  tournament_id: string
  user_id: string
  status: JoinRequestStatus
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

type InviteRow = {
  id: string
  tournament_id: string
  token: string
  email: string | null
  invited_by: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  created_at: string
  updated_at: string
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
  email?: string | null
}

type PredictionScoreRow = {
  prediction_id?: string | null
  user_id: string
  match_id: string | number | null
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number | null
  predicted_home_score: number
  predicted_away_score: number
}

type MatchRoundRow = {
  id: string | number
  round: string | number | null
  league_id: string | null
  match_date: string
  status: string | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  home_score: number | null
  away_score: number | null
  prediction_lock_override?: string | null
}

type LeagueRow = {
  id: string
  external_id: string | number | null
  name: string | null
}

type TeamRow = {
  id: string | number
  name: string | null
  logo_url?: string | null
}

type MatchRoundInfo = {
  id: string
  round: string | null
  leagueExternalId: number | null
  leagueExternalIdText: string | null
  leagueName: string | null
  matchDate: string
  status: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  homeScore: number | null
  awayScore: number | null
  predictionLockOverride: string | null
}

export type PrivateTournamentPredictionDetail = {
  predictionId: string
  matchId: string
  matchDate: string
  status: string | null
  homeTeamName: string
  awayTeamName: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  predictedHomeScore: number
  predictedAwayScore: number
  realHomeScore: number | null
  realAwayScore: number | null
  points: number | null
  exactHit: boolean
  partialHit: boolean
  scoreCalculated: boolean
}

export type PrivateTournamentRankingRow = {
  position: number
  userId: string
  username: string
  points: number
  exactHits: number
  partialHits: number
  playedPredictions: number
  predictions: PrivateTournamentPredictionDetail[]
}

export type PrivateTournamentRoundRanking = {
  value: string
  label: string
  matchCount: number
  ranking: PrivateTournamentRankingRow[]
}

export type PrivateTournamentSummary = {
  id: string
  name: string
  baseName: string
  displayName: string
  leagueExternalId: string
  leagueName: string
  creatorName: string
  memberCount: number
  role: PrivateTournamentRole
  myPosition: number | null
  myPoints: number
  createdAt: string
}

export type PrivateTournamentSearchResult = {
  id: string
  name: string
  displayName: string
  leagueExternalId: string
  leagueName: string
  creatorName: string
  memberCount: number
  isMember: boolean
  requestStatus: JoinRequestStatus | null
  canRequest: boolean
}

export type PrivateTournamentDetail = {
  id: string
  name: string
  baseName: string
  displayName: string
  leagueExternalId: string
  leagueName: string
  creatorName: string
  currentUserRole: PrivateTournamentRole
  memberCount: number
  ranking: PrivateTournamentRankingRow[]
  roundRankings: PrivateTournamentRoundRanking[]
  members: Array<{
    id: string
    userId: string
    username: string
    role: PrivateTournamentRole
    joinedAt: string
  }>
  pendingRequests: Array<{
    id: string
    userId: string
    username: string
    email: string | null
    requestedAt: string
  }>
}

export class PrivateTournamentError extends Error {
  status: number
  code: string | null

  constructor(message: string, status = 500, code: string | null = null) {
    super(message)
    this.name = 'PrivateTournamentError'
    this.status = status
    this.code = code
  }
}

export function normalizePrivateTournamentName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR')
}

function cleanPrivateTournamentName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function getConfiguredLeague(externalId: string) {
  return PRIVATE_TOURNAMENT_LEAGUE_OPTIONS.find((option) => option.externalId === externalId) ?? null
}

function getTournamentDisplayName(tournament: TournamentRow) {
  return tournament.display_name ?? tournament.name
}

function getTournamentBaseName(tournament: TournamentRow) {
  return tournament.base_name ?? tournament.name
}

function getTournamentLeagueExternalId(tournament: TournamentRow) {
  return String(tournament.league_external_id ?? '128')
}

function getTournamentLeagueName(tournament: TournamentRow) {
  return tournament.league_name ?? getConfiguredLeague(getTournamentLeagueExternalId(tournament))?.name ?? 'Liga Profesional Argentina'
}

function getErrorCode(error: unknown) {
  return (error as ApiErrorLike | null)?.code ?? null
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as ApiErrorLike | null)?.message ?? fallback
}

function throwIfDatabaseError(error: unknown, fallback: string): asserts error is null {
  if (!error) return

  const code = getErrorCode(error)
  const message = getErrorMessage(error, fallback)

  if (code === 'PGRST205' && message.includes('prode_private_')) {
    throw new PrivateTournamentError(
      'La migración de torneos privados no está aplicada en Supabase.',
      500,
      code
    )
  }

  throw new PrivateTournamentError(message, 500, code)
}

function getDisplayName(userId: string, profilesById: Map<string, ProfileRow>) {
  const profile = profilesById.get(userId)

  return profile?.display_name ?? profile?.username ?? profile?.email ?? 'Usuario'
}

function sortRankingRows(rows: Omit<PrivateTournamentRankingRow, 'position'>[]) {
  return [...rows]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
      if (b.partialHits !== a.partialHits) return b.partialHits - a.partialHits
      return a.username.localeCompare(b.username, 'es-AR', { sensitivity: 'base' })
    })
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }))
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function dedupeMembersByTournamentAndUser(members: MemberRow[]) {
  const membersByKey = new Map<string, MemberRow>()

  for (const member of members) {
    const key = `${member.tournament_id}:${member.user_id}`
    const current = membersByKey.get(key)

    if (!current || current.role !== 'owner') {
      membersByKey.set(key, member)
    }
  }

  return [...membersByKey.values()]
}

async function fetchProfiles(userIds: string[]) {
  const profilesById = new Map<string, ProfileRow>()
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean)

  if (!uniqueUserIds.length) return profilesById

  const supabase = getSupabaseAdminClient()
  const selectAttempts = [
    'id, username, display_name, email',
    'id, username, display_name',
    'id, username, email',
    'id, username',
  ]

  for (const select of selectAttempts) {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .in('id', uniqueUserIds)

    if (!error) {
      for (const profile of (data ?? []) as unknown as ProfileRow[]) {
        profilesById.set(profile.id, profile)
      }

      return profilesById
    }

    const optionalColumnMissing =
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message.toLowerCase().includes('schema cache')

    if (!optionalColumnMissing) {
      console.error('[private-tournaments] No se pudieron leer perfiles', error)
      return profilesById
    }
  }

  return profilesById
}

async function fetchMembers(tournamentIds: string[]) {
  if (!tournamentIds.length) return [] as MemberRow[]

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('prode_private_tournament_members')
    .select('id, tournament_id, user_id, role, joined_at')
    .in('tournament_id', tournamentIds)
    .order('joined_at', { ascending: true })

  throwIfDatabaseError(error, 'No se pudieron leer los participantes.')

  return dedupeMembersByTournamentAndUser((data ?? []) as MemberRow[])
}

async function fetchScoresByUserIds(userIds: string[]) {
  const scores: PredictionScoreRow[] = []
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean)

  if (!uniqueUserIds.length) return scores

  const supabase = getSupabaseAdminClient()

  for (const chunk of chunkArray(uniqueUserIds, 100)) {
    const { data, error } = await supabase
      .from('prediction_scores')
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
      .in('user_id', chunk)

    throwIfDatabaseError(error, 'No se pudo calcular el ranking privado.')
    scores.push(...((data ?? []) as PredictionScoreRow[]))
  }

  return scores
}

async function fetchPredictionsByUserIds(userIds: string[]) {
  const predictions: PredictionRow[] = []
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean)

  if (!uniqueUserIds.length) return predictions

  const supabase = getSupabaseAdminClient()

  for (const chunk of chunkArray(uniqueUserIds, 100)) {
    const { data, error } = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score')
      .in('user_id', chunk)

    throwIfDatabaseError(error, 'No se pudieron leer los pronósticos privados.')
    predictions.push(...((data ?? []) as PredictionRow[]))
  }

  return predictions
}

async function fetchLeaguesByIds(leagueIds: string[]) {
  const leaguesById = new Map<string, LeagueRow>()
  const uniqueLeagueIds = [...new Set(leagueIds.filter(Boolean))]
  const supabase = getSupabaseAdminClient()

  for (const chunk of chunkArray(uniqueLeagueIds, 100)) {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, name')
      .in('id', chunk)

    throwIfDatabaseError(error, 'No se pudieron leer las ligas del Prode.')

    for (const league of (data ?? []) as LeagueRow[]) {
      leaguesById.set(String(league.id), league)
    }
  }

  return leaguesById
}

async function fetchTeamsByIds(teamIds: string[]) {
  const teamsById = new Map<string, TeamRow>()
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))]
  const supabase = getSupabaseAdminClient()

  for (const chunk of chunkArray(uniqueTeamIds, 100)) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .in('id', chunk)

    throwIfDatabaseError(error, 'No se pudieron leer los equipos del Prode.')

    for (const team of (data ?? []) as TeamRow[]) {
      teamsById.set(String(team.id), team)
    }
  }

  return teamsById
}

function parseNumericId(value: string | null) {
  if (value === null) return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

async function buildMatchRoundInfoMap(
  matches: MatchRoundRow[],
  fallbackLeague: {
    leagueExternalIdText?: string | null
    leagueName?: string | null
  } = {}
) {
  const leagueIds = [
    ...new Set(matches.map((match) => match.league_id).filter(Boolean).map((id) => String(id))),
  ]
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ]
  const [leaguesById, teamsById] = await Promise.all([
    fetchLeaguesByIds(leagueIds),
    fetchTeamsByIds(teamIds),
  ])

  return new Map(
    matches.map((match) => {
      const league = match.league_id ? leaguesById.get(String(match.league_id)) : null
      const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
      const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
      const leagueExternalIdText =
        league?.external_id === null || league?.external_id === undefined
          ? fallbackLeague.leagueExternalIdText ?? null
          : String(league.external_id)

      return [
        String(match.id),
        {
          id: String(match.id),
          round: match.round === null || match.round === undefined ? null : String(match.round),
          leagueExternalId: parseNumericId(leagueExternalIdText),
          leagueExternalIdText,
          leagueName: league?.name ?? fallbackLeague.leagueName ?? null,
          matchDate: match.match_date,
          status: match.status,
          homeTeamId:
            match.home_team_id === null || match.home_team_id === undefined
              ? null
              : String(match.home_team_id),
          awayTeamId:
            match.away_team_id === null || match.away_team_id === undefined
              ? null
              : String(match.away_team_id),
          homeTeamName: homeTeam?.name?.trim() || 'Local',
          awayTeamName: awayTeam?.name?.trim() || 'Visitante',
          homeLogoUrl: homeTeam?.logo_url ?? null,
          awayLogoUrl: awayTeam?.logo_url ?? null,
          homeScore: match.home_score,
          awayScore: match.away_score,
          predictionLockOverride: match.prediction_lock_override ?? null,
        },
      ] as const
    })
  )
}

async function fetchMatchRoundInfo(matchIds: Array<string | number | null>) {
  const supabase = getSupabaseAdminClient()
  const uniqueMatchIds = [...new Set(matchIds.filter(Boolean).map((matchId) => String(matchId)))]
  const matches: MatchRoundRow[] = []

  if (!uniqueMatchIds.length) return new Map<string, MatchRoundInfo>()

  for (const chunk of chunkArray(uniqueMatchIds, 100)) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, round, league_id, match_date, status, home_team_id, away_team_id, home_score, away_score, prediction_lock_override')
      .in('id', chunk)

    throwIfDatabaseError(error, 'No se pudieron leer las fechas del Prode.')
    matches.push(...((data ?? []) as MatchRoundRow[]))
  }

  return buildMatchRoundInfoMap(matches)
}

async function fetchTournamentAvailableMatches(tournament: TournamentRow, members: MemberRow[]) {
  const supabase = getSupabaseAdminClient()
  const leagueExternalId = getTournamentLeagueExternalId(tournament)
  const leagueName = getTournamentLeagueName(tournament)
  const leagueIds = tournament.league_id ? [String(tournament.league_id)] : []

  if (!leagueIds.length) {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, name')
      .eq('external_id', Number(leagueExternalId))

    throwIfDatabaseError(error, 'No se pudo resolver la liga del torneo privado.')

    leagueIds.push(...((data ?? []) as LeagueRow[]).map((league) => String(league.id)))
  }

  if (!leagueIds.length) return new Map<string, MatchRoundInfo>()

  const earliestJoinTime = members.reduce<number | null>((current, member) => {
    const joinedAt = new Date(member.joined_at).getTime()

    return current === null ? joinedAt : Math.min(current, joinedAt)
  }, null)
  const query = supabase
    .from('matches')
    .select('id, round, league_id, match_date, status, home_team_id, away_team_id, home_score, away_score, prediction_lock_override')
    .in('league_id', leagueIds)
    .order('match_date', { ascending: true })

  if (earliestJoinTime !== null) {
    query.gte('match_date', new Date(earliestJoinTime).toISOString())
  }

  const { data, error } = await query

  throwIfDatabaseError(error, 'No se pudieron leer las fechas del torneo privado.')

  return buildMatchRoundInfoMap((data ?? []) as MatchRoundRow[], {
    leagueExternalIdText: leagueExternalId,
    leagueName,
  })
}

async function resolvePrivateTournamentLeague(leagueExternalId: string) {
  const configuredLeague = getConfiguredLeague(leagueExternalId)

  if (!configuredLeague) {
    throw new PrivateTournamentError('Elegí un torneo válido para jugar el Prode privado.', 400)
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('leagues')
    .select('id, external_id, name')
    .eq('external_id', Number(configuredLeague.externalId))
    .order('season', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.info('[private-tournaments] No se pudo resolver league_id; se guarda external_id estable', {
      code: error.code ?? null,
      message: error.message,
      leagueExternalId,
    })
  }

  const league = data as LeagueRow | null

  return {
    id: league?.id ? String(league.id) : null,
    externalId: configuredLeague.externalId,
    name: configuredLeague.name,
  }
}

function filterScoresForTournament(
  tournament: TournamentRow,
  members: MemberRow[],
  scores: PredictionScoreRow[],
  matchesById: Map<string, MatchRoundInfo>
) {
  const memberByUserId = new Map(members.map((member) => [member.user_id, member]))
  const leagueExternalId = getTournamentLeagueExternalId(tournament)

  return scores.filter((score) => {
    const member = memberByUserId.get(score.user_id)
    const matchId = score.match_id === null || score.match_id === undefined
      ? null
      : String(score.match_id)
    const match = matchId ? matchesById.get(matchId) : null

    if (!member || !match) return false
    if (match.leagueExternalIdText !== leagueExternalId) return false
    if (!isFinalMatchStatus(match.status)) return false

    return new Date(match.matchDate).getTime() >= new Date(member.joined_at).getTime()
  })
}

function getPredictionMatchId(prediction: PredictionRow) {
  return prediction.match_id === null || prediction.match_id === undefined
    ? null
    : String(prediction.match_id)
}

function getScoreMatchId(score: PredictionScoreRow) {
  return score.match_id === null || score.match_id === undefined
    ? null
    : String(score.match_id)
}

function getUserMatchKey(userId: string, matchId: string) {
  return `${userId}:${matchId}`
}

function filterPredictionsForTournament(
  tournament: TournamentRow,
  members: MemberRow[],
  predictions: PredictionRow[],
  matchesById: Map<string, MatchRoundInfo>
) {
  const memberByUserId = new Map(members.map((member) => [member.user_id, member]))
  const leagueExternalId = getTournamentLeagueExternalId(tournament)
  const now = new Date()

  return predictions.filter((prediction) => {
    const member = memberByUserId.get(prediction.user_id)
    const matchId = getPredictionMatchId(prediction)
    const match = matchId ? matchesById.get(matchId) : null

    if (!member || !match) return false
    if (match.leagueExternalIdText !== leagueExternalId) return false
    if (
      !isPredictionLocked(match.matchDate, match.status ?? 'scheduled', now, {
        lockMinutes: getPredictionLockMinutesForMatch({
          id: match.id,
          matchDate: match.matchDate,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
        }),
        lockOverride: match.predictionLockOverride,
      })
    ) {
      return false
    }

    return new Date(match.matchDate).getTime() >= new Date(member.joined_at).getTime()
  })
}

function buildPredictionDetailsByUserId(
  predictions: PredictionRow[],
  scores: PredictionScoreRow[],
  matchesById: Map<string, MatchRoundInfo>
) {
  const scoresByPredictionId = new Map(
    scores
      .filter((score) => score.prediction_id)
      .map((score) => [String(score.prediction_id), score])
  )
  const scoresByUserMatch = new Map<string, PredictionScoreRow>()

  for (const score of scores) {
    const matchId = getScoreMatchId(score)

    if (matchId) {
      scoresByUserMatch.set(getUserMatchKey(score.user_id, matchId), score)
    }
  }

  const detailsByUserId = new Map<string, PrivateTournamentPredictionDetail[]>()

  for (const prediction of predictions) {
    const matchId = getPredictionMatchId(prediction)
    const match = matchId ? matchesById.get(matchId) : null

    if (!matchId || !match) continue

    const score =
      scoresByPredictionId.get(prediction.id) ??
      scoresByUserMatch.get(getUserMatchKey(prediction.user_id, matchId)) ??
      null
    const current = detailsByUserId.get(prediction.user_id) ?? []

    current.push({
      predictionId: prediction.id,
      matchId,
      matchDate: match.matchDate,
      status: match.status,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      homeLogoUrl: match.homeLogoUrl,
      awayLogoUrl: match.awayLogoUrl,
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      realHomeScore: match.homeScore,
      realAwayScore: match.awayScore,
      points: score?.points ?? null,
      exactHit: Boolean(score?.exact_hit),
      partialHit: Boolean(score?.partial_hit),
      scoreCalculated: Boolean(score),
    })
    detailsByUserId.set(prediction.user_id, current)
  }

  for (const details of detailsByUserId.values()) {
    details.sort((a, b) => {
      const dateSort = new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()

      if (dateSort !== 0) return dateSort
      return `${a.homeTeamName} ${a.awayTeamName}`.localeCompare(
        `${b.homeTeamName} ${b.awayTeamName}`,
        'es-AR',
        { sensitivity: 'base' }
      )
    })
  }

  return detailsByUserId
}

function buildRankings(
  members: MemberRow[],
  profilesById: Map<string, ProfileRow>,
  scores: PredictionScoreRow[]
) {
  const totalsByUserId = new Map<
    string,
    {
      points: number
      exactHits: number
      partialHits: number
      playedPredictions: number
    }
  >()

  for (const score of scores) {
    const current = totalsByUserId.get(score.user_id) ?? {
      points: 0,
      exactHits: 0,
      partialHits: 0,
      playedPredictions: 0,
    }

    current.points += score.points ?? 0
    current.exactHits += score.exact_hit ? 1 : 0
    current.partialHits += score.partial_hit ? 1 : 0
    current.playedPredictions += 1
    totalsByUserId.set(score.user_id, current)
  }

  const membersByTournamentId = new Map<string, MemberRow[]>()

  for (const member of members) {
    const current = membersByTournamentId.get(member.tournament_id) ?? []
    current.push(member)
    membersByTournamentId.set(member.tournament_id, current)
  }

  const rankingsByTournamentId = new Map<string, PrivateTournamentRankingRow[]>()

  for (const [tournamentId, tournamentMembers] of membersByTournamentId.entries()) {
    const rows = tournamentMembers.map((member) => {
      const totals = totalsByUserId.get(member.user_id) ?? {
        points: 0,
        exactHits: 0,
        partialHits: 0,
        playedPredictions: 0,
      }

      return {
        userId: member.user_id,
        username: getDisplayName(member.user_id, profilesById),
        ...totals,
        predictions: [],
      }
    })

    rankingsByTournamentId.set(tournamentId, sortRankingRows(rows))
  }

  return rankingsByTournamentId
}

function buildRankingForMembers(
  members: MemberRow[],
  profilesById: Map<string, ProfileRow>,
  scores: PredictionScoreRow[]
) {
  return buildRankings(members, profilesById, scores).get(members[0]?.tournament_id ?? '') ?? []
}

function buildRoundRankings(
  members: MemberRow[],
  profilesById: Map<string, ProfileRow>,
  scores: PredictionScoreRow[],
  matchesById: Map<string, MatchRoundInfo>,
  availableMatchesById: Map<string, MatchRoundInfo> = matchesById,
  predictions: PredictionRow[] = []
) {
  const roundBuckets = new Map<
    string,
    {
      value: string
      label: string
      sortValue: number
      leagueName: string
      matchIds: Set<string>
      scores: PredictionScoreRow[]
      predictions: PredictionRow[]
    }
  >()

  function ensureRoundBucket(match: MatchRoundInfo) {
    if (!match?.round) return null
    if (!isVisibleProdeRound(match.round, match.leagueExternalId)) return null

    const normalizedRound = normalizeProdeRound(match.round, match.leagueExternalId)

    if (!normalizedRound) return null

    const leagueKey = match.leagueExternalId ?? 'sin-liga'
    const value = `${leagueKey}:${normalizedRound}`
    const leagueName = match.leagueName ?? 'Prode'
    const roundLabel = getProdeRoundLabel(normalizedRound, match.leagueExternalId) ?? normalizedRound
    const current = roundBuckets.get(value) ?? {
      value,
      label: `${leagueName} · ${roundLabel}`,
      sortValue: getProdeRoundSortValue(normalizedRound, match.leagueExternalId),
      leagueName,
      matchIds: new Set<string>(),
      scores: [],
      predictions: [],
    }

    current.matchIds.add(match.id)
    roundBuckets.set(value, current)

    return current
  }

  for (const match of availableMatchesById.values()) {
    ensureRoundBucket(match)
  }

  for (const score of scores) {
    const matchId = getScoreMatchId(score)
    const match = matchId ? matchesById.get(matchId) : null
    const bucket = match ? ensureRoundBucket(match) : null

    bucket?.scores.push(score)
  }

  for (const prediction of predictions) {
    const matchId = getPredictionMatchId(prediction)
    const match = matchId ? matchesById.get(matchId) : null
    const bucket = match ? ensureRoundBucket(match) : null

    bucket?.predictions.push(prediction)
  }

  return [...roundBuckets.values()]
    .sort((a, b) => {
      const leagueSort = a.leagueName.localeCompare(b.leagueName, 'es-AR', {
        sensitivity: 'base',
      })

      if (leagueSort !== 0) return leagueSort
      if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue
      return a.label.localeCompare(b.label, 'es-AR', { numeric: true })
    })
    .map((bucket) => {
      const detailsByUserId = buildPredictionDetailsByUserId(
        bucket.predictions,
        bucket.scores,
        matchesById
      )

      return {
        value: bucket.value,
        label: bucket.label,
        matchCount: bucket.matchIds.size,
        ranking: buildRankingForMembers(members, profilesById, bucket.scores).map((row) => ({
          ...row,
          predictions: detailsByUserId.get(row.userId) ?? [],
        })),
      }
    })
}

async function fetchTournamentById(id: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('prode_private_tournaments')
    .select('id, name, base_name, display_name, league_id, league_external_id, league_name, normalized_name, normalized_base_name, created_by, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  throwIfDatabaseError(error, 'No se pudo leer el torneo.')

  return (data ?? null) as TournamentRow | null
}

async function fetchMembership(tournamentId: string, userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('prode_private_tournament_members')
    .select('id, tournament_id, user_id, role, joined_at')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfDatabaseError(error, 'No se pudo verificar tu participación.')

  return (data ?? null) as MemberRow | null
}

function ensureValidTournamentName(name: string) {
  const cleanName = cleanPrivateTournamentName(name)
  const normalizedName = normalizePrivateTournamentName(cleanName)

  if (!normalizedName) {
    throw new PrivateTournamentError('Ingresá un nombre para el torneo.', 400)
  }

  if (cleanName.length > 80) {
    throw new PrivateTournamentError('El nombre del torneo no puede superar 80 caracteres.', 400)
  }

  return { cleanName, normalizedName }
}

export async function listPrivateTournaments(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data: membershipsData, error: membershipsError } = await supabase
    .from('prode_private_tournament_members')
    .select('id, tournament_id, user_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  throwIfDatabaseError(membershipsError, 'No se pudieron leer tus torneos.')

  const memberships = (membershipsData ?? []) as MemberRow[]
  const tournamentIds = memberships.map((membership) => membership.tournament_id)

  if (!tournamentIds.length) return [] as PrivateTournamentSummary[]

  const { data: tournamentsData, error: tournamentsError } = await supabase
    .from('prode_private_tournaments')
    .select('id, name, base_name, display_name, league_id, league_external_id, league_name, normalized_name, normalized_base_name, created_by, created_at, updated_at')
    .in('id', tournamentIds)
    .order('created_at', { ascending: false })

  throwIfDatabaseError(tournamentsError, 'No se pudieron leer tus torneos.')

  const tournaments = (tournamentsData ?? []) as TournamentRow[]
  const members = await fetchMembers(tournamentIds)
  const profilesById = await fetchProfiles([
    ...tournaments.map((tournament) => tournament.created_by),
    ...members.map((member) => member.user_id),
  ])
  const scores = await fetchScoresByUserIds(members.map((member) => member.user_id))
  const matchesById = await fetchMatchRoundInfo(scores.map((score) => score.match_id))
  const rankingsByTournamentId = new Map(
    tournaments.map((tournament) => {
      const tournamentMembers = members.filter((member) => member.tournament_id === tournament.id)
      const tournamentScores = filterScoresForTournament(
        tournament,
        tournamentMembers,
        scores,
        matchesById
      )

      return [
        tournament.id,
        buildRankings(tournamentMembers, profilesById, tournamentScores).get(tournament.id) ?? [],
      ] as const
    })
  )
  const membershipsByTournamentId = new Map(
    memberships.map((membership) => [membership.tournament_id, membership])
  )

  return tournaments.map((tournament) => {
    const ranking = rankingsByTournamentId.get(tournament.id) ?? []
    const myRanking = ranking.find((row) => row.userId === userId) ?? null

    return {
      id: tournament.id,
      name: getTournamentDisplayName(tournament),
      baseName: getTournamentBaseName(tournament),
      displayName: getTournamentDisplayName(tournament),
      leagueExternalId: getTournamentLeagueExternalId(tournament),
      leagueName: getTournamentLeagueName(tournament),
      creatorName: getDisplayName(tournament.created_by, profilesById),
      memberCount: members.filter((member) => member.tournament_id === tournament.id).length,
      role: membershipsByTournamentId.get(tournament.id)?.role ?? 'member',
      myPosition: myRanking?.position ?? null,
      myPoints: myRanking?.points ?? 0,
      createdAt: tournament.created_at,
    }
  })
}

export async function createPrivateTournament(
  userId: string,
  input: { baseName: string; leagueExternalId: string }
) {
  const { cleanName } = ensureValidTournamentName(input.baseName)
  const league = await resolvePrivateTournamentLeague(input.leagueExternalId)
  const displayName = `${cleanName} - ${league.name}`
  const normalizedName = normalizePrivateTournamentName(cleanName)
  const supabase = getSupabaseAdminClient()
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('prode_private_tournaments')
    .insert({
      name: cleanName,
      base_name: cleanName,
      display_name: displayName,
      league_id: league.id,
      league_external_id: league.externalId,
      league_name: league.name,
      normalized_name: normalizedName,
      normalized_base_name: normalizedName,
      created_by: userId,
    })
    .select('id, name, base_name, display_name, league_id, league_external_id, league_name, normalized_name, normalized_base_name, created_by, created_at, updated_at')
    .single()

  if (tournamentError) {
    if (tournamentError.code === '23505') {
      throw new PrivateTournamentError('Ya existe un torneo con ese nombre.', 409, tournamentError.code)
    }

    throw new PrivateTournamentError(
      tournamentError.message ?? 'No se pudo crear el torneo.',
      500,
      tournamentError.code ?? null
    )
  }

  const tournament = tournamentData as TournamentRow
  const { error: memberError } = await supabase
    .from('prode_private_tournament_members')
    .insert({
      tournament_id: tournament.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberError) {
    await supabase.from('prode_private_tournaments').delete().eq('id', tournament.id)
    throw new PrivateTournamentError(
      memberError.message ?? 'No se pudo agregar el creador al torneo.',
      500,
      memberError.code ?? null
    )
  }

  return tournament
}

export async function searchPrivateTournament(userId: string, name: string) {
  const normalizedName = normalizePrivateTournamentName(name)

  if (!normalizedName) {
    throw new PrivateTournamentError('Ingresá el nombre exacto del torneo.', 400)
  }

  const supabase = getSupabaseAdminClient()
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('prode_private_tournaments')
    .select('id, name, base_name, display_name, league_id, league_external_id, league_name, normalized_name, normalized_base_name, created_by, created_at, updated_at')
    .eq('normalized_base_name', normalizedName)
    .maybeSingle()

  throwIfDatabaseError(tournamentError, 'No se pudo buscar el torneo.')

  const tournament = (tournamentData ?? null) as TournamentRow | null

  if (!tournament) return null

  const [members, membership, requestResponse, profilesById] = await Promise.all([
    fetchMembers([tournament.id]),
    fetchMembership(tournament.id, userId),
    supabase
      .from('prode_private_tournament_join_requests')
      .select('id, tournament_id, user_id, status, requested_at, reviewed_at, reviewed_by')
      .eq('tournament_id', tournament.id)
      .eq('user_id', userId)
      .maybeSingle(),
    fetchProfiles([tournament.created_by]),
  ])

  throwIfDatabaseError(requestResponse.error, 'No se pudo leer tu solicitud.')

  const request = (requestResponse.data ?? null) as JoinRequestRow | null
  const requestStatus = request?.status ?? null

  return {
    id: tournament.id,
    name: getTournamentDisplayName(tournament),
    displayName: getTournamentDisplayName(tournament),
    leagueExternalId: getTournamentLeagueExternalId(tournament),
    leagueName: getTournamentLeagueName(tournament),
    creatorName: getDisplayName(tournament.created_by, profilesById),
    memberCount: members.length,
    isMember: Boolean(membership),
    requestStatus,
    canRequest: !membership && (!requestStatus || requestStatus === 'rejected' || requestStatus === 'cancelled'),
  } satisfies PrivateTournamentSearchResult
}

export async function requestPrivateTournamentAccess(userId: string, tournamentId: string) {
  const tournament = await fetchTournamentById(tournamentId)

  if (!tournament) {
    throw new PrivateTournamentError('No se encontró el torneo.', 404)
  }

  const membership = await fetchMembership(tournamentId, userId)

  if (membership) {
    throw new PrivateTournamentError('Ya participás en este torneo.', 409)
  }

  const supabase = getSupabaseAdminClient()
  const { data: requestData, error: requestError } = await supabase
    .from('prode_private_tournament_join_requests')
    .select('id, tournament_id, user_id, status, requested_at, reviewed_at, reviewed_by')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfDatabaseError(requestError, 'No se pudo revisar tu solicitud.')

  const existingRequest = (requestData ?? null) as JoinRequestRow | null

  if (existingRequest?.status === 'pending') {
    throw new PrivateTournamentError('Ya tenés una solicitud pendiente.', 409)
  }

  if (existingRequest?.status === 'approved') {
    throw new PrivateTournamentError('Tu solicitud ya fue aprobada.', 409)
  }

  if (existingRequest) {
    const { error } = await supabase
      .from('prode_private_tournament_join_requests')
      .update({
        status: 'pending',
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq('id', existingRequest.id)

    throwIfDatabaseError(error, 'No se pudo volver a solicitar acceso.')
    return { status: 'pending' as const }
  }

  const { error } = await supabase
    .from('prode_private_tournament_join_requests')
    .insert({
      tournament_id: tournamentId,
      user_id: userId,
      status: 'pending',
    })

  throwIfDatabaseError(error, 'No se pudo solicitar acceso.')

  return { status: 'pending' as const }
}

export async function getPrivateTournamentDetail(userId: string, tournamentId: string) {
  const tournament = await fetchTournamentById(tournamentId)

  if (!tournament) {
    throw new PrivateTournamentError('No se encontró el torneo.', 404)
  }

  const membership = await fetchMembership(tournamentId, userId)

  if (!membership) {
    throw new PrivateTournamentError('No tenés acceso a este torneo privado.', 403)
  }

  const supabase = getSupabaseAdminClient()
  const members = await fetchMembers([tournamentId])
  const isOwner = membership.role === 'owner' || tournament.created_by === userId
  const { data: pendingRequestsData, error: pendingRequestsError } = isOwner
    ? await supabase
        .from('prode_private_tournament_join_requests')
        .select('id, tournament_id, user_id, status, requested_at, reviewed_at, reviewed_by')
        .eq('tournament_id', tournamentId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })
    : { data: [] as JoinRequestRow[], error: null }

  throwIfDatabaseError(pendingRequestsError, 'No se pudieron leer las solicitudes.')

  const pendingRequests = (pendingRequestsData ?? []) as JoinRequestRow[]
  const profilesById = await fetchProfiles([
    tournament.created_by,
    ...members.map((member) => member.user_id),
    ...pendingRequests.map((request) => request.user_id),
  ])
  const userIds = members.map((member) => member.user_id)
  const [scores, predictions] = await Promise.all([
    fetchScoresByUserIds(userIds),
    fetchPredictionsByUserIds(userIds),
  ])
  const [scoreMatchesById, predictionMatchesById, availableMatchesById] = await Promise.all([
    fetchMatchRoundInfo(scores.map((score) => score.match_id)),
    fetchMatchRoundInfo(predictions.map((prediction) => prediction.match_id)),
    fetchTournamentAvailableMatches(tournament, members),
  ])
  const matchesById = new Map([
    ...availableMatchesById,
    ...predictionMatchesById,
    ...scoreMatchesById,
  ])
  const tournamentScores = filterScoresForTournament(tournament, members, scores, matchesById)
  const tournamentPredictions = filterPredictionsForTournament(
    tournament,
    members,
    predictions,
    matchesById
  )
  const ranking = buildRankings(members, profilesById, tournamentScores).get(tournamentId) ?? []
  const roundRankings = buildRoundRankings(
    members,
    profilesById,
    tournamentScores,
    matchesById,
    availableMatchesById,
    tournamentPredictions
  )

  return {
    id: tournament.id,
    name: getTournamentDisplayName(tournament),
    baseName: getTournamentBaseName(tournament),
    displayName: getTournamentDisplayName(tournament),
    leagueExternalId: getTournamentLeagueExternalId(tournament),
    leagueName: getTournamentLeagueName(tournament),
    creatorName: getDisplayName(tournament.created_by, profilesById),
    currentUserRole: membership.role,
    memberCount: members.length,
    ranking,
    roundRankings,
    members: members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      username: getDisplayName(member.user_id, profilesById),
      role: member.role,
      joinedAt: member.joined_at,
    })),
    pendingRequests: pendingRequests.map((request) => ({
      id: request.id,
      userId: request.user_id,
      username: getDisplayName(request.user_id, profilesById),
      email: profilesById.get(request.user_id)?.email ?? null,
      requestedAt: request.requested_at,
    })),
  } satisfies PrivateTournamentDetail
}

async function assertTournamentOwner(userId: string, tournamentId: string) {
  const tournament = await fetchTournamentById(tournamentId)

  if (!tournament) {
    throw new PrivateTournamentError('No se encontró el torneo.', 404)
  }

  const membership = await fetchMembership(tournamentId, userId)

  if (tournament.created_by !== userId && membership?.role !== 'owner') {
    throw new PrivateTournamentError('Solo el owner puede revisar solicitudes.', 403)
  }

  return tournament
}

export async function reviewPrivateTournamentRequest({
  ownerId,
  tournamentId,
  requestId,
  action,
}: {
  ownerId: string
  tournamentId: string
  requestId: string
  action: 'approve' | 'reject'
}) {
  await assertTournamentOwner(ownerId, tournamentId)

  const supabase = getSupabaseAdminClient()
  const { data: requestData, error: requestError } = await supabase
    .from('prode_private_tournament_join_requests')
    .select('id, tournament_id, user_id, status, requested_at, reviewed_at, reviewed_by')
    .eq('id', requestId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()

  throwIfDatabaseError(requestError, 'No se pudo leer la solicitud.')

  const request = (requestData ?? null) as JoinRequestRow | null

  if (!request) {
    throw new PrivateTournamentError('No se encontró la solicitud.', 404)
  }

  if (request.status !== 'pending') {
    throw new PrivateTournamentError('La solicitud ya fue revisada.', 409)
  }

  if (action === 'approve') {
    const { error: memberError } = await supabase
      .from('prode_private_tournament_members')
      .upsert(
        {
          tournament_id: tournamentId,
          user_id: request.user_id,
          role: 'member',
        },
        {
          onConflict: 'tournament_id,user_id',
          ignoreDuplicates: true,
        }
      )

    throwIfDatabaseError(memberError, 'No se pudo agregar el participante.')
  }

  const { error: updateError } = await supabase
    .from('prode_private_tournament_join_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: ownerId,
    })
    .eq('id', requestId)

  throwIfDatabaseError(updateError, 'No se pudo actualizar la solicitud.')

  return getPrivateTournamentDetail(ownerId, tournamentId)
}

function createInviteToken() {
  return randomBytes(32).toString('base64url')
}

function getOrigin(value: string | null | undefined) {
  if (!value) return null

  try {
    return new URL(value).origin.replace(/\/$/, '')
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  } catch {
    return false
  }
}

function getCanonicalAppOrigin() {
  return (
    getOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    getOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    getOrigin(process.env.SITE_URL) ??
    getOrigin(SITE_URL) ??
    SITE_URL.replace(/\/$/, '')
  )
}

function getInviteOrigin(requestOrigin: string) {
  const origin = getOrigin(requestOrigin)

  if (origin && isLocalOrigin(origin)) return origin

  return getCanonicalAppOrigin()
}

function buildInviteUrl(origin: string, token: string) {
  return `${getInviteOrigin(origin)}/prode/torneos/invitacion/${encodeURIComponent(token)}`
}

function buildMailtoUrl(email: string | null | undefined, inviteUrl: string) {
  const subject = 'Invitación al Prode de Hay Fulbo'
  const body = `Te invitaron a un torneo privado del Prode de Hay Fulbo.\n\nAceptá la invitación desde este link:\n${inviteUrl}`
  const recipient = email?.trim() ?? ''

  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function serializeInvite(invite: InviteRow, inviteUrl: string) {
  return {
    id: invite.id,
    tournamentId: invite.tournament_id,
    token: invite.token,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expires_at,
    acceptedAt: invite.accepted_at,
    acceptedBy: invite.accepted_by,
    createdAt: invite.created_at,
    inviteUrl,
    mailtoUrl: buildMailtoUrl(invite.email, inviteUrl),
  }
}

export async function createPrivateTournamentInvite({
  ownerId,
  tournamentId,
  email,
  expiresInDays,
  origin,
}: {
  ownerId: string
  tournamentId: string
  email?: string | null
  expiresInDays?: number | null
  origin: string
}) {
  await assertTournamentOwner(ownerId, tournamentId)

  const expiresAt =
    expiresInDays && Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + Math.min(Math.floor(expiresInDays), 90) * 24 * 60 * 60 * 1000).toISOString()
      : null
  const supabase = getSupabaseAdminClient()
  const token = createInviteToken()
  const { data, error } = await supabase
    .from('private_tournament_invites')
    .insert({
      tournament_id: tournamentId,
      token,
      email: email?.trim() || null,
      invited_by: ownerId,
      expires_at: expiresAt,
    })
    .select('id, tournament_id, token, email, invited_by, status, expires_at, accepted_at, accepted_by, created_at, updated_at')
    .single()

  throwIfDatabaseError(error, 'No se pudo crear la invitación.')

  const invite = data as InviteRow
  return serializeInvite(invite, buildInviteUrl(origin, invite.token))
}

async function fetchInviteByToken(token: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('private_tournament_invites')
    .select('id, tournament_id, token, email, invited_by, status, expires_at, accepted_at, accepted_by, created_at, updated_at')
    .eq('token', token)
    .maybeSingle()

  throwIfDatabaseError(error, 'No se pudo leer la invitación.')

  return (data ?? null) as InviteRow | null
}

function isInviteExpired(invite: InviteRow) {
  return Boolean(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())
}

export async function getPrivateTournamentInviteInfo(token: string, userId?: string | null) {
  const invite = await fetchInviteByToken(token)

  if (!invite) {
    throw new PrivateTournamentError('Invitación no encontrada.', 404)
  }

  const tournament = await fetchTournamentById(invite.tournament_id)

  if (!tournament) {
    throw new PrivateTournamentError('El torneo ya no existe.', 404)
  }

  const [members, membership, profilesById] = await Promise.all([
    fetchMembers([tournament.id]),
    userId ? fetchMembership(tournament.id, userId) : Promise.resolve(null),
    fetchProfiles([tournament.created_by]),
  ])
  const expired = isInviteExpired(invite)

  return {
    invite: {
      id: invite.id,
      token: invite.token,
      status: expired && invite.status === 'pending' ? 'expired' : invite.status,
      expiresAt: invite.expires_at,
      expired,
      acceptedAt: invite.accepted_at,
    },
    tournament: {
      id: tournament.id,
      name: getTournamentDisplayName(tournament),
      baseName: getTournamentBaseName(tournament),
      displayName: getTournamentDisplayName(tournament),
      leagueExternalId: getTournamentLeagueExternalId(tournament),
      leagueName: getTournamentLeagueName(tournament),
      creatorName: getDisplayName(tournament.created_by, profilesById),
      memberCount: members.length,
    },
    isMember: Boolean(membership),
    requiresAuth: !userId,
  }
}

export async function acceptPrivateTournamentInvite(token: string, userId: string) {
  const invite = await fetchInviteByToken(token)

  if (!invite) {
    throw new PrivateTournamentError('Invitación no encontrada.', 404)
  }

  if (invite.status === 'revoked') {
    throw new PrivateTournamentError('La invitación fue revocada.', 409)
  }

  if (isInviteExpired(invite)) {
    const supabase = getSupabaseAdminClient()
    await supabase
      .from('private_tournament_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)
    throw new PrivateTournamentError('La invitación expiró.', 409)
  }

  const tournament = await fetchTournamentById(invite.tournament_id)

  if (!tournament) {
    throw new PrivateTournamentError('El torneo ya no existe.', 404)
  }

  const now = new Date().toISOString()
  const supabase = getSupabaseAdminClient()
  const { error: memberError } = await supabase
    .from('prode_private_tournament_members')
    .upsert(
      {
        tournament_id: invite.tournament_id,
        user_id: userId,
        role: 'member',
        joined_at: now,
      },
      {
        onConflict: 'tournament_id,user_id',
        ignoreDuplicates: true,
      }
    )

  throwIfDatabaseError(memberError, 'No se pudo agregarte al torneo.')

  const { error: inviteError } = await supabase
    .from('private_tournament_invites')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_by: userId,
    })
    .eq('id', invite.id)

  throwIfDatabaseError(inviteError, 'No se pudo marcar la invitación como aceptada.')

  return getPrivateTournamentInviteInfo(token, userId)
}

export async function revokePrivateTournamentInvite({
  ownerId,
  token,
}: {
  ownerId: string
  token: string
}) {
  const invite = await fetchInviteByToken(token)

  if (!invite) {
    throw new PrivateTournamentError('Invitación no encontrada.', 404)
  }

  await assertTournamentOwner(ownerId, invite.tournament_id)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('private_tournament_invites')
    .update({ status: 'revoked' })
    .eq('id', invite.id)

  throwIfDatabaseError(error, 'No se pudo revocar la invitación.')

  return { ok: true }
}

export async function getPrivateTournamentInvitesAudit() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('private_tournament_invites')
    .select('id, tournament_id, token, email, invited_by, status, expires_at, accepted_at, accepted_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  throwIfDatabaseError(error, 'No se pudo auditar invitaciones.')

  const invites = (data ?? []) as InviteRow[]
  const expiredPending = invites.filter((invite) => invite.status === 'pending' && isInviteExpired(invite))

  return {
    ok: true,
    totals: {
      checked: invites.length,
      pending: invites.filter((invite) => invite.status === 'pending').length,
      accepted: invites.filter((invite) => invite.status === 'accepted').length,
      revoked: invites.filter((invite) => invite.status === 'revoked').length,
      expired: invites.filter((invite) => invite.status === 'expired').length,
      expiredPending: expiredPending.length,
    },
    items: invites.map((invite) => ({
      id: invite.id,
      tournamentId: invite.tournament_id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expires_at,
      expired: isInviteExpired(invite),
      acceptedAt: invite.accepted_at,
      acceptedBy: invite.accepted_by,
      createdAt: invite.created_at,
    })),
  }
}
