import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  hasCountryMojibake,
  hasCountryTranslation,
  normalizeCountryName,
  translateCountryNameToSpanish,
} from '@/shared/utils/country-names'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
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

async function fetchDistinctCountries(table: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from(table)
    .select('country')
    .not('country', 'is', null)

  if (error) {
    return { rows: [], error }
  }

  const countries = [...new Set((data ?? []).map((row) => String(row.country)).filter(Boolean))]
  return { rows: countries, error: null }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401, headers: JSON_HEADERS })
  }

  const warnings: string[] = []
  const sources = [
    { table: 'leagues', values: [] as string[] },
    { table: 'teams', values: [] as string[] },
  ]

  try {
    for (const source of sources) {
      const result = await fetchDistinctCountries(source.table)
      if (result.error) {
        warnings.push(`${source.table}: ${result.error.message}`)
      } else {
        source.values = result.rows
      }
    }

    const allCountries = [...new Set(sources.flatMap((source) => source.values))]
    const countries = allCountries.map((country) => ({
      raw: country,
      normalized: normalizeCountryName(country),
      display: translateCountryNameToSpanish(country),
      hasTranslation: hasCountryTranslation(country),
      hasMojibake: hasCountryMojibake(country),
    }))
    const untranslated = countries.filter((country) => !country.hasTranslation)
    const mojibake = countries.filter((country) => country.hasMojibake)

    return NextResponse.json(
      {
        ok: true,
        totals: {
          checked: countries.length,
          untranslated: untranslated.length,
          mojibake: mojibake.length,
        },
        sources,
        untranslated,
        mojibake,
        warnings,
      },
      { headers: JSON_HEADERS }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        warnings,
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

