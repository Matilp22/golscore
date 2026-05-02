import type { SupabaseClient } from '@supabase/supabase-js'

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
      ? fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id', leagueIds)
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
