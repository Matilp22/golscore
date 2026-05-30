import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import { getArgentinaDateISO } from '@/shared/utils/argentina-time'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  match_date: string
  status: string | null
}

type LeagueRow = {
  id: DbId
  name: string | null
  external_id: DbId | null
  country?: string | null
}

type TeamRow = {
  id: DbId
  name: string | null
  external_id?: DbId | null
}

type BroadcastRow = {
  id?: string | null
  match_id: DbId
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
  created_by_rule_id?: string | null
}

export type BroadcastMatchRow = {
  match_id: DbId
  external_id: DbId | null
  league: string | null
  league_external_id: DbId | null
  country: string | null
  local: string | null
  visitante: string | null
  home_team_external_id?: DbId | null
  away_team_external_id?: DbId | null
  match_date: string
  status: string | null
  broadcasters: Array<{
    name: string
    logo_url: string | null
    country: string | null
    source?: string | null
    confidence?: string | null
    verified?: boolean | null
  }>
}

export type UpcomingBroadcastOptions = {
  dateFrom: string
  dateTo: string
  includeWithBroadcasts?: boolean
  limit?: number
}

export type UpsertBroadcastInput = {
  matchId?: string | number | null
  externalId?: string | number | null
  broadcasterName: string
  broadcasterLogoUrl?: string | null
  country?: string | null
}

export type BulkBroadcastInput = {
  leagueId?: string | number | null
  leagueExternalId?: string | number | null
  dateFrom: string
  dateTo: string
  broadcasterName: string
  broadcasterLogoUrl?: string | null
  country?: string | null
}

type BroadcastRuleRow = {
  id: string
  match_external_id?: string | null
  match_date?: string | null
  league_external_id: string | null
  league_name: string | null
  country: string | null
  home_team_external_id?: string | null
  away_team_external_id?: string | null
  home_team_name: string | null
  away_team_name: string | null
  broadcaster_name: string
  broadcaster_logo_url: string | null
  priority: number | null
  active: boolean | null
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
}

export type SyncBroadcastOptions = {
  dateFrom: string
  dateTo: string
  leagueExternalId?: string | number | null
  leagueName?: string | null
  limit?: number | null
}

export type SyncBroadcastResult = {
  matchesChecked: number
  rulesLoaded: number
  activeRules?: number
  verifiedRules?: number
  unverifiedRules?: number
  rules?: {
    verified: Array<ReturnType<typeof serializeBroadcastRuleForAudit>>
    unverified: Array<ReturnType<typeof serializeBroadcastRuleForAudit>>
    verificationSqlTemplate: string
  }
  broadcastsCreated: number
  broadcastsUpdated: number
  skipped: number
  skippedReasons?: Record<string, number>
  warnings?: string[]
  providerBroadcastsSaved?: number
  suggestions?: {
    pending: BroadcastRuleSuggestionRow[]
    approved: BroadcastRuleSuggestionRow[]
    rejected: BroadcastRuleSuggestionRow[]
  }
  sample: Array<{
    match_id: DbId
    external_id: DbId | null
    league_external_id?: DbId | null
    league: string | null
    local: string | null
    visitante: string | null
    applicableRules?: Array<{
      id: string
      broadcaster: string
      specificity: number
      priority: number | null
      source?: string | null
      confidence?: string | null
      verified?: boolean | null
    }>
    selectedRule?: string | null
    action?: 'created' | 'updated' | 'upserted' | 'skipped'
    skipReason?: string | null
    broadcasters: string[]
    rule_ids: string[]
    source?: string | null
    confidence?: string | null
    verified?: boolean | null
  }>
}

export type CleanupBroadcastDefaultsOptions = {
  dryRun?: boolean
  broadcasterName?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  leagueExternalId?: string | number | null
  limit?: number | null
}

export type VerifyBroadcastRuleInput = {
  ruleId: string
  verified?: boolean
  source?: string | null
  confidence?: string | null
}

export type ProviderBroadcast = {
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
  sourcePath: string
}

export type ProviderBroadcastsOptions = SyncBroadcastOptions & {
  includeApi?: boolean
  dryRun?: boolean
  force?: boolean
}

type ProviderBroadcastCacheRow = {
  fixture_external_id: string
  fixture_payload?: unknown
  payload?: unknown
  normalized_payload?: unknown
  updated_at?: string | null
}

type BroadcastRuleSuggestionRow = {
  id: string
  league_external_id: string | null
  league_name: string | null
  broadcaster_name: string
  broadcaster_logo_url: string | null
  evidence_count: number
  sample_match_ids: string[] | null
  confidence: string
  status: 'pending' | 'approved' | 'rejected' | string
  created_at?: string | null
  updated_at?: string | null
}

type ProviderBroadcastAuditItem = {
  matchId: DbId
  fixtureExternalId: DbId | null
  leagueExternalId: DbId | null
  leagueName: string | null
  home: string | null
  away: string | null
  matchDate: string
  providerBroadcasts: ProviderBroadcast[]
  cacheBroadcasts: ProviderBroadcast[]
  dbBroadcasts: Array<{
    name: string
    logoUrl: string | null
    country: string | null
    source?: string | null
    confidence?: string | null
    verified?: boolean | null
  }>
  canCreateMatchBroadcast: boolean
  warning: string | null
}

type SyncProviderBroadcastItem = ProviderBroadcastAuditItem & {
  action:
    | 'created'
    | 'updated'
    | 'unchanged'
    | 'skipped'
    | 'dry-run'
    | 'failed'
  status:
    | 'provider_broadcast_saved'
    | 'provider_broadcast_available'
    | 'manual_verified_exists'
    | 'no_broadcast_from_provider'
    | 'missing_fixture_external_id'
    | 'failed'
  wouldCreate: number
  stored: number
  errors: Array<{
    message: string
    code?: string | null
    detail?: string | null
    hint?: string | null
    source?: string | null
  }>
}

const BROADCAST_RULE_SQL_TEMPLATE = `-- Completar broadcaster_name con canales verificados antes de ejecutar.
insert into public.broadcast_rules (
  league_external_id,
  league_name,
  country,
  broadcaster_name,
  broadcaster_logo_url,
  priority,
  active,
  source,
  confidence,
  verified
) values
  ('128', 'Liga Profesional Argentina', 'Argentina', '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  (null, 'Primera Nacional', 'Argentina', '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  ('13', 'Copa Libertadores', null, '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  ('11', 'Copa Sudamericana', null, '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  (null, 'Copa Argentina', 'Argentina', '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  ('2', 'Champions League', null, '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  ('3', 'Europa League', null, '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true),
  ('848', 'Conference League', null, '<CANAL_VERIFICADO>', null, 100, true, 'manual', 'high', true);`

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getDateBoundary(date: string, endOfDay = false) {
  return `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00`
}

function normalizeText(value?: string | number | null) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTrustedBroadcastSource(value?: string | null) {
  return ['manual', 'verified_rule', 'official', 'provider', 'provider_suggestion_approved'].includes(
    normalizeText(value)
  )
}

function isHighConfidence(value?: string | null) {
  return normalizeText(value) === 'high'
}

function isTrustedBroadcastRow(row: BroadcastRow) {
  return row.verified === true && (
    isTrustedBroadcastSource(row.source) ||
    isHighConfidence(row.confidence)
  )
}

function isScopedBroadcastRule(rule: BroadcastRuleRow) {
  return Boolean(
    rule.match_external_id ||
    rule.league_external_id ||
    (rule.league_name && rule.country) ||
    rule.home_team_external_id ||
    rule.away_team_external_id ||
    rule.home_team_name ||
    rule.away_team_name
  )
}

