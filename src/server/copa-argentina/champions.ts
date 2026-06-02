import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTeamIdentity } from '@/server/team-identity'

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

export const COPA_ARGENTINA_CHAMPIONS_SEED: CopaArgentinaChampion[] = [
  {
    season: 2025,
    championName: 'Independiente Rivadavia',
    runnerUpName: 'Argentinos Juniors',
    finalScore: '2-2 (5-3 pen.)',
    venue: 'Estadio Monumental Presidente Perón, Córdoba',
  },
  {
    season: 2024,
    championName: 'Central Córdoba (SdE)',
    runnerUpName: 'Vélez Sarsfield',
    finalScore: '1-0',
    venue: 'Estadio 15 de Abril, Santa Fe',
  },
  {
    season: 2023,
    championName: 'Estudiantes (LP)',
    runnerUpName: 'Defensa y Justicia',
    finalScore: '1-0',
    venue: 'Estadio Ciudad de Lanús',
  },
  {
    season: 2022,
    championName: 'Patronato',
    runnerUpName: 'Talleres de Córdoba',
    finalScore: '1-0',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2021,
    championName: 'Boca Juniors',
    runnerUpName: 'Talleres de Córdoba',
    finalScore: '0-0 (5-4 pen.)',
    venue: 'Estadio Madre de Ciudades, Santiago del Estero',
  },
  {
    season: 2019,
    championName: 'River Plate',
    runnerUpName: 'Central Córdoba (SdE)',
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
    runnerUpName: 'Atlético Tucumán',
    finalScore: '2-1',
    venue: 'Estadio Malvinas Argentinas, Mendoza',
  },
  {
    season: 2016,
    championName: 'River Plate',
    runnerUpName: 'Rosario Central',
    finalScore: '4-3',
    venue: 'Estadio Mario Alberto Kempes, Córdoba',
  },
  {
    season: 2015,
    championName: 'Boca Juniors',
    runnerUpName: 'Rosario Central',
    finalScore: '2-0',
    venue: 'Estadio Mario Alberto Kempes, Córdoba',
  },
  {
    season: 2014,
    championName: 'Huracán',
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

async function toChampion(row: ChampionRow) {
  const supabase = getSupabaseAdminClient()
  const [championTeam, runnerUpTeam] = await Promise.all([
    resolveTeamIdentity(supabase, {
      name: row.champion_name,
      context: 'argentina-copa-argentina',
      leagueExternalId: 130,
    }),
    resolveTeamIdentity(supabase, {
      name: row.runner_up_name,
      context: 'argentina-copa-argentina',
      leagueExternalId: 130,
    }),
  ])

  return {
    season: row.season,
    championName: championTeam.name || row.champion_name,
    runnerUpName: runnerUpTeam.name || row.runner_up_name,
    finalScore: row.final_score,
    venue: row.venue,
    championLogo: championTeam.logoUrl ?? null,
    runnerUpLogo: runnerUpTeam.logoUrl ?? null,
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

    return Promise.all(rows.map(toChampion))
  } catch (error) {
    console.warn('[copa-argentina:champions] No se pudieron leer campeones desde Supabase.', {
      message: error instanceof Error ? error.message : String(error),
    })

    return Promise.all(
      COPA_ARGENTINA_CHAMPIONS_SEED.map((champion) =>
        toChampion({
          season: champion.season,
          champion_team_id: null,
          runner_up_team_id: null,
          champion_name: champion.championName,
          runner_up_name: champion.runnerUpName,
          final_score: champion.finalScore,
          venue: champion.venue ?? null,
        })
      )
    ).catch(() => COPA_ARGENTINA_CHAMPIONS_SEED)
  }
}
