import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncProdeFixtureById } from '@/server/prode/sync-matches'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[sync-match] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[sync-match] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[sync-match] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

async function getFixtureId(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const fixture = searchParams.get('fixture') ?? body?.fixture ?? body?.fixtureId ?? null
  const fixtureId = fixture ? Number(fixture) : null

  if (!fixtureId || !Number.isFinite(fixtureId)) {
    throw new Error('fixture requerido e invalido. Usar /api/admin/sync-match?fixture=1492046')
  }

  return fixtureId
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const fixtureId = await getFixtureId(request)
    const debug = new URL(request.url).searchParams.get('debug') === 'true'
    const supabase = getSupabaseAdminClient()
    const result = await syncProdeFixtureById(supabase, fixtureId, { debug })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[sync-match] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar el fixture.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
