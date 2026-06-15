import 'server-only'

import { addDaysToISO, getArgentinaDateISO, toArgentinaDate } from '@/shared/utils/argentina-time'
import { upsertMatchBroadcast } from '@/server/broadcasts/admin'
import {
  asRecord,
  getAdminClient,
  isMissingRelationError,
  matchesFixtureSearch,
  normalizeSearch,
  serializeCachedFixture,
  toAdminDataError,
  type AdminDataResult,
  type CachedFixture,
} from './shared'

type FixtureCacheRow = {
  id: string
  date: string
  fixture_external_id: string
  league_external_id: string | null
  normalized_payload: unknown
  payload: unknown
  updated_at: string | null
  created_at: string | null
}

type MatchRow = {
  id: string | number
}

type MatchPatch = Record<string, string | number | null>

type SupabaseSchemaError = {
  code?: unknown
  message?: unknown
}

type BroadcastLogoRow = {
  broadcaster_name?: string | null
  broadcaster_logo_url?: string | null
}

export type AdminEditableMatch = CachedFixture & {
  leagueName: string | null
  leagueExternalId: string | null
  country: string | null
  season: number | null
  round: string | null
  date: string | null
  homeTeam: string | null
  awayTeam: string | null
  homeLogo: string | null
  awayLogo: string | null
  homePrimaryColor: string | null
  homeSecondaryColor: string | null
  awayPrimaryColor: string | null
  awaySecondaryColor: string | null
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore: number | null
  awayPenaltyScore: number | null
  minute: number | null
  statusShort: string | null
  statusLong: string | null
  venueName: string | null
  venueCity: string | null
  referee: string | null
  tv: string | null
  broadcastLogoUrl: string | null
  highlightsUrl: string | null
  highlightsTitle: string | null
}

export type AdminMatchesPageData = {
  fixtures: AdminEditableMatch[]
  selectedMatch: AdminEditableMatch | null
  broadcastOptions: AdminBroadcastOption[]
}

export type AdminBroadcastOption = {
  name: string
  logoUrl: string | null
}

export type AdminMatchListMode = 'today' | 'world-cup' | 'upcoming' | 'recent' | 'search'

export type AdminMatchDetailsInput = {
  fixtureExternalId: string
  leagueExternalId?: string | null
  leagueName?: string | null
  country?: string | null
  season?: number | null
  round?: string | null
  date?: string | null
  homeTeam?: string | null
  awayTeam?: string | null
  homeLogo?: string | null
  awayLogo?: string | null
  homePrimaryColor?: string | null
  homeSecondaryColor?: string | null
  awayPrimaryColor?: string | null
  awaySecondaryColor?: string | null
  goalsHome?: number | null
  goalsAway?: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  minute?: number | null
  statusShort?: string | null
  statusLong?: string | null
  venueName?: string | null
  venueCity?: string | null
  referee?: string | null
  tv?: string | null
  broadcastLogoUrl?: string | null
  highlightsUrl?: string | null
  highlightsTitle?: string | null
}

const ADMIN_TV_OPTION_DEFINITIONS = [
  {
    name: 'TyC Sports',
    aliases: ['tyc sports', 'tyc', 'tyc sports play'],
  },
  {
    name: 'D Sports',
    aliases: ['d sports', 'dsports', 'directv sports', 'directv'],
  },
  {
    name: 'Fox Sports',
    aliases: ['fox sports', 'foxsports'],
  },
  {
    name: 'ESPN',
    aliases: ['espn', 'espn premium'],
  },
  {
    name: 'Telefe',
    aliases: ['telefe'],
  },
] as const

function readText(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key]

  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function firstText(...values: Array<string | number | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }

  return null
}

function readNumber(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key]

  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function firstNumber(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim()

  return trimmed || null
}

