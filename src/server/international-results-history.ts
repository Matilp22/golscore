import {
  buildHeadToHeadViewModel,
  createEmptyHeadToHeadViewModel,
  createHeadToHeadCacheKey,
  type HeadToHeadViewModel,
  type HeadToHeadTeam,
} from '@/server/head-to-head'
import type { MatchFixture } from '@/lib/api-football'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'

const INTERNATIONAL_RESULTS_URL =
  'https://raw.githubusercontent.com/martj42/international_results/master/results.csv'
const INTERNATIONAL_RESULTS_SOURCE = {
  name: 'martj42/international_results',
  url: INTERNATIONAL_RESULTS_URL,
  license: 'CC0-1.0',
}

let cachedInternationalResultsHistoryPromise: Promise<InternationalResultRow[]> | null = null

type InternationalResultRow = {
  date: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  tournament: string
  city: string
  country: string
  neutral: boolean
}

type InternationalResultFixture = {
  fixture: {
    id: string
    date: string
    status: {
      short: 'FT'
      long: 'Match Finished'
    }
  }
  league: {
    name: string
    season: number | null
    round: string | null
  }
  teams: {
    home: {
      id: number | null
      name: string
      logo: string | null
    }
    away: {
      id: number | null
      name: string
      logo: string | null
    }
  }
  goals: {
    home: number
    away: number
  }
  score: {
    penalty: {
      home: null
      away: null
    }
  }
  source: typeof INTERNATIONAL_RESULTS_SOURCE
}

type InternationalResultsPayload = {
  response?: unknown
  rawFixtures?: unknown
  sources?: unknown
}

type EnrichedHeadToHeadPayload = InternationalResultsPayload & {
  response: unknown[]
  sources: Array<typeof INTERNATIONAL_RESULTS_SOURCE | unknown>
}

const TEAM_NAME_ALIASES: Record<string, string> = {
  bosnia: 'bosnia and herzegovina',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'bosnia herzogovina': 'bosnia and herzegovina',
  'bosnia & herzegovina': 'bosnia and herzegovina',
  'cape verde islands': 'cape verde',
  'cabo verde': 'cape verde',
  'congo dr': 'dr congo',
  'congo democratic republic': 'dr congo',
  'democratic republic congo': 'dr congo',
  'democratic republic of congo': 'dr congo',
  'cote d ivoire': 'ivory coast',
  'cote divoire': 'ivory coast',
  curacao: 'curacao',
  czechia: 'czech republic',
  'korea republic': 'south korea',
  'republic of ireland': 'ireland',
  'saudi': 'saudi arabia',
  'turkiye': 'turkey',
  'united states': 'usa',
  'united states of america': 'usa',
  'u s a': 'usa',
}

function normalizeTeamKey(value: string | null | undefined) {
  const normalized = (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return TEAM_NAME_ALIASES[normalized] ?? normalized
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      current += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += character
    }
  }

  values.push(current)

  return values
}