function isTrustedBroadcastRule(rule: BroadcastRuleRow) {
  return (
    rule.active === true &&
    isScopedBroadcastRule(rule) &&
    rule.verified === true &&
    isTrustedBroadcastSource(rule.source) &&
    isHighConfidence(rule.confidence)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readProviderText(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function readProviderTextFromKeys(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const text = readProviderText(source[key])

    if (text) return text
  }

  return null
}

function readProviderCountry(value: unknown) {
  const direct = readProviderText(value)

  if (direct) return direct
  if (!isRecord(value)) return null

  return readProviderTextFromKeys(value, ['name', 'country', 'code'])
}

function isUsefulProviderBroadcastName(value: string) {
  const normalized = normalizeText(value)

  if (!normalized) return false
  if (/^https?:\/\//i.test(value.trim())) return false
  if (
    [
      'true',
      'false',
      'yes',
      'no',
      'si',
      'available',
      'not available',
      'coverage',
      'fixtures',
      'events',
      'lineups',
      'statistics',
      'tv',
      'broadcast',
      'broadcaster',
      'channel',
      'channels',
      'stream',
      'streaming',
      'media',
    ].includes(normalized)
  ) {
    return false
  }

  return true
}

const PROVIDER_BROADCAST_SOURCE_KEYS = [
  'broadcast',
  'broadcasts',
  'broadcaster',
  'broadcasters',
  'tv',
  'television',
  'channel',
  'channels',
  'media',
  'stream',
  'streaming',
  'platform',
  'platforms',
  'transmission',
  'transmissions',
]

function collectProviderBroadcastsFromValue(
  value: unknown,
  sourcePath: string
): ProviderBroadcast[] {
  if (value === null || value === undefined || typeof value === 'boolean') return []

  const directText = readProviderText(value)
  if (directText && isUsefulProviderBroadcastName(directText)) {
    return [{
      broadcaster_name: directText,
      broadcaster_logo_url: null,
      country: null,
      sourcePath,
    }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectProviderBroadcastsFromValue(item, `${sourcePath}[${index}]`)
    )
  }

  if (!isRecord(value)) return []

  const nestedNameSource =
    value.broadcaster ??
    value.broadcast ??
    value.channel ??
    value.network ??
    value.provider ??
    value.platform ??
    value.tv
  const nestedName =
    readProviderText(nestedNameSource) ||
    (isRecord(nestedNameSource)
      ? readProviderTextFromKeys(nestedNameSource, ['name', 'title', 'label'])
      : null)
  const directName =
    readProviderTextFromKeys(value, [
      'broadcaster_name',
      'broadcasterName',
      'name',
      'title',
      'label',
      'channel_name',
      'channelName',
      'network',
      'provider',
      'platform',
    ]) || nestedName
  const directLogo =
    readProviderTextFromKeys(value, [
      'broadcaster_logo_url',
      'broadcasterLogoUrl',
      'logo',
      'logo_url',
      'logoUrl',
      'image',
      'image_url',
      'imageUrl',
    ]) ||
    (isRecord(nestedNameSource)
      ? readProviderTextFromKeys(nestedNameSource, [
          'logo',
          'logo_url',
          'logoUrl',
          'image',
          'image_url',
          'imageUrl',
        ])
      : null)
  const directCountry = readProviderCountry(value.country)
  const matches: ProviderBroadcast[] =
    directName && isUsefulProviderBroadcastName(directName)
      ? [{
          broadcaster_name: directName,
          broadcaster_logo_url: directLogo,
          country: directCountry,
          sourcePath,
        }]
      : []

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    const shouldInspectChild = PROVIDER_BROADCAST_SOURCE_KEYS.some((candidate) =>
      normalizedKey.includes(candidate)
    )

    if (shouldInspectChild) {
      matches.push(...collectProviderBroadcastsFromValue(child, `${sourcePath}.${key}`))
    }
  }

  return matches
}

function getProviderPayloadRoots(payload: unknown) {
  const roots: Array<{ path: string; value: unknown }> = [{ path: 'payload', value: payload }]

  if (!isRecord(payload)) return roots

  const response = payload.response
  if (Array.isArray(response)) {
    response.forEach((item, index) => roots.push({ path: `payload.response[${index}]`, value: item }))
  } else if (response !== undefined) {
    roots.push({ path: 'payload.response', value: response })
  }

  const normalized = payload.normalized_payload
  if (isRecord(normalized)) {
    roots.push({ path: 'payload.normalized_payload', value: normalized })
    if (normalized.matchDetail !== undefined) {
      roots.push({
        path: 'payload.normalized_payload.matchDetail',
        value: normalized.matchDetail,
      })
    }
  }

  if (payload.matchDetail !== undefined) {
    roots.push({ path: 'payload.matchDetail', value: payload.matchDetail })
  }

  return roots
}

export function extractBroadcastsFromProviderPayload(payload: unknown): ProviderBroadcast[] {
  const byName = new Map<string, ProviderBroadcast>()

  for (const root of getProviderPayloadRoots(payload)) {
    const record = isRecord(root.value) ? root.value : null
    const fixture = isRecord(record?.fixture) ? record.fixture : null
    const league = isRecord(record?.league) ? record.league : null
    const sourceEntries: Array<[string, unknown]> = [
      [`${root.path}.broadcasts`, record?.broadcasts],
      [`${root.path}.broadcasters`, record?.broadcasters],
      [`${root.path}.broadcast`, record?.broadcast],
      [`${root.path}.tv`, record?.tv],
      [`${root.path}.television`, record?.television],
      [`${root.path}.channels`, record?.channels],
      [`${root.path}.channel`, record?.channel],
      [`${root.path}.media`, record?.media],
      [`${root.path}.streaming`, record?.streaming],
      [`${root.path}.platforms`, record?.platforms],
      [`${root.path}.platform`, record?.platform],
      [`${root.path}.coverage`, record?.coverage],
      [`${root.path}.fixture.broadcasts`, fixture?.broadcasts],
      [`${root.path}.fixture.broadcasters`, fixture?.broadcasters],
      [`${root.path}.fixture.broadcast`, fixture?.broadcast],
      [`${root.path}.fixture.tv`, fixture?.tv],
      [`${root.path}.fixture.television`, fixture?.television],
      [`${root.path}.fixture.channels`, fixture?.channels],
      [`${root.path}.fixture.channel`, fixture?.channel],
      [`${root.path}.fixture.media`, fixture?.media],
      [`${root.path}.league.broadcasts`, league?.broadcasts],
      [`${root.path}.league.broadcasters`, league?.broadcasters],
      [`${root.path}.league.tv`, league?.tv],
      [`${root.path}.league.media`, league?.media],
      [`${root.path}.league.coverage`, league?.coverage],
    ]

    for (const [path, value] of sourceEntries) {
      for (const broadcast of collectProviderBroadcastsFromValue(value, path)) {
        const normalizedName = normalizeText(broadcast.broadcaster_name)

        if (!normalizedName) continue

        const existing = byName.get(normalizedName)
        byName.set(normalizedName, {
          broadcaster_name: existing?.broadcaster_name ?? broadcast.broadcaster_name,
          broadcaster_logo_url:
            existing?.broadcaster_logo_url ?? broadcast.broadcaster_logo_url,
          country: existing?.country ?? broadcast.country,
          sourcePath: existing?.sourcePath ?? broadcast.sourcePath,
        })
      }
    }
  }

  return [...byName.values()]
}

function isMissingBroadcastsTable(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('match_broadcasts') ||
    message.includes('schema cache')
  )
}

async function fetchRowsByIds<T extends { id: DbId }>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  ids: DbId[]
) {
  const rows: T[] = []
  const uniqueIds = [...new Set(ids.map(String))]

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await supabase
      .from(table)
      .select(select)
      .in('id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as unknown as T[]))
  }

  return rows
}

async function fetchBroadcastsByMatchIds(
  supabase: SupabaseClient,
  matchIds: DbId[]
) {
  const rows: BroadcastRow[] = []
  const uniqueIds = [...new Set(matchIds.map(String))]

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await supabase
      .from('match_broadcasts')
      .select('id, match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified, created_by_rule_id')
      .in('match_id', chunk)
      .order('broadcaster_name', { ascending: true })

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingTrustColumns =
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        message.includes('source') ||
        message.includes('confidence') ||
        message.includes('verified') ||
        message.includes('created_by_rule_id') ||
        message.includes('schema cache')

      if (isMissingTrustColumns) {
        const fallback = await supabase
          .from('match_broadcasts')
          .select('id, match_id, broadcaster_name, broadcaster_logo_url, country')
          .in('match_id', chunk)
          .order('broadcaster_name', { ascending: true })

        if (fallback.error) {
          if (isMissingBroadcastsTable(fallback.error)) {
            return { rows: [], tableExists: false }
          }

          throw fallback.error
        }

        rows.push(...(((fallback.data ?? []) as BroadcastRow[]).filter(isTrustedBroadcastRow)))
        continue
      }

      if (isMissingBroadcastsTable(response.error)) {
        return { rows: [], tableExists: false }
      }

      throw response.error
    }

    rows.push(...(((response.data ?? []) as BroadcastRow[]).filter(isTrustedBroadcastRow)))
  }

  return { rows, tableExists: true }
}

function mapMatchesWithContext(
  matches: MatchRow[],
  leagues: LeagueRow[],
  teams: TeamRow[],
  broadcasts: BroadcastRow[]
): BroadcastMatchRow[] {
  const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
  const teamsById = new Map(teams.map((team) => [String(team.id), team]))
  const broadcastsByMatchId = broadcasts.reduce<Map<string, BroadcastRow[]>>(
    (accumulator, broadcast) => {
      const matchId = String(broadcast.match_id)
      const current = accumulator.get(matchId) ?? []

      current.push(broadcast)
      accumulator.set(matchId, current)

      return accumulator
    },
    new Map()
  )

  return matches.map((match) => {
    const league = match.league_id ? leaguesById.get(String(match.league_id)) : null
    const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
    const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
    const matchBroadcasts = broadcastsByMatchId.get(String(match.id)) ?? []

    return {
      match_id: match.id,
      external_id: match.external_id,
      league: league?.name ?? null,
      league_external_id: league?.external_id ?? null,
      country: league?.country ?? null,
      local: homeTeam?.name ?? null,
      visitante: awayTeam?.name ?? null,
      home_team_external_id: homeTeam?.external_id ?? null,
      away_team_external_id: awayTeam?.external_id ?? null,
      match_date: match.match_date,
      status: match.status,
      broadcasters: matchBroadcasts.map((broadcast) => ({
        name: broadcast.broadcaster_name,
        logo_url: broadcast.broadcaster_logo_url,
        country: broadcast.country,
        source: broadcast.source,
        confidence: broadcast.confidence,
        verified: broadcast.verified,
      })),
    }
  })
}

