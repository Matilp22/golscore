import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  fillMissingAssetUrlsFromStaticSource,
  summarizeAssetSyncReports,
  syncLeagueAssetsFromApiFootball,
  syncPlayerAssetsFromApiFootball,
  syncTeamAssetsFromApiFootball,
  type VisualAssetScope,
  type VisualAssetSyncReport,
} from '@/server/assets/image-assets'
import { getMatchDetail } from '@/lib/api-football'

type AssetScope = 'teams' | 'players' | 'leagues' | 'all'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
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
    playerExternalId:
      searchParams.get('playerExternalId') ??
      fromBody('playerExternalId') ??
      searchParams.get('playerId') ??
      fromBody('playerId') ??
      null,
    matchId: searchParams.get('matchId') ?? fromBody('matchId') ?? null,
    season: Number(searchParams.get('season') ?? fromBody('season')) || null,
    limit: Number(searchParams.get('limit') ?? fromBody('limit')) || 500,
    force: ['1', 'true', 'yes', 'si', 'sí'].includes(
      String(searchParams.get('force') ?? fromBody('force') ?? 'false').toLowerCase()
    ),
  }
}

function includesScope(scope: AssetScope, candidate: VisualAssetScope) {
  return scope === 'all' || scope === candidate
}

function staticResultToReport(
  scope: VisualAssetScope,
  result: {
    processed: number
    updated: number
  }
): VisualAssetSyncReport {
  return {
    scope,
    checked: result.processed,
    updated: result.updated,
    skipped: Math.max(0, result.processed - result.updated),
    missing: 0,
    errors: [],
    sample: [],
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const options = await readOptions(request)
    const supabase = getSupabaseAdminClient()
    const reports: VisualAssetSyncReport[] = []
    const sideEffects: unknown[] = []

    if (options.matchId) {
      const detail = await getMatchDetail(Number(options.matchId))
      sideEffects.push({
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

    if (includesScope(options.scope, 'leagues')) {
      reports.push(
        await syncLeagueAssetsFromApiFootball(supabase, {
          leagueExternalId: options.leagueExternalId,
          season: options.season,
          limit: options.limit,
          force: options.force,
        })
      )
    }

    if (includesScope(options.scope, 'teams')) {
      reports.push(
        await syncTeamAssetsFromApiFootball(supabase, {
          leagueExternalId: options.leagueExternalId,
          teamExternalId: options.teamExternalId,
          season: options.season,
          limit: options.limit,
          force: options.force,
        })
      )
    }

    if (includesScope(options.scope, 'players')) {
      reports.push(
        await syncPlayerAssetsFromApiFootball(supabase, {
          leagueExternalId: options.leagueExternalId,
          teamExternalId: options.teamExternalId,
          playerExternalId: options.playerExternalId,
          season: options.season,
          limit: options.limit,
        })
      )
    }

    if (options.scope === 'all' || options.scope === 'teams') {
      reports.push(
        staticResultToReport('teams', await fillMissingAssetUrlsFromStaticSource(supabase, 'teams', options.limit, {
          leagueExternalId: options.leagueExternalId,
          teamId: options.teamId,
          force: options.force,
        }))
      )
    }

    if (options.scope === 'all' || options.scope === 'leagues') {
      reports.push(
        staticResultToReport('leagues', await fillMissingAssetUrlsFromStaticSource(supabase, 'leagues', options.limit, {
          leagueExternalId: options.leagueExternalId,
          force: options.force,
        }))
      )
    }

    if (options.scope === 'all' || options.scope === 'players') {
      reports.push(
        staticResultToReport('players', await fillMissingAssetUrlsFromStaticSource(supabase, 'players', options.limit, {
          teamId: options.teamId,
          playerId: options.playerId,
          force: options.force,
        }))
      )
    }
    const summary = summarizeAssetSyncReports(options.scope, reports)

    return NextResponse.json(
      {
        ok: true,
        ...summary,
        options,
        details: reports,
        sideEffects,
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
