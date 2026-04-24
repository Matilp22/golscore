import { NextResponse } from 'next/server'
import { getFootballApiConfig } from '@/server/config/env'
import { requestFootballApi } from '@/server/integrations/football-api-client'

type FixtureSample = {
  fixture?: {
    id?: number
    date?: string
    status?: {
      short?: string
    }
  }
  league?: {
    id?: number
    name?: string
    season?: number
    round?: string
  }
  teams?: {
    home?: {
      id?: number
      name?: string
    }
    away?: {
      id?: number
      name?: string
    }
  }
}

export async function GET() {
  try {
    const config = getFootballApiConfig()
    const { status, payload } = await requestFootballApi<FixtureSample[]>(
      '/fixtures',
      {
        league: 128,
        season: 2026,
        timezone: 'America/Argentina/Buenos_Aires',
      },
      { logContext: 'test-football-api' }
    )

    const response = Array.isArray(payload.response) ? payload.response : []

    return NextResponse.json({
      ok: true,
      status,
      keyConfigured: Boolean(config.apiKey),
      baseUrl: config.baseUrl,
      errors: payload.errors ?? {},
      results: payload.results ?? response.length,
      sample: response.slice(0, 3).map((item) => ({
        fixtureId: item.fixture?.id ?? null,
        date: item.fixture?.date ?? null,
        status: item.fixture?.status?.short ?? null,
        leagueId: item.league?.id ?? null,
        league: item.league?.name ?? null,
        season: item.league?.season ?? null,
        round: item.league?.round ?? null,
        home: item.teams?.home?.name ?? null,
        away: item.teams?.away?.name ?? null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        keyConfigured: Boolean(process.env.FOOTBALL_API_KEY),
        baseUrl:
          process.env.FOOTBALL_API_BASE_URL?.trim().replace(/\/+$/, '') ??
          'https://v3.football.api-sports.io',
        error: error instanceof Error ? error.message : 'No se pudo probar API-Football.',
      },
      { status: 500 }
    )
  }
}