async function fetchBroadcastRules(supabase: SupabaseClient) {
  const response = await supabase
    .from('broadcast_rules')
    .select('id, match_external_id, match_date, league_external_id, league_name, country, home_team_external_id, away_team_external_id, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active, source, confidence, verified')
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingSpecificRuleColumn =
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      message.includes('match_external_id') ||
      message.includes('match_date') ||
      message.includes('home_team_external_id') ||
      message.includes('away_team_external_id') ||
      message.includes('source') ||
      message.includes('confidence') ||
      message.includes('verified') ||
      message.includes('schema cache')

    if (isMissingSpecificRuleColumn) {
      const fallback = await supabase
        .from('broadcast_rules')
        .select('id, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active')
        .eq('active', true)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      if (fallback.error) {
        const fallbackMessage = fallback.error.message.toLowerCase()
        const isMissingRulesTable =
          fallback.error.code === '42P01' ||
          fallback.error.code === 'PGRST205' ||
          fallbackMessage.includes('broadcast_rules')

        if (isMissingRulesTable) return []
        throw fallback.error
      }

      return (fallback.data ?? []) as BroadcastRuleRow[]
    }

    const isMissingRulesTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('broadcast_rules')

    if (isMissingRulesTable) return []

    throw response.error
  }

  return (response.data ?? []) as BroadcastRuleRow[]
}

function textRuleMatches(ruleValue: string | null, actualValue: string | null) {
  if (!ruleValue) return true

  const ruleText = normalizeText(ruleValue)
  const actualText = normalizeText(actualValue)

  if (!ruleText || !actualText) return false

  return actualText.includes(ruleText) || ruleText.includes(actualText)
}

function teamRuleMatches(ruleTeam: string | null, match: BroadcastMatchRow) {
  if (!ruleTeam) return true

  return (
    textRuleMatches(ruleTeam, match.local) ||
    textRuleMatches(ruleTeam, match.visitante)
  )
}

function externalIdRuleMatches(ruleValue: string | null | undefined, actualValue: DbId | null | undefined) {
  if (!ruleValue) return true

  return String(ruleValue) === String(actualValue ?? '')
}

function getBroadcastRuleMismatchReason(rule: BroadcastRuleRow, match: BroadcastMatchRow) {
  if (
    rule.match_external_id &&
    String(rule.match_external_id) !== String(match.external_id ?? '')
  ) {
    return 'no_match_external_id'
  }

  if (
    rule.match_date &&
    getArgentinaDateISO(match.match_date) !== getArgentinaDateISO(rule.match_date)
  ) {
    return 'no_match_date'
  }

  if (
    rule.league_external_id &&
    String(rule.league_external_id) !== String(match.league_external_id ?? '')
  ) {
    return match.league_external_id === null || match.league_external_id === undefined
      ? 'missing_league_external_id'
      : 'no_matching_league'
  }

  if (!textRuleMatches(rule.league_name, match.league)) return 'no_matching_league'
  if (!textRuleMatches(rule.country, match.country)) return 'no_country_match'
  if (!externalIdRuleMatches(rule.home_team_external_id, match.home_team_external_id)) {
    return 'no_matching_team'
  }
  if (!externalIdRuleMatches(rule.away_team_external_id, match.away_team_external_id)) {
    return 'no_matching_team'
  }
  if (!teamRuleMatches(rule.home_team_name, match)) return 'no_matching_team'
  if (!teamRuleMatches(rule.away_team_name, match)) return 'no_matching_team'

  return null
}

function broadcastRuleMatches(rule: BroadcastRuleRow, match: BroadcastMatchRow) {
  return getBroadcastRuleMismatchReason(rule, match) === null
}

function getMatchingBroadcastRules(rules: BroadcastRuleRow[], match: BroadcastMatchRow) {
  return rules.filter((rule) => broadcastRuleMatches(rule, match))
}

function getRuleSpecificity(rule: BroadcastRuleRow) {
  if (rule.match_external_id) return 0
  if (
    (rule.home_team_external_id && rule.away_team_external_id) ||
    (rule.home_team_name && rule.away_team_name)
  ) return 1
  if (
    rule.home_team_external_id ||
    rule.away_team_external_id ||
    rule.home_team_name ||
    rule.away_team_name
  ) return 2
  if (rule.league_external_id || rule.league_name) return 3
  if (rule.country) return 4
  return 5
}

function getBestMatchingRules(rules: BroadcastRuleRow[], match: BroadcastMatchRow) {
  const matchingRules = getMatchingBroadcastRules(rules, match)
    .filter(isTrustedBroadcastRule)
    .sort((a, b) => {
      const specificityCompare = getRuleSpecificity(a) - getRuleSpecificity(b)
      if (specificityCompare !== 0) return specificityCompare
      return (a.priority ?? 100) - (b.priority ?? 100)
    })

  if (!matchingRules.length) return []

  const bestSpecificity = getRuleSpecificity(matchingRules[0])
  const bestPriority = matchingRules[0]?.priority ?? 100

  const bestRules = matchingRules.filter((rule) =>
    getRuleSpecificity(rule) === bestSpecificity &&
    (rule.priority ?? 100) === bestPriority
  )

  return [
    ...bestRules.reduce<Map<string, BroadcastRuleRow>>((accumulator, rule) => {
      const key = normalizeText(rule.broadcaster_name)

      if (!accumulator.has(key)) accumulator.set(key, rule)

      return accumulator
    }, new Map()).values(),
  ]
}

function getBroadcastSkipReason(rules: BroadcastRuleRow[], match: BroadcastMatchRow) {
  if (!match.match_id) return 'missing_match_id'
  if (!rules.length) return 'no_active_rules'

  const matchingRules = getMatchingBroadcastRules(rules, match)

  if (matchingRules.length && !matchingRules.some(isTrustedBroadcastRule)) {
    return 'unverified_rule'
  }

  const reasonCounts = rules.reduce<Record<string, number>>((accumulator, rule) => {
    const reason = getBroadcastRuleMismatchReason(rule, match)

    if (reason) accumulator[reason] = (accumulator[reason] ?? 0) + 1

    return accumulator
  }, {})
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])

  return sortedReasons[0]?.[0] ?? 'no_applicable_rule'
}

function getBroadcastRuleStats(rules: BroadcastRuleRow[]) {
  const verifiedRules = rules.filter(isTrustedBroadcastRule).length

  return {
    activeRules: rules.length,
    verifiedRules,
    unverifiedRules: rules.length - verifiedRules,
  }
}

function buildManualRuleVerificationSql(ruleIdPlaceholder = '<RULE_ID>') {
  return `update public.broadcast_rules
set verified = true,
    source = 'manual',
    confidence = 'high'
where id = '${ruleIdPlaceholder}';`
}

function serializeBroadcastRuleForAudit(rule: BroadcastRuleRow) {
  return {
    id: rule.id,
    broadcaster_name: rule.broadcaster_name,
    league_external_id: rule.league_external_id,
    league_name: rule.league_name,
    country: rule.country,
    home_team_external_id: rule.home_team_external_id ?? null,
    away_team_external_id: rule.away_team_external_id ?? null,
    home_team_name: rule.home_team_name,
    away_team_name: rule.away_team_name,
    priority: rule.priority,
    active: rule.active,
    source: rule.source ?? null,
    confidence: rule.confidence ?? null,
    verified: rule.verified === true,
    scoped: isScopedBroadcastRule(rule),
    trusted: isTrustedBroadcastRule(rule),
    verificationSql: buildManualRuleVerificationSql(rule.id),
  }
}

function normalizeRuleSource(value?: string | null) {
  const normalized = normalizeText(value)
  if (['manual', 'verified_rule', 'official', 'provider_suggestion_approved'].includes(normalized)) {
    return normalized
  }

  return 'manual'
}

function normalizeRuleConfidence(value?: string | null) {
  const normalized = normalizeText(value)
  if (['high', 'medium', 'low'].includes(normalized)) return normalized

  return 'high'
}

