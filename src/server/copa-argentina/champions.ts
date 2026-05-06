import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizeCopaArgentinaTeamName } from '@/shared/utils/copa-argentina'

export type CopaArgentinaChampion = {
  season: number
  championName: string
  runnerUpName: string
  finalScore: string
  venue?: string | null
  championLogo?: string | null
  runnerUpLogo?: string | null
}

type ChampionRow = {
  season: number
  champion_team_id: string | null
  runner_up_team_id: string | null
  champion_name: string
  runner_up_name: string
  final_score: string
  venue: string | null
}

type TeamLogoRow = {
  id: string
  name: string | null
  logo_url: string | null
}

export const COPA_ARGENTINA_CHAMPIONS_SEED: CopaArgentinaChampion[] = [
  {
    season: 2025,
    championName: 'Independiente Rivadavia',
    runnerUpName: 'Argentinos Juniors',
    finalScore: '2-2 (5-3 pen.)',
    venue: 'Estadio Monumental Presidente Peron, Cordoba',
  },
  {
    season: 2024,
    championName: 'Central Cordoba (SdE)',
    runnerUpName: 'Velez Sarsfield',
    finalScore: '1-0',
    venue: 'Estadio 15 de Abril, Santa Fe',
  },
  {
    season: 2023,
    championName: 'Estudiantes (LP)',
    runnerUpName: 'Defensa y Justicia',
    finalScore: '1-0',
    venue: 'Estadio Ciudad de Lanus',
  },
  {
    season: 2022,
    championName: 'Patronato',
    runnerUpName: 'Talleres de Cordoba',
    finalScore: '1-0',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2021,
    championName: 'Boca Juniors',
    runnerUpName: 'Talleres de Cordoba',
    finalScore: '0-0 (5-4 pen.)',
    venue: 'Estadio Madre de Ciudades, Santiago del Estero',
  },
  {
    season: 2019,
    championName: 'River Plate',
    runnerUpName: 'Central Cordoba (SdE)',
    finalScore: '3-0',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2018,
    championName: 'Rosario Central',
    runnerUpName: 'Gimnasia (LP)',
    finalScore: '1-1 (4-1 pen.)',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2017,
    championName: 'River Plate',
    runnerUpName: 'Atletico Tucuman',
    finalScore: '2-1',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2016,
    championName: 'River Plate',
    runnerUpName: 'Rosario Central',
    finalScore: '4-3',
    venue: 'Estadio Mario Alberto Kempes, Cordoba',
  },
  {
    season: 2015,
    championName: 'Boca Juniors',
    runnerUpName: 'Rosario Central',
    finalScore: '2-0',
    venue: 'Estadio Mario Alberto Kempes, Cordoba',
  },
  {
    season: 2014,
    championName: 'Huracan',
    runnerUpName: 'Rosario Central',
    finalScore: '0-0 (5-4 pen.)',
    venue: 'Estadio San Juan del Bicentenario',
  },
  {
    season: 2013,
    championName: 'Arsenal',
    runnerUpName: 'San Lorenzo',
    finalScore: '3-0',
    venue: 'Estadio Bicentenario Ciudad de Catamarca',
  },
  {
    season: 2012,
    championName: 'Boca Juniors',
    runnerUpName: 'Racing Club',
    finalScore: '2-1',
    venue: 'Estadio San Juan del Bicentenario',
  },
  {
    season: 1969,
    championName: 'Boca Juniors',
    runnerUpName: 'Atlanta',
    finalScore: '3-1 / 0-1',
    venue: null,
  },
]

function toChampion(row: ChampionRow, teamsById: Map<string, TeamLogoRow>, teamsByName: Map<string, TeamLogoRow>) {
  const championTeam =
    (row.champion_team_id ? teamsById.get(String(row.champion_team_id)) : null) ??
    teamsByName.get(normalizeCopaArgentinaTeamName(row.champion_name))
  const runnerUpTeam =
    (row.runner_up_team_id ? teamsById.get(String(row.runner_up_team_id)) : null) ??
    teamsByName.get(normalizeCopaArgentinaTeamName(row.runner_up_name))

  return {
    season: row.season,
    championName: row.champion_name,
    runnerUpName: row.runner_up_name,
    finalScore: row.final_score,
    venue: row.venue,
    championLogo: championTeam?.logo_url ?? null,
    runnerUpLogo: runnerUpTeam?.logo_url ?? null,
  }
}

export async function getCopaArgentinaChampions(): Promise<CopaArgentinaChampion[]> {
  try {
    const supabase = getSupabaseAdminClient()
    const championsResponse = await supabase
      .from('copa_argentina_champions')
      .select('season, champion_team_id, runner_up_team_id, champion_name, runner_up_name, final_score, venue')
      .order('season', { ascending: false })

    if (championsResponse.error) throw championsResponse.error

    const rows = (championsResponse.data ?? []) as ChampionRow[]
    if (!rows.length) return COPA_ARGENTINA_CHAMPIONS_SEED

    const teamIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.champion_team_id, row.runner_up_team_id])
          .filter((id): id is string => Boolean(id))
          .map(String)
      ),
    ]

    const teamsResponse = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .limit(3000)

    if (teamsResponse.error) throw teamsResponse.error

    const teams = (teamsResponse.data ?? []) as TeamLogoRow[]
    const teamsById = new Map(teams.map((team) => [String(team.id), team]))
    const teamsByName = new Map(
      teams
        .filter((team) => Boolean(team.name))
        .map((team) => [normalizeCopaArgentinaTeamName(team.name ?? ''), team])
    )

    for (const teamId of teamIds) {
      if (!teamsById.has(teamId)) {
        teamsById.set(teamId, { id: teamId, name: null, logo_url: null })
      }
    }

    return rows.map((row) => toChampion(row, teamsById, teamsByName))
  } catch (error) {
    console.warn('[copa-argentina:champions] No se pudieron leer campeones desde Supabase.', {
      message: error instanceof Error ? error.message : String(error),
    })

    return COPA_ARGENTINA_CHAMPIONS_SEED
  }
}
