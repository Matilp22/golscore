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
  goals?: {
    home?: number | null
    away?: number | null
  }
  score?: {
    fulltime?: {
      home?: number | null
      away?: number | null
    }
  }
}

export async function GET(request: Request) {
  try {
    const config = getFootballApiConfig()
    const { searchParams } = new URL(request.url)
    const fixture = searchParams.get('fixture')
    const fixtureId = fixture ? Number(fixture) : null

    if (fixture && (!fixtureId || !Number.isFinite(fixtureId))) {
      return NextResponse.json(
        { ok: false, error: 'fixture invalido.' },
        { status: 400 }
      )
    }

    const { status, payload } = await requestFootballApi<FixtureSample[]>(
      '/fixtures',
      fixtureId
        ? {
            id: fixtureId,
            timezone: 'America/Argentina/Buenos_Aires',
          }
        : {
            league: 128,
            season: 2026,
            timezone: 'America/Argentina/Buenos_Aires',
          },
      { logContext: fixtureId ? `test-football-api:fixture:${fixtureId}` : 'test-football-api' }
    )

    const response = Array.isArray(payload.response) ? payload.response : []
    const fixtureResponse = fixtureId ? response[0] ?? null : null

    if (fixtureId) {
      return NextResponse.json({
        ok: true,
        status,
        keyConfigured: Boolean(config.apiKey),
        baseUrl: config.baseUrl,
        errors: payload.errors ?? {},
        results: payload.results ?? response.length,
        fixture: fixtureResponse
          ? {
              fixture: {
                id: fixtureResponse.fixture?.id ?? null,
                status: {
                  short: fixtureResponse.fixture?.status?.short ?? null,
                },
              },
              goals: {
                home: fixtureResponse.goals?.home ?? null,
                away: fixtureResponse.goals?.away ?? null,
              },
              score: {
                fulltime: {
                  home: fixtureResponse.score?.fulltime?.home ?? null,
                  away: fixtureResponse.score?.fulltime?.away ?? null,
                },
              },
            }
          : null,
      })
    }

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