export async function verifyBroadcastRule(
  supabase: SupabaseClient,
  input: VerifyBroadcastRuleInput
) {
  const ruleId = input.ruleId?.trim()
  if (!ruleId) {
    return {
      ok: false,
      error: 'missing_rule_id',
      message: 'Debe indicar ruleId.',
    }
  }

  const patch = {
    verified: input.verified ?? true,
    source: normalizeRuleSource(input.source),
    confidence: normalizeRuleConfidence(input.confidence),
  }
  const response = await supabase
    .from('broadcast_rules')
    .update(patch)
    .eq('id', ruleId)
    .select('id, match_external_id, match_date, league_external_id, league_name, country, home_team_external_id, away_team_external_id, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active, source, confidence, verified')
    .maybeSingle()

  if (response.error) throw response.error
  if (!response.data) {
    return {
      ok: false,
      error: 'rule_not_found',
      message: `No se encontro broadcast_rule ${ruleId}.`,
    }
  }

  const rule = response.data as BroadcastRuleRow

  return {
    ok: true,
    rule: serializeBroadcastRuleForAudit(rule),
    willApplyAutomatically: isTrustedBroadcastRule(rule),
    nextStep:
      'Ejecutar /api/admin/sync-upcoming-match-info o /api/admin/broadcast-rules-audit para validar partidos afectados.',
  }
}

async function fetchBroadcastRuleSuggestions(supabase: SupabaseClient) {
  const response = await supabase
    .from('broadcast_rule_suggestions')
    .select('id, league_external_id, league_name, broadcaster_name, broadcaster_logo_url, evidence_count, sample_match_ids, confidence, status, created_at, updated_at')
    .order('evidence_count', { ascending: false })
    .order('updated_at', { ascending: false })

  if (response.error) {
    if (isMissingOptionalProviderCache(response.error)) return []
    throw response.error
  }

  return (response.data ?? []) as BroadcastRuleSuggestionRow[]
}

export async function getBroadcastRuleSuggestions(supabase: SupabaseClient) {
  const suggestions = await fetchBroadcastRuleSuggestions(supabase)

  return {
    ok: true,
    pending: suggestions.filter((suggestion) => suggestion.status === 'pending'),
    approved: suggestions.filter((suggestion) => suggestion.status === 'approved'),
    rejected: suggestions.filter((suggestion) => suggestion.status === 'rejected'),
    items: suggestions,
  }
}

export async function approveBroadcastRuleSuggestion(
  supabase: SupabaseClient,
  input: {
    suggestionId?: string | null
    approved?: boolean
  }
) {
  const suggestionId = input.suggestionId?.trim()
  if (!suggestionId) {
    return {
      ok: false,
      error: 'missing_suggestion_id',
      message: 'Debe indicar suggestionId.',
    }
  }

  const suggestionResponse = await supabase
    .from('broadcast_rule_suggestions')
    .select('id, league_external_id, league_name, broadcaster_name, broadcaster_logo_url, evidence_count, sample_match_ids, confidence, status, created_at, updated_at')
    .eq('id', suggestionId)
    .maybeSingle()

  if (suggestionResponse.error) throw suggestionResponse.error
  if (!suggestionResponse.data) {
    return {
      ok: false,
      error: 'suggestion_not_found',
      message: `No se encontro broadcast_rule_suggestion ${suggestionId}.`,
    }
  }

  const suggestion = suggestionResponse.data as BroadcastRuleSuggestionRow
  const approved = input.approved ?? true
  const status = approved ? 'approved' : 'rejected'
  const updateResponse = await supabase
    .from('broadcast_rule_suggestions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', suggestionId)

  if (updateResponse.error) throw updateResponse.error

  if (!approved) {
    return {
      ok: true,
      status,
      suggestion,
      rule: null,
    }
  }

  const ruleResponse = await supabase
    .from('broadcast_rules')
    .insert({
      league_external_id: suggestion.league_external_id,
      league_name: suggestion.league_name,
      country: null,
      broadcaster_name: suggestion.broadcaster_name,
      broadcaster_logo_url: suggestion.broadcaster_logo_url,
      priority: 100,
      active: true,
      source: 'provider_suggestion_approved',
      confidence: 'high',
      verified: true,
    })
    .select('id, match_external_id, match_date, league_external_id, league_name, country, home_team_external_id, away_team_external_id, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active, source, confidence, verified')
    .single()

  if (ruleResponse.error) throw ruleResponse.error

  const rule = ruleResponse.data as BroadcastRuleRow

  return {
    ok: true,
    status,
    suggestion,
    rule: serializeBroadcastRuleForAudit(rule),
    willApplyAutomatically: isTrustedBroadcastRule(rule),
  }
}

export async function seedBroadcastRules(supabase: SupabaseClient) {
  const existingRules = await fetchBroadcastRules(supabase)

  return {
    ok: true,
    inserted: 0,
    skippedExisting: existingRules.length,
    rules: [],
    templates: {
      note: 'No se cargaron canales por defecto. Completar <CANAL_VERIFICADO> y ejecutar manualmente solo con datos confiables.',
      sql: BROADCAST_RULE_SQL_TEMPLATE,
    },
  }
}

async function hydrateBroadcastMatches(
  supabase: SupabaseClient,
  matches: MatchRow[],
  includeWithBroadcasts: boolean
) {
  const leagueIds = matches
    .map((match) => match.league_id)
    .filter((id): id is DbId => id !== null)
  const teamIds = matches
    .flatMap((match) => [match.home_team_id, match.away_team_id])
    .filter((id): id is DbId => id !== null)
  const [leagues, teams, broadcastResult] = await Promise.all([
    leagueIds.length
      ? fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id, country', leagueIds)
      : Promise.resolve([]),
    teamIds.length
      ? fetchRowsByIds<TeamRow>(supabase, 'teams', 'id, name, external_id', teamIds)
      : Promise.resolve([]),
    matches.length
      ? fetchBroadcastsByMatchIds(supabase, matches.map((match) => match.id))
      : Promise.resolve({ rows: [], tableExists: true }),
  ])
  const rows = mapMatchesWithContext(matches, leagues, teams, broadcastResult.rows)

  return {
    tableExists: broadcastResult.tableExists,
    matches: includeWithBroadcasts
      ? rows
      : rows.filter((match) => match.broadcasters.length === 0),
  }
}

export async function getUpcomingMatchesWithoutBroadcasts(
  supabase: SupabaseClient,
  options: UpcomingBroadcastOptions
) {
  const limit = Math.min(Math.max(options.limit ?? 150, 1), 500)
  const response = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .gte('match_date', getDateBoundary(options.dateFrom))
    .lte('match_date', getDateBoundary(options.dateTo, true))
    .order('match_date', { ascending: true })
    .limit(limit)

  if (response.error) throw response.error

  return hydrateBroadcastMatches(
    supabase,
    (response.data ?? []) as MatchRow[],
    Boolean(options.includeWithBroadcasts)
  )
}

async function fetchBroadcastMatchesInRange(
  supabase: SupabaseClient,
  options: SyncBroadcastOptions
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500)
  const response = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .gte('match_date', getDateBoundary(options.dateFrom))
    .lte('match_date', getDateBoundary(options.dateTo, true))
    .order('match_date', { ascending: true })
    .limit(limit)

  if (response.error) throw response.error

  const hydrated = await hydrateBroadcastMatches(
    supabase,
    (response.data ?? []) as MatchRow[],
    true
  )
  const normalizedLeagueName = normalizeText(options.leagueName)

  return hydrated.matches.filter((match) => {
    if (
      options.leagueExternalId &&
      String(match.league_external_id ?? '') !== String(options.leagueExternalId)
    ) {
      return false
    }

    if (normalizedLeagueName && !normalizeText(match.league).includes(normalizedLeagueName)) {
      return false
    }

    return true
  })
}

function isMissingOptionalProviderCache(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (
      message.includes('schema cache') &&
      (
        message.includes('football_match_detail_cache') ||
        message.includes('football_fixture_cache') ||
        message.includes('broadcast_rule_suggestions')
      )
    )
  )
}

async function fetchDetailCacheBroadcastPayloads(
  supabase: SupabaseClient,
  fixtureExternalIds: DbId[]
) {
  const rows: ProviderBroadcastCacheRow[] = []
  const uniqueIds = [...new Set(fixtureExternalIds.map(String))]

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await supabase
      .from('football_match_detail_cache')
      .select('fixture_external_id, fixture_payload, updated_at')
      .in('fixture_external_id', chunk)

    if (response.error) {
      if (isMissingOptionalProviderCache(response.error)) continue
      throw response.error
    }

    rows.push(...((response.data ?? []) as ProviderBroadcastCacheRow[]))
  }

  return rows.reduce<Map<string, ProviderBroadcastCacheRow>>((accumulator, row) => {
    const key = String(row.fixture_external_id)
    const previous = accumulator.get(key)

    if (!previous || String(row.updated_at ?? '') > String(previous.updated_at ?? '')) {
      accumulator.set(key, row)
    }

    return accumulator
  }, new Map())
}

