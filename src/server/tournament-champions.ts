import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTeamIdentity } from '@/server/team-identity'
import { TOURNAMENT_CHAMPION_SEEDS } from '@/server/tournament-champion-seeds'

export type TournamentChampion = {
  season: string
  championName: string
  runnerUpName: string
  finalScore: string
  venue?: string | null
  championLogo?: string | null
  runnerUpLogo?: string | null
  championTeamId?: string | null
  runnerUpTeamId?: string | null
  championTeamExternalId?: string | null
  runnerUpTeamExternalId?: string | null
}

type TournamentChampionRow = {
  season: string | number | null
  champion_name: string | null
  runner_up_name: string | null
  final_score: string | null
  venue: string | null
  champion_team_id?: string | number | null
  runner_up_team_id?: string | number | null
  champion_team_external_id?: string | number | null
  runner_up_team_external_id?: string | number | null
}

const TOURNAMENT_CHAMPION_KEYS = new Set([
  'internacional-libertadores',
  'internacional-sudamericana',
  'internacional-champions',
  'internacional-europa-league',
])

function toStringOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function isChampionsHistoryTournamentKey(key: string | null | undefined) {
  return Boolean(key && TOURNAMENT_CHAMPION_KEYS.has(key))
}

function mapStoredChampion(row: TournamentChampionRow): TournamentChampion | null {
  if (!row.season || !row.champion_name || !row.runner_up_name) return null

  return {
    season: String(row.season),
    championName: row.champion_name,
    runnerUpName: row.runner_up_name,
    finalScore: row.final_score ?? '',
    venue: row.venue,
    championTeamId: toStringOrNull(row.champion_team_id),
    runnerUpTeamId: toStringOrNull(row.runner_up_team_id),
    championTeamExternalId: toStringOrNull(row.champion_team_external_id),
    runnerUpTeamExternalId: toStringOrNull(row.runner_up_team_external_id),
  }
}

function getSeededChampions(key: string): TournamentChampion[] {
  return (TOURNAMENT_CHAMPION_SEEDS[key as keyof typeof TOURNAMENT_CHAMPION_SEEDS] ?? [])
    .map((champion) => ({ ...champion }))
}

function isMissingChampionsTable(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('tournament_champions') ||
    message.includes('schema cache')
  )
}

async function enrichChampionLogos(
  key: string,
  champions: TournamentChampion[],
  supabase = getSupabaseAdminClient()
): Promise<TournamentChampion[]> {
  return Promise.all(
    champions.map(async (champion) => {
      const [championTeam, runnerUpTeam] = await Promise.all([
        resolveTeamIdentity(supabase, {
          name: champion.championName,
          externalId: champion.championTeamExternalId,
          teamId: champion.championTeamId,
          context: key,
        }),
        resolveTeamIdentity(supabase, {
          name: champion.runnerUpName,
          externalId: champion.runnerUpTeamExternalId,
          teamId: champion.runnerUpTeamId,
          context: key,
        }),
      ])

      return {
        ...champion,
        championName: championTeam.name || champion.championName,
        runnerUpName: runnerUpTeam.name || champion.runnerUpName,
        championLogo: champion.championLogo ?? championTeam.logoUrl ?? null,
        runnerUpLogo: champion.runnerUpLogo ?? runnerUpTeam.logoUrl ?? null,
        championTeamId: championTeam.id,
        runnerUpTeamId: runnerUpTeam.id,
        championTeamExternalId: championTeam.externalId,
        runnerUpTeamExternalId: runnerUpTeam.externalId,
      }
    })
  )
}

export async function getTournamentChampions(key: string): Promise<TournamentChampion[]> {
  if (!isChampionsHistoryTournamentKey(key)) return []

  const seededChampions = getSeededChampions(key)
  if (!seededChampions.length) return []

  try {
    const supabase = getSupabaseAdminClient()
    let champions = seededChampions
    const championsResponse = await supabase
      .from('tournament_champions')
      .select(
        'season, champion_name, runner_up_name, final_score, venue, champion_team_id, runner_up_team_id, champion_team_external_id, runner_up_team_external_id'
      )
      .eq('competition_key', key)
      .order('season', { ascending: false })

    if (championsResponse.error && !isMissingChampionsTable(championsResponse.error)) {
      throw championsResponse.error
    }

    if (!championsResponse.error) {
      const storedChampions = ((championsResponse.data ?? []) as TournamentChampionRow[])
        .map(mapStoredChampion)
        .filter((champion): champion is TournamentChampion => Boolean(champion))

      if (storedChampions.length) champions = storedChampions
    }

    return enrichChampionLogos(key, champions, supabase)
  } catch (error) {
    console.warn('[tournament-champions] No se pudieron enriquecer logos.', {
      key,
      message: error instanceof Error ? error.message : String(error),
    })

    return seededChampions
  }
}

export { isChampionsHistoryTournamentKey }
