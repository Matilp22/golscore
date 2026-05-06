import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  fillMissingAssetUrlsFromStaticSource,
  upsertLeagueAssets,
  upsertPlayerAssets,
  upsertTeamAssets,
} from '@/server/assets/image-assets'
import {
  getMatchDetail,
  getPlayerDetail,
  getTeamDetail,
} from '@/lib/api-football'

type AssetScope = 'teams' | 'players' | 'leagues' | 'all'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function parseScope(value: string | null): AssetScope {
  if (value === 'teams' || value === 'players' || value === 'leagues' || value === 'all') {
    return value
  }

  return 'all'
}

async function readOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const fromBody = (key: string) => body?.[key]
  const teamExternalId =
    searchParams.get('teamExternalId') ??
    fromBody('teamExternalId') ??
    searchParams.get('teamId') ??
    fromBody('teamId') ??
    null

  return {
    scope: parseScope(searchParams.get('scope') ?? fromBody('scope') ?? null),
    leagueExternalId: searchParams.get('leagueExternalId') ?? fromBody('leagueExternalId') ?? null,
    teamId: teamExternalId,
    teamExternalId,
    playerId: searchParams.get('playerId') ?? fromBody('playerId') ?? null,
    matchId: searchParams.get('matchId') ?? fromBody('matchId') ?? null,
    season: Number(searchParams.get('season') ?? fromBody('season')) || null,
    limit: Number(searchParams.get('limit') ?? fromBody('limit')) || 500,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const options = await readOptions(request)
    const supabase = getSupabaseAdminClient()
    const results: unknown[] = []

    if (options.matchId) {
      const detail = await getMatchDetail(Number(options.matchId))
      results.push({
        mode: 'match-detail',
        matchId: options.matchId,
        teams: detail.fixture ? 2 : 0,
        lineups: detail.lineups.length,
        players: detail.lineups.reduce(
          (total, lineup) =>
            total + (lineup.startXI?.length ?? 0) + (lineup.substitutes?.length ?? 0),
          0
        ),
      })
    }

    if (options.teamId) {
      const detail = await getTeamDetail(Number(options.teamId))
      results.push({
        mode: 'team-detail',
        teamId: options.teamId,
        players: detail.squad?.players?.length ?? 0,
      })
    }

    if (options.playerId) {
      if (options.season) {
        await getPlayerDetail(
          Number(options.playerId),
          options.season,
          Number(options.leagueExternalId) || undefined
        )
      } else {
        await upsertPlayerAssets(supabase, [{ externalId: options.playerId }])
      }

      results.push({
        mode: 'player',
        playerId: options.playerId,
        source: options.season ? 'api-football' : 'static-url',
      })
    }

    if (options.leagueExternalId) {
      results.push(
        await upsertLeagueAssets(supabase, [{ externalId: options.leagueExternalId }])
      )
    }

    if (options.teamId) {
      results.push(await upsertTeamAssets(supabase, [{ externalId: options.teamId }]))
    }

    if (options.scope === 'all' || options.scope === 'teams') {
      results.push(
        await fillMissingAssetUrlsFromStaticSource(supabase, 'teams', options.limit, {
          leagueExternalId: options.leagueExternalId,
          teamId: options.teamId,
        })
      )
    }

    if (options.scope === 'all' || options.scope === 'leagues') {
      results.push(
        await fillMissingAssetUrlsFromStaticSource(supabase, 'leagues', options.limit, {
          leagueExternalId: options.leagueExternalId,
        })
      )
    }

    if (options.scope === 'all' || options.scope === 'players') {
      results.push(
        await fillMissingAssetUrlsFromStaticSource(supabase, 'players', options.limit, {
          teamId: options.teamId,
          playerId: options.playerId,
        })
      )
    }

    return NextResponse.json(
      {
        ok: true,
        options,
        results,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron sincronizar assets.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
