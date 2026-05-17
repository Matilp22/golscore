import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getFootballApiConfig } from '@/server/config/env'
import {
  auditUefaKnockoutRound,
  getUefaKnockoutRoundLabel,
  type UefaKnockoutPhaseKey,
} from '@/shared/utils/uefa-rounds'

type LeagueRow = {
  id: string
  name: string | null
  country: string | null
  external_id: string | number | null
  season: number | null
}

type MatchRow = {
  id: string | number
  round: string | null
  status?: string | null
  match_date?: string | null
}

type ApiFixtureItem = {
  fixture?: {
    id?: number
    date?: string
    status?: {
      short?: string
    }
  }
  league?: {
    round?: string
  }
}

const UEFA_AUDITED_LEAGUES = [
  { externalId: 2, fallbackName: 'UEFA Champions League' },
  { externalId: 3, fallbackName: 'UEFA Europa League' },
] as const

function getAuthorizationError(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no esta configurado.' },
      { status: 401 }
    )
  }

  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  return null
}

function serializeRoundAudit(matches: MatchRow[]) {
  const roundMap = new Map<
    string,
    {
      round: string
      count: number
      firstMatchDate: string | null
      lastMatchDate: string | null
      statuses: Set<string>
    }
  >()

  for (const match of matches) {
    const round = match.round?.trim() || 'Sin fase'
    const current = roundMap.get(round) ?? {
      round,
      count: 0,
      firstMatchDate: null,
      lastMatchDate: null,
      statuses: new Set<string>(),
    }

    current.count += 1

    if (match.status) current.statuses.add(match.status)

    if (match.match_date) {
      if (!current.firstMatchDate || match.match_date < current.firstMatchDate) {
        current.firstMatchDate = match.match_date
      }

      if (!current.lastMatchDate || match.match_date > current.lastMatchDate) {
        current.lastMatchDate = match.match_date
      }
    }

    roundMap.set(round, current)
  }

  return [...roundMap.values()]
    .map((entry) => {
      const audit = auditUefaKnockoutRound(entry.round)

      return {
        round: entry.round,
        count: entry.count,
        firstMatchDate: entry.firstMatchDate,
        lastMatchDate: entry.lastMatchDate,
        statuses: [...entry.statuses].sort(),
        normalized: audit.normalized,
        normalizedLabel: audit.normalized ? getUefaKnockoutRoundLabel(audit.normalized) : null,
        includedInBracket: audit.includedInBracket,
        reason: audit.reason,
      }
    })
    .sort((a, b) => {
      if (a.firstMatchDate && b.firstMatchDate) {
        return a.firstMatchDate.localeCompare(b.firstMatchDate)
      }

      return a.round.localeCompare(b.round, 'es-AR', { numeric: true })
    })
}

async function fetchApiFootballRoundAudit(leagueExternalId: number, season: number | null) {
  const targetSeason = season ?? new Date().getFullYear()
  const { apiKey, baseUrl } = getFootballApiConfig()
  const url = new URL(`${baseUrl}/fixtures`)

  url.searchParams.set('league', String(leagueExternalId))
  url.searchParams.set('season', String(targetSeason))
  url.searchParams.set('timezone', 'America/Argentina/Buenos_Aires')

  console.info('[api-football-call]', {
    source: 'admin:uefa-rounds-audit',
    endpoint: '/fixtures',
    params: Object.fromEntries(url.searchParams.entries()),
  })

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'x-apisports-key': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`API-Football respondio ${response.status} para league ${leagueExternalId}.`)
  }

  const payload = (await response.json()) as { response?: ApiFixtureItem[]; results?: number }
  const matches: MatchRow[] = (payload.response ?? []).map((fixture) => ({
    id: fixture.fixture?.id ?? crypto.randomUUID(),
    round: fixture.league?.round ?? null,
    status: fixture.fixture?.status?.short ?? null,
    match_date: fixture.fixture?.date ?? null,
  }))

  return {
    totalMatches: payload.results ?? matches.length,
    rounds: serializeRoundAudit(matches),
  }
}

