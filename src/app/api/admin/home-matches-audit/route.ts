import { NextResponse } from 'next/server'

import {
  getHomeMatchesSourceSnapshot,
  type MatchListItem,
} from '@/lib/api-football'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import {
  formatMatchDateTimeArgentina,
  getArgentinaDateISO,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'

type ApiAuditFixture = {
  fixture?: {
    id?: number
    date?: string
    status?: {
      short?: string
      long?: string
    }
  }
  league?: {
    id?: number
    name?: string
    country?: string
    round?: string
  }
  teams?: {
    home?: {
      name?: string
    }
    away?: {
      name?: string
    }
  }
}

type IncludedAuditMatch = {
  external_id: number
  liga: string
  local: string
  visitante: string
  match_date_utc: string
  match_date_argentina: string
  status: string
  reasonIncluded: 'supabase' | 'supabase+api' | 'apiSupplemented'
}

type ExcludedAuditMatch = {
  external_id: number | null
  liga: string
  local: string
  visitante: string
  match_date_utc: string | null
  match_date_argentina: string | null
  status: string | null
  reasonExcluded:
    | 'excludedCompetition'
    | 'dateMismatch'
    | 'missingLeagueConfig'
    | 'unsupportedLeague'
    | 'duplicate'
    | 'noTeams'
    | 'unknown'
  detail: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return false
  return request.headers.get('x-cron-secret') === cronSecret
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}

function getMatchKey(match: Pick<MatchListItem, 'externalId' | 'id'>) {
  return String(match.externalId ?? match.id)
}

function sortByDateAndId<T extends { match_date_utc: string | null; external_id: number | null }>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    const dateA = a.match_date_utc ?? ''
    const dateB = b.match_date_utc ?? ''

    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return (a.external_id ?? 0) - (b.external_id ?? 0)
  })
}

