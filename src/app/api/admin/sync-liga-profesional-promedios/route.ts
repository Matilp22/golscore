import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getLigaProfesionalPromedioSources,
  isAnnualTableFixtureRound,
} from '@/server/liga-profesional/promedios'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { getArgentinaDateISO } from '@/shared/utils/argentina-time'
import {
  getCanonicalMatchStatusFromApi,
  isFinishedStatus,
} from '@/shared/utils/match-status'
import { getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import { pickLeagueLogoUrl, pickTeamLogoUrl } from '@/shared/utils/asset-urls'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: {
      elapsed?: number | null
      extra?: number | null
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
    logo?: string | null
  }
  teams: {
    home: {
      id?: number
      name: string
      logo?: string | null
    }
    away: {
      id?: number
      name: string
      logo?: string | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score?: {
    fulltime?: {
      home?: number | null
      away?: number | null
    }
    penalty?: {
      home?: number | null
      away?: number | null
    }
  }
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const authorization = request.headers.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  return Boolean(
    cronSecret &&
      (request.headers.get('x-cron-secret') === cronSecret || bearerToken === cronSecret)
  )
}

function readNumber(value: string | null) {
  if (value === null || value.trim() === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function getFixtureHomeScore(fixture: ApiFixture) {
  return fixture.goals.home ?? fixture.score?.fulltime?.home ?? null
}

function getFixtureAwayScore(fixture: ApiFixture) {
  return fixture.goals.away ?? fixture.score?.fulltime?.away ?? null
}

function getFixtureCachePayload(fixture: ApiFixture) {
  return {
    id: fixture.fixture.id,
    externalId: fixture.fixture.id,
    leagueId: fixture.league.id,
    league: fixture.league.name,
    season: fixture.league.season ?? null,
    leagueLogo: pickLeagueLogoUrl(null, fixture.league.id, fixture.league.logo) ?? null,
    country: fixture.league.country ?? null,
    date: fixture.fixture.date,
    round: fixture.league.round ?? null,
    homeId: fixture.teams.home.id,
    home: fixture.teams.home.name,
    awayId: fixture.teams.away.id,
    away: fixture.teams.away.name,
    homeLogo: pickTeamLogoUrl(null, fixture.teams.home.id, fixture.teams.home.logo) ?? null,
    awayLogo: pickTeamLogoUrl(null, fixture.teams.away.id, fixture.teams.away.logo) ?? null,
    goalsHome: getFixtureHomeScore(fixture),
    goalsAway: getFixtureAwayScore(fixture),
    homePenaltyScore: fixture.score?.penalty?.home ?? null,
    awayPenaltyScore: fixture.score?.penalty?.away ?? null,
    minute: getFixtureStatusElapsedMinute(fixture.fixture.status),
    statusShort: getCanonicalMatchStatusFromApi(fixture.fixture.status),
    statusLong: fixture.fixture.status.long ?? fixture.fixture.status.short,
  }
}

async function fetchFixtureSource(leagueExternalId: number, season: number) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      league: leagueExternalId,
      season,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-lpf-promedios:${leagueExternalId}:${season}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function readExistingMatchDetail(fixtureExternalId: number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('football_fixture_cache')
    .select('normalized_payload')
    .eq('fixture_external_id', String(fixtureExternalId))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (response.error) return null

  const normalizedPayload = response.data?.normalized_payload
  if (!normalizedPayload || typeof normalizedPayload !== 'object' || Array.isArray(normalizedPayload)) {
    return null
  }

  return (normalizedPayload as { matchDetail?: unknown }).matchDetail ?? null
}

async function upsertFixtureCache(fixture: ApiFixture) {
  const supabase = getSupabaseAdminClient()
  const matchDetail = await readExistingMatchDetail(fixture.fixture.id)
  const cacheDate = getArgentinaDateISO(fixture.fixture.date)
  const normalizedPayload = {
    ...getFixtureCachePayload(fixture),
    ...(matchDetail ? { matchDetail } : {}),
  }
  const response = await supabase
    .from('football_fixture_cache')
    .upsert(
      {
        date: cacheDate,
        league_external_id: String(fixture.league.id),
        fixture_external_id: String(fixture.fixture.id),
        payload: fixture,
        normalized_payload: normalizedPayload,
      },
      { onConflict: 'date,fixture_external_id' }
    )

  if (response.error) {
    throw response.error
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401, headers: NO_STORE_HEADERS }
    )
  }

  const { searchParams } = new URL(request.url)
  const currentSeason = readNumber(searchParams.get('currentSeason')) ?? new Date().getUTCFullYear()
  const requestedSeason = readNumber(searchParams.get('season'))
  const seasons = requestedSeason
    ? [requestedSeason]
    : [currentSeason - 2, currentSeason - 1, currentSeason]
  const result = {
    ok: true,
    currentSeason,
    seasons,
    sources: [] as Array<{
      season: number
      leagueExternalId: number
      label: string
      fetched: number
      cached: number
      annualFixtures: number
      finishedAnnualFixtures: number
      error?: string
    }>,
  }

  for (const season of seasons) {
    for (const source of getLigaProfesionalPromedioSources(season)) {
      try {
        const fixtures = await fetchFixtureSource(source.leagueExternalId, source.season)
        let cached = 0
        let annualFixtures = 0
        let finishedAnnualFixtures = 0

        for (const fixture of fixtures) {
          if (fixture.league.id !== source.leagueExternalId) continue

          if (isAnnualTableFixtureRound(fixture.league.round)) {
            annualFixtures += 1
            if (isFinishedStatus(getCanonicalMatchStatusFromApi(fixture.fixture.status))) {
              finishedAnnualFixtures += 1
            }
          }

          await upsertFixtureCache(fixture)
          cached += 1
        }

        result.sources.push({
          ...source,
          fetched: fixtures.length,
          cached,
          annualFixtures,
          finishedAnnualFixtures,
        })
      } catch (error) {
        result.ok = false
        result.sources.push({
          ...source,
          fetched: 0,
          cached: 0,
          annualFixtures: 0,
          finishedAnnualFixtures: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
    headers: NO_STORE_HEADERS,
  })
}

export async function POST(request: Request) {
  return GET(request)
}