async function fetchSupabaseRoundAudit(league: LeagueRow | null) {
  if (!league) {
    return {
      totalMatches: 0,
      rounds: [],
    }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('matches')
    .select('id, round, status, match_date')
    .eq('league_id', league.id)
    .order('match_date', { ascending: true })

  if (error) throw error

  return {
    totalMatches: data?.length ?? 0,
    rounds: serializeRoundAudit((data ?? []) as MatchRow[]),
  }
}

function buildCoverageNote(
  supabaseMatchCount: number,
  apiMatchCount: number
) {
  if (!apiMatchCount) return null
  if (supabaseMatchCount >= apiMatchCount) return null

  return `Supabase tiene ${supabaseMatchCount} de ${apiMatchCount} partidos auditados para esta liga/temporada.`
}

export async function GET(request: Request) {
  const authorizationError = getAuthorizationError(request)

  if (authorizationError) return authorizationError

  try {
    const supabase = getSupabaseAdminClient()
    const { data: leagueRows, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, country, external_id, season')
      .in(
        'external_id',
        UEFA_AUDITED_LEAGUES.map((entry) => entry.externalId)
      )
      .order('season', { ascending: false })

    if (leaguesError) {
      return NextResponse.json(
        { ok: false, error: leaguesError.message, code: leaguesError.code ?? null },
        { status: 500 }
      )
    }

    const latestLeagueByExternalId = new Map<number, LeagueRow>()

    for (const row of (leagueRows ?? []) as LeagueRow[]) {
      const externalId = Number(row.external_id)
      if (!Number.isFinite(externalId) || latestLeagueByExternalId.has(externalId)) continue

      latestLeagueByExternalId.set(externalId, row)
    }

    const competitions = await Promise.all(
      UEFA_AUDITED_LEAGUES.map(async ({ externalId, fallbackName }) => {
        const league = latestLeagueByExternalId.get(externalId) ?? null

        const [supabaseAudit, apiAudit] = await Promise.allSettled([
          fetchSupabaseRoundAudit(league),
          fetchApiFootballRoundAudit(externalId, league?.season ?? null),
        ])

        const supabaseResult =
          supabaseAudit.status === 'fulfilled'
            ? supabaseAudit.value
            : {
                totalMatches: 0,
                rounds: [],
                error: supabaseAudit.reason instanceof Error
                  ? supabaseAudit.reason.message
                  : String(supabaseAudit.reason),
              }

        const apiResult =
          apiAudit.status === 'fulfilled'
            ? apiAudit.value
            : {
                totalMatches: 0,
                rounds: [],
                error: apiAudit.reason instanceof Error
                  ? apiAudit.reason.message
                  : String(apiAudit.reason),
              }

        const includedRounds = apiResult.rounds
          .filter((round) => round.includedInBracket)
          .map((round) => ({
            round: round.round,
            normalized: round.normalized as UefaKnockoutPhaseKey,
            label: round.normalized ? getUefaKnockoutRoundLabel(round.normalized) : null,
          }))

        return {
          leagueName: league?.name ?? fallbackName,
          leagueExternalId: externalId,
          season: league?.season ?? null,
          supabaseLeagueId: league?.id ?? null,
          supabase: {
            totalMatches: supabaseResult.totalMatches,
            rounds: supabaseResult.rounds,
            error: 'error' in supabaseResult ? supabaseResult.error : null,
          },
          apiFootball: {
            totalMatches: apiResult.totalMatches,
            rounds: apiResult.rounds,
            error: 'error' in apiResult ? apiResult.error : null,
          },
          includedBracketRounds: includedRounds,
          excludedApiRounds: apiResult.rounds
            .filter((round) => !round.includedInBracket)
            .map((round) => ({
              round: round.round,
              reason: round.reason,
            })),
          coverageNote: buildCoverageNote(
            supabaseResult.totalMatches,
            apiResult.totalMatches
          ),
        }
      })
    )

    return NextResponse.json({
      ok: true,
      auditedAt: new Date().toISOString(),
      competitions,
    })
  } catch (error) {
    console.error('[uefa-rounds-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar los rounds UEFA.',
      },
      { status: 500 }
    )
  }
}
