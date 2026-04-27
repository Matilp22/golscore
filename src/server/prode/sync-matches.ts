import type { SupabaseClient } from '@supabase/supabase-js'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { recalculateProdePoints } from '@/server/prode/points'
import {
  ALLOWED_TOURNAMENTS,
  getAllowedTournamentBySlug,
  getAllowedTournamentByExternalId,
  normalizeLeagueName,
  type AllowedTournament,
} from '@/shared/config/prode-leagues'
import { isFinishedStatus } from '@/shared/utils/match-status'

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: {
      elapsed?: number | null
      long?: string
      short: string
    }
  }
  league: {
    id: number
    name: string
    country?: string
    season?: number
    round?: string
  }
  teams: {
    home: {
      id: number
      name: string
      logo?: string
    }
    away: {
      id: number
      name: string
      logo?: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score?: {
    fulltime?: {
      home: number | null
      away: number | null
    }
    penalty?: {
      home: number | null
      away: number | null
    }
  }
}

export type SyncTournamentResult = {
  slug: string
  name: string
  externalLeagueId: number
  season: number
  fetched: number
  processed: number
  discarded: number
  leaguesCreated: number
  leaguesUpdated: number
  teamsCreated: number
  teamsUpdated: number
  matchesCreated: number
  matchesUpdated: number
  created: number
  updated: number
  skipped: number
  roundSummary: Array<{
    round: string
    count: number
    firstFixtureId: number
    lastFixtureId: number
  }>
  errors: string[]
  sampleErrors: Array<{
    fixtureId: number | null
    stage: string
    message: string
  }>
}

export type SyncMatchesResult = {
  processedTournaments: number
  fetched: number
  processed: number
  discarded: number
  teamsCreated: number
  teamsUpdated: number
  matchesCreated: number
  matchesUpdated: number
  created: number
  updated: number
  skipped: number
  tournaments: SyncTournamentResult[]
}

type DbId = string | number

type DbIdRow = {
  id: DbId
}

type SyncOptions = {
  competition?: string | null
  debug?: boolean
  limit?: number | null
}

type UpsertAction = 'created' | 'updated'

type UpsertResult = {
  id: DbId
  action: UpsertAction
}

type StoredMatchLookupRow = DbIdRow & {
  external_id?: number | string | null
}

export type SyncSingleFixtureResult = {
  fixtureId: number
  tournament: {
    slug: string
    name: string
    externalLeagueId: number
    season: number
  }
  api: {
    status: string
    statusLong?: string | null
    elapsed?: number | null
    date?: string
    goalsHome: number | null
    goalsAway: number | null
    fulltimeHome: number | null
    fulltimeAway: number | null
    resolvedHomeScore: number | null
    resolvedAwayScore: number | null
  }
  warnings: string[]
  before: {
    id: DbId
    external_id: number | string | null
    home_score: number | null
    away_score: number | null
    status: string | null
  } | null
  after: {
    id: DbId
    external_id: number | string | null
    home_score: number | null
    away_score: number | null
    status: string | null
  } | null
  action: UpsertAction
  matchBefore?: SyncSingleFixtureResult['before']
  matchAfter?: SyncSingleFixtureResult['after']
  apiFixture?: {
    fixture: {
      id: number
      date: string
      status: {
        short: string
        long: string | null
        elapsed: number | null
      }
    }
    goals: {
      home: number | null
      away: number | null
    }
    score: {
      fulltime: {
        home: number | null
        away: number | null
      }
    }
  }
  updatedFields?: Record<string, { before: unknown; after: unknown }>
}

function logDebug(enabled: boolean | undefined, message: string, meta?: Record<string, unknown>) {
  if (!enabled) return

  console.info(`[sync-matches:debug] ${message}`, meta ?? {})
}

async function withTimeout<T>(promise: PromiseLike<T>, stage: string, ms = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${stage} supero ${ms}ms sin responder.`)),
          ms
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function addFixtureError(
  result: SyncTournamentResult,
  fixtureId: number | null,
  stage: string,
  error: unknown
) {
  const message = error instanceof Error ? error.message : 'Error desconocido'
  const detail = fixtureId ? `Fixture ${fixtureId} (${stage}): ${message}` : `${stage}: ${message}`

  result.errors.push(detail)

  if (result.sampleErrors.length < 10) {
    result.sampleErrors.push({ fixtureId, stage, message })
  }
}

function getFixtureRoundValue(round: string | null | undefined) {
  const normalizedRound = round?.trim()

  return normalizedRound ? normalizedRound : null
}

function getFixtureHomeScore(fixture: ApiFixture) {
  return fixture.goals.home ?? fixture.score?.fulltime?.home ?? null
}

function getFixtureAwayScore(fixture: ApiFixture) {
  return fixture.goals.away ?? fixture.score?.fulltime?.away ?? null
}

function hasResolvedScore(fixture: ApiFixture) {
  return getFixtureHomeScore(fixture) !== null && getFixtureAwayScore(fixture) !== null
}

function shouldRecalculateProdePoints(fixture: ApiFixture) {
  return isFinishedStatus(fixture.fixture.status.short) && hasResolvedScore(fixture)
}

function getUpdatedFields(
  before: SyncSingleFixtureResult['before'],
  after: SyncSingleFixtureResult['after']
) {
  const fields: Record<string, { before: unknown; after: unknown }> = {}

  if (!after) return fields

  for (const field of ['status', 'home_score', 'away_score', 'external_id'] as const) {
    const beforeValue = before?.[field] ?? null
    const afterValue = after[field] ?? null

    if (beforeValue !== afterValue) {
      fields[field] = {
        before: beforeValue,
        after: afterValue,
      }
    }
  }

  return fields
}

function getTeamLogoUrl(team: { id: number; logo?: string }) {
  return team.logo || `https://media.api-sports.io/football/teams/${team.id}.png`
}

function getTournamentSelection(slug?: string | null) {
  if (!slug) return [...ALLOWED_TOURNAMENTS]

  const tournament = getAllowedTournamentBySlug(slug)
  return tournament ? [tournament] : []
}

function summarizeFixtureRounds(fixtures: ApiFixture[]) {
  const grouped = new Map<string, ApiFixture[]>()

  for (const fixture of fixtures) {
    const round = fixture.league.round || 'Sin fase'
    const current = grouped.get(round) || []
    current.push(fixture)
    grouped.set(round, current)
  }

  return [...grouped.entries()].map(([round, roundFixtures]) => {
    const sorted = [...roundFixtures].sort(compareFixturesByApiOrder)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    return {
      round,
      count: sorted.length,
      firstFixtureId: first?.fixture.id ?? 0,
      lastFixtureId: last?.fixture.id ?? 0,
    }
  })
}

function compareFixturesByApiOrder(a: ApiFixture, b: ApiFixture) {
  const roundCompare = getApiRoundOrder(a.league.round) - getApiRoundOrder(b.league.round)
  if (roundCompare !== 0) return roundCompare

  const dateCompare = new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
  if (dateCompare !== 0) return dateCompare

  return a.fixture.id - b.fixture.id
}

function getApiRoundOrder(round: string | null | undefined) {
  const normalized = (round || '').toLowerCase()

  if (normalized.includes('round of 64') || normalized.includes('32nd finals')) return 10
  if (normalized.includes('round of 32') || normalized.includes('16th finals')) return 20
  if (normalized.includes('round of 16') || normalized.includes('octavos')) return 30
  if (normalized.includes('quarter')) return 40
  if (normalized.includes('semi')) return 50
  if (normalized.includes('final') && !normalized.includes('semi')) return 60
  return 999
}

async function fetchTournamentFixtures(tournament: AllowedTournament) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      league: tournament.externalLeagueId,
      season: tournament.season,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-matches:${tournament.slug}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function fetchFixtureById(fixtureId: number) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      id: fixtureId,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-match:${fixtureId}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  const fixture = payload.response?.[0] ?? null

  if (!fixture) {
    throw new Error(`API-Football no devolvio el fixture ${fixtureId}.`)
  }

  return fixture
}