async function fetchApiFixturesForHomeAudit(date: string) {
  const { payload } = await requestFootballApi<ApiAuditFixture[]>(
    '/fixtures',
    {
      date,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    {
      logContext: 'admin:home-matches-audit',
      usageContext: 'admin-home-matches-audit',
    }
  )

  return payload.response ?? []
}

function serializeIncludedMatch(
  match: MatchListItem,
  storedMatchKeys: Set<string>,
  apiMatchKeys: Set<string>
): IncludedAuditMatch {
  const key = getMatchKey(match)
  const reasonIncluded = storedMatchKeys.has(key)
    ? apiMatchKeys.has(key)
      ? 'supabase+api'
      : 'supabase'
    : 'apiSupplemented'

  return {
    external_id: match.externalId ?? match.id,
    liga: match.league,
    local: match.home,
    visitante: match.away,
    match_date_utc: toArgentinaDate(match.date).toISOString(),
    match_date_argentina: formatMatchDateTimeArgentina(match.date),
    status: match.statusShort,
    reasonIncluded,
  }
}

function serializeExcludedMatch(
  fixture: ApiAuditFixture,
  reasonExcluded: ExcludedAuditMatch['reasonExcluded'],
  detail: string | null
): ExcludedAuditMatch {
  const date = fixture.fixture?.date ?? null

  return {
    external_id: fixture.fixture?.id ?? null,
    liga: fixture.league?.name ?? 'Sin liga',
    local: fixture.teams?.home?.name ?? 'Sin local',
    visitante: fixture.teams?.away?.name ?? 'Sin visitante',
    match_date_utc: date ? toArgentinaDate(date).toISOString() : null,
    match_date_argentina: date ? formatMatchDateTimeArgentina(date) : null,
    status: fixture.fixture?.status?.short ?? null,
    reasonExcluded,
    detail,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dateArgentina = searchParams.get('date') || getArgentinaTodayISO()
    const snapshot = await getHomeMatchesSourceSnapshot(dateArgentina)
    const rawApiFixtures = await fetchApiFixturesForHomeAudit(dateArgentina)
    const rawApiFixtureMap = new Map<number, ApiAuditFixture>()
    const excludedMatches: ExcludedAuditMatch[] = []
    const includedApiMatches = new Map<number, ApiAuditFixture>()

    for (const fixture of rawApiFixtures) {
      const fixtureId = fixture.fixture?.id ?? null
      const fixtureDate = fixture.fixture?.date ?? null
      const home = fixture.teams?.home?.name ?? null
      const away = fixture.teams?.away?.name ?? null

      if (fixtureId !== null && rawApiFixtureMap.has(fixtureId)) {
        excludedMatches.push(
          serializeExcludedMatch(fixture, 'duplicate', 'fixture repetido en la respuesta de API-Football')
        )
        continue
      }

      if (!home || !away) {
        excludedMatches.push(
          serializeExcludedMatch(fixture, 'noTeams', 'fixture sin nombres de equipos')
        )
        continue
      }

      if (!fixtureDate || getArgentinaDateISO(fixtureDate) !== dateArgentina) {
        excludedMatches.push(
          serializeExcludedMatch(fixture, 'dateMismatch', 'el fixture no cae en la fecha argentina pedida')
        )
        continue
      }

      if (fixtureId === null) {
        excludedMatches.push(
          serializeExcludedMatch(fixture, 'unknown', 'fixture sin external_id en la respuesta de API-Football')
        )
        continue
      }

      const visibility = getHomeMatchVisibility({
        leagueId: fixture.league?.id ?? null,
        league: fixture.league?.name ?? '',
        country: fixture.league?.country ?? '',
        home,
        away,
        round: fixture.league?.round ?? null,
      })

      rawApiFixtureMap.set(fixtureId, fixture)

      if (visibility.included) {
        includedApiMatches.set(fixtureId, fixture)
        continue
      }

      excludedMatches.push(
        serializeExcludedMatch(
          fixture,
          visibility.reason === 'excludedCompetition' ? 'excludedCompetition' : 'unsupportedLeague',
          visibility.excludedReason ? String(visibility.excludedReason) : visibility.reason
        )
      )
    }

    const storedMatchKeys = new Set(snapshot.storedMatches.map(getMatchKey))
    const apiMatchKeys = new Set(snapshot.apiMatches.map(getMatchKey))
    const visibleMatchKeys = new Set(snapshot.mergedMatches.map(getMatchKey))

    const includedMatches = sortByDateAndId(
      snapshot.mergedMatches.map((match) =>
        serializeIncludedMatch(match, storedMatchKeys, apiMatchKeys)
      )
    )

    const missingFromSupabase = sortByDateAndId(
      [...includedApiMatches.values()]
        .filter((fixture) => fixture.fixture?.id && !storedMatchKeys.has(String(fixture.fixture.id)))
        .map((fixture) =>
          serializeExcludedMatch(
            fixture,
            'missingLeagueConfig',
            'fixture valido en API-Football pero ausente en Supabase para Home'
          )
        )
    )

    const missingFromHome = sortByDateAndId(
      [...includedApiMatches.values()]
        .filter((fixture) => fixture.fixture?.id && !visibleMatchKeys.has(String(fixture.fixture.id)))
        .map((fixture) =>
          serializeExcludedMatch(
            fixture,
            'unknown',
            'fixture valido en API-Football que no termino en la lista visible del Home'
          )
        )
    )

    return jsonNoStore({
      ok: true,
      dateArgentina,
      supplementRecommended: snapshot.supplementRecommended,
      visibleMatchesCount: includedMatches.length,
      supabaseMatchesCount: snapshot.storedMatches.length,
      apiFootballMatchesCount: rawApiFixtures.length,
      apiFootballVisibleCandidatesCount: includedApiMatches.size,
      hiddenByFilters: excludedMatches.length,
      missingFromHomeCount: missingFromHome.length,
      missingFromSupabaseCount: missingFromSupabase.length,
      apiError: snapshot.apiError,
      missingFromHome,
      missingFromSupabase,
      includedMatches,
      excludedMatches: sortByDateAndId(excludedMatches),
    })
  } catch (error) {
    console.error('[home-matches-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar Home.',
      },
      { status: 500 }
    )
  }
}
