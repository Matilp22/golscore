import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[recalculate-points] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[recalculate-points] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[recalculate-points] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

async function getMatchId(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const matchId = searchParams.get('matchId') ?? body?.matchId ?? null

  if (matchId === null || matchId === undefined || matchId === '') return null

  const numericMatchId = Number(matchId)

  if (!Number.isFinite(numericMatchId)) {
    throw new Error('matchId invalido.')
  }

  return numericMatchId
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const matchId = await getMatchId(request)
    const supabase = getSupabaseAdminClient()
    const result = await recalculateProdePoints(supabase, matchId)

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron recalcular puntos.',
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