async function fetchFixtureCacheBroadcastPayloads(
  supabase: SupabaseClient,
  fixtureExternalIds: DbId[]
) {
  const rows: ProviderBroadcastCacheRow[] = []
  const uniqueIds = [...new Set(fixtureExternalIds.map(String))]

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await supabase
      .from('football_fixture_cache')
      .select('fixture_external_id, payload, normalized_payload, updated_at')
      .in('fixture_external_id', chunk)
      .order('updated_at', { ascending: false })

    if (response.error) {
      if (isMissingOptionalProviderCache(response.error)) continue
      throw response.error
    }

    rows.push(...((response.data ?? []) as ProviderBroadcastCacheRow[]))
  }

  return rows.reduce<Map<string, ProviderBroadcastCacheRow>>((accumulator, row) => {
    const key = String(row.fixture_external_id)
    const previous = accumulator.get(key)

    if (!previous || String(row.updated_at ?? '') > String(previous.updated_at ?? '')) {
      accumulator.set(key, row)
    }

    return accumulator
  }, new Map())
}

function mergeProviderBroadcasts(groups: ProviderBroadcast[][]) {
  return [
    ...groups.flat().reduce<Map<string, ProviderBroadcast>>((accumulator, broadcast) => {
      const key = normalizeText(broadcast.broadcaster_name)
      if (!key) return accumulator
      const previous = accumulator.get(key)

      accumulator.set(key, {
        broadcaster_name: previous?.broadcaster_name ?? broadcast.broadcaster_name,
        broadcaster_logo_url:
          previous?.broadcaster_logo_url ?? broadcast.broadcaster_logo_url,
        country: previous?.country ?? broadcast.country,
        sourcePath: previous?.sourcePath ?? broadcast.sourcePath,
      })

      return accumulator
    }, new Map()).values(),
  ]
}

function extractCacheBroadcastsForMatch(
  match: BroadcastMatchRow,
  detailPayloads: Map<string, ProviderBroadcastCacheRow>,
  fixturePayloads: Map<string, ProviderBroadcastCacheRow>
) {
  const fixtureId = match.external_id === null || match.external_id === undefined
    ? null
    : String(match.external_id)
  if (!fixtureId) return []

  const detail = detailPayloads.get(fixtureId)
  const fixture = fixturePayloads.get(fixtureId)

  return mergeProviderBroadcasts([
    extractBroadcastsFromProviderPayload(detail?.fixture_payload),
    extractBroadcastsFromProviderPayload(fixture?.payload),
    extractBroadcastsFromProviderPayload(fixture?.normalized_payload),
  ])
}

async function fetchProviderFixturePayload(fixtureExternalId: DbId) {
  const { payload } = await requestFootballApi<unknown[]>(
    '/fixtures',
    { id: fixtureExternalId },
    { logContext: `provider-broadcasts:${fixtureExternalId}` }
  )

  return {
    payload,
    fixture: Array.isArray(payload.response) ? payload.response[0] ?? null : null,
  }
}

function mapDbBroadcasts(match: BroadcastMatchRow): ProviderBroadcastAuditItem['dbBroadcasts'] {
  return match.broadcasters.map((broadcast) => ({
    name: broadcast.name,
    logoUrl: broadcast.logo_url,
    country: broadcast.country,
    source: broadcast.source,
    confidence: broadcast.confidence,
    verified: broadcast.verified,
  }))
}

function getBroadcastCandidates(input: {
  providerBroadcasts: ProviderBroadcast[]
  cacheBroadcasts: ProviderBroadcast[]
}) {
  return input.providerBroadcasts.length ? input.providerBroadcasts : input.cacheBroadcasts
}

function getNewProviderBroadcasts(
  match: BroadcastMatchRow,
  candidates: ProviderBroadcast[],
  force = false
) {
  const existingTrusted = new Set(
    match.broadcasters.map((broadcast) => normalizeText(broadcast.name))
  )

  if (force) return candidates

  return candidates.filter((broadcast) =>
    !existingTrusted.has(normalizeText(broadcast.broadcaster_name))
  )
}

function buildProviderAuditItem(input: {
  match: BroadcastMatchRow
  providerBroadcasts: ProviderBroadcast[]
  cacheBroadcasts: ProviderBroadcast[]
  apiWarning: string | null
}) {
  const candidates = getBroadcastCandidates(input)
  const newBroadcasts = getNewProviderBroadcasts(input.match, candidates)
  const warning =
    input.apiWarning ??
    (!candidates.length
      ? 'no_broadcast_from_provider'
      : !newBroadcasts.length
        ? 'manual_verified_exists'
        : null)

  return {
    matchId: input.match.match_id,
    fixtureExternalId: input.match.external_id,
    leagueExternalId: input.match.league_external_id,
    leagueName: input.match.league,
    home: input.match.local,
    away: input.match.visitante,
    matchDate: input.match.match_date,
    providerBroadcasts: input.providerBroadcasts,
    cacheBroadcasts: input.cacheBroadcasts,
    dbBroadcasts: mapDbBroadcasts(input.match),
    canCreateMatchBroadcast: newBroadcasts.length > 0,
    warning,
  } satisfies ProviderBroadcastAuditItem
}

export async function auditProviderBroadcasts(
  supabase: SupabaseClient,
  options: ProviderBroadcastsOptions
) {
  const matches = await fetchBroadcastMatchesInRange(supabase, options)
  const fixtureExternalIds = matches
    .map((match) => match.external_id)
    .filter((id): id is DbId => id !== null && id !== undefined)
  const [detailPayloads, fixturePayloads] = await Promise.all([
    fetchDetailCacheBroadcastPayloads(supabase, fixtureExternalIds),
    fetchFixtureCacheBroadcastPayloads(supabase, fixtureExternalIds),
  ])
  const items: ProviderBroadcastAuditItem[] = []
  let apiRequests = 0

  for (const match of matches) {
    const cacheBroadcasts = extractCacheBroadcastsForMatch(match, detailPayloads, fixturePayloads)
    let providerBroadcasts: ProviderBroadcast[] = []
    let apiWarning: string | null = null

    if (options.includeApi && match.external_id !== null && match.external_id !== undefined) {
      try {
        const apiPayload = await fetchProviderFixturePayload(match.external_id)
        apiRequests += 1
        providerBroadcasts = extractBroadcastsFromProviderPayload(apiPayload.payload)
      } catch (error) {
        apiWarning = error instanceof Error
          ? `api_error: ${error.message}`
          : 'api_error: unknown'
      }
    } else if (options.includeApi) {
      apiWarning = 'missing_fixture_external_id'
    }

    items.push(buildProviderAuditItem({
      match,
      providerBroadcasts,
      cacheBroadcasts,
      apiWarning,
    }))
  }

  return {
    ok: true,
    matchesChecked: items.length,
    apiRequests,
    providerWithBroadcasts: items.filter((item) => item.providerBroadcasts.length > 0).length,
    cacheWithBroadcasts: items.filter((item) => item.cacheBroadcasts.length > 0).length,
    dbWithBroadcasts: items.filter((item) => item.dbBroadcasts.length > 0).length,
    noBroadcastData: items.filter((item) =>
      !item.providerBroadcasts.length && !item.cacheBroadcasts.length && !item.dbBroadcasts.length
    ).length,
    sample: items.slice(0, 30),
    items,
  }
}

async function upsertProviderBroadcasts(
  supabase: SupabaseClient,
  matchId: DbId,
  broadcasts: ProviderBroadcast[]
) {
  if (!broadcasts.length) return []

  const payload = broadcasts.map((broadcast) => ({
    match_id: matchId,
    broadcaster_name: broadcast.broadcaster_name,
    broadcaster_logo_url: broadcast.broadcaster_logo_url,
    country: broadcast.country,
    source: 'provider',
    confidence: 'high',
    verified: true,
    created_by_rule_id: null,
  }))
  const response = await supabase
    .from('match_broadcasts')
    .upsert(payload, { onConflict: 'match_id,broadcaster_name' })
    .select('match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified, created_by_rule_id')

  if (response.error) throw response.error

  return (response.data ?? []) as BroadcastRow[]
}

function buildSuggestionEvidence(items: SyncProviderBroadcastItem[]) {
  const groups = new Map<string, {
    leagueExternalId: string | null
    leagueName: string | null
    broadcaster: ProviderBroadcast
    matchIds: Set<string>
  }>()

  for (const item of items) {
    if (!['provider_broadcast_saved', 'provider_broadcast_available'].includes(item.status)) {
      continue
    }

    const candidates = getBroadcastCandidates(item)
    for (const broadcast of candidates) {
      const key = `${String(item.leagueExternalId ?? '')}::${normalizeText(broadcast.broadcaster_name)}`
      const current = groups.get(key) ?? {
        leagueExternalId: item.leagueExternalId === null || item.leagueExternalId === undefined
          ? null
          : String(item.leagueExternalId),
        leagueName: item.leagueName,
        broadcaster: broadcast,
        matchIds: new Set<string>(),
      }

      current.matchIds.add(String(item.matchId))
      groups.set(key, current)
    }
  }

  return [...groups.values()].filter((group) => group.matchIds.size >= 3)
}

