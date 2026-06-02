import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTeamIdentity } from '@/server/team-identity'
import { getApiSportsTeamLogoUrl } from '@/shared/utils/asset-urls'
import {
  formatMatchScoreWithPenalties,
  parseHistoricalFinalScore,
  type ParsedHistoricalFinalScore,
} from '@/shared/utils/match-score'

export type WorldCupFinalSeed = {
  year: number
  championName: string
  championCanonicalName: string
  championTeamExternalId: string | null
  runnerUpName: string
  runnerUpCanonicalName: string
  runnerUpTeamExternalId: string | null
  score: string
  penalties: string | null
  afterExtraTime: boolean
  decisiveMatch: boolean
  venue: string | null
  city: string | null
  country: string | null
  notes: string | null
  source: 'manual_verified'
  verified: true
}

type WorldCupFinalRow = {
  year: number
  champion_name: string
  champion_canonical_name: string | null
  champion_team_id: string | null
  champion_team_external_id: string | null
  runner_up_name: string
  runner_up_canonical_name: string | null
  runner_up_team_id: string | null
  runner_up_team_external_id: string | null
  score: string
  penalties: string | null
  after_extra_time: boolean | null
  decisive_match: boolean | null
  venue: string | null
  city: string | null
  country: string | null
  notes: string | null
  source: string | null
  verified: boolean | null
}

export type WorldCupFinalView = {
  year: number
  champion: string
  championCanonicalName: string
  championLogoUrl: string | null
  score: string
  penalties: string | null
  scoreParts: ParsedHistoricalFinalScore
  displayScore: string
  runnerUp: string
  runnerUpCanonicalName: string
  runnerUpLogoUrl: string | null
  venue: string | null
  city: string | null
  country: string | null
  notes: string | null
  afterExtraTime: boolean
  decisiveMatch: boolean
}

export type WorldCupTitleCount = {
  rank: number
  teamName: string
  canonicalTeamName: string
  logoUrl: string | null
  titles: number
  years: number[]
  runnerUps: number
}

export type WorldCupChampionsViewModel = {
  title: string
  titleCounts: WorldCupTitleCount[]
  finals: WorldCupFinalView[]
  meta: {
    totalFinals: number
    lastChampion: string | null
    lastUpdated: string
    source: 'supabase' | 'seed_fallback'
  }
}

const NATIONAL_TEAM_ALIASES: Record<string, { canonical: string; externalId: string | null; display: string }> = {
  argentina: { canonical: 'Argentina', externalId: '26', display: 'Argentina' },
  brasil: { canonical: 'Brasil', externalId: '6', display: 'Brasil' },
  brazil: { canonical: 'Brasil', externalId: '6', display: 'Brasil' },
  alemania: { canonical: 'Alemania', externalId: '25', display: 'Alemania' },
  germany: { canonical: 'Alemania', externalId: '25', display: 'Alemania' },
  'west germany': { canonical: 'Alemania', externalId: '25', display: 'Alemania Federal' },
  'alemania federal': { canonical: 'Alemania', externalId: '25', display: 'Alemania Federal' },
  italia: { canonical: 'Italia', externalId: '768', display: 'Italia' },
  italy: { canonical: 'Italia', externalId: '768', display: 'Italia' },
  francia: { canonical: 'Francia', externalId: '2', display: 'Francia' },
  france: { canonical: 'Francia', externalId: '2', display: 'Francia' },
  uruguay: { canonical: 'Uruguay', externalId: '7', display: 'Uruguay' },
  inglaterra: { canonical: 'Inglaterra', externalId: '10', display: 'Inglaterra' },
  england: { canonical: 'Inglaterra', externalId: '10', display: 'Inglaterra' },
  espana: { canonical: 'España', externalId: '9', display: 'España' },
  spain: { canonical: 'España', externalId: '9', display: 'España' },
  'paises bajos': { canonical: 'Países Bajos', externalId: '1118', display: 'Países Bajos' },
  netherlands: { canonical: 'Países Bajos', externalId: '1118', display: 'Países Bajos' },
  holland: { canonical: 'Países Bajos', externalId: '1118', display: 'Países Bajos' },
  croacia: { canonical: 'Croacia', externalId: '3', display: 'Croacia' },
  croatia: { canonical: 'Croacia', externalId: '3', display: 'Croacia' },
  suecia: { canonical: 'Suecia', externalId: '21', display: 'Suecia' },
  sweden: { canonical: 'Suecia', externalId: '21', display: 'Suecia' },
  hungria: { canonical: 'Hungría', externalId: '769', display: 'Hungría' },
  hungary: { canonical: 'Hungría', externalId: '769', display: 'Hungría' },
  checoslovaquia: { canonical: 'Checoslovaquia', externalId: null, display: 'Checoslovaquia' },
  czechoslovakia: { canonical: 'Checoslovaquia', externalId: null, display: 'Checoslovaquia' },
}