function toNumber(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function parseInternationalResultsCsv(csv: string) {
  const [headerLine, ...lines] = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = parseCsvLine(headerLine)
  const indexByHeader = new Map(headers.map((header, index) => [header, index]))

  return lines
    .map((line) => {
      const values = parseCsvLine(line)
      const homeScore = toNumber(values[indexByHeader.get('home_score') ?? -1])
      const awayScore = toNumber(values[indexByHeader.get('away_score') ?? -1])

      if (homeScore === null || awayScore === null) return null

      return {
        date: values[indexByHeader.get('date') ?? -1] ?? '',
        homeTeam: values[indexByHeader.get('home_team') ?? -1] ?? '',
        awayTeam: values[indexByHeader.get('away_team') ?? -1] ?? '',
        homeScore,
        awayScore,
        tournament: values[indexByHeader.get('tournament') ?? -1] ?? 'International',
        city: values[indexByHeader.get('city') ?? -1] ?? '',
        country: values[indexByHeader.get('country') ?? -1] ?? '',
        neutral: String(values[indexByHeader.get('neutral') ?? -1] ?? '').toLowerCase() === 'true',
      }
    })
    .filter((row): row is InternationalResultRow => Boolean(row?.date && row.homeTeam && row.awayTeam))
}

export async function fetchInternationalResultsHistory() {
  const response = await fetch(INTERNATIONAL_RESULTS_URL, {
    cache: 'no-store',
    headers: {
      'user-agent': 'hay-fulbo-history-sync/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`international_results respondio ${response.status}`)
  }

  return parseInternationalResultsCsv(await response.text())
}

export async function fetchCachedInternationalResultsHistory() {
  if (!cachedInternationalResultsHistoryPromise) {
    cachedInternationalResultsHistoryPromise = fetchInternationalResultsHistory().catch((error) => {
      cachedInternationalResultsHistoryPromise = null
      throw error
    })
  }

  return cachedInternationalResultsHistoryPromise
}

function getYearFromDate(date: string) {
  const year = Number(date.slice(0, 4))

  return Number.isFinite(year) ? year : null
}

function getSyntheticFixtureId(row: InternationalResultRow) {
  return [
    'intl-results',
    row.date,
    normalizeTeamKey(row.homeTeam),
    normalizeTeamKey(row.awayTeam),
    row.homeScore,
    row.awayScore,
  ].join(':')
}

function isSamePair(row: InternationalResultRow, teamAKey: string, teamBKey: string) {
  const homeKey = normalizeTeamKey(row.homeTeam)
  const awayKey = normalizeTeamKey(row.awayTeam)

  return (
    (homeKey === teamAKey && awayKey === teamBKey) ||
    (homeKey === teamBKey && awayKey === teamAKey)
  )
}

function mapResultToFixture(
  row: InternationalResultRow,
  homeTeam: HeadToHeadTeam,
  awayTeam: HeadToHeadTeam
): InternationalResultFixture | null {
  const sourceHomeKey = normalizeTeamKey(row.homeTeam)
  const currentHomeKey = normalizeTeamKey(homeTeam.name)
  const currentAwayKey = normalizeTeamKey(awayTeam.name)
  const homeIsCurrentHome = sourceHomeKey === currentHomeKey
  const homeIsCurrentAway = sourceHomeKey === currentAwayKey

  if (!homeIsCurrentHome && !homeIsCurrentAway) return null

  const mappedHomeTeam = homeIsCurrentHome ? homeTeam : awayTeam
  const mappedAwayTeam = homeIsCurrentHome ? awayTeam : homeTeam

  return {
    fixture: {
      id: getSyntheticFixtureId(row),
      date: `${row.date}T00:00:00+00:00`,
      status: {
        short: 'FT',
        long: 'Match Finished',
      },
    },
    league: {
      name: row.tournament || 'International',
      season: getYearFromDate(row.date),
      round: null,
    },
    teams: {
      home: {
        id: mappedHomeTeam.externalId,
        name: mappedHomeTeam.name,
        logo: mappedHomeTeam.logoUrl,
      },
      away: {
        id: mappedAwayTeam.externalId,
        name: mappedAwayTeam.name,
        logo: mappedAwayTeam.logoUrl,
      },
    },
    goals: {
      home: row.homeScore,
      away: row.awayScore,
    },
    score: {
      penalty: {
        home: null,
        away: null,
      },
    },
    source: INTERNATIONAL_RESULTS_SOURCE,
  }
}

function getRawFixturesFromPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as InternationalResultsPayload

  if (Array.isArray(record.response)) return record.response
  if (Array.isArray(record.rawFixtures)) return record.rawFixtures

  return []
}

function getFixtureDateKey(date: string | null | undefined) {
  const value = date?.trim()
  if (!value) return null

  const datePart = value.slice(0, 10)

  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : value
}

function getFixtureTeamKey(input?: { id?: string | number | null; name?: string | null } | null) {
  if (input?.id !== null && input?.id !== undefined && String(input.id).trim()) {
    return `id:${input.id}`
  }

  const nameKey = normalizeTeamKey(input?.name)

  return nameKey ? `name:${nameKey}` : null
}

function getFixtureSemanticDedupeKey(input: unknown) {
  if (!input || typeof input !== 'object') return null

  const fixture = input as {
    fixture?: { date?: string | null } | null
    teams?: {
      home?: { id?: string | number | null; name?: string | null } | null
      away?: { id?: string | number | null; name?: string | null } | null
    } | null
    goals?: { home?: string | number | null; away?: string | number | null } | null
  }
  const date = getFixtureDateKey(fixture.fixture?.date)
  const homeTeam = getFixtureTeamKey(fixture.teams?.home)
  const awayTeam = getFixtureTeamKey(fixture.teams?.away)
  const homeGoals = fixture.goals?.home
  const awayGoals = fixture.goals?.away

  if (
    !date ||
    !homeTeam ||
    !awayTeam ||
    homeGoals === null ||
    homeGoals === undefined ||
    awayGoals === null ||
    awayGoals === undefined
  ) {
    return null
  }

  const [firstTeam, secondTeam] = [homeTeam, awayTeam].sort()
  const firstGoals = firstTeam === homeTeam ? homeGoals : awayGoals
  const secondGoals = firstTeam === homeTeam ? awayGoals : homeGoals

  return [
    'match',
    date,
    firstTeam,
    secondTeam,
    firstGoals,
    secondGoals,
  ].join(':')
}

function getFixtureDedupeKey(input: unknown) {
  if (!input || typeof input !== 'object') return null

  const fixture = input as {
    fixture?: { id?: string | number | null; date?: string | null } | null
    teams?: {
      home?: { id?: string | number | null; name?: string | null } | null
      away?: { id?: string | number | null; name?: string | null } | null
    } | null
    goals?: { home?: string | number | null; away?: string | number | null } | null
  }
  const semanticKey = getFixtureSemanticDedupeKey(input)

  if (semanticKey) return semanticKey

  const fixtureId = fixture.fixture?.id

  if (fixtureId !== null && fixtureId !== undefined && String(fixtureId).trim()) {
    return `id:${fixtureId}`
  }

  return [
    'match',
    fixture.fixture?.date ?? '',
    fixture.teams?.home?.id ?? normalizeTeamKey(fixture.teams?.home?.name),
    fixture.teams?.away?.id ?? normalizeTeamKey(fixture.teams?.away?.name),
    fixture.goals?.home ?? '',
    fixture.goals?.away ?? '',
  ].join(':')
}

export function getInternationalResultsForPair(input: {
  rows: InternationalResultRow[]
  homeTeam: HeadToHeadTeam
  awayTeam: HeadToHeadTeam
}) {
  const homeKey = normalizeTeamKey(input.homeTeam.name)
  const awayKey = normalizeTeamKey(input.awayTeam.name)

  if (!homeKey || !awayKey) return []

  return input.rows
    .filter((row) => isSamePair(row, homeKey, awayKey))
    .map((row) => mapResultToFixture(row, input.homeTeam, input.awayTeam))
    .filter((fixture): fixture is InternationalResultFixture => Boolean(fixture))
}

export function mergeInternationalResultsIntoHeadToHeadPayload(input: {
  payload: unknown
  fixtures: InternationalResultFixture[]
}) {
  const existingFixtures = getRawFixturesFromPayload(input.payload)
  const seen = new Set<string>()
  const response: unknown[] = []

  for (const fixture of [...existingFixtures, ...input.fixtures]) {
    const key = getFixtureDedupeKey(fixture)

    if (!key || seen.has(key)) continue

    seen.add(key)
    response.push(fixture)
  }

  const existingPayload =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? input.payload as InternationalResultsPayload
      : {}
  const sources = Array.isArray(existingPayload.sources) ? existingPayload.sources : []
  const hasInternationalResultsSource = sources.some(
    (source) =>
      source &&
      typeof source === 'object' &&
      (source as { name?: unknown }).name === INTERNATIONAL_RESULTS_SOURCE.name
  )

  return {
    ...existingPayload,
    response,
    results: response.length,
    sources: hasInternationalResultsSource
      ? sources
      : [...sources, INTERNATIONAL_RESULTS_SOURCE],
  } satisfies EnrichedHeadToHeadPayload & { results: number }
}

export function buildInternationalResultsNormalizedPayload(input: {
  payload: unknown
  currentMatch: {
    fixtureExternalId?: string | number | null
    date?: string | null
  }
  homeTeam: HeadToHeadTeam
  awayTeam: HeadToHeadTeam
  cacheKey: string
  cacheLastSyncedAt?: string | null
}) {
  const viewModel = buildHeadToHeadViewModel({
    currentMatch: input.currentMatch,
    rawFixtures: input.payload,
    perspectiveHomeTeam: input.homeTeam,
    perspectiveAwayTeam: input.awayTeam,
    cacheKey: input.cacheKey,
    cacheExists: true,
    cacheLastSyncedAt: input.cacheLastSyncedAt ?? null,
  })

  return {
    viewModel,
    normalizedPayload: {
      summary: viewModel.summary,
      matches: viewModel.matches,
      generatedAt: new Date().toISOString(),
      sources: [INTERNATIONAL_RESULTS_SOURCE.name],
    },
  }
}

export function getInternationalResultsCacheKey(homeTeam: HeadToHeadTeam, awayTeam: HeadToHeadTeam) {
  if (!homeTeam.externalId || !awayTeam.externalId) return null

  return createHeadToHeadCacheKey(homeTeam.externalId, awayTeam.externalId)
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function getFixtureHeadToHeadTeam(
  team: MatchFixture['teams']['home'],
  fallbackName: string
): HeadToHeadTeam {
  const externalId = toNullableNumber(team.id)

  return {
    externalId,
    name: team.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(team.logo_url ?? team.logoUrl ?? team.logo, externalId),
  }
}

export async function buildInternationalResultsHeadToHeadForFixture(
  fixture: MatchFixture
): Promise<HeadToHeadViewModel> {
  const homeTeam = getFixtureHeadToHeadTeam(fixture.teams.home, 'Local')
  const awayTeam = getFixtureHeadToHeadTeam(fixture.teams.away, 'Visitante')

  if (!homeTeam.externalId) {
    return createEmptyHeadToHeadViewModel('missing_home_external_id')
  }

  if (!awayTeam.externalId) {
    return createEmptyHeadToHeadViewModel('missing_away_external_id')
  }

  const cacheKey = createHeadToHeadCacheKey(homeTeam.externalId, awayTeam.externalId)
  const rows = await fetchCachedInternationalResultsHistory()
  const fixtures = getInternationalResultsForPair({
    rows,
    homeTeam,
    awayTeam,
  })
  const payload = mergeInternationalResultsIntoHeadToHeadPayload({
    payload: null,
    fixtures,
  })

  return buildHeadToHeadViewModel({
    currentMatch: {
      fixtureExternalId: fixture.fixture.id,
      date: fixture.fixture.date ?? null,
    },
    rawFixtures: payload,
    perspectiveHomeTeam: homeTeam,
    perspectiveAwayTeam: awayTeam,
    cacheKey,
    cacheExists: false,
  })
}
