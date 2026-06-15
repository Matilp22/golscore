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

type AdminMatchDetailOverrideRow = {
  fixture_external_id: string
  overrides: unknown
  active?: boolean | null
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
  homeNumberColor: string | null
  homeGoalkeeperPrimaryColor: string | null
  homeGoalkeeperSecondaryColor: string | null
  homeGoalkeeperNumberColor: string | null
  awayPrimaryColor: string | null
  awaySecondaryColor: string | null
  awayNumberColor: string | null
  awayGoalkeeperPrimaryColor: string | null
  awayGoalkeeperSecondaryColor: string | null
  awayGoalkeeperNumberColor: string | null
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
  homeCaptainPlayerId: string | null
  homeCaptainPlayerName: string | null
  awayCaptainPlayerId: string | null
  awayCaptainPlayerName: string | null
  homeCaptainOptions: AdminCaptainOption[]
  awayCaptainOptions: AdminCaptainOption[]
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

export type AdminCaptainOption = {
  playerId: string | null
  playerName: string
  number: number | null
  list: 'starter' | 'substitute'
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
  homeNumberColor?: string | null
  homeGoalkeeperPrimaryColor?: string | null
  homeGoalkeeperSecondaryColor?: string | null
  homeGoalkeeperNumberColor?: string | null
  awayPrimaryColor?: string | null
  awaySecondaryColor?: string | null
  awayNumberColor?: string | null
  awayGoalkeeperPrimaryColor?: string | null
  awayGoalkeeperSecondaryColor?: string | null
  awayGoalkeeperNumberColor?: string | null
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
  homeCaptainPlayerId?: string | null
  homeCaptainPlayerName?: string | null
  awayCaptainPlayerId?: string | null
  awayCaptainPlayerName?: string | null
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

function hasRecordKey(source: Record<string, unknown> | null, key: string) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key))
}

function readOverrideText(source: Record<string, unknown> | null, key: string) {
  if (!hasRecordKey(source, key)) return undefined

  return cleanText(readText(source, key))
}

function readOverrideNumber(source: Record<string, unknown> | null, key: string) {
  if (!hasRecordKey(source, key)) return undefined

  return toIntegerOrNull(readNumber(source, key))
}

function readOverrideHexColor(source: Record<string, unknown> | null, key: string) {
  if (!hasRecordKey(source, key)) return undefined

  return cleanHexColor(readText(source, key))
}

function resolveTextOverride(
  overrides: Record<string, unknown> | null,
  key: string,
  ...fallback: Array<string | number | null | undefined>
) {
  const override = readOverrideText(overrides, key)

  return override !== undefined ? override : firstText(...fallback) ?? null
}

function resolveNumberOverride(
  overrides: Record<string, unknown> | null,
  key: string,
  ...fallback: Array<number | string | null | undefined>
) {
  const override = readOverrideNumber(overrides, key)

  return override !== undefined ? override : firstNumber(...fallback)
}

function resolveHexOverride(
  overrides: Record<string, unknown> | null,
  key: string,
  ...fallback: Array<string | null | undefined>
) {
  const override = readOverrideHexColor(overrides, key)

  return override !== undefined ? override : firstText(...fallback) ?? null
}

function readKitColor(
  source: Record<string, unknown> | null,
  side: 'home' | 'away',
  role: 'player' | 'goalkeeper',
  key: 'primary' | 'secondary' | 'number'
) {
  const teamKitColors = asRecord(source?.teamKitColors)
  const sideKitColors = asRecord(teamKitColors?.[side])
  const roleKitColors = asRecord(sideKitColors?.[role])

  return (
    readHexColor(roleKitColors, key) ??
    (role === 'player' ? readHexColor(sideKitColors, key) : null)
  )
}

function isCaptainFlag(value: unknown) {
  if (value === true || value === 1) return true
  if (typeof value !== 'string') return false

  const normalized = normalizeSearch(value)

  return normalized === 'true' || normalized === '1' || normalized === 'c' || normalized === 'captain'
}