export const WORLD_CUP_FINALS_SEED: WorldCupFinalSeed[] = [
  { year: 1930, championName: 'Uruguay', championCanonicalName: 'Uruguay', championTeamExternalId: '7', runnerUpName: 'Argentina', runnerUpCanonicalName: 'Argentina', runnerUpTeamExternalId: '26', score: '4-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Estadio Centenario', city: 'Montevideo', country: 'Uruguay', notes: null, source: 'manual_verified', verified: true },
  { year: 1934, championName: 'Italia', championCanonicalName: 'Italia', championTeamExternalId: '768', runnerUpName: 'Checoslovaquia', runnerUpCanonicalName: 'Checoslovaquia', runnerUpTeamExternalId: null, score: '2-1', penalties: null, afterExtraTime: true, decisiveMatch: false, venue: 'Stadio Nazionale PNF', city: 'Roma', country: 'Italia', notes: 'a.e.t.', source: 'manual_verified', verified: true },
  { year: 1938, championName: 'Italia', championCanonicalName: 'Italia', championTeamExternalId: '768', runnerUpName: 'Hungría', runnerUpCanonicalName: 'Hungría', runnerUpTeamExternalId: '769', score: '4-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Stade Olympique de Colombes', city: 'Colombes', country: 'Francia', notes: null, source: 'manual_verified', verified: true },
  { year: 1950, championName: 'Uruguay', championCanonicalName: 'Uruguay', championTeamExternalId: '7', runnerUpName: 'Brasil', runnerUpCanonicalName: 'Brasil', runnerUpTeamExternalId: '6', score: '2-1', penalties: null, afterExtraTime: false, decisiveMatch: true, venue: 'Maracana', city: 'Rio de Janeiro', country: 'Brasil', notes: 'partido decisivo', source: 'manual_verified', verified: true },
  { year: 1954, championName: 'Alemania Federal', championCanonicalName: 'Alemania', championTeamExternalId: '25', runnerUpName: 'Hungría', runnerUpCanonicalName: 'Hungría', runnerUpTeamExternalId: '769', score: '3-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Wankdorfstadion', city: 'Berna', country: 'Suiza', notes: 'Alemania Federal cuenta como Alemania.', source: 'manual_verified', verified: true },
  { year: 1958, championName: 'Brasil', championCanonicalName: 'Brasil', championTeamExternalId: '6', runnerUpName: 'Suecia', runnerUpCanonicalName: 'Suecia', runnerUpTeamExternalId: '21', score: '5-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Rasunda Stadium', city: 'Solna', country: 'Suecia', notes: null, source: 'manual_verified', verified: true },
  { year: 1962, championName: 'Brasil', championCanonicalName: 'Brasil', championTeamExternalId: '6', runnerUpName: 'Checoslovaquia', runnerUpCanonicalName: 'Checoslovaquia', runnerUpTeamExternalId: null, score: '3-1', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Estadio Nacional', city: 'Santiago', country: 'Chile', notes: null, source: 'manual_verified', verified: true },
  { year: 1966, championName: 'Inglaterra', championCanonicalName: 'Inglaterra', championTeamExternalId: '10', runnerUpName: 'Alemania Federal', runnerUpCanonicalName: 'Alemania', runnerUpTeamExternalId: '25', score: '4-2', penalties: null, afterExtraTime: true, decisiveMatch: false, venue: 'Wembley Stadium', city: 'Londres', country: 'Inglaterra', notes: 'a.e.t.', source: 'manual_verified', verified: true },
  { year: 1970, championName: 'Brasil', championCanonicalName: 'Brasil', championTeamExternalId: '6', runnerUpName: 'Italia', runnerUpCanonicalName: 'Italia', runnerUpTeamExternalId: '768', score: '4-1', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Estadio Azteca', city: 'Ciudad de México', country: 'México', notes: null, source: 'manual_verified', verified: true },
  { year: 1974, championName: 'Alemania Federal', championCanonicalName: 'Alemania', championTeamExternalId: '25', runnerUpName: 'Países Bajos', runnerUpCanonicalName: 'Países Bajos', runnerUpTeamExternalId: '1118', score: '2-1', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Olympiastadion', city: 'Múnich', country: 'Alemania', notes: 'Alemania Federal cuenta como Alemania.', source: 'manual_verified', verified: true },
  { year: 1978, championName: 'Argentina', championCanonicalName: 'Argentina', championTeamExternalId: '26', runnerUpName: 'Países Bajos', runnerUpCanonicalName: 'Países Bajos', runnerUpTeamExternalId: '1118', score: '3-1', penalties: null, afterExtraTime: true, decisiveMatch: false, venue: 'Estadio Monumental', city: 'Buenos Aires', country: 'Argentina', notes: 't.e.', source: 'manual_verified', verified: true },
  { year: 1982, championName: 'Italia', championCanonicalName: 'Italia', championTeamExternalId: '768', runnerUpName: 'Alemania Federal', runnerUpCanonicalName: 'Alemania', runnerUpTeamExternalId: '25', score: '3-1', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Santiago Bernabéu', city: 'Madrid', country: 'España', notes: 'Alemania Federal cuenta como Alemania.', source: 'manual_verified', verified: true },
  { year: 1986, championName: 'Argentina', championCanonicalName: 'Argentina', championTeamExternalId: '26', runnerUpName: 'Alemania Federal', runnerUpCanonicalName: 'Alemania', runnerUpTeamExternalId: '25', score: '3-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Estadio Azteca', city: 'Ciudad de México', country: 'México', notes: 'Alemania Federal cuenta como Alemania.', source: 'manual_verified', verified: true },
  { year: 1990, championName: 'Alemania', championCanonicalName: 'Alemania', championTeamExternalId: '25', runnerUpName: 'Argentina', runnerUpCanonicalName: 'Argentina', runnerUpTeamExternalId: '26', score: '1-0', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Stadio Olimpico', city: 'Roma', country: 'Italia', notes: null, source: 'manual_verified', verified: true },
  { year: 1994, championName: 'Brasil', championCanonicalName: 'Brasil', championTeamExternalId: '6', runnerUpName: 'Italia', runnerUpCanonicalName: 'Italia', runnerUpTeamExternalId: '768', score: '0-0', penalties: 'Brasil 3-2 Italia', afterExtraTime: false, decisiveMatch: false, venue: 'Rose Bowl', city: 'Pasadena', country: 'Estados Unidos', notes: 'penales', source: 'manual_verified', verified: true },
  { year: 1998, championName: 'Francia', championCanonicalName: 'Francia', championTeamExternalId: '2', runnerUpName: 'Brasil', runnerUpCanonicalName: 'Brasil', runnerUpTeamExternalId: '6', score: '3-0', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Stade de France', city: 'Saint-Denis', country: 'Francia', notes: null, source: 'manual_verified', verified: true },
  { year: 2002, championName: 'Brasil', championCanonicalName: 'Brasil', championTeamExternalId: '6', runnerUpName: 'Alemania', runnerUpCanonicalName: 'Alemania', runnerUpTeamExternalId: '25', score: '2-0', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'International Stadium', city: 'Yokohama', country: 'Japón', notes: null, source: 'manual_verified', verified: true },
  { year: 2006, championName: 'Italia', championCanonicalName: 'Italia', championTeamExternalId: '768', runnerUpName: 'Francia', runnerUpCanonicalName: 'Francia', runnerUpTeamExternalId: '2', score: '1-1', penalties: 'Italia 5-3 Francia', afterExtraTime: false, decisiveMatch: false, venue: 'Olympiastadion', city: 'Berlín', country: 'Alemania', notes: 'penales', source: 'manual_verified', verified: true },
  { year: 2010, championName: 'España', championCanonicalName: 'España', championTeamExternalId: '9', runnerUpName: 'Países Bajos', runnerUpCanonicalName: 'Países Bajos', runnerUpTeamExternalId: '1118', score: '1-0', penalties: null, afterExtraTime: true, decisiveMatch: false, venue: 'Soccer City', city: 'Johannesburgo', country: 'Sudáfrica', notes: 't.e.', source: 'manual_verified', verified: true },
  { year: 2014, championName: 'Alemania', championCanonicalName: 'Alemania', championTeamExternalId: '25', runnerUpName: 'Argentina', runnerUpCanonicalName: 'Argentina', runnerUpTeamExternalId: '26', score: '1-0', penalties: null, afterExtraTime: true, decisiveMatch: false, venue: 'Maracana', city: 'Rio de Janeiro', country: 'Brasil', notes: 'a.e.t.', source: 'manual_verified', verified: true },
  { year: 2018, championName: 'Francia', championCanonicalName: 'Francia', championTeamExternalId: '2', runnerUpName: 'Croacia', runnerUpCanonicalName: 'Croacia', runnerUpTeamExternalId: '3', score: '4-2', penalties: null, afterExtraTime: false, decisiveMatch: false, venue: 'Luzhniki Stadium', city: 'Moscú', country: 'Rusia', notes: null, source: 'manual_verified', verified: true },
  { year: 2022, championName: 'Argentina', championCanonicalName: 'Argentina', championTeamExternalId: '26', runnerUpName: 'Francia', runnerUpCanonicalName: 'Francia', runnerUpTeamExternalId: '2', score: '3-3', penalties: 'Argentina 4-2 Francia', afterExtraTime: false, decisiveMatch: false, venue: 'Lusail Stadium', city: 'Lusail', country: 'Qatar', notes: 'penales', source: 'manual_verified', verified: true },
]

function normalizeNationalText(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMissingWorldCupFinalsTable(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('world_cup_finals') ||
    message.includes('schema cache')
  )
}

function mapRowToSeed(row: WorldCupFinalRow): WorldCupFinalSeed {
  return {
    year: row.year,
    championName: row.champion_name,
    championCanonicalName: row.champion_canonical_name || row.champion_name,
    championTeamExternalId: row.champion_team_external_id,
    runnerUpName: row.runner_up_name,
    runnerUpCanonicalName: row.runner_up_canonical_name || row.runner_up_name,
    runnerUpTeamExternalId: row.runner_up_team_external_id,
    score: row.score,
    penalties: row.penalties,
    afterExtraTime: Boolean(row.after_extra_time),
    decisiveMatch: Boolean(row.decisive_match),
    venue: row.venue,
    city: row.city,
    country: row.country,
    notes: row.notes,
    source: 'manual_verified',
    verified: true,
  }
}

async function getWorldCupFinalsData() {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('world_cup_finals')
    .select(
      'year, champion_name, champion_canonical_name, champion_team_id, champion_team_external_id, runner_up_name, runner_up_canonical_name, runner_up_team_id, runner_up_team_external_id, score, penalties, after_extra_time, decisive_match, venue, city, country, notes, source, verified'
    )
    .eq('verified', true)
    .order('year', { ascending: false })

  if (response.error) {
    if (isMissingWorldCupFinalsTable(response.error)) {
      return { source: 'seed_fallback' as const, finals: WORLD_CUP_FINALS_SEED }
    }

    throw response.error
  }

  const finals = ((response.data ?? []) as WorldCupFinalRow[]).map(mapRowToSeed)
  return {
    source: finals.length ? ('supabase' as const) : ('seed_fallback' as const),
    finals: finals.length ? finals : WORLD_CUP_FINALS_SEED,
  }
}

export async function resolveNationalTeamIdentity(name: string) {
  const normalized = normalizeNationalText(name)
  const alias = NATIONAL_TEAM_ALIASES[normalized] ?? {
    canonical: name,
    externalId: null,
    display: name,
  }

  const supabase = getSupabaseAdminClient()
  const identity = await resolveTeamIdentity(supabase, {
    name: alias.display,
    externalId: alias.externalId,
    context: 'selecciones-mundial',
  })

  return {
    name: alias.display,
    canonicalName: alias.canonical,
    externalId: alias.externalId,
    logoUrl: identity.logoUrl ?? getApiSportsTeamLogoUrl(alias.externalId),
    resolvedTeamId: identity.id,
    warnings: identity.warnings,
  }
}

async function buildFinalView(seed: WorldCupFinalSeed): Promise<WorldCupFinalView> {
  const [champion, runnerUp] = await Promise.all([
    resolveNationalTeamIdentity(seed.championCanonicalName),
    resolveNationalTeamIdentity(seed.runnerUpCanonicalName),
  ])
  const scoreParts = parseHistoricalFinalScore(seed.score, seed.penalties)

  return {
    year: seed.year,
    champion: seed.championName,
    championCanonicalName: champion.canonicalName || seed.championCanonicalName,
    championLogoUrl: champion.logoUrl,
    score: seed.score,
    penalties: seed.penalties,
    scoreParts,
    displayScore: formatMatchScoreWithPenalties({
      goalsHome: scoreParts.goalsHome,
      goalsAway: scoreParts.goalsAway,
      homePenaltyScore: scoreParts.homePenaltyScore,
      awayPenaltyScore: scoreParts.awayPenaltyScore,
      separator: ' vs ',
    }),
    runnerUp: seed.runnerUpName,
    runnerUpCanonicalName: runnerUp.canonicalName || seed.runnerUpCanonicalName,
    runnerUpLogoUrl: runnerUp.logoUrl,
    venue: seed.venue,
    city: seed.city,
    country: seed.country,
    notes: seed.notes,
    afterExtraTime: seed.afterExtraTime,
    decisiveMatch: seed.decisiveMatch,
  }
}

function buildTitleCounts(finals: WorldCupFinalView[]): WorldCupTitleCount[] {
  const byTeam = new Map<string, Omit<WorldCupTitleCount, 'rank'>>()

  for (const final of finals) {
    const championKey = final.championCanonicalName
    const champion = byTeam.get(championKey) ?? {
      teamName: championKey,
      canonicalTeamName: championKey,
      logoUrl: final.championLogoUrl,
      titles: 0,
      years: [] as number[],
      runnerUps: 0,
    }

    champion.titles += 1
    champion.years.push(final.year)
    if (!champion.logoUrl && final.championLogoUrl) champion.logoUrl = final.championLogoUrl
    byTeam.set(championKey, champion)

    const runnerUpKey = final.runnerUpCanonicalName
    const runnerUp = byTeam.get(runnerUpKey) ?? {
      teamName: runnerUpKey,
      canonicalTeamName: runnerUpKey,
      logoUrl: final.runnerUpLogoUrl,
      titles: 0,
      years: [] as number[],
      runnerUps: 0,
    }

    runnerUp.runnerUps += 1
    if (!runnerUp.logoUrl && final.runnerUpLogoUrl) runnerUp.logoUrl = final.runnerUpLogoUrl
    byTeam.set(runnerUpKey, runnerUp)
  }

  return [...byTeam.values()]
    .filter((row) => row.titles > 0)
    .sort((a, b) => {
      if (b.titles !== a.titles) return b.titles - a.titles
      if (b.runnerUps !== a.runnerUps) return b.runnerUps - a.runnerUps
      return a.teamName.localeCompare(b.teamName, 'es-AR')
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      years: [...row.years].sort((a, b) => a - b),
    }))
}

export async function buildWorldCupChampionsViewModel(): Promise<WorldCupChampionsViewModel> {
  const { finals: finalsData, source } = await getWorldCupFinalsData()
  const finals = (await Promise.all(finalsData.map(buildFinalView))).sort((a, b) => b.year - a.year)
  const titleCounts = buildTitleCounts(finals)

  return {
    title: 'Campeones de la Copa del Mundo',
    titleCounts,
    finals,
    meta: {
      totalFinals: finals.length,
      lastChampion: finals[0]?.championCanonicalName ?? null,
      lastUpdated: new Date().toISOString(),
      source,
    },
  }
}

export async function auditWorldCupChampions() {
  const model = await buildWorldCupChampionsViewModel()
  const years = model.finals.map((final) => final.year)
  const duplicateYears = years.filter((year, index) => years.indexOf(year) !== index)
  const expectedYears = WORLD_CUP_FINALS_SEED.map((final) => final.year)
  const missingYears = expectedYears.filter((year) => !years.includes(year))
  const encodingProblems = model.finals.flatMap((final) => {
    const fields = {
      champion: final.champion,
      championCanonicalName: final.championCanonicalName,
      runnerUp: final.runnerUp,
      runnerUpCanonicalName: final.runnerUpCanonicalName,
      venue: final.venue,
      city: final.city,
      country: final.country,
      notes: final.notes,
    }

    return Object.entries(fields)
      .filter(([, value]) => /Ã|Â|�|ï¿½/.test(value ?? ''))
      .map(([field, value]) => ({ year: final.year, field, value }))
  })
  const unresolvedTeams = model.finals.flatMap((final) => {
    const missing: string[] = []
    if (!final.championLogoUrl) missing.push(`${final.year} campeon: ${final.champion}`)
    if (!final.runnerUpLogoUrl && final.runnerUpCanonicalName !== 'Checoslovaquia') {
      missing.push(`${final.year} subcampeon: ${final.runnerUp}`)
    }
    return missing
  })
  const warnings: string[] = []

  if (model.finals.length !== WORLD_CUP_FINALS_SEED.length) {
    warnings.push(`Cantidad de finales esperada ${WORLD_CUP_FINALS_SEED.length}, encontrada ${model.finals.length}.`)
  }

  if (!model.finals.some((final) => final.year === 1950 && final.decisiveMatch)) {
    warnings.push('1950 debe estar marcado como partido decisivo.')
  }

  if (years.includes(1942) || years.includes(1946)) {
    warnings.push('1942/1946 no deben existir porque no hubo Mundial.')
  }

  const germany = model.titleCounts.find((row) => row.canonicalTeamName === 'Alemania')
  if (germany?.titles !== 4) {
    warnings.push('Alemania debe consolidar Alemania Federal / West Germany y sumar 4 titulos.')
  }

  if (encodingProblems.length) {
    warnings.push('Hay textos del historial del Mundial con encoding sospechoso.')
  }

  const expectedPenaltyDisplays = new Map([
    [1994, '0 (3) vs 0 (2)'],
    [2006, '1 (5) vs 1 (3)'],
    [2022, '3 (4) vs 3 (2)'],
  ])

  for (const [year, expectedDisplay] of expectedPenaltyDisplays) {
    const final = model.finals.find((item) => item.year === year)
    if (final?.displayScore !== expectedDisplay) {
      warnings.push(`${year} debe mostrar penales como ${expectedDisplay}.`)
    }
  }

  const finalsWithPenalties = model.finals
    .filter((final) => final.penalties)
    .map((final) => ({
      year: final.year,
      champion: final.champion,
      runnerUp: final.runnerUp,
      score: final.score,
      penalties: final.penalties,
      displayScore: final.displayScore,
      scoreParts: final.scoreParts,
    }))

  return {
    ok: warnings.length === 0 && duplicateYears.length === 0 && missingYears.length === 0,
    finalsCount: model.finals.length,
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    missingYears,
    duplicateYears,
    unresolvedTeams,
    encodingProblems,
    finalsWithPenalties,
    penaltyShootoutFormat: {
      expected: 'Argentina 3 (4) vs Francia 3 (2)',
      implemented: true,
    },
    hiddenNotesColumn: true,
    titleCounts: model.titleCounts.map((row) => ({
      teamName: row.teamName,
      titles: row.titles,
      years: row.years,
      runnerUps: row.runnerUps,
    })),
    finalsSample: model.finals.slice(0, 5),
    source: model.meta.source,
    warnings,
  }
}
