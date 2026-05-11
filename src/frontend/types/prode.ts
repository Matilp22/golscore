import {
  getPredictionLockState,
  hasMatchStarted as hasMatchStartedByDate,
  isPredictionLocked as isPredictionLockedByDate,
} from '@/shared/utils/prediction-lock'

export type EntityId = string

export type League = {
  id: EntityId
  externalId?: number | null
  slug?: string
  name: string
  country: string | null
  season: number
  logoUrl: string | null
}

export type TournamentOption = League & {
  slug: string
}

export type RoundOption = {
  value: string
  label: string
  matchCount: number
}

export type Team = {
  id: EntityId
  externalId?: number | null
  name: string
  logoUrl: string | null
}

export type Match = {
  id: EntityId
  leagueId: EntityId | null
  homeTeamId: EntityId | null
  awayTeamId: EntityId | null
  matchDate: string | null
  status: string
  round: string | null
  homeScore: number | null
  awayScore: number | null
  league: League | null
  homeTeam: Team | null
  awayTeam: Team | null
}

export type MatchPredictionViewModel = {
  match: Match
  prediction?: Prediction
  locked: boolean
  hasStarted: boolean
}

export type Prediction = {
  id: string
  prediction_id?: string
  userId: string
  matchId: EntityId
  match_id?: EntityId
  leagueId?: EntityId | null
  league_id?: EntityId | null
  predictedHomeScore: number
  predictedAwayScore: number
  predicted_home_score?: number
  predicted_away_score?: number
  realHomeScore?: number | null
  realAwayScore?: number | null
  real_home_score?: number | null
  real_away_score?: number | null
  points?: number | null
  exactHit?: boolean
  partialHit?: boolean
  exact_hit?: boolean
  partial_hit?: boolean
  predictionScoreFound?: boolean
  prediction_score_found?: boolean
  createdAt: string
  updatedAt: string
}

export type UserProfile = {
  id: string
  username: string | null
  displayName: string | null
}

export type PointsEntry = {
  userId: string
  matchId: EntityId
  points: number
  exactHit: boolean
  partialHit: boolean
}

export type LeaderboardRow = {
  userId: string
  name: string
  points: number
  played: number
  exactHits: number
  partialHits: number
}

export function isPredictionLocked(matchDate: string | null, now = new Date()) {
  return isPredictionLockedByDate(matchDate, 'scheduled', now)
}

export function hasMatchStarted(match: Pick<Match, 'matchDate' | 'status'>, now = new Date()) {
  return hasMatchStartedByDate(match.matchDate, match.status, now)
}

export function getMatchPredictionLockState(
  match: Pick<Match, 'matchDate' | 'status'>,
  now = new Date()
) {
  return getPredictionLockState(match.matchDate, match.status, now)
}

export function hasVisibleResult(match: Pick<Match, 'homeScore' | 'awayScore' | 'status'>) {
  return match.homeScore !== null && match.awayScore !== null
}