function cleanHexColor(value: string | null | undefined) {
  const text = cleanText(value)
  if (!text) return null

  const cleaned = text.replace(/^#/, '')

  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned.toLowerCase()}` : null
}

function readHexColor(source: Record<string, unknown> | null, key: string) {
  return cleanHexColor(readText(source, key))
}

function getBroadcastOptionName(value: string | null | undefined) {
  const normalizedValue = normalizeSearch(value)
  if (!normalizedValue) return null

  for (const option of ADMIN_TV_OPTION_DEFINITIONS) {
    const normalizedName = normalizeSearch(option.name)
    if (normalizedValue === normalizedName || normalizedValue.includes(normalizedName)) {
      return option.name
    }

    if (
      option.aliases.some((alias) => {
        const normalizedAlias = normalizeSearch(alias)

        return normalizedValue === normalizedAlias || normalizedValue.includes(normalizedAlias)
      })
    ) {
      return option.name
    }
  }

  return null
}

function addBroadcastLogoOption(
  logoByName: Map<string, string>,
  broadcasterName: string | null | undefined,
  broadcasterLogoUrl: string | null | undefined
) {
  const optionName = getBroadcastOptionName(broadcasterName)
  const logoUrl = cleanText(broadcasterLogoUrl)

  if (!optionName || !logoUrl || logoByName.has(optionName)) return

  logoByName.set(optionName, logoUrl)
}

function normalizeDateForStorage(value: string | null | undefined) {
  const text = cleanText(value)
  if (!text) return null

  const date = toArgentinaDate(text)

  return Number.isNaN(date.getTime()) ? text : date.toISOString()
}

function toIntegerOrNull(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.trunc(value as number) : null
}

function getMissingMatchColumnFromError(error: unknown) {
  const record = typeof error === 'object' && error !== null ? (error as SupabaseSchemaError) : null
  const code = typeof record?.code === 'string' ? record.code : null
  const message = typeof record?.message === 'string' ? record.message : ''
  const lowerMessage = message.toLowerCase()

  if (
    code !== 'PGRST204' &&
    code !== '42703' &&
    !lowerMessage.includes('schema cache') &&
    !lowerMessage.includes('column')
  ) {
    return null
  }

  return (
    message.match(/'([^']+)' column/i)?.[1] ??
    message.match(/column "([^"]+)"/i)?.[1] ??
    null
  )
}

function isMissingOptionalBroadcastStore(error: unknown) {
  const record = typeof error === 'object' && error !== null ? (error as SupabaseSchemaError) : null
  const code = typeof record?.code === 'string' ? record.code : null
  const message = typeof record?.message === 'string' ? record.message.toLowerCase() : ''

  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('match_broadcasts') ||
    message.includes('source') ||
    message.includes('schema cache')
  )
}

function getCacheRowsQuery() {
  return getAdminClient()
    .from('football_fixture_cache')
    .select('id, date, fixture_external_id, league_external_id, normalized_payload, payload, updated_at, created_at')
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false })
}

function getCacheRowsAscendingQuery() {
  return getAdminClient()
    .from('football_fixture_cache')
    .select('id, date, fixture_external_id, league_external_id, normalized_payload, payload, updated_at, created_at')
    .order('date', { ascending: true })
    .order('updated_at', { ascending: false })
}

function parseEditableMatch(row: FixtureCacheRow): AdminEditableMatch {
  const cached = serializeCachedFixture(row)
  const normalized = asRecord(row.normalized_payload)
  const raw = asRecord(row.payload)
  const rawFixture = asRecord(raw?.fixture)
  const rawFixtureStatus = asRecord(rawFixture?.status)
  const rawVenue = asRecord(rawFixture?.venue)
  const rawLeague = asRecord(raw?.league)
  const rawTeams = asRecord(raw?.teams)
  const rawHome = asRecord(rawTeams?.home)
  const rawAway = asRecord(rawTeams?.away)
  const rawGoals = asRecord(raw?.goals)
  const rawScore = asRecord(raw?.score)
  const rawPenalty = asRecord(asRecord(rawScore?.penalty))
  const detail = asRecord(normalized?.matchDetail)
  const detailFixturePayload = asRecord(detail?.fixture)
  const detailFixture = asRecord(detailFixturePayload?.fixture)
  const detailFixtureStatus = asRecord(detailFixture?.status)
  const detailVenue = asRecord(detailFixture?.venue)
  const detailLeague = asRecord(detailFixturePayload?.league)
  const detailTeams = asRecord(detailFixturePayload?.teams)
  const detailHome = asRecord(detailTeams?.home)
  const detailAway = asRecord(detailTeams?.away)
  const detailGoals = asRecord(detailFixturePayload?.goals)
  const detailScore = asRecord(detailFixturePayload?.score)
  const detailPenalty = asRecord(asRecord(detailScore?.penalty))
  const normalizedKitColors = asRecord(normalized?.teamKitColors)
  const detailKitColors = asRecord(detail?.teamKitColors)
  const normalizedHomeKitColors = asRecord(normalizedKitColors?.home)
  const normalizedAwayKitColors = asRecord(normalizedKitColors?.away)
  const detailHomeKitColors = asRecord(detailKitColors?.home)
  const detailAwayKitColors = asRecord(detailKitColors?.away)

  return {
    ...cached,
    leagueExternalId:
      firstText(row.league_external_id, readText(normalized, 'leagueId'), readText(rawLeague, 'id')) ??
      null,
    leagueName:
      firstText(readText(normalized, 'league'), readText(normalized, 'leagueName'), readText(detailLeague, 'name'), readText(rawLeague, 'name')) ??
      null,
    country:
      firstText(readText(normalized, 'country'), readText(detailLeague, 'country'), readText(rawLeague, 'country')) ??
      null,
    season:
      firstNumber(readNumber(normalized, 'season'), readNumber(detailLeague, 'season'), readNumber(rawLeague, 'season')),
    round:
      firstText(readText(normalized, 'round'), readText(detailLeague, 'round'), readText(rawLeague, 'round')) ??
      null,
    date:
      firstText(readText(normalized, 'date'), readText(detailFixture, 'date'), readText(rawFixture, 'date'), row.date) ??
      null,
    homeTeam:
      firstText(readText(normalized, 'home'), readText(normalized, 'homeTeam'), readText(detailHome, 'name'), readText(rawHome, 'name')) ??
      null,
    awayTeam:
      firstText(readText(normalized, 'away'), readText(normalized, 'awayTeam'), readText(detailAway, 'name'), readText(rawAway, 'name')) ??
      null,
    homeLogo:
      firstText(readText(normalized, 'homeLogo'), readText(detailHome, 'logo'), readText(rawHome, 'logo')) ??
      null,
    awayLogo:
      firstText(readText(normalized, 'awayLogo'), readText(detailAway, 'logo'), readText(rawAway, 'logo')) ??
      null,
    homePrimaryColor:
      firstText(
        readHexColor(normalized, 'homePrimaryColor'),
        readHexColor(normalized, 'home_primary_color'),
        readHexColor(normalizedHomeKitColors, 'primary'),
        readHexColor(detailHomeKitColors, 'primary')
      ) ?? null,
    homeSecondaryColor:
      firstText(
        readHexColor(normalized, 'homeSecondaryColor'),
        readHexColor(normalized, 'home_secondary_color'),
        readHexColor(normalizedHomeKitColors, 'secondary'),
        readHexColor(detailHomeKitColors, 'secondary')
      ) ?? null,
    awayPrimaryColor:
      firstText(
        readHexColor(normalized, 'awayPrimaryColor'),
        readHexColor(normalized, 'away_primary_color'),
        readHexColor(normalizedAwayKitColors, 'primary'),
        readHexColor(detailAwayKitColors, 'primary')
      ) ?? null,
    awaySecondaryColor:
      firstText(
        readHexColor(normalized, 'awaySecondaryColor'),
        readHexColor(normalized, 'away_secondary_color'),
        readHexColor(normalizedAwayKitColors, 'secondary'),
        readHexColor(detailAwayKitColors, 'secondary')
      ) ?? null,
    goalsHome: firstNumber(readNumber(normalized, 'goalsHome'), readNumber(detailGoals, 'home'), readNumber(rawGoals, 'home')),
    goalsAway: firstNumber(readNumber(normalized, 'goalsAway'), readNumber(detailGoals, 'away'), readNumber(rawGoals, 'away')),
    homePenaltyScore:
      firstNumber(readNumber(normalized, 'homePenaltyScore'), readNumber(detailPenalty, 'home'), readNumber(rawPenalty, 'home')),
    awayPenaltyScore:
      firstNumber(readNumber(normalized, 'awayPenaltyScore'), readNumber(detailPenalty, 'away'), readNumber(rawPenalty, 'away')),
    minute: firstNumber(readNumber(normalized, 'minute'), readNumber(detailFixtureStatus, 'elapsed'), readNumber(rawFixtureStatus, 'elapsed')),
    statusShort:
      firstText(readText(normalized, 'statusShort'), readText(detailFixtureStatus, 'short'), readText(rawFixtureStatus, 'short')) ??
      null,
    statusLong:
      firstText(readText(normalized, 'statusLong'), readText(detailFixtureStatus, 'long'), readText(rawFixtureStatus, 'long')) ??
      null,
    venueName:
      firstText(readText(normalized, 'venueName'), readText(detailVenue, 'name'), readText(rawVenue, 'name')) ??
      null,
    venueCity:
      firstText(readText(normalized, 'venueCity'), readText(detailVenue, 'city'), readText(rawVenue, 'city')) ??
      null,
    referee:
      firstText(readText(normalized, 'referee'), readText(detailFixture, 'referee'), readText(rawFixture, 'referee')) ??
      null,
    tv:
      firstText(readText(normalized, 'tv'), readText(normalized, 'broadcastChannel'), readText(normalized, 'broadcast_channel')) ??
      null,
    broadcastLogoUrl:
      firstText(readText(normalized, 'broadcastLogoUrl'), readText(normalized, 'broadcast_logo_url')) ??
      null,
    highlightsUrl:
      firstText(readText(normalized, 'highlightsUrl'), readText(normalized, 'highlights_url')) ??
      null,
    highlightsTitle:
      firstText(readText(normalized, 'highlightsTitle'), readText(normalized, 'highlights_title')) ??
      null,
  }
}

function normalizeAdminMatchListMode(
  mode: string | null | undefined,
  query: string | null | undefined
): AdminMatchListMode {
  if (mode === 'world-cup' || mode === 'upcoming' || mode === 'recent' || mode === 'search') {
    return mode
  }

  if (query?.trim()) return 'search'

  return 'today'
}

function dedupeFixtureRows(rows: FixtureCacheRow[]) {
  const seen = new Set<string>()
  const deduped: FixtureCacheRow[] = []

  for (const row of rows) {
    const key = String(row.fixture_external_id || row.id)
    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(row)
  }

  return deduped
}

function isWorldCupFixture(fixture: AdminEditableMatch) {
  if (fixture.leagueExternalId === '1') return true

  const haystack = normalizeSearch([
    fixture.leagueName,
    fixture.country,
    fixture.round,
  ].filter(Boolean).join(' '))
  const looksLikeWorldCup =
    haystack.includes('world cup') ||
    haystack.includes('fifa world cup') ||
    haystack.includes('copa del mundo') ||
    haystack.includes('mundial')
  const looksLikeQualifier =
    haystack.includes('qualification') ||
    haystack.includes('qualifier') ||
    haystack.includes('eliminatoria') ||
    haystack.includes('play off') ||
    haystack.includes('playoff')

  return looksLikeWorldCup && !looksLikeQualifier
}

async function getRowsForAdminMatchesMode(mode: AdminMatchListMode) {
  const today = getArgentinaDateISO()

  if (mode === 'today') {
    const { data, error } = await getCacheRowsAscendingQuery()
      .eq('date', today)
      .limit(600)

    return {
      data: (data ?? []) as FixtureCacheRow[],
      error,
    }
  }

  if (mode === 'upcoming') {
    const { data, error } = await getCacheRowsAscendingQuery()
      .gte('date', today)
      .lte('date', addDaysToISO(today, 14))
      .limit(900)

    return {
      data: (data ?? []) as FixtureCacheRow[],
      error,
    }
  }

  if (mode === 'world-cup') {
    const byLeague = await getCacheRowsAscendingQuery()
      .eq('league_external_id', '1')
      .limit(300)
    const byDateWindow = await getCacheRowsAscendingQuery()
      .gte('date', '2026-06-01')
      .lte('date', '2026-07-31')
      .limit(2500)

    if (byLeague.error) {
      return {
        data: [] as FixtureCacheRow[],
        error: byLeague.error,
      }
    }

    if (byDateWindow.error) {
      return {
        data: [] as FixtureCacheRow[],
        error: byDateWindow.error,
      }
    }

    return {
      data: dedupeFixtureRows([
        ...((byLeague.data ?? []) as FixtureCacheRow[]),
        ...((byDateWindow.data ?? []) as FixtureCacheRow[]),
      ]),
      error: null,
    }
  }

  const { data, error } = await getCacheRowsQuery().limit(mode === 'search' ? 2500 : 600)

  return {
    data: (data ?? []) as FixtureCacheRow[],
    error,
  }
}

function patchNormalizedPayload(row: FixtureCacheRow, input: AdminMatchDetailsInput) {
  const normalized = {
    ...(asRecord(row.normalized_payload) ?? {}),
  }
  const fixtureExternalId = cleanText(input.fixtureExternalId) ?? String(row.fixture_external_id)
  const date = normalizeDateForStorage(input.date)
  const leagueExternalId = cleanText(input.leagueExternalId) ?? row.league_external_id
  const leagueName = cleanText(input.leagueName)
  const country = cleanText(input.country)
  const season = toIntegerOrNull(input.season)
  const round = cleanText(input.round)
  const homeTeam = cleanText(input.homeTeam)
  const awayTeam = cleanText(input.awayTeam)
  const homeLogo = cleanText(input.homeLogo)
  const awayLogo = cleanText(input.awayLogo)
  const homePrimaryColor = cleanHexColor(input.homePrimaryColor)
  const homeSecondaryColor = cleanHexColor(input.homeSecondaryColor)
  const awayPrimaryColor = cleanHexColor(input.awayPrimaryColor)
  const awaySecondaryColor = cleanHexColor(input.awaySecondaryColor)
  const goalsHome = toIntegerOrNull(input.goalsHome)
  const goalsAway = toIntegerOrNull(input.goalsAway)
  const homePenaltyScore = toIntegerOrNull(input.homePenaltyScore)
  const awayPenaltyScore = toIntegerOrNull(input.awayPenaltyScore)
  const minute = toIntegerOrNull(input.minute)
  const statusShort = cleanText(input.statusShort)
  const statusLong = cleanText(input.statusLong)
  const venueName = cleanText(input.venueName)
  const venueCity = cleanText(input.venueCity)
  const referee = cleanText(input.referee)
  const tv = cleanText(input.tv)
  const broadcastLogoUrl = cleanText(input.broadcastLogoUrl)
  const highlightsUrl = cleanText(input.highlightsUrl)
  const highlightsTitle = cleanText(input.highlightsTitle)

  normalized.id = Number(fixtureExternalId) || fixtureExternalId
  normalized.externalId = Number(fixtureExternalId) || fixtureExternalId
  normalized.leagueId = leagueExternalId
  normalized.league = leagueName
  normalized.country = country
  normalized.season = season
  normalized.round = round
  normalized.date = date
  normalized.home = homeTeam
  normalized.away = awayTeam
  normalized.homeLogo = homeLogo
  normalized.awayLogo = awayLogo
  normalized.homePrimaryColor = homePrimaryColor
  normalized.homeSecondaryColor = homeSecondaryColor
  normalized.awayPrimaryColor = awayPrimaryColor
  normalized.awaySecondaryColor = awaySecondaryColor
  normalized.home_primary_color = homePrimaryColor
  normalized.home_secondary_color = homeSecondaryColor
  normalized.away_primary_color = awayPrimaryColor
  normalized.away_secondary_color = awaySecondaryColor
  normalized.goalsHome = goalsHome
  normalized.goalsAway = goalsAway
  normalized.homePenaltyScore = homePenaltyScore
  normalized.awayPenaltyScore = awayPenaltyScore
  normalized.minute = minute
  normalized.statusShort = statusShort
  normalized.statusLong = statusLong
  normalized.venueName = venueName
  normalized.venueCity = venueCity
  normalized.referee = referee
  normalized.tv = tv
  normalized.broadcastChannel = tv
  normalized.broadcast_channel = tv
  normalized.broadcastLogoUrl = broadcastLogoUrl
  normalized.broadcast_logo_url = broadcastLogoUrl
  normalized.highlightsUrl = highlightsUrl
  normalized.highlightsTitle = highlightsTitle

  const currentKitColors = asRecord(normalized.teamKitColors)
  const teamKitColors = {
    ...(currentKitColors ?? {}),
    home: {
      ...(asRecord(currentKitColors?.home) ?? {}),
      primary: homePrimaryColor,
      secondary: homeSecondaryColor,
    },
    away: {
      ...(asRecord(currentKitColors?.away) ?? {}),
      primary: awayPrimaryColor,
      secondary: awaySecondaryColor,
    },
  }
  normalized.teamKitColors = teamKitColors

  const matchDetail = {
    ...(asRecord(normalized.matchDetail) ?? {}),
  }
  const fixturePayload = {
    ...(asRecord(matchDetail.fixture) ?? {}),
  }
  const fixture = {
    ...(asRecord(fixturePayload.fixture) ?? {}),
  }
  const status = {
    ...(asRecord(fixture.status) ?? {}),
    short: statusShort,
    long: statusLong,
    elapsed: minute,
  }
  const venue = {
    ...(asRecord(fixture.venue) ?? {}),
    name: venueName,
    city: venueCity,
  }
  const league = {
    ...(asRecord(fixturePayload.league) ?? {}),
    id: Number(leagueExternalId) || leagueExternalId,
    name: leagueName,
    country,
    round,
    season,
  }
  const teams = {
    ...(asRecord(fixturePayload.teams) ?? {}),
    home: {
      ...(asRecord(asRecord(fixturePayload.teams)?.home) ?? {}),
      name: homeTeam,
      logo: homeLogo,
    },
    away: {
      ...(asRecord(asRecord(fixturePayload.teams)?.away) ?? {}),
      name: awayTeam,
      logo: awayLogo,
    },
  }
  const score = {
    ...(asRecord(fixturePayload.score) ?? {}),
    fulltime: {
      ...(asRecord(asRecord(fixturePayload.score)?.fulltime) ?? {}),
      home: goalsHome,
      away: goalsAway,
    },
    penalty: {
      ...(asRecord(asRecord(fixturePayload.score)?.penalty) ?? {}),
      home: homePenaltyScore,
      away: awayPenaltyScore,
    },
  }

  matchDetail.fixture = {
    ...fixturePayload,
    fixture: {
      ...fixture,
      id: Number(fixtureExternalId) || fixtureExternalId,
      date,
      status,
      venue,
      referee,
    },
    league,
    teams,
    goals: {
      ...(asRecord(fixturePayload.goals) ?? {}),
      home: goalsHome,
      away: goalsAway,
    },
    score,
  }
  matchDetail.teamKitColors = teamKitColors
  normalized.matchDetail = matchDetail

  return {
    cacheDate: date ? getArgentinaDateISO(date) : row.date,
    leagueExternalId,
    normalized,
  }
}

async function findFixtureCacheRow(fixtureExternalId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('football_fixture_cache')
    .select('id, date, fixture_external_id, league_external_id, normalized_payload, payload, updated_at, created_at')
    .eq('fixture_external_id', fixtureExternalId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data as FixtureCacheRow | null) ?? null
}

async function updateStoredMatch(input: AdminMatchDetailsInput) {
  const fixtureExternalId = cleanText(input.fixtureExternalId)
  if (!fixtureExternalId) return

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('external_id', fixtureExternalId)
    .maybeSingle()

  if (error) throw error

  const match = data as MatchRow | null
  if (!match) return

  const patch: MatchPatch = {
    round: cleanText(input.round),
    match_date: normalizeDateForStorage(input.date),
    status: cleanText(input.statusShort),
    elapsed: toIntegerOrNull(input.minute),
    home_score: toIntegerOrNull(input.goalsHome),
    away_score: toIntegerOrNull(input.goalsAway),
    home_penalty_score: toIntegerOrNull(input.homePenaltyScore),
    away_penalty_score: toIntegerOrNull(input.awayPenaltyScore),
    home_primary_color: cleanHexColor(input.homePrimaryColor),
    home_secondary_color: cleanHexColor(input.homeSecondaryColor),
    away_primary_color: cleanHexColor(input.awayPrimaryColor),
    away_secondary_color: cleanHexColor(input.awaySecondaryColor),
    venue_name: cleanText(input.venueName),
    venue_city: cleanText(input.venueCity),
    referee: cleanText(input.referee),
    broadcast_channel: cleanText(input.tv),
    broadcast_logo_url: cleanText(input.broadcastLogoUrl),
    highlights_url: cleanText(input.highlightsUrl),
    highlights_title: cleanText(input.highlightsTitle),
  }

  const remainingPatch: MatchPatch = { ...patch }
  let lastUpdateError: unknown = null

  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (Object.keys(remainingPatch).length === 0) {
      await replaceManualMatchBroadcast(match.id, input)
      return
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(remainingPatch)
      .eq('id', String(match.id))

    if (!updateError) {
      await replaceManualMatchBroadcast(match.id, input)
      return
    }

    lastUpdateError = updateError

    const missingColumn = getMissingMatchColumnFromError(updateError)
    if (missingColumn && Object.prototype.hasOwnProperty.call(remainingPatch, missingColumn)) {
      delete remainingPatch[missingColumn]
      console.warn('[admin-matches] Optional matches column missing in production schema; skipping it.', {
        fixtureExternalId,
        missingColumn,
      })
      continue
    }

    throw updateError
  }

  throw lastUpdateError
}

async function replaceManualMatchBroadcast(
  matchId: string | number,
  input: AdminMatchDetailsInput
) {
  const broadcasterName = cleanText(input.tv)
  const broadcasterLogoUrl = cleanText(input.broadcastLogoUrl)
  const country = cleanText(input.country)
  const supabase = getAdminClient()

  try {
    const deleteResponse = await supabase
      .from('match_broadcasts')
      .delete()
      .eq('match_id', String(matchId))
      .eq('source', 'manual')

    if (deleteResponse.error) {
      if (isMissingOptionalBroadcastStore(deleteResponse.error)) {
        console.warn('[admin-matches] Manual broadcast cleanup not available in current schema.', {
          matchId,
        })
      } else {
        throw deleteResponse.error
      }
    }

    if (!broadcasterName) return

    await upsertMatchBroadcast(supabase, {
      matchId,
      broadcasterName,
      broadcasterLogoUrl,
      country,
    })
  } catch (error) {
    if (isMissingOptionalBroadcastStore(error)) {
      console.warn('[admin-matches] Optional match_broadcasts store not available; TV remains only in normalized cache.', {
        matchId,
      })
      return
    }

    throw error
  }
}

function buildAdminBroadcastOptions(logoByName: Map<string, string>): AdminBroadcastOption[] {
  return ADMIN_TV_OPTION_DEFINITIONS.map((option) => ({
    name: option.name,
    logoUrl: logoByName.get(option.name) ?? null,
  }))
}

async function addBroadcastLogoOptionsFromTable(
  logoByName: Map<string, string>,
  table: 'admin_broadcast_overrides' | 'broadcast_rules' | 'match_broadcasts',
  options: {
    activeOnly?: boolean
  } = {}
) {
  const supabase = getAdminClient()
  let query = supabase
    .from(table)
    .select('broadcaster_name, broadcaster_logo_url')
    .not('broadcaster_logo_url', 'is', null)
    .limit(500)

  if (options.activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingRelationError(error) || isMissingOptionalBroadcastStore(error)) {
      return
    }

    throw error
  }

  for (const row of (data ?? []) as BroadcastLogoRow[]) {
    addBroadcastLogoOption(logoByName, row.broadcaster_name, row.broadcaster_logo_url)
  }
}

async function getAdminBroadcastOptions(fixtures: AdminEditableMatch[] = []) {
  const logoByName = new Map<string, string>()

  await addBroadcastLogoOptionsFromTable(logoByName, 'admin_broadcast_overrides', {
    activeOnly: true,
  })
  await addBroadcastLogoOptionsFromTable(logoByName, 'broadcast_rules', {
    activeOnly: true,
  })
  await addBroadcastLogoOptionsFromTable(logoByName, 'match_broadcasts')

  for (const fixture of fixtures) {
    addBroadcastLogoOption(logoByName, fixture.tv, fixture.broadcastLogoUrl)
  }

  return buildAdminBroadcastOptions(logoByName)
}

export async function getAdminMatchesPageData(
  query: string | null | undefined,
  selectedFixtureId?: string | null,
  mode?: string | null
): Promise<AdminDataResult<AdminMatchesPageData>> {
  const fallback: AdminMatchesPageData = {
    fixtures: [],
    selectedMatch: null,
    broadcastOptions: buildAdminBroadcastOptions(new Map()),
  }

  try {
    const listMode = normalizeAdminMatchListMode(mode, query)
    const { data, error } = await getRowsForAdminMatchesMode(listMode)

    if (error) {
      return {
        data: fallback,
        error: toAdminDataError(error, 'No se pudieron leer partidos cacheados.'),
      }
    }

    const rows = (data ?? []) as FixtureCacheRow[]
    const allFixtures = rows
      .map(parseEditableMatch)
      .filter((fixture) => (listMode === 'world-cup' ? isWorldCupFixture(fixture) : true))
    const broadcastOptions = await getAdminBroadcastOptions(allFixtures)
    const fixtures = allFixtures
      .filter((fixture) => matchesFixtureSearch(fixture, query ?? ''))
      .slice(0, 120)
    const selectedMatchFromList =
      selectedFixtureId
        ? allFixtures.find((fixture) => fixture.fixtureExternalId === selectedFixtureId) ??
          fixtures.find((fixture) => fixture.fixtureExternalId === selectedFixtureId)
        : null
    const selectedRow =
      selectedFixtureId && !selectedMatchFromList
        ? await findFixtureCacheRow(selectedFixtureId)
        : null
    const selectedMatch =
      selectedMatchFromList ??
      (selectedRow ? parseEditableMatch(selectedRow) : null) ??
      fixtures[0] ??
      null

    return {
      data: {
        fixtures,
        selectedMatch,
        broadcastOptions,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: fallback,
      error: toAdminDataError(error, 'No se pudo cargar el editor de partidos.'),
    }
  }
}

export async function updateAdminMatchDetails(input: AdminMatchDetailsInput) {
  const fixtureExternalId = cleanText(input.fixtureExternalId)
  if (!fixtureExternalId) {
    throw new Error('Selecciona un partido valido.')
  }

  const row = await findFixtureCacheRow(fixtureExternalId)
  if (!row) {
    throw new Error('No se encontro el fixture cacheado para editar.')
  }

  const patch = patchNormalizedPayload(row, input)
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('football_fixture_cache')
    .update({
      date: patch.cacheDate,
      league_external_id: patch.leagueExternalId,
      normalized_payload: patch.normalized,
    })
    .eq('id', row.id)

  if (error) {
    throw new Error(`No se pudo actualizar el cache del partido: ${error.message}`)
  }

  await updateStoredMatch(input)
}
