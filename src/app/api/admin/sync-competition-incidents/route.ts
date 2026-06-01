import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncCompetitionIncidents } from '@/server/match-event-stats'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

function readBoolean(value: string | null) {
  if (value === null) return null
  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function normalizeCompetition(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getCompetitionSearchTerms(competition: string | null) {
  const normalized = normalizeCompetition(competition)

  if (!normalized) return []
  if (normalized.includes('champions')) return ['UEFA Champions League', 'Champions League']
  if (normalized.includes('libertadores')) return ['Copa Libertadores', 'CONMEBOL Libertadores']
  if (normalized.includes('sudamericana')) return ['Copa Sudamericana', 'CONMEBOL Sudamericana']
  if (normalized.includes('europa')) return ['UEFA Europa League', 'Europa League']
  if (normalized.includes('conference')) return ['UEFA Europa Conference League', 'Conference League']

  return [competition ?? normalized]
}

async function resolveLeagueExternalId(input: {
  leagueExternalId: string | null
  competition: string | null
  season: number | undefined
}) {
  if (input.leagueExternalId?.trim()) return input.leagueExternalId.trim()

  const terms = getCompetitionSearchTerms(input.competition)
  if (!terms.length) return null

  const supabase = getSupabaseAdminClient()

  for (const term of terms) {
    let query = supabase
      .from('leagues')
      .select('external_id, name, season')
      .ilike('name', `%${term}%`)
      .not('external_id', 'is', null)
      .order('season', { ascending: false })
      .limit(1)

    if (input.season) query = query.eq('season', input.season)

    const response = await query
    if (response.error) throw response.error

    const league = response.data?.[0] as { external_id?: string | number | null } | undefined
    if (league?.external_id !== null && league?.external_id !== undefined) {
      return String(league.external_id)
    }
  }

  return null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const seasonValue = readNumber(searchParams.get('season'))
    const season = seasonValue ? Math.floor(seasonValue) : undefined
    const leagueExternalId = await resolveLeagueExternalId({
      leagueExternalId: searchParams.get('leagueExternalId'),
      competition: searchParams.get('competition'),
      season,
    })

    if (!leagueExternalId) {
      return jsonNoStore(
        {
          ok: false,
          error: 'leagueExternalId o competition es requerido. Ejemplo: /api/admin/sync-competition-incidents?leagueExternalId=2&season=2025&limit=100',
        },
        { status: 400 }
      )
    }

    const onlyMissingValue = readBoolean(searchParams.get('onlyMissing'))
    const result = await syncCompetitionIncidents({
      leagueExternalId,
      season,
      force: Boolean(readBoolean(searchParams.get('force'))),
      onlyMissing: onlyMissingValue ?? true,
      limit: readNumber(searchParams.get('limit')) ?? undefined,
    })

    return jsonNoStore({
      endpoint: 'sync-competition-incidents',
      competition: searchParams.get('competition'),
      ...result,
    })
  } catch (error) {
    console.error('[sync-competition-incidents] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudieron sincronizar las incidencias de competencia.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
