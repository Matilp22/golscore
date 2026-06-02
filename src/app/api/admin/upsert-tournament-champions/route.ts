import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTeamIdentity } from '@/server/team-identity'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type ChampionPayload = {
  season: string
  championName: string
  runnerUpName: string
  finalScore?: string | null
  venue?: string | null
  source?: string | null
  verified?: boolean | null
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
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

function normalizeChampionsPayload(value: unknown): ChampionPayload[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((row): row is ChampionPayload => {
      const candidate = row as Partial<ChampionPayload>
      return Boolean(candidate.season && candidate.championName && candidate.runnerUpName)
    })
    .map((row) => ({
      ...row,
      season: String(row.season),
      championName: String(row.championName),
      runnerUpName: String(row.runnerUpName),
    }))
}

function normalizeCompetitionKey(value: string) {
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, string> = {
    champions_league: 'internacional-champions',
    uefa_champions_league: 'internacional-champions',
    copa_argentina: 'argentina-copa-argentina',
    libertadores: 'internacional-libertadores',
    sudamericana: 'internacional-sudamericana',
    europa_league: 'internacional-europa-league',
  }

  return aliases[normalized] ?? value.trim()
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const competition = normalizeCompetitionKey(String(body?.competition ?? ''))
    const champions = normalizeChampionsPayload(body?.champions)

    if (!competition || !champions.length) {
      return jsonNoStore(
        { ok: false, error: 'Payload invalido: competition y champions son obligatorios.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const rows = await Promise.all(
      champions.map(async (champion) => {
        const [championTeam, runnerUpTeam] = await Promise.all([
          resolveTeamIdentity(supabase, {
            name: champion.championName,
            context: competition,
          }),
          resolveTeamIdentity(supabase, {
            name: champion.runnerUpName,
            context: competition,
          }),
        ])

        return {
          competition_key: competition,
          season: champion.season,
          champion_name: championTeam.name || champion.championName,
          runner_up_name: runnerUpTeam.name || champion.runnerUpName,
          final_score: champion.finalScore ?? null,
          champion_team_id: championTeam.id,
          runner_up_team_id: runnerUpTeam.id,
          champion_team_external_id: championTeam.externalId,
          runner_up_team_external_id: runnerUpTeam.externalId,
          venue: champion.venue ?? null,
          source: champion.source || body?.source || 'manual_verified',
          verified: champion.verified ?? body?.verified ?? true,
        }
      })
    )

    const unresolvedTeams = rows.flatMap((row) => {
      const unresolved: string[] = []
      if (!row.champion_team_id && !row.champion_team_external_id) unresolved.push(row.champion_name)
      if (!row.runner_up_team_id && !row.runner_up_team_external_id) unresolved.push(row.runner_up_name)
      return unresolved
    })

    if (unresolvedTeams.length) {
      return jsonNoStore(
        {
          ok: false,
          unresolvedTeams,
          error: 'No se resolvieron todos los equipos. No se guardaron cambios.',
        },
        { status: 422 }
      )
    }

    if (competition === 'argentina-copa-argentina') {
      const copaRows = rows.map((row) => ({
        season: Number(row.season),
        champion_name: row.champion_name,
        runner_up_name: row.runner_up_name,
        final_score: row.final_score ?? '',
        champion_team_id: row.champion_team_id,
        runner_up_team_id: row.runner_up_team_id,
        venue: row.venue,
      }))

      if (copaRows.some((row) => !Number.isFinite(row.season))) {
        return jsonNoStore(
          { ok: false, error: 'Para Copa Argentina, season debe ser numerico.' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('copa_argentina_champions')
        .upsert(copaRows, { onConflict: 'season' })
        .select('season, champion_name, runner_up_name')

      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('schema cache')) {
          return jsonNoStore(
            {
              ok: false,
              migrationNeeded: true,
              error: 'La tabla copa_argentina_champions no existe todavia.',
            },
            { status: 409 }
          )
        }

        throw error
      }

      return jsonNoStore({
        ok: true,
        endpoint: 'upsert-tournament-champions',
        competition,
        table: 'copa_argentina_champions',
        upserted: data?.length ?? copaRows.length,
        sample: data?.slice(0, 5) ?? [],
      })
    }

    const { data, error } = await supabase
      .from('tournament_champions')
      .upsert(rows, { onConflict: 'competition_key,season' })
      .select('competition_key, season, champion_name, runner_up_name')

    if (error) {
      const message = error.message?.toLowerCase() ?? ''
      if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('schema cache')) {
        return jsonNoStore(
          {
            ok: false,
            migrationNeeded: true,
            error: 'La tabla tournament_champions no existe todavia. Aplicar la migracion antes del upsert remoto.',
          },
          { status: 409 }
        )
      }

      throw error
    }

    return jsonNoStore({
      ok: true,
      endpoint: 'upsert-tournament-champions',
      competition,
      upserted: data?.length ?? rows.length,
      sample: data?.slice(0, 5) ?? [],
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo guardar historial de campeones.',
      },
      { status: 500 }
    )
  }
}
