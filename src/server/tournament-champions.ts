import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export type TournamentChampion = {
  season: string
  championName: string
  runnerUpName: string
  finalScore: string
  venue?: string | null
  championLogo?: string | null
  runnerUpLogo?: string | null
}

type TeamLogoRow = {
  id: string
  name: string | null
  logo_url: string | null
}

const TOURNAMENT_CHAMPION_KEYS = new Set([
  'internacional-libertadores',
  'internacional-sudamericana',
  'internacional-champions',
  'internacional-europa-league',
])

const TEAM_NAME_ALIASES: Record<string, string[]> = {
  'atletico mineiro': ['clube atletico mineiro', 'atletico mineiro mg'],
  'athletico paranaense': ['atletico paranaense', 'paranaense', 'ath paranaense'],
  'atletico nacional': ['atletico nacional medellin'],
  'atletico de madrid': ['atletico madrid'],
  'bayern munchen': ['bayern munich', 'fc bayern munchen'],
  'boca juniors': ['boca'],
  'borussia monchengladbach': ['borussia mgladbach'],
  'central cordoba (sde)': ['central cordoba sde', 'central cordoba de santiago'],
  'chelsea': ['chelsea fc'],
  'dnipro': ['dnipro dnipropetrovsk'],
  'eintracht frankfurt': ['eintracht frankfurt am main'],
  'independiente del valle': ['ind del valle'],
  'inter': ['internazionale', 'inter milan'],
  'juventus': ['juventus turin'],
  'lanus': ['lanús'],
  'liga de quito': ['ldu quito', 'liga deportiva universitaria de quito'],
  'manchester city': ['man city'],
  'manchester united': ['man united'],
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
  'velez sarsfield': ['velez', 'vélez sarsfield'],
}