function readAdminLineups(...values: unknown[]) {
  for (const value of values) {
    if (!Array.isArray(value)) continue

    const lineups = value
      .map((lineup) => asRecord(lineup))
      .filter((lineup): lineup is Record<string, unknown> => Boolean(lineup))

    if (lineups.length) return lineups
  }

  return []
}

function getLineupTeamName(lineup: Record<string, unknown> | null) {
  return readText(asRecord(lineup?.team), 'name')
}

function findAdminLineup(
  lineups: Record<string, unknown>[],
  teamName: string | null,
  fallbackIndex: number
) {
  const normalizedTeamName = normalizeSearch(teamName)

  if (normalizedTeamName) {
    const exactMatch = lineups.find((lineup) => normalizeSearch(getLineupTeamName(lineup)) === normalizedTeamName)
    if (exactMatch) return exactMatch

    const containsMatch = lineups.find((lineup) => {
      const lineupName = normalizeSearch(getLineupTeamName(lineup))

      return lineupName.includes(normalizedTeamName) || normalizedTeamName.includes(lineupName)
    })
    if (containsMatch) return containsMatch
  }

  return lineups[fallbackIndex] ?? null
}

function getLineupPlayerOption(
  value: unknown,
  list: AdminCaptainOption['list']
): AdminCaptainOption | null {
  const wrapper = asRecord(value)
  const player = asRecord(wrapper?.player)
  const playerName = firstText(readText(player, 'name'), readText(wrapper, 'name'))

  if (!playerName) return null

  return {
    playerId: firstText(readText(player, 'id'), readText(wrapper, 'id')),
    playerName,
    number: firstNumber(readNumber(player, 'number'), readNumber(wrapper, 'number')),
    list,
  }
}

