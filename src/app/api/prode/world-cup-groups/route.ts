import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getFootballPublicReadMode } from '@/server/football-public-read-mode'
import { getWorldCupGroupStandings } from '@/server/prode/world-cup-groups'
import { DEFAULT_PRODE_TOURNAMENT_SLUG } from '@/shared/config/prode-leagues'
import { WORLD_CUP_EXTERNAL_ID } from '@/shared/utils/league-rounds'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LeagueRow = {
  id: string
  name: string | null
  external_id: string | number | null
  season: number | null
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const supabase = getSupabaseAdminClient()
    let league: LeagueRow | null = null

    if (leagueId) {
      const response = await supabase
        .from('leagues')
        .select('id, name, external_id, season')
        .eq('id', leagueId)
        .maybeSingle()

      if (response.error) throw response.error
      league = (response.data ?? null) as LeagueRow | null
    }

    if (!league) {
      const response = await supabase
        .from('leagues')
        .select('id, name, external_id, season')
        .eq('external_id', String(WORLD_CUP_EXTERNAL_ID))
        .eq('season', 2026)
        .maybeSingle()

      if (response.error) throw response.error
      league = (response.data ?? null) as LeagueRow | null
    }

    if (!league || Number(league.external_id) !== WORLD_CUP_EXTERNAL_ID) {
      return jsonNoStore({
        ok: false,
        error: 'La liga seleccionada no corresponde a Copa del Mundo 2026.',
        groups: [],
      }, { status: 404 })
    }

    const readMode = getFootballPublicReadMode('prode')
    const groups = await getWorldCupGroupStandings(league.season ?? 2026, {
      includeOfficialFallback: readMode !== 'cache-only',
    })

    return jsonNoStore({
      ok: true,
      defaultCompetition: DEFAULT_PRODE_TOURNAMENT_SLUG,
      worldCupLeague: {
        id: String(league.id),
        name: league.name,
        externalId: Number(league.external_id),
        season: league.season ?? 2026,
      },
      source: 'competition_page_standings',
      groups,
    })
  } catch (error) {
    console.error('[prode/world-cup-groups] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los grupos de Copa del Mundo 2026.',
        groups: [],
      },
      { status: 500 }
    )
  }
}
