import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

type CacheRow = {
  payload: string
  expires_at: number
}

type StoredFixtureRow = {
  fixture_id: number
  league_id: number | null
  season: number | null
  league_name: string
  league_logo: string | null
  country: string | null
  round: string | null
  date_utc: string
  override_date_utc: string | null
  date_ar: string
  time_ar: string
  status_short: string
  status_long: string
  minute: number | null
  home_team_id: number | null
  home_team_name: string
  home_team_logo: string | null
  away_team_id: number | null
  away_team_name: string
  away_team_logo: string | null
  goals_home: number | null
  goals_away: number | null
  home_penalty_score: number | null
  away_penalty_score: number | null
}

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

const DB_PATH = join(process.cwd(), '.data', 'golscore-cache.sqlite')

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    payload TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_api_cache_path ON api_cache(path);
  CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);

  CREATE TABLE IF NOT EXISTS fixture_schedule (
    fixture_id INTEGER PRIMARY KEY,
    league_id INTEGER,
    season INTEGER,
    league_name TEXT NOT NULL,
    league_logo TEXT,
    country TEXT,
    round TEXT,
    date_utc TEXT NOT NULL,
    override_date_utc TEXT,
    date_ar TEXT NOT NULL,
    time_ar TEXT NOT NULL,
    status_short TEXT NOT NULL,
    status_long TEXT NOT NULL,
    minute INTEGER,
    home_team_id INTEGER,
    home_team_name TEXT NOT NULL,
    home_team_logo TEXT,
    away_team_id INTEGER,
    away_team_name TEXT NOT NULL,
    away_team_logo TEXT,
    goals_home INTEGER,
    goals_away INTEGER,
    home_penalty_score INTEGER,
    away_penalty_score INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_fixture_schedule_date_ar ON fixture_schedule(date_ar);
  CREATE INDEX IF NOT EXISTS idx_fixture_schedule_league_season ON fixture_schedule(league_id, season);
`)

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (columns.some((item) => item.name === column)) return

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`)
}

ensureColumn('fixture_schedule', 'home_penalty_score', 'INTEGER')
ensureColumn('fixture_schedule', 'away_penalty_score', 'INTEGER')

const selectCacheStatement = db.prepare(`
  SELECT payload, expires_at
  FROM api_cache
  WHERE cache_key = ?
`)

const upsertCacheStatement = db.prepare(`
  INSERT INTO api_cache (cache_key, path, payload, expires_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(cache_key) DO UPDATE SET
    path = excluded.path,
    payload = excluded.payload,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
`)

const deleteExpiredStatement = db.prepare(`
  DELETE FROM api_cache
  WHERE expires_at < ?
`)

const upsertFixtureStatement = db.prepare(`
  INSERT INTO fixture_schedule (
    fixture_id,
    league_id,
    season,
    league_name,
    league_logo,
    country,
    round,
    date_utc,
    date_ar,
    time_ar,
    status_short,
    status_long,
    minute,
    home_team_id,
    home_team_name,
    home_team_logo,
    away_team_id,
    away_team_name,
    away_team_logo,
    goals_home,
    goals_away,
    home_penalty_score,
    away_penalty_score,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(fixture_id) DO UPDATE SET
    league_id = excluded.league_id,
    season = excluded.season,
    league_name = excluded.league_name,
    league_logo = excluded.league_logo,
    country = excluded.country,
    round = excluded.round,
    date_utc = CASE
      WHEN fixture_schedule.override_date_utc IS NOT NULL THEN fixture_schedule.date_utc
      ELSE excluded.date_utc
    END,
    date_ar = CASE
      WHEN fixture_schedule.override_date_utc IS NOT NULL THEN fixture_schedule.date_ar
      ELSE excluded.date_ar
    END,
    time_ar = CASE
      WHEN fixture_schedule.override_date_utc IS NOT NULL THEN fixture_schedule.time_ar
      ELSE excluded.time_ar
    END,
    status_short = excluded.status_short,
    status_long = excluded.status_long,
    minute = excluded.minute,
    home_team_id = excluded.home_team_id,
    home_team_name = excluded.home_team_name,
    home_team_logo = excluded.home_team_logo,
    away_team_id = excluded.away_team_id,
    away_team_name = excluded.away_team_name,
    away_team_logo = excluded.away_team_logo,
    goals_home = excluded.goals_home,
    goals_away = excluded.goals_away,
    home_penalty_score = excluded.home_penalty_score,
    away_penalty_score = excluded.away_penalty_score,
    updated_at = excluded.updated_at
`)

const selectFixturesByDateStatement = db.prepare(`
  SELECT
    fixture_id,
    league_id,
    season,
    league_name,
    league_logo,
    country,
    round,
    COALESCE(override_date_utc, date_utc) AS date_utc,
    override_date_utc,
    date_ar,
    time_ar,
    status_short,
    status_long,
    minute,
    home_team_id,
    home_team_name,
    home_team_logo,
    away_team_id,
    away_team_name,
    away_team_logo,
    goals_home,
    goals_away,
    home_penalty_score,
    away_penalty_score
  FROM fixture_schedule
  WHERE date_ar = ?
  ORDER BY date_utc ASC, fixture_id ASC
`)