async function upsertBroadcastRuleSuggestions(
  supabase: SupabaseClient,
  items: SyncProviderBroadcastItem[]
) {
  const evidence = buildSuggestionEvidence(items)

  if (!evidence.length) {
    return { createdOrUpdated: 0, skipped: 0, warnings: [] as string[] }
  }

  const payload = evidence.map((group) => ({
    league_external_id: group.leagueExternalId,
    league_name: group.leagueName,
    broadcaster_name: group.broadcaster.broadcaster_name,
    broadcaster_logo_url: group.broadcaster.broadcaster_logo_url,
    evidence_count: group.matchIds.size,
    sample_match_ids: [...group.matchIds].slice(0, 20),
    confidence: group.matchIds.size >= 5 ? 'high' : 'medium',
    status: 'pending',
    updated_at: new Date().toISOString(),
  }))
  const response = await supabase
    .from('broadcast_rule_suggestions')
    .upsert(payload, { onConflict: 'league_external_id,broadcaster_name' })
    .select('id')

  if (response.error) {
    if (isMissingOptionalProviderCache(response.error)) {
      return {
        createdOrUpdated: 0,
        skipped: payload.length,
        warnings: ['broadcast_rule_suggestions no existe; se omitieron sugerencias pendientes.'],
      }
    }

    throw response.error
  }

  return {
    createdOrUpdated: response.data?.length ?? payload.length,
    skipped: 0,
    warnings: [] as string[],
  }
}

export async function syncProviderBroadcasts(
  supabase: SupabaseClient,
  options: ProviderBroadcastsOptions
) {
  const audit = await auditProviderBroadcasts(supabase, options)
  const dryRun = options.dryRun !== false
  const items: SyncProviderBroadcastItem[] = []
  const errors: SyncProviderBroadcastItem['errors'] = []
  let checked = 0
  let found = 0
  let stored = 0
  let skipped = 0

  for (const item of audit.items) {
    checked += 1
    const candidates = getBroadcastCandidates(item)
    const newBroadcasts = getNewProviderBroadcasts(
      {
        match_id: item.matchId,
        external_id: item.fixtureExternalId,
        league_external_id: item.leagueExternalId,
        league: item.leagueName,
        country: null,
        local: item.home,
        visitante: item.away,
        match_date: item.matchDate,
        status: null,
        broadcasters: item.dbBroadcasts.map((broadcast) => ({
          name: broadcast.name,
          logo_url: broadcast.logoUrl,
          country: broadcast.country,
          source: broadcast.source,
          confidence: broadcast.confidence,
          verified: broadcast.verified,
        })),
      },
      candidates,
      Boolean(options.force)
    )
    const itemErrors: SyncProviderBroadcastItem['errors'] = []

    if (!candidates.length) {
      skipped += 1
      items.push({
        ...item,
        action: 'skipped',
        status: item.fixtureExternalId === null || item.fixtureExternalId === undefined
          ? 'missing_fixture_external_id'
          : 'no_broadcast_from_provider',
        wouldCreate: 0,
        stored: 0,
        errors: itemErrors,
      })
      continue
    }

    found += candidates.length

    if (!newBroadcasts.length) {
      skipped += 1
      items.push({
        ...item,
        action: 'skipped',
        status: 'manual_verified_exists',
        wouldCreate: 0,
        stored: 0,
        errors: itemErrors,
      })
      continue
    }

    if (dryRun) {
      items.push({
        ...item,
        action: 'dry-run',
        status: 'provider_broadcast_available',
        wouldCreate: newBroadcasts.length,
        stored: 0,
        errors: itemErrors,
      })
      continue
    }

    try {
      const rows = await upsertProviderBroadcasts(supabase, item.matchId, newBroadcasts)
      stored += rows.length
      items.push({
        ...item,
        dbBroadcasts: [
          ...item.dbBroadcasts,
          ...rows.map((row) => ({
            name: row.broadcaster_name,
            logoUrl: row.broadcaster_logo_url,
            country: row.country,
            source: row.source,
            confidence: row.confidence,
            verified: row.verified,
          })),
        ],
        action: item.dbBroadcasts.length ? 'updated' : 'created',
        status: 'provider_broadcast_saved',
        wouldCreate: newBroadcasts.length,
        stored: rows.length,
        errors: itemErrors,
      })
    } catch (error) {
      const serialized = {
        message: error instanceof Error ? error.message : String(error),
        code: isRecord(error) && typeof error.code === 'string' ? error.code : null,
        detail: isRecord(error) && typeof error.details === 'string' ? error.details : null,
        hint: isRecord(error) && typeof error.hint === 'string' ? error.hint : null,
        source: 'supabase',
      }

      errors.push(serialized)
      itemErrors.push(serialized)
      items.push({
        ...item,
        action: 'failed',
        status: 'failed',
        wouldCreate: newBroadcasts.length,
        stored: 0,
        errors: itemErrors,
      })
    }
  }

  const suggestions = dryRun
    ? { createdOrUpdated: 0, skipped: 0, warnings: [] as string[] }
    : await upsertBroadcastRuleSuggestions(supabase, items)

  return {
    ok: errors.length === 0,
    dryRun,
    matchesChecked: checked,
    providerWithBroadcasts: audit.providerWithBroadcasts,
    cacheWithBroadcasts: audit.cacheWithBroadcasts,
    dbWithBroadcasts: audit.dbWithBroadcasts,
    broadcastersFound: found,
    broadcastersStored: stored,
    skipped,
    suggestions,
    errors,
    sample: items.slice(0, 30),
    items,
  }
}

async function resolveMatchIdByExternalId(
  supabase: SupabaseClient,
  externalId: string | number
) {
  const response = await supabase
    .from('matches')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()

  if (response.error) throw response.error

  return (response.data as { id: DbId } | null)?.id ?? null
}

async function resolveLeagueIds(
  supabase: SupabaseClient,
  input: Pick<BulkBroadcastInput, 'leagueId' | 'leagueExternalId'>
) {
  if (input.leagueId) return [input.leagueId]
  if (!input.leagueExternalId) return []

  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', input.leagueExternalId)

  if (response.error) throw response.error

  return ((response.data ?? []) as Array<{ id: DbId }>).map((league) => league.id)
}

async function resolveMatchIdsForLeagueBroadcast(
  supabase: SupabaseClient,
  input: BulkBroadcastInput
) {
  const leagueIds = await resolveLeagueIds(supabase, input)

  if (!leagueIds.length) return []

  const rows: Array<{ id: DbId }> = []

  for (const chunk of chunkArray(leagueIds.map(String), 100)) {
    const response = await supabase
      .from('matches')
      .select('id')
      .in('league_id', chunk)
      .gte('match_date', getDateBoundary(input.dateFrom))
      .lte('match_date', getDateBoundary(input.dateTo, true))

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as Array<{ id: DbId }>))
  }

  return rows.map((row) => row.id)
}

export async function upsertMatchBroadcast(
  supabase: SupabaseClient,
  input: UpsertBroadcastInput
) {
  const matchId =
    input.matchId ?? (
      input.externalId ? await resolveMatchIdByExternalId(supabase, input.externalId) : null
    )

  if (!matchId) {
    throw new Error(
      'No se encontro el partido en Supabase. Ejecuta /api/admin/sync-home-matches para esa fecha antes de cargar TV.'
    )
  }

  const response = await supabase
    .from('match_broadcasts')
    .upsert({
      match_id: matchId,
      broadcaster_name: input.broadcasterName,
      broadcaster_logo_url: input.broadcasterLogoUrl ?? null,
      country: input.country ?? null,
      source: 'manual',
      confidence: 'high',
      verified: true,
    }, {
      onConflict: 'match_id,broadcaster_name',
    })
    .select('match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified, created_by_rule_id')
    .single()

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingTrustColumns =
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      message.includes('source') ||
      message.includes('confidence') ||
      message.includes('verified') ||
      message.includes('schema cache')

    if (isMissingTrustColumns) {
      const fallback = await supabase
        .from('match_broadcasts')
        .upsert({
          match_id: matchId,
          broadcaster_name: input.broadcasterName,
          broadcaster_logo_url: input.broadcasterLogoUrl ?? null,
          country: input.country ?? null,
        }, {
          onConflict: 'match_id,broadcaster_name',
        })
        .select('match_id, broadcaster_name, broadcaster_logo_url, country')
        .single()

      if (fallback.error) throw fallback.error

      return {
        ...(fallback.data as BroadcastRow),
        source: 'manual',
        confidence: 'high',
        verified: true,
      } satisfies BroadcastRow
    }

    throw response.error
  }

  return response.data as BroadcastRow
}

