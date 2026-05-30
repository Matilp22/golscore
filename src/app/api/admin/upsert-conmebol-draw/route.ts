import { NextResponse } from 'next/server'

import {
  parseConmebolCompetition,
  upsertConmebolDraw,
  type UpsertConmebolDrawInput,
} from '@/server/conmebol-bracket'

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

  return Boolean(cronSecret && getAuthorizationToken(request) === cronSecret)
}

function readSeason(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function parseBody(body: unknown): UpsertConmebolDrawInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Body invalido.')
  }

  const raw = body as Record<string, unknown>
  const competition = parseConmebolCompetition(
    typeof raw.competition === 'string' ? raw.competition : null
  )
  const season = readSeason(raw.season)

  if (!competition) throw new Error('competition debe ser libertadores o sudamericana.')
  if (!season) throw new Error('season es obligatorio.')
  if (typeof raw.phase !== 'string' || !raw.phase.trim()) {
    throw new Error('phase es obligatorio.')
  }
  if (!Array.isArray(raw.series)) {
    throw new Error('series debe ser un array.')
  }

  return {
    competition,
    season,
    phase: raw.phase,
    source: typeof raw.source === 'string' && raw.source.trim()
      ? raw.source.trim()
      : 'manual_official_draw',
    series: raw.series.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`series[${index}] invalida.`)
      }

      const row = item as Record<string, unknown>
      const slot = Number(row.slot)

      if (!Number.isFinite(slot) || slot <= 0) {
        throw new Error(`series[${index}].slot debe ser positivo.`)
      }

      return {
        slot,
        teamAExternalId:
          typeof row.teamAExternalId === 'string' || typeof row.teamAExternalId === 'number'
            ? row.teamAExternalId
            : null,
        teamBExternalId:
          typeof row.teamBExternalId === 'string' || typeof row.teamBExternalId === 'number'
            ? row.teamBExternalId
            : null,
        teamAName:
          typeof row.teamAName === 'string' && row.teamAName.trim()
            ? row.teamAName.trim()
            : null,
        teamBName:
          typeof row.teamBName === 'string' && row.teamBName.trim()
            ? row.teamBName.trim()
            : null,
        leg1Date: typeof row.leg1Date === 'string' ? row.leg1Date : null,
        leg2Date: typeof row.leg2Date === 'string' ? row.leg2Date : null,
      }
    }),
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const result = await upsertConmebolDraw(parseBody(body))

    return jsonNoStore(result)
  } catch (error) {
    console.error('[upsert-conmebol-draw] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo guardar el sorteo Conmebol.',
      },
      { status: 400 }
    )
  }
}