const selectFixturesByLeagueSeasonStatement = db.prepare(`
  SELECT
    fixture_id,
    league_id,
    season,
    league_name,
    league_logo,
    country,
    round,
    COALESCE(override_date_utc, date_utc) AS date_utc,
    override_date_utc,
    date_ar,
    time_ar,
    status_short,
    status_long,
    minute,
    home_team_id,
    home_team_name,
    home_team_logo,
    away_team_id,
    away_team_name,
    away_team_logo,
    goals_home,
    goals_away,
    home_penalty_score,
    away_penalty_score
  FROM fixture_schedule
  WHERE league_id = ? AND season = ?
  ORDER BY date_utc ASC, fixture_id ASC
`)

let lastCleanupAt = 0

function maybeCleanupExpiredEntries() {
  const now = Date.now()

  if (now - lastCleanupAt < 5 * 60 * 1000) return

  deleteExpiredStatement.run(now)
  lastCleanupAt = now
}

export function readPersistentCache<T>(cacheKey: string) {
  maybeCleanupExpiredEntries()

  const row = selectCacheStatement.get(cacheKey) as CacheRow | undefined
  if (!row) return null

  return {
    data: JSON.parse(row.payload) as T,
    expiresAt: row.expires_at,
    isExpired: row.expires_at <= Date.now(),
  }
}

export function writePersistentCache(
  cacheKey: string,
  path: string,
  payload: unknown,
  ttlSeconds: number
) {
  const now = Date.now()
  const expiresAt = now + ttlSeconds * 1000

  upsertCacheStatement.run(
    cacheKey,
    path,
    JSON.stringify(payload),
    expiresAt,
    now
  )
}

function toArgentinaDateKey(dateString: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateString))
}

function toArgentinaTime(dateString: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateString))
}

function mapStoredFixture(row: StoredFixtureRow): StoredFixture {
  return {
    fixtureId: row.fixture_id,
    leagueId: row.league_id ?? undefined,
    season: row.season ?? undefined,
    leagueName: row.league_name,
    leagueLogo: row.league_logo ?? undefined,
    country: row.country ?? undefined,
    round: row.round ?? undefined,
    date: row.date_utc,
    dateAr: row.date_ar,
    timeAr: row.time_ar,
    statusShort: row.status_short,
    statusLong: row.status_long,
    minute: row.minute ?? null,
    homeTeamId: row.home_team_id ?? undefined,
    homeTeamName: row.home_team_name,
    homeTeamLogo: row.home_team_logo ?? undefined,
    awayTeamId: row.away_team_id ?? undefined,
    awayTeamName: row.away_team_name,
    awayTeamLogo: row.away_team_logo ?? undefined,
    goalsHome: row.goals_home ?? null,
    goalsAway: row.goals_away ?? null,
    homePenaltyScore: row.home_penalty_score ?? null,
    awayPenaltyScore: row.away_penalty_score ?? null,
  }
}

export function upsertStoredFixtures(fixtures: StoredFixtureInput[]) {
  const now = Date.now()

  try {
    for (const fixture of fixtures) {
      const effectiveDate = fixture.dateUtc

      upsertFixtureStatement.run(
        fixture.fixtureId,
        fixture.leagueId ?? null,
        fixture.season ?? null,
        fixture.leagueName,
        fixture.leagueLogo ?? null,
        fixture.country ?? null,
        fixture.round ?? null,
        effectiveDate,
        toArgentinaDateKey(effectiveDate),
        toArgentinaTime(effectiveDate),
        fixture.statusShort,
        fixture.statusLong,
        fixture.minute,
        fixture.homeTeamId ?? null,
        fixture.homeTeamName,
        fixture.homeTeamLogo ?? null,
        fixture.awayTeamId ?? null,
        fixture.awayTeamName,
        fixture.awayTeamLogo ?? null,
        fixture.goalsHome,
        fixture.goalsAway,
        fixture.homePenaltyScore ?? null,
        fixture.awayPenaltyScore ?? null,
        now
      )
    }
  } catch (error) {
    console.error('No se pudieron guardar fixtures en SQLite.', error)
  }
}

export function readStoredFixturesByDate(dateAr: string) {
  try {
    const rows = selectFixturesByDateStatement.all(dateAr) as StoredFixtureRow[]
    return rows.map(mapStoredFixture)
  } catch (error) {
    console.error('No se pudieron leer fixtures por fecha desde SQLite.', error)
    return []
  }
}

export function readStoredFixturesByLeagueSeason(leagueId: number, season: number) {
  try {
    const rows = selectFixturesByLeagueSeasonStatement.all(leagueId, season) as StoredFixtureRow[]
    return rows.map(mapStoredFixture)
  } catch (error) {
    console.error('No se pudieron leer fixtures por liga/temporada desde SQLite.', error)
    return []
  }
}
