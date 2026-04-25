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
  matchDate: string
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
  userId: string
  matchId: EntityId
  predictedHomeScore: number
  predictedAwayScore: number
  points?: number
  exactHit?: boolean
  partialHit?: boolean
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

export function isPredictionLocked(matchDate: string, now = new Date()) {
  const matchStart = new Date(matchDate).getTime()

  return now.getTime() >= matchStart - 15 * 60 * 1000
}

export function hasMatchStarted(match: Pick<Match, 'matchDate' | 'status'>, now = new Date()) {
  const normalizedStatus = match.status.toLowerCase()
  const nonEditableStatuses = ['live', '1h', '2h', 'ht', 'et', 'bt', 'p', 'ft', 'aet', 'pen', 'final', 'finished']

  return (
    now.getTime() >= new Date(match.matchDate).getTime() ||
    nonEditableStatuses.includes(normalizedStatus)
  )
}

export function hasVisibleResult(match: Pick<Match, 'homeScore' | 'awayScore' | 'status'>) {
  return match.homeScore !== null && match.awayScore !== null
}
