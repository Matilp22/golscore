import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'

type DiagnosticError = Error & {
  code?: string
  detail?: string
  details?: string
  hint?: string
}

function sanitizeDiagnostic(value: unknown) {
  if (typeof value !== 'string') return value

  return value
    .replace(/(service_role|anon|apikey|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
}

function getDiagnosticPayload(error: unknown) {
  const diagnosticError = error as DiagnosticError
  const message =
    error instanceof Error ? error.message : 'No se pudieron recalcular puntos.'
  const detail =
    diagnosticError.detail ??
    diagnosticError.details ??
    diagnosticError.hint ??
    getFriendlyDetail(diagnosticError.code)

  return {
    ok: false,
    error: sanitizeDiagnostic(message),
    detail: sanitizeDiagnostic(detail ?? 'Error inesperado en recalculate-points.'),
    code: diagnosticError.code ?? null,
  }
}

function getFriendlyDetail(code: string | undefined) {
  if (code === 'PGRST202') {
    return 'No existe la funcion SQL public.recalculate_prediction_scores(target_match_id). Ejecutar migraciones de Supabase.'
  }

  if (code === '42P01' || code === 'PGRST205') {
    return 'Falta una tabla requerida del prode: predictions, prediction_scores, points o leaderboards.'
  }

  if (code === '42703') {
    return 'Falta una columna requerida para calcular puntos del prode.'
  }

  return null
}

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
    console.error('[recalculate-points] Error completo', error)

    return NextResponse.json(
      getDiagnosticPayload(error),
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