export async function upsertLeagueBroadcasts(
  supabase: SupabaseClient,
  input: BulkBroadcastInput
) {
  const matchIds = await resolveMatchIdsForLeagueBroadcast(supabase, input)

  if (!matchIds.length) {
    throw new Error(
      'No se encontraron partidos para esa liga y rango. Ejecuta el sync de esos dias antes de cargar TV masiva.'
    )
  }

  const payload = matchIds.map((matchId) => ({
    match_id: matchId,
    broadcaster_name: input.broadcasterName,
    broadcaster_logo_url: input.broadcasterLogoUrl ?? null,
    country: input.country ?? null,
    source: 'manual',
    confidence: 'high',
    verified: true,
  }))
  const response = await supabase
    .from('match_broadcasts')
    .upsert(payload, {
      onConflict: 'match_id,broadcaster_name',
    })
    .select('match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified, created_by_rule_id')

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingTrustColumns =
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      message.includes('source') ||
      message.includes('confidence') ||
      message.includes('verified') ||
      message.includes('schema cache')

    if (isMissingTrustColumns) {
      const fallbackPayload = payload.map((item) => ({
        match_id: item.match_id,
        broadcaster_name: item.broadcaster_name,
        broadcaster_logo_url: item.broadcaster_logo_url,
        country: item.country,
      }))
      const fallback = await supabase
        .from('match_broadcasts')
        .upsert(fallbackPayload, {
          onConflict: 'match_id,broadcaster_name',
        })
        .select('match_id, broadcaster_name, broadcaster_logo_url, country')

      if (fallback.error) throw fallback.error

      return {
        count: fallback.data?.length ?? 0,
        broadcasts: ((fallback.data ?? []) as BroadcastRow[]).map((row) => ({
          ...row,
          source: 'manual',
          confidence: 'high',
          verified: true,
        })),
      }
    }

    throw response.error
  }

  return {
    count: response.data?.length ?? 0,
    broadcasts: (response.data ?? []) as BroadcastRow[],
  }
}

export async function syncBroadcastsFromRules(
  supabase: SupabaseClient,
  options: SyncBroadcastOptions
): Promise<SyncBroadcastResult> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)
  const matchesResponse = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .gte('match_date', getDateBoundary(options.dateFrom))
    .lte('match_date', getDateBoundary(options.dateTo, true))
    .order('match_date', { ascending: true })
    .limit(limit)

  if (matchesResponse.error) throw matchesResponse.error

  const hydrated = await hydrateBroadcastMatches(
    supabase,
    (matchesResponse.data ?? []) as MatchRow[],
    true
  )
  const normalizedLeagueName = normalizeText(options.leagueName)
  const matches = hydrated.matches.filter((match) => {
    if (
      options.leagueExternalId &&
      String(match.league_external_id ?? '') !== String(options.leagueExternalId)
    ) {
      return false
    }

    if (normalizedLeagueName && !normalizeText(match.league).includes(normalizedLeagueName)) {
      return false
    }

    return true
  })
  const rules = await fetchBroadcastRules(supabase)
  const ruleStats = getBroadcastRuleStats(rules)
  const warnings = !ruleStats.verifiedRules
    ? ['No hay reglas activas y verificadas de TV cargadas. Sin reglas confiables se muestra TV: No disponible.']
    : []
  const existingKeys = new Set(
    matches.flatMap((match) =>
      match.broadcasters.map((broadcast) =>
        `${String(match.match_id)}::${normalizeText(broadcast.name)}`
      )
    )
  )
  const payload: Array<{
    match_id: DbId
    broadcaster_name: string
    broadcaster_logo_url: string | null
    country: string | null
    source: string | null
    confidence: string | null
    verified: boolean
    created_by_rule_id: string | null
  }> = []
  const sample: SyncBroadcastResult['sample'] = []
  const skippedReasons: Record<string, number> = {}
  let skipped = 0

  for (const match of matches) {
    const matchingRules = getBestMatchingRules(rules, match)

    if (!matchingRules.length) {
      const skipReason = getBroadcastSkipReason(rules, match)

      skipped += 1
      skippedReasons[skipReason] = (skippedReasons[skipReason] ?? 0) + 1
      if (sample.length < 20) {
        sample.push({
          match_id: match.match_id,
          external_id: match.external_id,
          league_external_id: match.league_external_id,
          league: match.league,
          local: match.local,
          visitante: match.visitante,
          applicableRules: [],
          selectedRule: null,
          action: 'skipped',
          skipReason,
          broadcasters: [],
          rule_ids: [],
        })
      }
      continue
    }

    const newRules = matchingRules.filter((rule) =>
      !existingKeys.has(`${String(match.match_id)}::${normalizeText(rule.broadcaster_name)}`)
    )

    for (const rule of matchingRules) {
      if (!newRules.includes(rule)) continue
      payload.push({
        match_id: match.match_id,
        broadcaster_name: rule.broadcaster_name,
        broadcaster_logo_url: rule.broadcaster_logo_url,
        country: rule.country ?? match.country,
        source: rule.source ?? 'verified_rule',
        confidence: rule.confidence ?? 'high',
        verified: true,
        created_by_rule_id: rule.id,
      })
    }

    if (sample.length < 20) {
      sample.push({
        match_id: match.match_id,
        external_id: match.external_id,
        league_external_id: match.league_external_id,
        league: match.league,
        local: match.local,
        visitante: match.visitante,
        applicableRules: matchingRules.map((rule) => ({
          id: rule.id,
          broadcaster: rule.broadcaster_name,
          specificity: getRuleSpecificity(rule),
          priority: rule.priority,
          source: rule.source,
          confidence: rule.confidence,
          verified: rule.verified,
        })),
        selectedRule: matchingRules[0]?.id ?? null,
        action: newRules.length ? 'upserted' : 'skipped',
        skipReason: newRules.length ? null : 'manual_verified_exists',
        broadcasters: matchingRules.map((rule) => rule.broadcaster_name),
        rule_ids: matchingRules.map((rule) => rule.id),
        source: matchingRules[0]?.source ?? 'verified_rule',
        confidence: matchingRules[0]?.confidence ?? 'high',
        verified: true,
      })
    }
  }

  if (!payload.length) {
    return {
      matchesChecked: matches.length,
      rulesLoaded: rules.length,
      activeRules: ruleStats.activeRules,
      verifiedRules: ruleStats.verifiedRules,
      unverifiedRules: ruleStats.unverifiedRules,
      broadcastsCreated: 0,
      broadcastsUpdated: 0,
      skipped,
      skippedReasons,
      warnings,
      sample,
    }
  }

  const uniquePayload = [
    ...payload.reduce<Map<string, typeof payload[number]>>((accumulator, item) => {
      accumulator.set(`${String(item.match_id)}::${normalizeText(item.broadcaster_name)}`, item)
      return accumulator
    }, new Map()).values(),
  ]
  const broadcastsCreated = uniquePayload.filter(
    (item) => !existingKeys.has(`${String(item.match_id)}::${normalizeText(item.broadcaster_name)}`)
  ).length
  const broadcastsUpdated = uniquePayload.length - broadcastsCreated

  for (const chunk of chunkArray(uniquePayload, 100)) {
    const response = await supabase
      .from('match_broadcasts')
      .upsert(chunk, {
        onConflict: 'match_id,broadcaster_name',
      })

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingTrustColumns =
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        message.includes('source') ||
        message.includes('confidence') ||
        message.includes('verified') ||
        message.includes('created_by_rule_id') ||
        message.includes('schema cache')

      if (isMissingTrustColumns) {
        warnings.push(
          'match_broadcasts no tiene columnas de confianza en el schema cache; no se crearon broadcasters por reglas para evitar TV no verificada.'
        )
        continue
      }

      throw response.error
    }
  }

  return {
    matchesChecked: matches.length,
    rulesLoaded: rules.length,
    activeRules: ruleStats.activeRules,
    verifiedRules: ruleStats.verifiedRules,
    unverifiedRules: ruleStats.unverifiedRules,
    broadcastsCreated,
    broadcastsUpdated,
    skipped,
    skippedReasons,
    warnings,
    sample,
  }
}

