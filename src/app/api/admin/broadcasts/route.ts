import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getUpcomingMatchesWithoutBroadcasts,
  upsertLeagueBroadcasts,
  upsertMatchBroadcast,
} from '@/server/broadcasts/admin'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function getBuenosAiresTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysToISO(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + amount)

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumberOrString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return readString(value)
}

function readBoolean(value: unknown) {
  return value === true || value === 'true' || value === '1'
}

function readLimit(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function readJsonBody(request: Request) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const today = getBuenosAiresTodayISO()
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('from') || today
    const dateTo = searchParams.get('dateTo') || searchParams.get('to') || addDaysToISO(today, 14)
    const includeWithBroadcasts = readBoolean(searchParams.get('includeWithBroadcasts'))
    const limit = readLimit(searchParams.get('limit'))
    const supabase = getSupabaseAdminClient()
    const result = await getUpcomingMatchesWithoutBroadcasts(supabase, {
      dateFrom,
      dateTo,
      includeWithBroadcasts,
      limit,
    })

    return NextResponse.json({
      ok: true,
      date_from: dateFrom,
      date_to: dateTo,
      table_exists: result.tableExists,
      count: result.matches.length,
      matches: result.matches,
      message: result.tableExists
        ? null
        : 'La tabla match_broadcasts no existe o no esta en el schema cache. Ejecuta la migracion antes de cargar TV.',
    })
  } catch (error) {
    console.error('[broadcasts-admin] Error listando partidos sin TV', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron listar broadcasters.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await readJsonBody(request)
    const mode = readString(body.mode) || 'match'
    const broadcasterName =
      readString(body.broadcaster_name) ||
      readString(body.broadcasterName)
    const broadcasterLogoUrl =
      readString(body.broadcaster_logo_url) ||
      readString(body.broadcasterLogoUrl)
    const country = readString(body.country)

    if (!broadcasterName) {
      return NextResponse.json(
        { ok: false, error: 'broadcaster_name es obligatorio' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    if (mode === 'league') {
      const today = getBuenosAiresTodayISO()
      const dateFrom = readString(body.date_from) || readString(body.dateFrom) || today
      const dateTo = readString(body.date_to) || readString(body.dateTo) || addDaysToISO(today, 14)
      const result = await upsertLeagueBroadcasts(supabase, {
        leagueId: readNumberOrString(body.league_id) ?? readNumberOrString(body.leagueId),
        leagueExternalId:
          readNumberOrString(body.league_external_id) ??
          readNumberOrString(body.leagueExternalId),
        dateFrom,
        dateTo,
        broadcasterName,
        broadcasterLogoUrl,
        country,
      })

      return NextResponse.json({
        ok: true,
        mode,
        count: result.count,
        broadcasts: result.broadcasts,
      })
    }

    const broadcast = await upsertMatchBroadcast(supabase, {
      matchId: readNumberOrString(body.match_id) ?? readNumberOrString(body.matchId),
      externalId: readNumberOrString(body.external_id) ?? readNumberOrString(body.externalId),
      broadcasterName,
      broadcasterLogoUrl,
      country,
    })

    return NextResponse.json({
      ok: true,
      mode: 'match',
      broadcast,
    })
  } catch (error) {
    console.error('[broadcasts-admin] Error cargando TV', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar la TV.',
      },
      { status: 500 }
    )
  }
}
