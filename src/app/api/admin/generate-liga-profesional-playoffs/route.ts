import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateLigaProfesionalPlayoffs } from '@/server/liga-profesional/playoffs'
import { LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID } from '@/shared/utils/league-rounds'

function getAuthorizationError(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no esta configurado.' },
      { status: 401 }
    )
  }

  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  return null
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback
  if (['1', 'true', 'yes', 'si', 'sí'].includes(value.toLowerCase())) return true
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false

  return fallback
}

function parseNumber(value: string | null, fallback: number | null = null) {
  if (value === null || value.trim() === '') return fallback

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : fallback
}

export async function GET(request: Request) {
  const authorizationError = getAuthorizationError(request)

  if (authorizationError) return authorizationError

  try {
    const url = new URL(request.url)
    const leagueExternalId =
      parseNumber(url.searchParams.get('leagueExternalId'), LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) ??
      LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
    const season = parseNumber(url.searchParams.get('season'), null)
    const dryRun = parseBoolean(url.searchParams.get('dryRun'), true)
    const result = await generateLigaProfesionalPlayoffs(getSupabaseAdminClient(), {
      leagueExternalId,
      season,
      dryRun,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
