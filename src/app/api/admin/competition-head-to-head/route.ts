import { NextResponse } from 'next/server'

import {
  getCompetitionHeadToHeadPairs,
  syncCompetitionHeadToHeadCache,
} from '@/server/competition-head-to-head'
import {
  COPA_ARGENTINA_EXTERNAL_ID,
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
} from '@/shared/utils/league-rounds'
import { ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID } from '@/shared/utils/competition-filter'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
}

const COMPETITION_EXTERNAL_IDS: Record<string, number> = {
  'argentina-liga-profesional': LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  'liga-profesional': LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  'liga profesional': LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  'argentina-copa-argentina': COPA_ARGENTINA_EXTERNAL_ID,
  'copa-argentina': COPA_ARGENTINA_EXTERNAL_ID,
  'copa argentina': COPA_ARGENTINA_EXTERNAL_ID,
  'argentina-torneo-proyeccion': ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID,
  'torneo-proyeccion': ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID,
  'torneo proyeccion': ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID,
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', JSON_HEADERS['Cache-Control'])

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
  return ['1', 'true', 'yes', 'si'].includes((value ?? '').trim().toLowerCase())
}

function readNumber(value: string | null) {
  if (!value?.trim()) return undefined

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeCompetition(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function resolveLeagueExternalId(searchParams: URLSearchParams) {
  const direct = searchParams.get('leagueExternalId')
  if (direct?.trim()) return direct.trim()

  const competition = normalizeCompetition(searchParams.get('competition'))

  return competition ? COMPETITION_EXTERNAL_IDS[competition] ?? null : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const leagueExternalId = resolveLeagueExternalId(searchParams)

    if (!leagueExternalId) {
      return jsonNoStore(
        {
          ok: false,
          error:
            'leagueExternalId o competition es requerido. Ejemplo: /api/admin/competition-head-to-head?competition=argentina-liga-profesional&season=2026',
        },
        { status: 400 }
      )
    }

    const season = readNumber(searchParams.get('season'))
    const staleAfterHours = readNumber(searchParams.get('staleAfterHours'))
    const options = {
      leagueExternalId,
      season: season ? Math.floor(season) : undefined,
      staleAfterHours,
    }
    const result = readBoolean(searchParams.get('sync'))
      ? await syncCompetitionHeadToHeadCache({
          ...options,
          limit: readNumber(searchParams.get('limit')),
          force: readBoolean(searchParams.get('force')),
        })
      : await getCompetitionHeadToHeadPairs(options)

    return jsonNoStore({
      endpoint: 'competition-head-to-head',
      competition: searchParams.get('competition'),
      ...result,
    })
  } catch (error) {
    console.error('[competition-head-to-head] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar o sincronizar historiales de competencia.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