export async function auditBroadcastRules(
  supabase: SupabaseClient,
  options: SyncBroadcastOptions
): Promise<SyncBroadcastResult & { examples: SyncBroadcastResult['sample'] }> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)
  const matchesResponse = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .gte('match_date', getDateBoundary(options.dateFrom))
    .lte('match_date', getDateBoundary(options.dateTo, true))
    .order('match_date', { ascending: true })
    .limit(limit)

  if (matchesResponse.error) throw matchesResponse.error

  const hydrated = await hydrateBroadcastMatches(
    supabase,
    (matchesResponse.data ?? []) as MatchRow[],
    true
  )
  const normalizedLeagueName = normalizeText(options.leagueName)
  const matches = hydrated.matches.filter((match) => {
    if (
      options.leagueExternalId &&
      String(match.league_external_id ?? '') !== String(options.leagueExternalId)
    ) {
      return false
    }

    if (normalizedLeagueName && !normalizeText(match.league).includes(normalizedLeagueName)) {
      return false
    }

    return true
  })
  const rules = await fetchBroadcastRules(supabase)
  const suggestions = await getBroadcastRuleSuggestions(supabase)
  const ruleStats = getBroadcastRuleStats(rules)
  const unverifiedRuleRows = rules
    .filter((rule) => !isTrustedBroadcastRule(rule))
    .map(serializeBroadcastRuleForAudit)
  const warnings = !ruleStats.verifiedRules
    ? ['No hay reglas activas y verificadas de TV cargadas. Sin reglas confiables se muestra TV: No disponible.']
    : []
  const existingKeys = new Set(
    matches.flatMap((match) =>
      match.broadcasters.map((broadcast) =>
        `${String(match.match_id)}::${normalizeText(broadcast.name)}`
      )
    )
  )
  const skippedReasons: Record<string, number> = {}
  const examples: SyncBroadcastResult['sample'] = []
  let broadcastsCreated = 0
  let broadcastsUpdated = 0
  let skipped = 0
  const providerBroadcastsSaved = matches.reduce((total, match) =>
    total + match.broadcasters.filter((broadcast) => normalizeText(broadcast.source) === 'provider').length,
    0
  )

  for (const match of matches) {
    const matchingRules = getBestMatchingRules(rules, match)

    if (!matchingRules.length) {
      const skipReason = getBroadcastSkipReason(rules, match)

      skipped += 1
      skippedReasons[skipReason] = (skippedReasons[skipReason] ?? 0) + 1
      if (examples.length < 50) {
        examples.push({
          match_id: match.match_id,
          external_id: match.external_id,
          league_external_id: match.league_external_id,
          league: match.league,
          local: match.local,
          visitante: match.visitante,
          applicableRules: [],
          selectedRule: null,
          action: 'skipped',
          skipReason,
          broadcasters: [],
          rule_ids: [],
        })
      }
      continue
    }

    const action = matchingRules.some((rule) =>
      existingKeys.has(`${String(match.match_id)}::${normalizeText(rule.broadcaster_name)}`)
    )
      ? 'updated'
      : 'created'

    broadcastsCreated += matchingRules.filter((rule) =>
      !existingKeys.has(`${String(match.match_id)}::${normalizeText(rule.broadcaster_name)}`)
    ).length
    broadcastsUpdated += matchingRules.filter((rule) =>
      existingKeys.has(`${String(match.match_id)}::${normalizeText(rule.broadcaster_name)}`)
    ).length

    if (examples.length < 50) {
      examples.push({
        match_id: match.match_id,
        external_id: match.external_id,
        league_external_id: match.league_external_id,
        league: match.league,
        local: match.local,
        visitante: match.visitante,
        applicableRules: matchingRules.map((rule) => ({
          id: rule.id,
          broadcaster: rule.broadcaster_name,
          specificity: getRuleSpecificity(rule),
          priority: rule.priority,
          source: rule.source,
          confidence: rule.confidence,
          verified: rule.verified,
        })),
        selectedRule: matchingRules[0]?.id ?? null,
        action,
        skipReason: null,
        broadcasters: matchingRules.map((rule) => rule.broadcaster_name),
        rule_ids: matchingRules.map((rule) => rule.id),
        source: matchingRules[0]?.source ?? 'verified_rule',
        confidence: matchingRules[0]?.confidence ?? 'high',
        verified: true,
      })
    }
  }

  return {
    matchesChecked: matches.length,
    rulesLoaded: rules.length,
    activeRules: ruleStats.activeRules,
    verifiedRules: ruleStats.verifiedRules,
    unverifiedRules: ruleStats.unverifiedRules,
    providerBroadcastsSaved,
    suggestions: {
      pending: suggestions.pending,
      approved: suggestions.approved,
      rejected: suggestions.rejected,
    },
    broadcastsCreated,
    broadcastsUpdated,
    skipped,
    skippedReasons,
    warnings,
    rules: {
      verified: rules.filter(isTrustedBroadcastRule).map(serializeBroadcastRuleForAudit),
      unverified: unverifiedRuleRows,
      verificationSqlTemplate: buildManualRuleVerificationSql(),
    },
    sample: examples,
    examples,
  }
}

function isSuspiciousDefaultBroadcast(row: BroadcastRow, broadcasterName?: string | null) {
  if (isTrustedBroadcastRow(row)) return false

  const normalizedName = normalizeText(row.broadcaster_name)
  const requestedName = normalizeText(broadcasterName)
  const badSource = ['fallback', 'generated_default', 'default', 'generated rule'].includes(
    normalizeText(row.source)
  )
  const lowConfidence = normalizeText(row.confidence) === 'low'
  const suspiciousName = requestedName
    ? normalizedName.includes(requestedName)
    : normalizedName.includes('espn')

  return suspiciousName || badSource || lowConfidence || Boolean(row.created_by_rule_id)
}

async function fetchBroadcastRowsForCleanup(
  supabase: SupabaseClient,
  limit: number
) {
  const response = await supabase
    .from('match_broadcasts')
    .select('id, match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified, created_by_rule_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingTrustColumns =
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      message.includes('source') ||
      message.includes('confidence') ||
      message.includes('verified') ||
      message.includes('created_by_rule_id') ||
      message.includes('schema cache')

    if (isMissingTrustColumns) {
      const fallback = await supabase
        .from('match_broadcasts')
        .select('id, match_id, broadcaster_name, broadcaster_logo_url, country')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fallback.error) throw fallback.error

      return (fallback.data ?? []) as BroadcastRow[]
    }

    throw response.error
  }

  return (response.data ?? []) as BroadcastRow[]
}

async function fetchCleanupMatches(
  supabase: SupabaseClient,
  matchIds: DbId[]
) {
  const rows: Array<{ id: DbId; external_id: DbId | null; league_id: DbId | null; match_date: string | null }> = []
  const uniqueIds = [...new Set(matchIds.map(String))]

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await supabase
      .from('matches')
      .select('id, external_id, league_id, match_date')
      .in('id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as typeof rows))
  }

  return rows
}

export async function cleanupBroadcastDefaults(
  supabase: SupabaseClient,
  options: CleanupBroadcastDefaultsOptions = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 1000, 1), 5000)
  const rows = await fetchBroadcastRowsForCleanup(supabase, limit)
  const matches = await fetchCleanupMatches(supabase, rows.map((row) => row.match_id))
  const leagueIds = [...new Set(matches.map((match) => match.league_id).filter((id): id is DbId => id !== null))]
  const leagues = leagueIds.length
    ? await fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id, country', leagueIds)
    : []
  const matchesById = new Map(matches.map((match) => [String(match.id), match]))
  const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
  const filteredRows = rows.filter((row) => {
    const match = matchesById.get(String(row.match_id))
    const league = match?.league_id ? leaguesById.get(String(match.league_id)) : null

    if (options.dateFrom && match?.match_date && getArgentinaDateISO(match.match_date) < options.dateFrom) {
      return false
    }
    if (options.dateTo && match?.match_date && getArgentinaDateISO(match.match_date) > options.dateTo) {
      return false
    }
    if (
      options.leagueExternalId &&
      String(league?.external_id ?? '') !== String(options.leagueExternalId)
    ) {
      return false
    }

    return isSuspiciousDefaultBroadcast(row, options.broadcasterName)
  })
  const idsToDelete = filteredRows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id))

  let deleted = 0

  if (options.dryRun === false && idsToDelete.length) {
    for (const chunk of chunkArray(idsToDelete, 100)) {
      const response = await supabase
        .from('match_broadcasts')
        .delete()
        .in('id', chunk)

      if (response.error) throw response.error
    }

    deleted = idsToDelete.length
  }

  return {
    ok: true,
    dryRun: options.dryRun !== false,
    matchesChecked: new Set(rows.map((row) => String(row.match_id))).size,
    suspiciousBroadcasts: filteredRows.length,
    wouldDelete: options.dryRun === false ? 0 : idsToDelete.length,
    deleted,
    sample: filteredRows.slice(0, 50).map((row) => {
      const match = matchesById.get(String(row.match_id))
      const league = match?.league_id ? leaguesById.get(String(match.league_id)) : null

      return {
        id: row.id,
        match_id: row.match_id,
        fixtureExternalId: match?.external_id ?? null,
        leagueExternalId: league?.external_id ?? null,
        leagueName: league?.name ?? null,
        matchDate: match?.match_date ?? null,
        broadcaster_name: row.broadcaster_name,
        source: row.source ?? null,
        confidence: row.confidence ?? null,
        verified: row.verified ?? false,
        created_by_rule_id: row.created_by_rule_id ?? null,
      }
    }),
  }
}
