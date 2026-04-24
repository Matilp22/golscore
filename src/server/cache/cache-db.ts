export type StoredFixtureInput = {
  fixtureId: number
  leagueId?: number
  season?: number
  leagueName: string
  leagueLogo?: string
  country?: string
  round?: string
  dateUtc: string
  statusShort: string
  statusLong: string
  minute: number | null
  homeTeamId?: number
  homeTeamName: string
  homeTeamLogo?: string
  awayTeamId?: number
  awayTeamName: string
  awayTeamLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}

export type StoredFixture = {
  fixtureId: number
  leagueId?: number
  season?: number
  leagueName: string
  leagueLogo?: string
  country?: string
  round?: string
  date: string
  dateAr: string
  timeAr: string
  statusShort: string
  statusLong: string
  minute: number | null
  homeTeamId?: number
  homeTeamName: string
  homeTeamLogo?: string
  awayTeamId?: number
  awayTeamName: string
  awayTeamLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}

export function readPersistentCache<T>(_cacheKey: string):
  | {
      data: T
      expiresAt: number
      isExpired: boolean
    }
  | null {
  void _cacheKey
  return null
}

export function writePersistentCache(
  _cacheKey: string,
  _path: string,
  _payload: unknown,
  _ttlSeconds: number
) {
  void _cacheKey
  void _path
  void _payload
  void _ttlSeconds
  // Persistent local filesystem cache is disabled for Vercel compatibility.
}

export function upsertStoredFixtures(_fixtures: StoredFixtureInput[]) {
  void _fixtures
  // Fixture persistence is handled outside this runtime. Do not write local files.
}

export function readStoredFixturesByDate(_dateAr: string): StoredFixture[] {
  void _dateAr
  return []
}

export function readStoredFixturesByLeagueSeason(
  _leagueId: number,
  _season: number
): StoredFixture[] {
  void _leagueId
  void _season
  return []
}