function getAdminCaptainOptions(lineup: Record<string, unknown> | null): AdminCaptainOption[] {
  const rawStarters = Array.isArray(lineup?.startXI) ? lineup.startXI : []
  const rawSubstitutes = Array.isArray(lineup?.substitutes) ? lineup.substitutes : []
  const options = [
    ...rawStarters.map((player) => getLineupPlayerOption(player, 'starter')),
    ...rawSubstitutes.map((player) => getLineupPlayerOption(player, 'substitute')),
  ].filter((player): player is AdminCaptainOption => Boolean(player))
  const seen = new Set<string>()

  return options.filter((option) => {
    const key = option.playerId ? `id:${option.playerId}` : `name:${normalizeSearch(option.playerName)}`
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function findAdminCaptainInPlayers(
  players: unknown[],
  list: AdminCaptainOption['list']
): AdminCaptainOption | null {
  for (const value of players) {
    const wrapper = asRecord(value)
    const player = asRecord(wrapper?.player)

    if (!isCaptainFlag(wrapper?.captain) && !isCaptainFlag(player?.captain)) continue

    return getLineupPlayerOption(value, list)
  }

  return null
}

function getAdminCaptainFromLineup(lineup: Record<string, unknown> | null) {
  const rawStarters = Array.isArray(lineup?.startXI) ? lineup.startXI : []
  const rawSubstitutes = Array.isArray(lineup?.substitutes) ? lineup.substitutes : []

  return (
    findAdminCaptainInPlayers(rawStarters, 'starter') ??
    findAdminCaptainInPlayers(rawSubstitutes, 'substitute')
  )
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

function parseEditableMatch(
  row: FixtureCacheRow,
  overridePayload?: Record<string, unknown> | null
): AdminEditableMatch {
  const cached = serializeCachedFixture(row)
  const normalized = asRecord(row.normalized_payload)
  const overrides = overridePayload ?? null
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
  const resolvedHomeTeam = resolveTextOverride(overrides, 'homeTeam', readText(normalized, 'home'), readText(normalized, 'homeTeam'), readText(detailHome, 'name'), readText(rawHome, 'name'))
  const resolvedAwayTeam = resolveTextOverride(overrides, 'awayTeam', readText(normalized, 'away'), readText(normalized, 'awayTeam'), readText(detailAway, 'name'), readText(rawAway, 'name'))
  const detailLineups = readAdminLineups(detail?.lineups, normalized?.lineups)
  const homeLineup = findAdminLineup(detailLineups, resolvedHomeTeam, 0)
  const awayLineup = findAdminLineup(detailLineups, resolvedAwayTeam, 1)
  const homeApiCaptain = getAdminCaptainFromLineup(homeLineup)
  const awayApiCaptain = getAdminCaptainFromLineup(awayLineup)
  const homeCaptainPlayerId = resolveTextOverride(overrides, 'homeCaptainPlayerId', homeApiCaptain?.playerId)
  const homeCaptainPlayerName = resolveTextOverride(overrides, 'homeCaptainPlayerName', homeApiCaptain?.playerName)
  const awayCaptainPlayerId = resolveTextOverride(overrides, 'awayCaptainPlayerId', awayApiCaptain?.playerId)
  const awayCaptainPlayerName = resolveTextOverride(overrides, 'awayCaptainPlayerName', awayApiCaptain?.playerName)

  return {
    ...cached,
    leagueExternalId:
      resolveTextOverride(overrides, 'leagueExternalId', row.league_external_id, readText(normalized, 'leagueId'), readText(rawLeague, 'id')),
    leagueName:
      resolveTextOverride(overrides, 'leagueName', readText(normalized, 'league'), readText(normalized, 'leagueName'), readText(detailLeague, 'name'), readText(rawLeague, 'name')),
    country:
      resolveTextOverride(overrides, 'country', readText(normalized, 'country'), readText(detailLeague, 'country'), readText(rawLeague, 'country')),
    season:
      resolveNumberOverride(overrides, 'season', readNumber(normalized, 'season'), readNumber(detailLeague, 'season'), readNumber(rawLeague, 'season')),
    round:
      resolveTextOverride(overrides, 'round', readText(normalized, 'round'), readText(detailLeague, 'round'), readText(rawLeague, 'round')),
    date:
      resolveTextOverride(overrides, 'date', readText(normalized, 'date'), readText(detailFixture, 'date'), readText(rawFixture, 'date'), row.date),
    homeTeam: resolvedHomeTeam,
    awayTeam: resolvedAwayTeam,
    homeLogo:
      resolveTextOverride(overrides, 'homeLogo', readText(normalized, 'homeLogo'), readText(detailHome, 'logo'), readText(rawHome, 'logo')),
    awayLogo:
      resolveTextOverride(overrides, 'awayLogo', readText(normalized, 'awayLogo'), readText(detailAway, 'logo'), readText(rawAway, 'logo')),
    homePrimaryColor:
      resolveHexOverride(
        overrides,
        'homePrimaryColor',
        readKitColor(overrides, 'home', 'player', 'primary'),
        readHexColor(normalized, 'homePrimaryColor'),
        readHexColor(normalized, 'home_primary_color'),
        readKitColor(normalized, 'home', 'player', 'primary'),
        readHexColor(normalizedHomeKitColors, 'primary'),
        readHexColor(detailHomeKitColors, 'primary')
      ),
    homeSecondaryColor:
      resolveHexOverride(
        overrides,
        'homeSecondaryColor',
        readKitColor(overrides, 'home', 'player', 'secondary'),
        readHexColor(normalized, 'homeSecondaryColor'),
        readHexColor(normalized, 'home_secondary_color'),
        readKitColor(normalized, 'home', 'player', 'secondary'),
        readHexColor(normalizedHomeKitColors, 'secondary'),
        readHexColor(detailHomeKitColors, 'secondary')
      ),
    homeNumberColor:
      resolveHexOverride(
        overrides,
        'homeNumberColor',
        readKitColor(overrides, 'home', 'player', 'number'),
        readHexColor(normalized, 'homeNumberColor'),
        readHexColor(normalized, 'home_number_color'),
        readKitColor(normalized, 'home', 'player', 'number'),
        readHexColor(detailHomeKitColors, 'number')
      ),
    homeGoalkeeperPrimaryColor:
      resolveHexOverride(
        overrides,
        'homeGoalkeeperPrimaryColor',
        readKitColor(overrides, 'home', 'goalkeeper', 'primary'),
        readHexColor(normalized, 'homeGoalkeeperPrimaryColor'),
        readHexColor(normalized, 'home_goalkeeper_primary_color'),
        readKitColor(normalized, 'home', 'goalkeeper', 'primary')
      ),
    homeGoalkeeperSecondaryColor:
      resolveHexOverride(
        overrides,
        'homeGoalkeeperSecondaryColor',
        readKitColor(overrides, 'home', 'goalkeeper', 'secondary'),
        readHexColor(normalized, 'homeGoalkeeperSecondaryColor'),
        readHexColor(normalized, 'home_goalkeeper_secondary_color'),
        readKitColor(normalized, 'home', 'goalkeeper', 'secondary')
      ),
    homeGoalkeeperNumberColor:
      resolveHexOverride(
        overrides,
        'homeGoalkeeperNumberColor',
        readKitColor(overrides, 'home', 'goalkeeper', 'number'),
        readHexColor(normalized, 'homeGoalkeeperNumberColor'),
        readHexColor(normalized, 'home_goalkeeper_number_color'),
        readKitColor(normalized, 'home', 'goalkeeper', 'number')
      ),
    awayPrimaryColor:
      resolveHexOverride(
        overrides,
        'awayPrimaryColor',
        readKitColor(overrides, 'away', 'player', 'primary'),
        readHexColor(normalized, 'awayPrimaryColor'),
        readHexColor(normalized, 'away_primary_color'),
        readKitColor(normalized, 'away', 'player', 'primary'),
        readHexColor(normalizedAwayKitColors, 'primary'),
        readHexColor(detailAwayKitColors, 'primary')
      ),
    awaySecondaryColor:
      resolveHexOverride(
        overrides,
        'awaySecondaryColor',
        readKitColor(overrides, 'away', 'player', 'secondary'),
        readHexColor(normalized, 'awaySecondaryColor'),
        readHexColor(normalized, 'away_secondary_color'),
        readKitColor(normalized, 'away', 'player', 'secondary'),
        readHexColor(normalizedAwayKitColors, 'secondary'),
        readHexColor(detailAwayKitColors, 'secondary')
      ),
    awayNumberColor:
      resolveHexOverride(
        overrides,
        'awayNumberColor',
        readKitColor(overrides, 'away', 'player', 'number'),
        readHexColor(normalized, 'awayNumberColor'),
        readHexColor(normalized, 'away_number_color'),
        readKitColor(normalized, 'away', 'player', 'number'),
        readHexColor(detailAwayKitColors, 'number')
      ),
    awayGoalkeeperPrimaryColor:
      resolveHexOverride(
        overrides,
        'awayGoalkeeperPrimaryColor',
        readKitColor(overrides, 'away', 'goalkeeper', 'primary'),
        readHexColor(normalized, 'awayGoalkeeperPrimaryColor'),
        readHexColor(normalized, 'away_goalkeeper_primary_color'),
        readKitColor(normalized, 'away', 'goalkeeper', 'primary')
      ),
    awayGoalkeeperSecondaryColor:
      resolveHexOverride(
        overrides,
        'awayGoalkeeperSecondaryColor',
        readKitColor(overrides, 'away', 'goalkeeper', 'secondary'),
        readHexColor(normalized, 'awayGoalkeeperSecondaryColor'),
        readHexColor(normalized, 'away_goalkeeper_secondary_color'),
        readKitColor(normalized, 'away', 'goalkeeper', 'secondary')
      ),
    awayGoalkeeperNumberColor:
      resolveHexOverride(
        overrides,
        'awayGoalkeeperNumberColor',
        readKitColor(overrides, 'away', 'goalkeeper', 'number'),
        readHexColor(normalized, 'awayGoalkeeperNumberColor'),
        readHexColor(normalized, 'away_goalkeeper_number_color'),
        readKitColor(normalized, 'away', 'goalkeeper', 'number')
      ),
    goalsHome: resolveNumberOverride(overrides, 'goalsHome', readNumber(normalized, 'goalsHome'), readNumber(detailGoals, 'home'), readNumber(rawGoals, 'home')),
    goalsAway: resolveNumberOverride(overrides, 'goalsAway', readNumber(normalized, 'goalsAway'), readNumber(detailGoals, 'away'), readNumber(rawGoals, 'away')),
    homePenaltyScore:
      resolveNumberOverride(overrides, 'homePenaltyScore', readNumber(normalized, 'homePenaltyScore'), readNumber(detailPenalty, 'home'), readNumber(rawPenalty, 'home')),
    awayPenaltyScore:
      resolveNumberOverride(overrides, 'awayPenaltyScore', readNumber(normalized, 'awayPenaltyScore'), readNumber(detailPenalty, 'away'), readNumber(rawPenalty, 'away')),
    minute: resolveNumberOverride(overrides, 'minute', readNumber(normalized, 'minute'), readNumber(detailFixtureStatus, 'elapsed'), readNumber(rawFixtureStatus, 'elapsed')),
    statusShort:
      resolveTextOverride(overrides, 'statusShort', readText(normalized, 'statusShort'), readText(detailFixtureStatus, 'short'), readText(rawFixtureStatus, 'short')),
    statusLong:
      resolveTextOverride(overrides, 'statusLong', readText(normalized, 'statusLong'), readText(detailFixtureStatus, 'long'), readText(rawFixtureStatus, 'long')),
    venueName:
      resolveTextOverride(overrides, 'venueName', readText(normalized, 'venueName'), readText(detailVenue, 'name'), readText(rawVenue, 'name')),
    venueCity:
      resolveTextOverride(overrides, 'venueCity', readText(normalized, 'venueCity'), readText(detailVenue, 'city'), readText(rawVenue, 'city')),
    referee:
      resolveTextOverride(overrides, 'referee', readText(normalized, 'referee'), readText(detailFixture, 'referee'), readText(rawFixture, 'referee')),
    tv:
      resolveTextOverride(overrides, 'tv', readText(normalized, 'tv'), readText(normalized, 'broadcastChannel'), readText(normalized, 'broadcast_channel')),
    broadcastLogoUrl:
      resolveTextOverride(overrides, 'broadcastLogoUrl', readText(normalized, 'broadcastLogoUrl'), readText(normalized, 'broadcast_logo_url')),
    highlightsUrl:
      resolveTextOverride(overrides, 'highlightsUrl', readText(normalized, 'highlightsUrl'), readText(normalized, 'highlights_url')),
    highlightsTitle:
      resolveTextOverride(overrides, 'highlightsTitle', readText(normalized, 'highlightsTitle'), readText(normalized, 'highlights_title')),
    homeCaptainPlayerId,
    homeCaptainPlayerName,
    awayCaptainPlayerId,
    awayCaptainPlayerName,
    homeCaptainOptions: getAdminCaptainOptions(homeLineup),
    awayCaptainOptions: getAdminCaptainOptions(awayLineup),
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
  const homeNumberColor = cleanHexColor(input.homeNumberColor)
  const homeGoalkeeperPrimaryColor = cleanHexColor(input.homeGoalkeeperPrimaryColor)
  const homeGoalkeeperSecondaryColor = cleanHexColor(input.homeGoalkeeperSecondaryColor)
  const homeGoalkeeperNumberColor = cleanHexColor(input.homeGoalkeeperNumberColor)
  const awayPrimaryColor = cleanHexColor(input.awayPrimaryColor)
  const awaySecondaryColor = cleanHexColor(input.awaySecondaryColor)
  const awayNumberColor = cleanHexColor(input.awayNumberColor)
  const awayGoalkeeperPrimaryColor = cleanHexColor(input.awayGoalkeeperPrimaryColor)
  const awayGoalkeeperSecondaryColor = cleanHexColor(input.awayGoalkeeperSecondaryColor)
  const awayGoalkeeperNumberColor = cleanHexColor(input.awayGoalkeeperNumberColor)
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
  const homeCaptainPlayerId = cleanText(input.homeCaptainPlayerId)
  const homeCaptainPlayerName = cleanText(input.homeCaptainPlayerName)
  const awayCaptainPlayerId = cleanText(input.awayCaptainPlayerId)
  const awayCaptainPlayerName = cleanText(input.awayCaptainPlayerName)
  const captains = {
    home: {
      playerId: homeCaptainPlayerId,
      playerName: homeCaptainPlayerName,
    },
    away: {
      playerId: awayCaptainPlayerId,
      playerName: awayCaptainPlayerName,
    },
  }

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
  normalized.homeNumberColor = homeNumberColor
  normalized.homeGoalkeeperPrimaryColor = homeGoalkeeperPrimaryColor
  normalized.homeGoalkeeperSecondaryColor = homeGoalkeeperSecondaryColor
  normalized.homeGoalkeeperNumberColor = homeGoalkeeperNumberColor
  normalized.awayPrimaryColor = awayPrimaryColor
  normalized.awaySecondaryColor = awaySecondaryColor
  normalized.awayNumberColor = awayNumberColor
  normalized.awayGoalkeeperPrimaryColor = awayGoalkeeperPrimaryColor
  normalized.awayGoalkeeperSecondaryColor = awayGoalkeeperSecondaryColor
  normalized.awayGoalkeeperNumberColor = awayGoalkeeperNumberColor
  normalized.home_primary_color = homePrimaryColor
  normalized.home_secondary_color = homeSecondaryColor
  normalized.home_number_color = homeNumberColor
  normalized.home_goalkeeper_primary_color = homeGoalkeeperPrimaryColor
  normalized.home_goalkeeper_secondary_color = homeGoalkeeperSecondaryColor
  normalized.home_goalkeeper_number_color = homeGoalkeeperNumberColor
  normalized.away_primary_color = awayPrimaryColor
  normalized.away_secondary_color = awaySecondaryColor
  normalized.away_number_color = awayNumberColor
  normalized.away_goalkeeper_primary_color = awayGoalkeeperPrimaryColor
  normalized.away_goalkeeper_secondary_color = awayGoalkeeperSecondaryColor
  normalized.away_goalkeeper_number_color = awayGoalkeeperNumberColor
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
  normalized.homeCaptainPlayerId = homeCaptainPlayerId
  normalized.homeCaptainPlayerName = homeCaptainPlayerName
  normalized.awayCaptainPlayerId = awayCaptainPlayerId
  normalized.awayCaptainPlayerName = awayCaptainPlayerName
  normalized.captains = captains

  const currentKitColors = asRecord(normalized.teamKitColors)
  const teamKitColors = {
    ...(currentKitColors ?? {}),
    home: {
      ...(asRecord(currentKitColors?.home) ?? {}),
      primary: homePrimaryColor,
      secondary: homeSecondaryColor,
      number: homeNumberColor,
      player: {
        ...(asRecord(asRecord(currentKitColors?.home)?.player) ?? {}),
        primary: homePrimaryColor,
        secondary: homeSecondaryColor,
        number: homeNumberColor,
      },
      goalkeeper: {
        ...(asRecord(asRecord(currentKitColors?.home)?.goalkeeper) ?? {}),
        primary: homeGoalkeeperPrimaryColor,
        secondary: homeGoalkeeperSecondaryColor,
        number: homeGoalkeeperNumberColor,
      },
    },
    away: {
      ...(asRecord(currentKitColors?.away) ?? {}),
      primary: awayPrimaryColor,
      secondary: awaySecondaryColor,
      number: awayNumberColor,
      player: {
        ...(asRecord(asRecord(currentKitColors?.away)?.player) ?? {}),
        primary: awayPrimaryColor,
        secondary: awaySecondaryColor,
        number: awayNumberColor,
      },
      goalkeeper: {
        ...(asRecord(asRecord(currentKitColors?.away)?.goalkeeper) ?? {}),
        primary: awayGoalkeeperPrimaryColor,
        secondary: awayGoalkeeperSecondaryColor,
        number: awayGoalkeeperNumberColor,
      },
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
  matchDetail.captains = captains
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
    home_number_color: cleanHexColor(input.homeNumberColor),
    home_goalkeeper_primary_color: cleanHexColor(input.homeGoalkeeperPrimaryColor),
    home_goalkeeper_secondary_color: cleanHexColor(input.homeGoalkeeperSecondaryColor),
    home_goalkeeper_number_color: cleanHexColor(input.homeGoalkeeperNumberColor),
    away_primary_color: cleanHexColor(input.awayPrimaryColor),
    away_secondary_color: cleanHexColor(input.awaySecondaryColor),
    away_number_color: cleanHexColor(input.awayNumberColor),
    away_goalkeeper_primary_color: cleanHexColor(input.awayGoalkeeperPrimaryColor),
    away_goalkeeper_secondary_color: cleanHexColor(input.awayGoalkeeperSecondaryColor),
    away_goalkeeper_number_color: cleanHexColor(input.awayGoalkeeperNumberColor),
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

function isMissingOptionalMatchOverrideStore(error: unknown) {
  const record = typeof error === 'object' && error !== null ? (error as SupabaseSchemaError) : null
  const code = typeof record?.code === 'string' ? record.code : null
  const message = typeof record?.message === 'string' ? record.message.toLowerCase() : ''

  return (
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('admin_match_detail_overrides') ||
    message.includes('schema cache')
  )
}

function buildAdminMatchOverridePayload(input: AdminMatchDetailsInput) {
  const homePrimaryColor = cleanHexColor(input.homePrimaryColor)
  const homeSecondaryColor = cleanHexColor(input.homeSecondaryColor)
  const homeNumberColor = cleanHexColor(input.homeNumberColor)
  const homeGoalkeeperPrimaryColor = cleanHexColor(input.homeGoalkeeperPrimaryColor)
  const homeGoalkeeperSecondaryColor = cleanHexColor(input.homeGoalkeeperSecondaryColor)
  const homeGoalkeeperNumberColor = cleanHexColor(input.homeGoalkeeperNumberColor)
  const awayPrimaryColor = cleanHexColor(input.awayPrimaryColor)
  const awaySecondaryColor = cleanHexColor(input.awaySecondaryColor)
  const awayNumberColor = cleanHexColor(input.awayNumberColor)
  const awayGoalkeeperPrimaryColor = cleanHexColor(input.awayGoalkeeperPrimaryColor)
  const awayGoalkeeperSecondaryColor = cleanHexColor(input.awayGoalkeeperSecondaryColor)
  const awayGoalkeeperNumberColor = cleanHexColor(input.awayGoalkeeperNumberColor)
  const homeCaptainPlayerId = cleanText(input.homeCaptainPlayerId)
  const homeCaptainPlayerName = cleanText(input.homeCaptainPlayerName)
  const awayCaptainPlayerId = cleanText(input.awayCaptainPlayerId)
  const awayCaptainPlayerName = cleanText(input.awayCaptainPlayerName)

  return {
    leagueExternalId: cleanText(input.leagueExternalId),
    leagueName: cleanText(input.leagueName),
    country: cleanText(input.country),
    season: toIntegerOrNull(input.season),
    round: cleanText(input.round),
    date: normalizeDateForStorage(input.date),
    homeTeam: cleanText(input.homeTeam),
    awayTeam: cleanText(input.awayTeam),
    homeLogo: cleanText(input.homeLogo),
    awayLogo: cleanText(input.awayLogo),
    goalsHome: toIntegerOrNull(input.goalsHome),
    goalsAway: toIntegerOrNull(input.goalsAway),
    homePenaltyScore: toIntegerOrNull(input.homePenaltyScore),
    awayPenaltyScore: toIntegerOrNull(input.awayPenaltyScore),
    minute: toIntegerOrNull(input.minute),
    statusShort: cleanText(input.statusShort),
    statusLong: cleanText(input.statusLong),
    venueName: cleanText(input.venueName),
    venueCity: cleanText(input.venueCity),
    referee: cleanText(input.referee),
    tv: cleanText(input.tv),
    broadcastLogoUrl: cleanText(input.broadcastLogoUrl),
    highlightsUrl: cleanText(input.highlightsUrl),
    highlightsTitle: cleanText(input.highlightsTitle),
    homeCaptainPlayerId,
    homeCaptainPlayerName,
    awayCaptainPlayerId,
    awayCaptainPlayerName,
    homePrimaryColor,
    homeSecondaryColor,
    homeNumberColor,
    homeGoalkeeperPrimaryColor,
    homeGoalkeeperSecondaryColor,
    homeGoalkeeperNumberColor,
    awayPrimaryColor,
    awaySecondaryColor,
    awayNumberColor,
    awayGoalkeeperPrimaryColor,
    awayGoalkeeperSecondaryColor,
    awayGoalkeeperNumberColor,
    teamKitColors: {
      home: {
        primary: homePrimaryColor,
        secondary: homeSecondaryColor,
        number: homeNumberColor,
        player: {
          primary: homePrimaryColor,
          secondary: homeSecondaryColor,
          number: homeNumberColor,
        },
        goalkeeper: {
          primary: homeGoalkeeperPrimaryColor,
          secondary: homeGoalkeeperSecondaryColor,
          number: homeGoalkeeperNumberColor,
        },
      },
      away: {
        primary: awayPrimaryColor,
        secondary: awaySecondaryColor,
        number: awayNumberColor,
        player: {
          primary: awayPrimaryColor,
          secondary: awaySecondaryColor,
          number: awayNumberColor,
        },
        goalkeeper: {
          primary: awayGoalkeeperPrimaryColor,
          secondary: awayGoalkeeperSecondaryColor,
          number: awayGoalkeeperNumberColor,
        },
      },
    },
    captains: {
      home: {
        playerId: homeCaptainPlayerId,
        playerName: homeCaptainPlayerName,
      },
      away: {
        playerId: awayCaptainPlayerId,
        playerName: awayCaptainPlayerName,
      },
    },
  }
}

async function getAdminMatchDetailOverridesByFixtureIds(fixtureExternalIds: string[]) {
  const ids = [
    ...new Set(
      fixtureExternalIds
        .map((id) => cleanText(id))
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const overridesByFixtureId = new Map<string, Record<string, unknown>>()

  if (!ids.length) return overridesByFixtureId

  const { data, error } = await getAdminClient()
    .from('admin_match_detail_overrides')
    .select('fixture_external_id, overrides, active')
    .in('fixture_external_id', ids)
    .eq('active', true)

  if (error) {
    if (isMissingOptionalMatchOverrideStore(error)) return overridesByFixtureId

    throw error
  }

  for (const row of (data ?? []) as AdminMatchDetailOverrideRow[]) {
    const overrides = asRecord(row.overrides)
    if (!row.fixture_external_id || !overrides) continue

    overridesByFixtureId.set(String(row.fixture_external_id), overrides)
  }

  return overridesByFixtureId
}

async function upsertAdminMatchDetailOverride(input: AdminMatchDetailsInput) {
  const fixtureExternalId = cleanText(input.fixtureExternalId)
  if (!fixtureExternalId) return

  const { error } = await getAdminClient()
    .from('admin_match_detail_overrides')
    .upsert(
      {
        fixture_external_id: fixtureExternalId,
        overrides: buildAdminMatchOverridePayload(input),
        active: true,
      },
      { onConflict: 'fixture_external_id' }
    )

  if (error) {
    if (isMissingOptionalMatchOverrideStore(error)) {
      console.warn('[admin-matches] Admin match detail overrides table is missing; cache update will still be saved.', {
        fixtureExternalId,
      })
      return
    }

    throw error
  }
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
    const overridesByFixtureId = await getAdminMatchDetailOverridesByFixtureIds(
      rows.map((row) => String(row.fixture_external_id))
    )
    const allFixtures = rows
      .map((row) => parseEditableMatch(row, overridesByFixtureId.get(String(row.fixture_external_id))))
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
    const selectedOverride =
      selectedRow && selectedFixtureId
        ? (await getAdminMatchDetailOverridesByFixtureIds([selectedFixtureId])).get(selectedFixtureId)
        : null
    const selectedMatch =
      selectedMatchFromList ??
      (selectedRow ? parseEditableMatch(selectedRow, selectedOverride) : null) ??
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

  await upsertAdminMatchDetailOverride(input)
  await updateStoredMatch(input)
}
