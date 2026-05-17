import type { SupabaseClient } from '@supabase/supabase-js'

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
}

type BroadcastRow = {
  match_id: DbId
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
}

export type BroadcastMatchRow = {
  match_id: DbId
  external_id: DbId | null
  league: string | null
  league_external_id: DbId | null
  country: string | null
  local: string | null
  visitante: string | null
  match_date: string
  status: string | null
  broadcasters: Array<{
    name: string
    logo_url: string | null
    country: string | null
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
  home_team_name: string | null
  away_team_name: string | null
  broadcaster_name: string
  broadcaster_logo_url: string | null
  priority: number | null
  active: boolean | null
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
  broadcastsCreated: number
  broadcastsUpdated: number
  skipped: number
  sample: Array<{
    match_id: DbId
    external_id: DbId | null
    league: string | null
    local: string | null
    visitante: string | null
    broadcasters: string[]
    rule_ids: string[]
  }>
}

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
      .select('match_id, broadcaster_name, broadcaster_logo_url, country')
      .in('match_id', chunk)
      .order('broadcaster_name', { ascending: true })

    if (response.error) {
      if (isMissingBroadcastsTable(response.error)) {
        return { rows: [], tableExists: false }
      }

      throw response.error
    }

    rows.push(...((response.data ?? []) as BroadcastRow[]))
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
      match_date: match.match_date,
      status: match.status,
      broadcasters: matchBroadcasts.map((broadcast) => ({
        name: broadcast.broadcaster_name,
        logo_url: broadcast.broadcaster_logo_url,
        country: broadcast.country,
      })),
    }
  })
}

async function fetchBroadcastRules(supabase: SupabaseClient) {
  const response = await supabase
    .from('broadcast_rules')
    .select('id, match_external_id, match_date, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active')
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingRulesTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('broadcast_rules') ||
      message.includes('schema cache')

    if (isMissingRulesTable) return []
    const isMissingSpecificRuleColumn =
      response.error.code === '42703' ||
      message.includes('match_external_id') ||
      message.includes('match_date')

    if (isMissingSpecificRuleColumn) {
      const fallback = await supabase
        .from('broadcast_rules')
        .select('id, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active')
        .eq('active', true)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      if (fallback.error) return []

      return (fallback.data ?? []) as BroadcastRuleRow[]
    }

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

function broadcastRuleMatches(rule: BroadcastRuleRow, match: BroadcastMatchRow) {
  if (
    rule.match_external_id &&
    String(rule.match_external_id) !== String(match.external_id ?? '')
  ) {
    return false
  }

  if (
    rule.match_date &&
    getArgentinaDateISO(match.match_date) !== getArgentinaDateISO(rule.match_date)
  ) {
    return false
  }

  if (
    rule.league_external_id &&
    String(rule.league_external_id) !== String(match.league_external_id ?? '')
  ) {
    return false
  }

  return (
    textRuleMatches(rule.league_name, match.league) &&
    textRuleMatches(rule.country, match.country) &&
    teamRuleMatches(rule.home_team_name, match) &&
    teamRuleMatches(rule.away_team_name, match)
  )
}

function getRuleSpecificity(rule: BroadcastRuleRow) {
  if (rule.match_external_id) return 0
  if (rule.home_team_name && rule.away_team_name) return 1
  if (rule.home_team_name || rule.away_team_name) return 2
  if (rule.league_external_id || rule.league_name) return 3
  if (rule.country) return 4
  return 5
}

function isSpecificBroadcastRule(rule: BroadcastRuleRow) {
  return getRuleSpecificity(rule) <= 1
}

function getBestMatchingRules(rules: BroadcastRuleRow[], match: BroadcastMatchRow) {
  const matchingRules = rules
    .filter((rule) => isSpecificBroadcastRule(rule) && broadcastRuleMatches(rule, match))
    .sort((a, b) => {
      const specificityCompare = getRuleSpecificity(a) - getRuleSpecificity(b)
      if (specificityCompare !== 0) return specificityCompare
      return (a.priority ?? 100) - (b.priority ?? 100)
    })

  if (!matchingRules.length) return []

  const bestSpecificity = getRuleSpecificity(matchingRules[0])
  const bestPriority = matchingRules[0]?.priority ?? 100

  return matchingRules.filter((rule) =>
    getRuleSpecificity(rule) === bestSpecificity &&
    (rule.priority ?? 100) === bestPriority
  )
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
      ? fetchRowsByIds<TeamRow>(supabase, 'teams', 'id, name', teamIds)
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
    }, {
      onConflict: 'match_id,broadcaster_name',
    })
    .select('match_id, broadcaster_name, broadcaster_logo_url, country')
    .single()

  if (response.error) throw response.error

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
  }))
  const response = await supabase
    .from('match_broadcasts')
    .upsert(payload, {
      onConflict: 'match_id,broadcaster_name',
    })
    .select('match_id, broadcaster_name, broadcaster_logo_url, country')

  if (response.error) throw response.error

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
  }> = []
  const sample: SyncBroadcastResult['sample'] = []
  let skipped = 0

  for (const match of matches) {
    const matchingRules = getBestMatchingRules(rules, match)

    if (!matchingRules.length) {
      skipped += 1
      continue
    }

    for (const rule of matchingRules) {
      payload.push({
        match_id: match.match_id,
        broadcaster_name: rule.broadcaster_name,
        broadcaster_logo_url: rule.broadcaster_logo_url,
        country: rule.country ?? match.country,
      })
    }

    if (sample.length < 20) {
      sample.push({
        match_id: match.match_id,
        external_id: match.external_id,
        league: match.league,
        local: match.local,
        visitante: match.visitante,
        broadcasters: matchingRules.map((rule) => rule.broadcaster_name),
        rule_ids: matchingRules.map((rule) => rule.id),
      })
    }
  }

  if (!payload.length) {
    return {
      matchesChecked: matches.length,
      rulesLoaded: rules.length,
      broadcastsCreated: 0,
      broadcastsUpdated: 0,
      skipped,
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

    if (response.error) throw response.error
  }

  return {
    matchesChecked: matches.length,
    rulesLoaded: rules.length,
    broadcastsCreated,
    broadcastsUpdated,
    skipped,
    sample,
  }
}