async function upsertLeague(
  supabase: SupabaseClient,
  tournament: AllowedTournament,
  fixture: ApiFixture | null,
  debug?: boolean
) {
  const payload = {
    external_id: tournament.externalLeagueId,
    name: tournament.name,
    country: fixture?.league.country ?? (tournament.type === 'cup' ? 'World' : 'Argentina'),
    season: tournament.season,
  }

  logDebug(debug, 'league lookup by external_id started', {
    external_id: tournament.externalLeagueId,
  })

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id')
      .eq('external_id', tournament.externalLeagueId)
      .maybeSingle(),
    `leagues lookup ${tournament.externalLeagueId}`
  )

  logDebug(debug, 'league lookup by external_id finished', {
    external_id: tournament.externalLeagueId,
    found: Boolean(existingByExternalId),
    error: externalIdError?.message ?? null,
  })

  if (externalIdError) {
    throw new Error(`No se pudo buscar la liga ${tournament.name}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    logDebug(debug, 'league update started', { id: (existingByExternalId as DbIdRow).id })

    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id')
        .single(),
      `leagues update ${tournament.externalLeagueId}`
    )

    logDebug(debug, 'league update finished', {
      id: (existingByExternalId as DbIdRow).id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar la liga ${tournament.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  const allowedNames = new Set(
    [tournament.name, ...tournament.aliases].map((name) => normalizeLeagueName(name))
  )
  logDebug(debug, 'legacy league lookup started', { tournament: tournament.slug })

  const { data: legacyLeagues, error: legacyError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id, name, external_id')
      .is('external_id', null),
    `legacy leagues lookup ${tournament.slug}`
  )

  logDebug(debug, 'legacy league lookup finished', {
    tournament: tournament.slug,
    count: legacyLeagues?.length ?? 0,
    error: legacyError?.message ?? null,
  })

  if (legacyError) {
    throw new Error(`No se pudo buscar ligas legacy para ${tournament.name}: ${legacyError.message}`)
  }

  const reusableLegacyLeague = (legacyLeagues as Array<DbIdRow & {
    name: string | null
    external_id: number | null
  }> | null)?.find((league) => allowedNames.has(normalizeLeagueName(league.name)))

  if (reusableLegacyLeague) {
    logDebug(debug, 'legacy league normalize started', { id: reusableLegacyLeague.id })

    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', reusableLegacyLeague.id)
        .select('id')
        .single(),
      `legacy league normalize ${tournament.slug}`
    )

    logDebug(debug, 'legacy league normalize finished', {
      id: reusableLegacyLeague.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo normalizar la liga ${tournament.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'league insert started', { external_id: tournament.externalLeagueId })

  const { data, error } = await withTimeout(
    supabase
      .from('leagues')
      .insert(payload)
      .select('id')
      .single(),
    `leagues insert ${tournament.externalLeagueId}`
  )

  logDebug(debug, 'league insert finished', {
    external_id: tournament.externalLeagueId,
    error: error?.message ?? null,
  })

  if (error) throw new Error(`No se pudo guardar la liga ${tournament.name}: ${error.message}`)

  return {
    id: (data as DbIdRow).id,
    action: 'created' as const,
  }
}

async function upsertTeam(
  supabase: SupabaseClient,
  team: { id: number; name: string; logo?: string },
  debug?: boolean
) {
  const payload = {
    external_id: team.id,
    name: team.name,
    logo_url: getTeamLogoUrl(team),
  }

  logDebug(debug, 'team lookup by external_id started', {
    external_id: team.id,
    name: team.name,
  })

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('teams')
      .select('id')
      .eq('external_id', team.id)
      .maybeSingle(),
    `teams lookup ${team.id}`
  )

  logDebug(debug, 'team lookup by external_id finished', {
    external_id: team.id,
    found: Boolean(existingByExternalId),
    error: externalIdError?.message ?? null,
  })

  if (externalIdError) {
    throw new Error(`No se pudo buscar el equipo ${team.name}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    logDebug(debug, 'team update started', { id: (existingByExternalId as DbIdRow).id })

    const { data, error } = await withTimeout(
      supabase
        .from('teams')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id')
        .single(),
      `teams update ${team.id}`,
    )

    logDebug(debug, 'team update finished', {
      id: (existingByExternalId as DbIdRow).id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar el equipo ${team.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'legacy team lookup started', { external_id: team.id })

  const { data: legacyTeams, error: legacyError } = await withTimeout(
    supabase
      .from('teams')
      .select('id, name, external_id')
      .is('external_id', null),
    `legacy teams lookup ${team.id}`
  )

  logDebug(debug, 'legacy team lookup finished', {
    external_id: team.id,
    count: legacyTeams?.length ?? 0,
    error: legacyError?.message ?? null,
  })

  if (legacyError) {
    throw new Error(`No se pudo buscar equipos legacy para ${team.name}: ${legacyError.message}`)
  }

  const reusableLegacyTeam = (legacyTeams as Array<DbIdRow & {
    name: string | null
    external_id: number | null
  }> | null)?.find((candidate) => normalizeLeagueName(candidate.name) === normalizeLeagueName(team.name))

  if (reusableLegacyTeam) {
    logDebug(debug, 'legacy team normalize started', { id: reusableLegacyTeam.id })

    const { data, error } = await withTimeout(
      supabase
        .from('teams')
        .update(payload)
        .eq('id', reusableLegacyTeam.id)
        .select('id')
        .single(),
      `legacy team normalize ${team.id}`,
    )

    logDebug(debug, 'legacy team normalize finished', {
      id: reusableLegacyTeam.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo normalizar el equipo ${team.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'team insert started', { external_id: team.id })

  const { data, error } = await withTimeout(
    supabase
      .from('teams')
      .insert(payload)
      .select('id')
      .single(),
    `teams insert ${team.id}`,
  )

  logDebug(debug, 'team insert finished', {
    external_id: team.id,
    error: error?.message ?? null,
  })

  if (error) throw new Error(`No se pudo guardar el equipo ${team.name}: ${error.message}`)

  return {
    id: (data as DbIdRow).id,
    action: 'created' as const,
  }
}

async function upsertMatch(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  leagueId: string | number,
  homeTeamId: string | number,
  awayTeamId: string | number,
  debug?: boolean
) {
  const homeScore = getFixtureHomeScore(fixture)
  const awayScore = getFixtureAwayScore(fixture)
  const payload = {
    external_id: fixture.fixture.id,
    league_id: leagueId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_date: fixture.fixture.date,
    round: getFixtureRoundValue(fixture.league.round),
    status: fixture.fixture.status.short,
    home_score: homeScore,
    away_score: awayScore,
  }

  logDebug(debug, 'match lookup by external_id started', {
    external_id: fixture.fixture.id,
  })

  const externalIdCandidates = [String(fixture.fixture.id), fixture.fixture.id]
  let existingByExternalId: StoredMatchLookupRow | null = null
  let existingExternalIdError: { message: string } | null = null

  for (const externalId of externalIdCandidates) {
    const { data, error } = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id')
        .eq('external_id', externalId)
        .maybeSingle(),
      `matches lookup ${fixture.fixture.id}`
    )

    if (error) {
      existingExternalIdError = error
      break
    }

    if (data) {
      existingByExternalId = data as StoredMatchLookupRow
      break
    }
  }

  logDebug(debug, 'match lookup by external_id finished', {
    external_id: fixture.fixture.id,
    found: Boolean(existingByExternalId),
    error: existingExternalIdError?.message ?? null,
  })

  if (existingExternalIdError) {
    throw new Error(`No se pudo verificar el partido ${fixture.fixture.id}: ${existingExternalIdError.message}`)
  }

  if (!existingByExternalId) {
    const { data: existingById, error: existingByIdError } = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id')
        .eq('id', fixture.fixture.id)
        .maybeSingle(),
      `matches lookup by id ${fixture.fixture.id}`
    )

    if (existingByIdError) {
      logDebug(debug, 'match lookup by id fallback failed', {
        fixtureId: fixture.fixture.id,
        error: existingByIdError.message,
      })
    } else if (existingById) {
      existingByExternalId = existingById as StoredMatchLookupRow
      logDebug(debug, 'match lookup by id fallback found legacy row', {
        fixtureId: fixture.fixture.id,
        id: existingByExternalId.id,
        external_id: existingByExternalId.external_id ?? null,
      })
    }
  }

  const existing = existingByExternalId

  if (existing) {
    logDebug(debug, 'match update started', {
      fixtureId: fixture.fixture.id,
      id: existing.id,
      payload,
    })

    const { error } = await withTimeout(
      supabase
        .from('matches')
        .update(payload)
        .eq('id', existing.id),
      `matches update ${fixture.fixture.id}`
    )

    logDebug(debug, 'match update finished', {
      fixtureId: fixture.fixture.id,
      id: existing.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar el partido ${fixture.fixture.id}: ${error.message}`)

    await updateElapsedIfSupported(supabase, existing.id, fixture, debug)
    await updatePenaltyScoresIfSupported(supabase, existing.id, fixture, debug)

    return {
      id: existing.id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'match insert started', {
    fixtureId: fixture.fixture.id,
    payload,
  })

  const { data, error } = await withTimeout(
    supabase
      .from('matches')
      .insert(payload)
      .select('id')
      .single(),
    `matches insert ${fixture.fixture.id}`
  )

  logDebug(debug, 'match insert finished', {
    fixtureId: fixture.fixture.id,
    error: error?.message ?? null,
  })

  if (!error) {
    await updateElapsedIfSupported(supabase, (data as DbIdRow).id, fixture, debug)
    await updatePenaltyScoresIfSupported(supabase, (data as DbIdRow).id, fixture, debug)

    return {
      id: (data as DbIdRow).id,
      action: 'created' as const,
    }
  }

  const shouldTryNumericIdFallback =
    error.message.toLowerCase().includes('null value') ||
    error.message.toLowerCase().includes('id') ||
    error.message.toLowerCase().includes('primary key')

  if (!shouldTryNumericIdFallback) {
    throw new Error(`No se pudo guardar el partido ${fixture.fixture.id}: ${error.message}`)
  }

  logDebug(debug, 'match insert fallback with id started', {
    fixtureId: fixture.fixture.id,
  })

  const { data: fallbackData, error: fallbackError } = await withTimeout(
    supabase
      .from('matches')
      .insert({
        id: fixture.fixture.id,
        ...payload,
      })
      .select('id')
      .single(),
    `matches insert fallback ${fixture.fixture.id}`
  )

  logDebug(debug, 'match insert fallback with id finished', {
    fixtureId: fixture.fixture.id,
    error: fallbackError?.message ?? null,
  })

  if (fallbackError) {
    if (fallbackError.message.toLowerCase().includes('duplicate')) {
      logDebug(debug, 'match update by id fallback started', {
        fixtureId: fixture.fixture.id,
      })

      const { error: updateByIdError } = await withTimeout(
        supabase
          .from('matches')
          .update(payload)
          .eq('id', fixture.fixture.id),
        `matches update by id fallback ${fixture.fixture.id}`
      )

      logDebug(debug, 'match update by id fallback finished', {
        fixtureId: fixture.fixture.id,
        error: updateByIdError?.message ?? null,
      })

      if (!updateByIdError) {
        await updateElapsedIfSupported(supabase, fixture.fixture.id, fixture, debug)
        await updatePenaltyScoresIfSupported(supabase, fixture.fixture.id, fixture, debug)

        return {
          id: fixture.fixture.id,
          action: 'updated' as const,
        }
      }
    }

    throw new Error(
      `No se pudo guardar el partido ${fixture.fixture.id}: ${error.message}; fallback con id fallo: ${fallbackError.message}`
    )
  }

  const fallbackId = (fallbackData as DbIdRow | null)?.id ?? fixture.fixture.id
  await updateElapsedIfSupported(supabase, fallbackId, fixture, debug)
  await updatePenaltyScoresIfSupported(supabase, fallbackId, fixture, debug)

  return {
    id: fallbackId,
    action: 'created' as const,
  }
}

async function updateElapsedIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  debug?: boolean
) {
  const elapsed = isFinishedStatus(fixture.fixture.status.short)
    ? null
    : fixture.fixture.status.elapsed ?? null

  const { error } = await withTimeout(
    supabase
      .from('matches')
      .update({ elapsed })
      .eq('id', matchId),
    `matches elapsed update ${fixture.fixture.id}`
  )

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingElapsedColumn =
    message.includes('elapsed') ||
    message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'

  if (isMissingElapsedColumn) {
    logDebug(debug, 'elapsed column missing; base match sync preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      elapsed,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudo guardar elapsed del partido ${fixture.fixture.id}: ${error.message}`)
}

async function updatePenaltyScoresIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  debug?: boolean
) {
  const homePenaltyScore = fixture.score?.penalty?.home ?? null
  const awayPenaltyScore = fixture.score?.penalty?.away ?? null

  if (homePenaltyScore === null && awayPenaltyScore === null) return

  const { error } = await withTimeout(
    supabase
      .from('matches')
      .update({
        home_penalty_score: homePenaltyScore,
        away_penalty_score: awayPenaltyScore,
      })
      .eq('id', matchId),
    `matches penalty update ${fixture.fixture.id}`
  )

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingPenaltyColumn =
    message.includes('home_penalty_score') ||
    message.includes('away_penalty_score') ||
    message.includes('schema cache')

  if (isMissingPenaltyColumn) {
    logDebug(debug, 'penalty columns missing; base match sync preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudieron guardar penales del partido ${fixture.fixture.id}: ${error.message}`)
}

async function fetchStoredMatchByExternalId(supabase: SupabaseClient, fixtureId: number) {
  let data: unknown = null
  let error: { message: string } | null = null

  for (const externalId of [String(fixtureId), fixtureId]) {
    const result = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id, home_score, away_score, status')
        .eq('external_id', externalId)
        .maybeSingle(),
      `matches debug lookup ${fixtureId}`
    )

    if (result.error) {
      error = result.error
      break
    }

    if (result.data) {
      data = result.data
      break
    }
  }

  if (!data && !error) {
    const result = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id, home_score, away_score, status')
        .eq('id', fixtureId)
        .maybeSingle(),
      `matches debug lookup by id ${fixtureId}`
    )

    data = result.data
    error = result.error
  }

  if (error) {
    throw new Error(`No se pudo leer el partido ${fixtureId} desde Supabase: ${error.message}`)
  }

  return data as SyncSingleFixtureResult['before']
}

export async function syncProdeFixtureById(
  supabase: SupabaseClient,
  fixtureId: number,
  options: { debug?: boolean } = {}
): Promise<SyncSingleFixtureResult> {
  const fixture = await fetchFixtureById(fixtureId)
  const tournament = getAllowedTournamentByExternalId(fixture.league.id)

  if (!tournament) {
    throw new Error(
      `Fixture ${fixtureId} pertenece a liga ${fixture.league.id}, que no esta permitida para Prode.`
    )
  }

  if (fixture.league.season && fixture.league.season !== tournament.season) {
    throw new Error(
      `Fixture ${fixtureId} pertenece a temporada ${fixture.league.season}, esperada ${tournament.season}.`
    )
  }

  const before = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const league = await upsertLeague(supabase, tournament, fixture, options.debug)
  const [homeTeam, awayTeam] = await Promise.all([
    upsertTeam(supabase, fixture.teams.home, options.debug),
    upsertTeam(supabase, fixture.teams.away, options.debug),
  ])
  const matchUpsert = await upsertMatch(
    supabase,
    fixture,
    league.id,
    homeTeam.id,
    awayTeam.id,
    options.debug
  )
  const warnings: string[] = []

  if (shouldRecalculateProdePoints(fixture)) {
    try {
      await recalculateProdePoints(supabase, matchUpsert.id)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudieron recalcular puntos.'
      warnings.push(message)
      logDebug(options.debug, 'prode points recalculation failed after single fixture sync', {
        fixtureId,
        matchId: matchUpsert.id,
        error: message,
      })
    }
  }

  const after = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const updatedFields = getUpdatedFields(before, after)

  return {
    fixtureId,
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      externalLeagueId: tournament.externalLeagueId,
      season: tournament.season,
    },
    api: {
      status: fixture.fixture.status.short,
      statusLong: fixture.fixture.status.long ?? null,
      elapsed: fixture.fixture.status.elapsed ?? null,
      date: fixture.fixture.date,
      goalsHome: fixture.goals.home,
      goalsAway: fixture.goals.away,
      fulltimeHome: fixture.score?.fulltime?.home ?? null,
      fulltimeAway: fixture.score?.fulltime?.away ?? null,
      resolvedHomeScore: getFixtureHomeScore(fixture),
      resolvedAwayScore: getFixtureAwayScore(fixture),
    },
    warnings,
    before,
    after,
    matchBefore: before,
    matchAfter: after,
    apiFixture: {
      fixture: {
        id: fixture.fixture.id,
        date: fixture.fixture.date,
        status: {
          short: fixture.fixture.status.short,
          long: fixture.fixture.status.long ?? null,
          elapsed: fixture.fixture.status.elapsed ?? null,
        },
      },
      goals: {
        home: fixture.goals.home,
        away: fixture.goals.away,
      },
      score: {
        fulltime: {
          home: fixture.score?.fulltime?.home ?? null,
          away: fixture.score?.fulltime?.away ?? null,
        },
      },
    },
    updatedFields,
    action: matchUpsert.action,
  }
}

export async function syncProdeMatches(
  supabase: SupabaseClient,
  options: SyncOptions = {}
): Promise<SyncMatchesResult> {
  const tournaments = getTournamentSelection(options.competition)
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : null

  if (options.competition && !tournaments.length) {
    throw new Error(`Torneo no permitido: ${options.competition}`)
  }

  const results: SyncTournamentResult[] = []

  for (const tournament of tournaments) {
    const result: SyncTournamentResult = {
      slug: tournament.slug,
      name: tournament.name,
      externalLeagueId: tournament.externalLeagueId,
      season: tournament.season,
      fetched: 0,
      processed: 0,
      discarded: 0,
      leaguesCreated: 0,
      leaguesUpdated: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      matchesCreated: 0,
      matchesUpdated: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      roundSummary: [],
      errors: [],
      sampleErrors: [],
    }

    try {
      const fixtures = await fetchTournamentFixtures(tournament)
      result.fetched = fixtures.length
      result.roundSummary = summarizeFixtureRounds(fixtures)
      const orderedFixtures = [...fixtures].sort(compareFixturesByApiOrder)
      const fixturesToProcess = orderedFixtures

      logDebug(options.debug, 'fixtures fetched', {
        tournament: tournament.slug,
        fetched: fixtures.length,
        processing: fixturesToProcess.length,
        limitIgnored: limit,
        roundSummary: result.roundSummary,
        order: orderedFixtures.map((fixture) => ({
          round: fixture.league.round ?? null,
          date: fixture.fixture.date,
          fixtureId: fixture.fixture.id,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
        })),
      })

      let league: UpsertResult

      try {
        league = await upsertLeague(supabase, tournament, fixtures[0] ?? null, options.debug)

        if (league.action === 'created') result.leaguesCreated += 1
        if (league.action === 'updated') result.leaguesUpdated += 1

        logDebug(options.debug, 'league upserted', {
          tournament: tournament.slug,
          leagueId: league.id,
          action: league.action,
          externalLeagueId: tournament.externalLeagueId,
        })
      } catch (error) {
        addFixtureError(result, null, 'league-upsert', error)
        results.push(result)
        continue
      }

      for (const fixture of fixturesToProcess) {
        try {
          if (fixture.league.id !== tournament.externalLeagueId) {
            result.skipped += 1
            result.discarded += 1
            result.errors.push(
              `Fixture ${fixture.fixture.id} ignorado: pertenece a liga ${fixture.league.id}, no a ${tournament.externalLeagueId}.`
            )
            logDebug(options.debug, 'fixture discarded by league mismatch', {
              fixtureId: fixture.fixture.id,
              fixtureLeagueId: fixture.league.id,
              expectedLeagueId: tournament.externalLeagueId,
            })
            continue
          }

          if (!fixture.teams.home.id || !fixture.teams.away.id) {
            result.skipped += 1
            result.discarded += 1
            logDebug(options.debug, 'fixture discarded by missing team id', {
              fixtureId: fixture.fixture.id,
              homeTeamId: fixture.teams.home.id,
              awayTeamId: fixture.teams.away.id,
            })
            continue
          }

          result.processed += 1

          logDebug(options.debug, 'processing fixture', {
            fixtureId: fixture.fixture.id,
            external_id: fixture.fixture.id,
            league_id: league.id,
            homeExternalId: fixture.teams.home.id,
            awayExternalId: fixture.teams.away.id,
            match_date: fixture.fixture.date,
            api_round: fixture.league.round ?? null,
            stored_round: getFixtureRoundValue(fixture.league.round),
            status: fixture.fixture.status.short,
            goals_home: fixture.goals.home,
            goals_away: fixture.goals.away,
            fulltime_home: fixture.score?.fulltime?.home ?? null,
            fulltime_away: fixture.score?.fulltime?.away ?? null,
            resolved_home_score: getFixtureHomeScore(fixture),
            resolved_away_score: getFixtureAwayScore(fixture),
          })

          const [homeTeam, awayTeam] = await Promise.all([
            upsertTeam(supabase, fixture.teams.home, options.debug),
            upsertTeam(supabase, fixture.teams.away, options.debug),
          ])

          if (homeTeam.action === 'created') result.teamsCreated += 1
          if (homeTeam.action === 'updated') result.teamsUpdated += 1
          if (awayTeam.action === 'created') result.teamsCreated += 1
          if (awayTeam.action === 'updated') result.teamsUpdated += 1

          const matchUpsert = await upsertMatch(
            supabase,
            fixture,
            league.id,
            homeTeam.id,
            awayTeam.id,
            options.debug
          )

          if (matchUpsert.action === 'created') {
            result.created += 1
            result.matchesCreated += 1
          }

          if (matchUpsert.action === 'updated') {
            result.updated += 1
            result.matchesUpdated += 1
          }

          if (shouldRecalculateProdePoints(fixture)) {
            try {
              await recalculateProdePoints(supabase, matchUpsert.id)
              logDebug(options.debug, 'prode points recalculated', {
                fixtureId: fixture.fixture.id,
                matchId: matchUpsert.id,
              })
            } catch (error) {
              addFixtureError(result, fixture.fixture.id, 'points-recalculation', error)
            }
          }

          logDebug(options.debug, 'match upserted', {
            fixtureId: fixture.fixture.id,
            matchId: matchUpsert.id,
            action: matchUpsert.action,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            leagueId: league.id,
          })
        } catch (error) {
          addFixtureError(result, fixture.fixture.id, 'fixture-processing', error)
          logDebug(options.debug, 'fixture failed', {
            fixtureId: fixture.fixture.id,
            error: error instanceof Error ? error.message : 'Error desconocido',
          })
        }
      }

      logDebug(options.debug, 'tournament summary', {
        tournament: tournament.slug,
        fetched: result.fetched,
        processed: result.processed,
        discarded: result.discarded,
        teamsCreated: result.teamsCreated,
        teamsUpdated: result.teamsUpdated,
        matchesCreated: result.matchesCreated,
        matchesUpdated: result.matchesUpdated,
        errors: result.errors.length,
      })
    } catch (error) {
      addFixtureError(result, null, 'fetch-fixtures', error)
    }

    results.push(result)
  }

  return {
    processedTournaments: results.length,
    fetched: results.reduce((sum, item) => sum + item.fetched, 0),
    processed: results.reduce((sum, item) => sum + item.processed, 0),
    discarded: results.reduce((sum, item) => sum + item.discarded, 0),
    teamsCreated: results.reduce((sum, item) => sum + item.teamsCreated, 0),
    teamsUpdated: results.reduce((sum, item) => sum + item.teamsUpdated, 0),
    matchesCreated: results.reduce((sum, item) => sum + item.matchesCreated, 0),
    matchesUpdated: results.reduce((sum, item) => sum + item.matchesUpdated, 0),
    created: results.reduce((sum, item) => sum + item.created, 0),
    updated: results.reduce((sum, item) => sum + item.updated, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
    tournaments: results,
  }
}
