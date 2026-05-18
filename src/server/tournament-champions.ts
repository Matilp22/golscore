import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllTeamLogoRows, type TeamLogoLookupRow } from '@/server/team-logo-lookup'
import { TOURNAMENT_CHAMPION_SEEDS } from '@/server/tournament-champion-seeds'

export type TournamentChampion = {
  season: string
  championName: string
  runnerUpName: string
  finalScore: string
  venue?: string | null
  championLogo?: string | null
  runnerUpLogo?: string | null
}

type TournamentChampionRow = {
  season: string | number | null
  champion_name: string | null
  runner_up_name: string | null
  final_score: string | null
  venue: string | null
}

const TOURNAMENT_CHAMPION_KEYS = new Set([
  'internacional-libertadores',
  'internacional-sudamericana',
  'internacional-champions',
  'internacional-europa-league',
])

const TEAM_NAME_ALIASES: Record<string, string[]> = {
  'argentinos juniors': ['argentinos jrs'],
  'atletico mineiro': ['atletico mg', 'clube atletico mineiro', 'atletico mineiro mg'],
  'athletico paranaense': ['atletico paranaense', 'paranaense', 'ath paranaense'],
  'atletico nacional': ['atletico nacional medellin'],
  'atletico de madrid': ['atletico madrid'],
  'barcelona sc': ['barcelona guayaquil'],
  'bayern munchen': ['bayern munich', 'fc bayern munchen'],
  'bolivar': ['club bolivar'],
  'boca juniors': ['boca'],
  'borussia monchengladbach': ['borussia mgladbach'],
  'central cordoba (sde)': ['central cordoba sde', 'central cordoba de santiago'],
  'chelsea': ['chelsea fc'],
  'dnipro': ['dnipro dnipropetrovsk'],
  'eintracht frankfurt': ['eintracht frankfurt am main'],
  'estudiantes': ['estudiantes l p', 'estudiantes la plata'],
  'independiente del valle': ['ind del valle'],
  'inter': ['internazionale', 'inter milan'],
  'juventus': ['juventus turin'],
  'lanus': ['lanús'],
  'liga de quito': ['ldu de quito', 'ldu quito', 'liga deportiva universitaria de quito'],
  'red bull bragantino': ['bragantino'],
  'manchester city': ['man city'],
  'manchester united': ['man united'],
  'nacional': ['club nacional'],
  "newell's old boys": ['newells old boys'],
  'olympique de marseille': ['marseille'],
  'paris saint germain': ['psg', 'paris sg'],
  'porto': ['fc porto', 'oporto'],
  'real madrid': ['real madrid cf'],
  'racing club': ['racing'],
  'rosario central': ['ca rosario central'],
  'river plate': ['river'],
  'sao paulo': ['são paulo', 'sao paulo fc'],
  'sevilla': ['sevilla fc'],
  'tottenham hotspur': ['tottenham'],
  'uanl': ['tigres', 'tigres uanl'],
  'unam': ['pumas unam', 'pumas'],
  'velez sarsfield': ['velez', 'vélez sarsfield'],
}

function normalizeTeamName(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isChampionsHistoryTournamentKey(key: string | null | undefined) {
  return Boolean(key && TOURNAMENT_CHAMPION_KEYS.has(key))
}

function buildTeamLookupKeys(name: string) {
  const normalized = normalizeTeamName(name)
  const aliasValues =
    TEAM_NAME_ALIASES[normalized] ||
    Object.entries(TEAM_NAME_ALIASES).find(
      ([aliasName]) => normalizeTeamName(aliasName) === normalized
    )?.[1] ||
    []

  return [normalized, ...aliasValues.map(normalizeTeamName)]
}

function enrichChampionLogos(
  champions: TournamentChampion[],
  teamsByName: Map<string, TeamLogoLookupRow>
) {
  return champions.map((champion) => {
    const championTeam = buildTeamLookupKeys(champion.championName)
      .map((key) => teamsByName.get(key))
      .find(Boolean)
    const runnerUpTeam = buildTeamLookupKeys(champion.runnerUpName)
      .map((key) => teamsByName.get(key))
      .find(Boolean)

    return {
      ...champion,
      championLogo: champion.championLogo ?? championTeam?.logo_url ?? null,
      runnerUpLogo: champion.runnerUpLogo ?? runnerUpTeam?.logo_url ?? null,
    }
  })
}

function mapStoredChampion(row: TournamentChampionRow): TournamentChampion | null {
  if (!row.season || !row.champion_name || !row.runner_up_name) return null

  return {
    season: String(row.season),
    championName: row.champion_name,
    runnerUpName: row.runner_up_name,
    finalScore: row.final_score ?? '',
    venue: row.venue,
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

export async function getTournamentChampions(key: string): Promise<TournamentChampion[]> {
  if (!isChampionsHistoryTournamentKey(key)) return []

  const seededChampions = getSeededChampions(key)
  if (!seededChampions.length) return []

  try {
    const supabase = getSupabaseAdminClient()
    let champions = seededChampions
    const championsResponse = await supabase
      .from('tournament_champions')
      .select('season, champion_name, runner_up_name, final_score, venue')
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

    const teams = await fetchAllTeamLogoRows(supabase)
    const teamsByName = new Map(
      teams
        .filter((team) => Boolean(team.name))
        .map((team) => [normalizeTeamName(team.name), team] as const)
    )

    return enrichChampionLogos(champions, teamsByName)
  } catch (error) {
    console.warn('[tournament-champions] No se pudieron enriquecer logos.', {
      key,
      message: error instanceof Error ? error.message : String(error),
    })

    return seededChampions
  }
}

export { isChampionsHistoryTournamentKey }
