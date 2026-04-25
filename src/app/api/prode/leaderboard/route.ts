import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type LeaderboardDbError = {
  message: string
  code?: string
  details?: string
  detail?: string
  hint?: string
}

function isMissingLeaderboardSource(error: LeaderboardDbError | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function sanitizeDiagnostic(value: unknown) {
  if (typeof value !== 'string') return value

  return value
    .replace(/(service_role|anon|apikey|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
}

function getFriendlyDetail(error: LeaderboardDbError | null) {
  if (!error) return 'Error inesperado al consultar la tabla de posiciones.'

  if (isMissingLeaderboardSource(error)) {
    return 'No existe la tabla leaderboards ni la tabla legacy leaderboard.'
  }

  if (error.code === '42703') {
    return 'Falta una columna requerida en leaderboards: points o exact_hits.'
  }

  return error.details ?? error.detail ?? error.hint ?? 'Supabase rechazo la consulta de leaderboard.'
}

async function fetchLeaderboardFrom(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  table: 'leaderboards' | 'leaderboard'
) {
  return supabase
    .from(table)
    .select('*')
    .order('points', { ascending: false })
    .order('exact_hits', { ascending: false })
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Supabase no esta configurado.',
          detail: 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
          code: 'SUPABASE_CONFIG_MISSING',
          leaderboard: [],
        },
        { status: 500 }
      )
    }

    const primary = await fetchLeaderboardFrom(supabase, 'leaderboards')
    const fallback = primary.error && isMissingLeaderboardSource(primary.error)
      ? await fetchLeaderboardFrom(supabase, 'leaderboard')
      : null

    const data = fallback?.data ?? primary.data
    const error = fallback?.error ?? primary.error

    if (error) {
      console.error('[prode/leaderboard] Error de Supabase', error)

      if (isMissingLeaderboardSource(error)) {
        return NextResponse.json({
          ok: true,
          leaderboard: [],
          meta: { emptyReason: 'leaderboard_source_missing' },
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error: sanitizeDiagnostic(error.message),
          detail: sanitizeDiagnostic(getFriendlyDetail(error)),
          code: error.code ?? null,
          leaderboard: [],
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, leaderboard: data ?? [] })
  } catch (error) {
    console.error('[prode/leaderboard] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: sanitizeDiagnostic(
          error instanceof Error ? error.message : 'No se pudo cargar el leaderboard.'
        ),
        detail: 'Error inesperado en /api/prode/leaderboard.',
        code: null,
        leaderboard: [],
      },
      { status: 500 }
    )
  }
}