const TOURNAMENT_CHAMPION_SEEDS: Record<string, TournamentChampion[]> = {
  'internacional-libertadores': [
    { season: '2025', championName: 'Flamengo', runnerUpName: 'Palmeiras', finalScore: '1-0', venue: 'Lima, Peru' },
    { season: '2024', championName: 'Botafogo', runnerUpName: 'Atletico Mineiro', finalScore: '3-1', venue: 'Buenos Aires, Argentina' },
    { season: '2023', championName: 'Fluminense', runnerUpName: 'Boca Juniors', finalScore: '2-1', venue: 'Rio de Janeiro, Brasil' },
    { season: '2022', championName: 'Flamengo', runnerUpName: 'Athletico Paranaense', finalScore: '1-0', venue: 'Guayaquil, Ecuador' },
    { season: '2021', championName: 'Palmeiras', runnerUpName: 'Flamengo', finalScore: '2-1', venue: 'Montevideo, Uruguay' },
    { season: '2020', championName: 'Palmeiras', runnerUpName: 'Santos', finalScore: '1-0', venue: 'Rio de Janeiro, Brasil' },
    { season: '2019', championName: 'Flamengo', runnerUpName: 'River Plate', finalScore: '2-1', venue: 'Lima, Peru' },
    { season: '2018', championName: 'River Plate', runnerUpName: 'Boca Juniors', finalScore: '3-1', venue: 'Madrid, Espana' },
    { season: '2017', championName: 'Gremio', runnerUpName: 'Lanus', finalScore: '3-1', venue: null },
    { season: '2016', championName: 'Atletico Nacional', runnerUpName: 'Independiente del Valle', finalScore: '2-1', venue: null },
    { season: '2015', championName: 'River Plate', runnerUpName: 'Tigres', finalScore: '3-0', venue: null },
    { season: '2014', championName: 'San Lorenzo', runnerUpName: 'Nacional', finalScore: '2-1', venue: null },
  ],
  'internacional-sudamericana': [
    { season: '2025', championName: 'Lanus', runnerUpName: 'Atletico Mineiro', finalScore: '1-1 (4-2 pen.)', venue: 'Asuncion, Paraguay' },
    { season: '2024', championName: 'Racing Club', runnerUpName: 'Cruzeiro', finalScore: '3-1', venue: 'Asuncion, Paraguay' },
    { season: '2023', championName: 'Liga de Quito', runnerUpName: 'Fortaleza', finalScore: '1-1 (4-3 pen.)', venue: 'Punta del Este, Uruguay' },
    { season: '2022', championName: 'Independiente del Valle', runnerUpName: 'Sao Paulo', finalScore: '2-0', venue: 'Cordoba, Argentina' },
    { season: '2021', championName: 'Athletico Paranaense', runnerUpName: 'Bragantino', finalScore: '1-0', venue: 'Montevideo, Uruguay' },
    { season: '2020', championName: 'Defensa y Justicia', runnerUpName: 'Lanus', finalScore: '3-0', venue: 'Cordoba, Argentina' },
    { season: '2019', championName: 'Independiente del Valle', runnerUpName: 'Colon', finalScore: '3-1', venue: 'Asuncion, Paraguay' },
    { season: '2018', championName: 'Athletico Paranaense', runnerUpName: 'Junior', finalScore: '1-1 (4-3 pen.)', venue: null },
    { season: '2017', championName: 'Independiente', runnerUpName: 'Flamengo', finalScore: '3-2', venue: null },
    { season: '2016', championName: 'Chapecoense', runnerUpName: 'Atletico Nacional', finalScore: 'Titulo otorgado por CONMEBOL', venue: null },
    { season: '2015', championName: 'Santa Fe', runnerUpName: 'Huracan', finalScore: '0-0 (3-1 pen.)', venue: 'Bogota, Colombia' },
    { season: '2014', championName: 'River Plate', runnerUpName: 'Atletico Nacional', finalScore: '3-1', venue: null },
  ],
  'internacional-champions': [
    { season: '2024/25', championName: 'Paris Saint Germain', runnerUpName: 'Inter', finalScore: '5-0', venue: 'Munich, Alemania' },
    { season: '2023/24', championName: 'Real Madrid', runnerUpName: 'Borussia Dortmund', finalScore: '2-0', venue: 'Londres, Inglaterra' },
    { season: '2022/23', championName: 'Manchester City', runnerUpName: 'Inter', finalScore: '1-0', venue: 'Estambul, Turquia' },
    { season: '2021/22', championName: 'Real Madrid', runnerUpName: 'Liverpool', finalScore: '1-0', venue: 'Saint-Denis, Francia' },
    { season: '2020/21', championName: 'Chelsea', runnerUpName: 'Manchester City', finalScore: '1-0', venue: 'Porto, Portugal' },
    { season: '2019/20', championName: 'Bayern Munchen', runnerUpName: 'Paris Saint Germain', finalScore: '1-0', venue: 'Lisboa, Portugal' },
    { season: '2018/19', championName: 'Liverpool', runnerUpName: 'Tottenham Hotspur', finalScore: '2-0', venue: 'Madrid, Espana' },
    { season: '2017/18', championName: 'Real Madrid', runnerUpName: 'Liverpool', finalScore: '3-1', venue: 'Kiev, Ucrania' },
    { season: '2016/17', championName: 'Real Madrid', runnerUpName: 'Juventus', finalScore: '4-1', venue: 'Cardiff, Gales' },
    { season: '2015/16', championName: 'Real Madrid', runnerUpName: 'Atletico de Madrid', finalScore: '1-1 (5-3 pen.)', venue: 'Milan, Italia' },
    { season: '2014/15', championName: 'Barcelona', runnerUpName: 'Juventus', finalScore: '3-1', venue: 'Berlin, Alemania' },
  ],
  'internacional-europa-league': [
    { season: '2024/25', championName: 'Tottenham Hotspur', runnerUpName: 'Manchester United', finalScore: '1-0', venue: 'Bilbao, Espana' },
    { season: '2023/24', championName: 'Atalanta', runnerUpName: 'Bayer Leverkusen', finalScore: '3-0', venue: 'Dublin, Irlanda' },
    { season: '2022/23', championName: 'Sevilla', runnerUpName: 'Roma', finalScore: '1-1 (4-1 pen.)', venue: 'Budapest, Hungria' },
    { season: '2021/22', championName: 'Eintracht Frankfurt', runnerUpName: 'Rangers', finalScore: '1-1 (5-4 pen.)', venue: 'Sevilla, Espana' },
    { season: '2020/21', championName: 'Villarreal', runnerUpName: 'Manchester United', finalScore: '1-1 (11-10 pen.)', venue: 'Gdansk, Polonia' },
    { season: '2019/20', championName: 'Sevilla', runnerUpName: 'Inter', finalScore: '3-2', venue: 'Colonia, Alemania' },
    { season: '2018/19', championName: 'Chelsea', runnerUpName: 'Arsenal', finalScore: '4-1', venue: 'Baku, Azerbaiyan' },
    { season: '2017/18', championName: 'Atletico de Madrid', runnerUpName: 'Olympique de Marseille', finalScore: '3-0', venue: 'Lyon, Francia' },
    { season: '2016/17', championName: 'Manchester United', runnerUpName: 'Ajax', finalScore: '2-0', venue: 'Estocolmo, Suecia' },
    { season: '2015/16', championName: 'Sevilla', runnerUpName: 'Liverpool', finalScore: '3-1', venue: 'Basilea, Suiza' },
    { season: '2014/15', championName: 'Sevilla', runnerUpName: 'Dnipro', finalScore: '3-2', venue: 'Varsovia, Polonia' },
  ],
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
  const aliasValues = TEAM_NAME_ALIASES[normalized] || []

  return [normalized, ...aliasValues.map(normalizeTeamName)]
}

function enrichChampionLogos(
  champions: TournamentChampion[],
  teamsByName: Map<string, TeamLogoRow>
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

export async function getTournamentChampions(key: string): Promise<TournamentChampion[]> {
  if (!isChampionsHistoryTournamentKey(key)) return []

  const seededChampions = TOURNAMENT_CHAMPION_SEEDS[key] || []
  if (!seededChampions.length) return []

  try {
    const supabase = getSupabaseAdminClient()
    const teamsResponse = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .limit(4000)

    if (teamsResponse.error) throw teamsResponse.error

    const teams = (teamsResponse.data ?? []) as TeamLogoRow[]
    const teamsByName = new Map(
      teams
        .filter((team) => Boolean(team.name))
        .map((team) => [normalizeTeamName(team.name), team] as const)
    )

    return enrichChampionLogos(seededChampions, teamsByName)
  } catch (error) {
    console.warn('[tournament-champions] No se pudieron enriquecer logos.', {
      key,
      message: error instanceof Error ? error.message : String(error),
    })

    return seededChampions
  }
}

export { isChampionsHistoryTournamentKey }
