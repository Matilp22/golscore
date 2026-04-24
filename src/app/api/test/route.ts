import { NextResponse } from 'next/server'
import { getFootballApiConfig } from '@/server/config/env'

export async function GET() {
  let config: ReturnType<typeof getFootballApiConfig>

  try {
    config = getFootballApiConfig()
  } catch {
    return NextResponse.json({
      ok: false,
      error: 'Falta FOOTBALL_API_KEY en el entorno.',
    })
  }

  const url = new URL(`${config.baseUrl}/fixtures`)
  url.searchParams.set('date', '2026-03-28')
  url.searchParams.set('timezone', 'America/Argentina/Buenos_Aires')

  const res = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': config.apiKey,
    },
    cache: 'no-store',
  })

  const data = await res.json()

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    results: data?.results ?? null,
    errors: data?.errors ?? null,
    responseLength: Array.isArray(data?.response) ? data.response.length : 0,
    sample: Array.isArray(data?.response) ? data.response.slice(0, 3) : [],
  })
}
