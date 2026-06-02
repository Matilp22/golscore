import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  buildWorldCupTeamGroupIndex,
  getWorldCupGroupStandings,
  inferWorldCupGroupsFromFixtures,
  resolveWorldCupMatchGroup,
} from '@/server/prode/world-cup-groups'
import {
  DEFAULT_PRODE_TOURNAMENT_SLUG,
  getAllowedProdeLeagueLabel,
  getAllowedTournamentByExternalId,
} from '@/shared/config/prode-leagues'
import { WORLD_CUP_EXTERNAL_ID } from '@/shared/utils/league-rounds'
import {
  getWorldCupGroupLabel,
  sortWorldCupGroupKeys,
} from '@/shared/utils/world-cup-groups'

type DbId = string | number

type LeagueRow = {
  id: string
  name: string | null
  external_id: string | number | null
  season: number | null
  logo_url?: string | null
}

type MatchRow = {
  id: DbId
  round: string | number | null
  match_date: string | null
  status: string | null
  home_team_id: string | null
  away_team_id: string | null
}

type TeamRow = {
  id: string
  name: string | null
  external_id: string | number | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const warnings: string[] = []
    const defaultTournament = getAllowedTournamentByExternalId(WORLD_CUP_EXTERNAL_ID)
    const leagueResponse = await supabase
      .from('leagues')
      .select('id, name, external_id, season, logo_url')
      .eq('external_id', String(WORLD_CUP_EXTERNAL_ID))
      .eq('season', 2026)
      .maybeSingle()

    if (leagueResponse.error) throw leagueResponse.error

    const league = (leagueResponse.data ?? null) as LeagueRow | null

    if (!league) {
      warnings.push('No se encontro la liga Copa del Mundo 2026 en Supabase.')
    }

    const standings = await getWorldCupGroupStandings(league?.season ?? 2026, {
      includeOfficialFallback: true,
    })
    const teamGroupIndex = buildWorldCupTeamGroupIndex(standings)
    const standingsByGroup = Object.fromEntries(
      standings.map((group) => [
        group.group,
        {
          label: group.label,
          teams: group.rows.length,
        },
      ])
    )

    if (!standings.length) {
      warnings.push('No hay standings cacheados para Copa del Mundo 2026.')
    }

    const matchesResponse = league
      ? await supabase
          .from('matches')
          .select('id, round, match_date, status, home_team_id, away_team_id')
          .eq('league_id', league.id)
          .order('match_date', { ascending: true, nullsFirst: false })
      : { data: [], error: null }

    if (matchesResponse.error) throw matchesResponse.error

    const matches = (matchesResponse.data ?? []) as MatchRow[]
    const teamIds = [
      ...new Set(
        matches
          .flatMap((match) => [match.home_team_id, match.away_team_id])
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const teamsResponse = teamIds.length
      ? await supabase
          .from('teams')
          .select('id, name, external_id')
          .in('id', teamIds)
      : { data: [], error: null }

    if (teamsResponse.error) throw teamsResponse.error

    const teamsById = new Map(
      ((teamsResponse.data ?? []) as TeamRow[]).map((team) => [String(team.id), team])
    )
    const inferredGroups =
      !teamGroupIndex.size && league
        ? inferWorldCupGroupsFromFixtures(
            matches.map((match) => {
              const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
              const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) : null

              return {
                round: match.round,
                leagueExternalId: WORLD_CUP_EXTERNAL_ID,
                homeTeam: homeTeam
                  ? {
                      externalId: homeTeam.external_id,
                      name: homeTeam.name,
                    }
                  : null,
                awayTeam: awayTeam
                  ? {
                      externalId: awayTeam.external_id,
                      name: awayTeam.name,
                    }
                  : null,
              }
            })
          )
        : null
    const effectiveTeamGroupIndex = teamGroupIndex.size
      ? teamGroupIndex
      : inferredGroups?.teamGroupIndex ?? new Map()

    if (inferredGroups?.warnings.length) {
      warnings.push(...inferredGroups.warnings)
    }

    const matchesByGroupMap = new Map<string, number>()
    const unassignedMatches: Array<{
      id: string
      round: string | number | null
      homeTeam: string | null
      awayTeam: string | null
    }> = []

    for (const match of matches) {
      const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
      const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) : null
      const group = resolveWorldCupMatchGroup(
        {
          round: match.round,
          leagueExternalId: WORLD_CUP_EXTERNAL_ID,
          homeTeam: homeTeam
            ? { externalId: homeTeam.external_id, name: homeTeam.name }
            : null,
          awayTeam: awayTeam
            ? { externalId: awayTeam.external_id, name: awayTeam.name }
            : null,
        },
        effectiveTeamGroupIndex
      )

      if (group) {
        increment(matchesByGroupMap, group)
      } else {
        unassignedMatches.push({
          id: String(match.id),
          round: match.round,
          homeTeam: homeTeam?.name ?? null,
          awayTeam: awayTeam?.name ?? null,
        })
      }
    }

    const groupKeys = sortWorldCupGroupKeys([
      ...new Set([
        ...standings.map((group) => group.group),
        ...(inferredGroups?.groups.map((group) => group.group) ?? []),
        ...matchesByGroupMap.keys(),
      ]),
    ])
    const matchesByGroup = Object.fromEntries(
      groupKeys.map((group) => [group, matchesByGroupMap.get(group) ?? 0])
    )
    const selectedDefaultGroup =
      groupKeys.find((group) => (matchesByGroupMap.get(group) ?? 0) > 0) ??
      groupKeys[0] ??
      null

    if (matches.length && unassignedMatches.length === matches.length) {
      warnings.push('Los partidos del Mundial no tienen grupo detectable desde standings/cache.')
    } else if (unassignedMatches.length) {
      warnings.push(`${unassignedMatches.length} partidos no tienen grupo detectable.`)
    }

    if (DEFAULT_PRODE_TOURNAMENT_SLUG !== 'mundial-2026') {
      warnings.push('El default del Prode no apunta a Copa del Mundo 2026.')
    }

    return NextResponse.json({
      ok: Boolean(league) && DEFAULT_PRODE_TOURNAMENT_SLUG === 'mundial-2026',
      defaultCompetition: {
        slug: DEFAULT_PRODE_TOURNAMENT_SLUG,
        displayName: defaultTournament?.name ?? null,
      },
      worldCupLeague: league
        ? {
            id: String(league.id),
            name: getAllowedProdeLeagueLabel(league.name),
            storedName: league.name,
            externalId: Number(league.external_id),
            season: league.season,
            logoUrl: league.logo_url ?? null,
          }
        : null,
      groupsAvailable: groupKeys.map((group) => ({
        group,
        label: getWorldCupGroupLabel(group),
      })),
      selectedDefaultGroup,
      matchesByGroup,
      standingsByGroup,
      groupSource: standings.length
        ? 'competition_page_standings'
        : inferredGroups?.groups.length
          ? 'fixtures_inferred'
          : 'none',
      prodeMatchesByGroup: matchesByGroup,
      allGroupsDefault: false,
      unassignedMatches: unassignedMatches.slice(0, 25),
      warnings,
    })
  } catch (error) {
    console.error('[prode-world-cup-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar el Prode de Copa del Mundo 2026.',
      },
      { status: 500 }
    )
  }
}
