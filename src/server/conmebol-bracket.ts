import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getLeagueFixtures,
  getLeagueStandings,
  readCachedLeagueStandings,
  type LeagueFixtureSummary,
  type LeagueStandingGroup,
  type LeagueStandingRow,
} from '@/lib/api-football'
import type { FootballPublicReadMode } from '@/server/football-public-read-mode'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { syncLeagueStandingsCache } from '@/server/football-standings-cache'
import { syncCompetitionFull } from '@/server/prode/sync-matches'
import {
  auditConmebolRound,
  getConmebolGroupRoundNumber,
  getConmebolPhaseLabel,
  getConmebolPhaseOrder,
  isConmebolGroupRound,
  normalizeConmebolRound,
  type ConmebolCompetitionType,
  type ConmebolPhaseKey,
} from '@/shared/utils/conmebol-rounds'

type DbId = string | number

type LeagueRow = {
  id: DbId
  external_id: string | number | null
  name: string | null
  country: string | null
  season: number | null
}

type TeamRow = {
  id: DbId
  external_id: string | number | null
  name: string | null
  logo_url?: string | null
}

type BracketSeriesRow = {
  id: string
  competition: ConmebolCompetitionType
  league_id: string | null
  league_external_id: string
  season: number
  phase: string
  slot: number
  home_seed: string | null
  away_seed: string | null
  team_a_id: string | null
  team_b_id: string | null
  source: string | null
  status: string | null
  leg1_date: string | null
  leg2_date: string | null
}

type MatchAuditRow = {
  id: DbId
  external_id: string | number | null
  round: string | null
  match_date: string | null
  home_team_id: string | number | null
  away_team_id: string | number | null
}

type ApiFixture = {
  fixture: {
    id: number
    date: string | null
    status?: {
      short?: string
      long?: string
    }
  }
  league: {
    id: number
    name: string
    country?: string
    season?: number
    round?: string
    logo?: string | null
  }
  teams: {
    home: {
      id?: number
      name?: string
      logo?: string | null
    }
    away: {
      id?: number
      name?: string
      logo?: string | null
    }
  }
  goals?: {
    home: number | null
    away: number | null
  }
  score?: {
    penalty?: {
      home: number | null
      away: number | null
    }
  }
}

export type StoredConmebolBracketSeries = {
  id: string
  phase: ConmebolPhaseKey
  slot: number
  homeSeed?: string | null
  awaySeed?: string | null
  teamA?: {
    id?: string | number | null
    name?: string | null
    logo?: string | null
  } | null
  teamB?: {
    id?: string | number | null
    name?: string | null
    logo?: string | null
  } | null
  source?: string | null
  status?: string | null
  leg1Date?: string | null
  leg2Date?: string | null
}

export type ConmebolQualifiedTeam = {
  teamId?: number | null
  teamExternalId?: number | null
  teamName: string
  teamLogo?: string | null
  logoUrl?: string | null
  group: string
  rank: number
  position: number
  points: number
  goalDifference: number
  goalsFor: number
  won: number
  seedLabel: string
  sourceCompetition: ConmebolCompetitionType
  destination: 'libertadores_round_of_16' | 'sudamericana_playoffs' | 'sudamericana_round_of_16'
}

export type ConmebolQualifiedTeams = {
  libertadoresRoundOf16: ConmebolQualifiedTeam[]
  libertadoresThirdsToSudamericana: ConmebolQualifiedTeam[]
  sudamericanaPlayoffs: ConmebolQualifiedTeam[]
  sudamericanaRoundOf16: ConmebolQualifiedTeam[]
  sudamericanaPlayoffSeeds: ConmebolQualifiedTeam[]
  sudamericanaRoundOf16Seeds: ConmebolQualifiedTeam[]
}

export type ConmebolBracketViewModelPlaceholder = {
  phase: ConmebolPhaseKey
  slot: number
  homeSeed?: string | null
  awaySeed?: string | null
  teamA?: StoredConmebolBracketSeries['teamA']
  teamB?: StoredConmebolBracketSeries['teamB']
  source?: string | null
}

export type ConmebolGroupCardViewModel = {
  id: string
  title: string
  rows: LeagueStandingRow[]
  fixtures: LeagueFixtureSummary[]
}

export type ConmebolBracketViewModel = {
  competition: ConmebolCompetitionType
  season: number
  leagueExternalId: number
  bracket: {
    phases: readonly ConmebolPhaseKey[]
    series: StoredConmebolBracketSeries[]
    placeholders: ConmebolBracketViewModelPlaceholder[]
    officialFixturesFound: boolean
  }
  agenda: {
    phases: string[]
    selectedPhase: string | null
    matchesByPhase: Record<ConmebolPhaseKey, number>
    itemsByPhase: Record<ConmebolPhaseKey, number>
    scheduledItems: number
    unscheduledItems: number
    usesManualDrawAsAgenda: boolean
  }
  groups: {
    groupCards: ConmebolGroupCardViewModel[]
  }
  qualifiedTeams: ConmebolQualifiedTeams
  warnings: string[]
}

export type SyncConmebolKnockoutsOptions = {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
  force?: boolean
  dryRun?: boolean
}

export type SyncConmebolStandingsOptions = {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
}

export type UpsertConmebolDrawInput = {
  competition: ConmebolCompetitionType
  season: number
  phase: string
  source?: string | null
  series: Array<{
    slot: number
    teamAExternalId?: string | number | null
    teamBExternalId?: string | number | null
    teamAName?: string | null
    teamBName?: string | null
    leg1Date?: string | null
    leg2Date?: string | null
  }>
}

const CONMEBOL_COMPETITIONS: Record<ConmebolCompetitionType, {
  leagueExternalId: number
  slug: string
  name: string
}> = {
  libertadores: {
    leagueExternalId: 13,
    slug: 'internacional-libertadores',
    name: 'Copa Libertadores',
  },
  sudamericana: {
    leagueExternalId: 11,
    slug: 'internacional-sudamericana',
    name: 'Copa Sudamericana',
  },
}

const EXPECTED_GROUPS = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H']
const ALL_CONMEBOL_PHASES: ConmebolPhaseKey[] = [
  'groups',
  'playoffs',
  'roundOf16',
  'quarterFinals',
  'semiFinals',
  'final',
]

const EXPECTED_KNOCKOUT_FIXTURES: Record<ConmebolCompetitionType, Record<Exclude<ConmebolPhaseKey, 'groups'>, number>> = {
  libertadores: {
    playoffs: 0,
    roundOf16: 16,
    quarterFinals: 8,
    semiFinals: 4,
    final: 1,
  },
  sudamericana: {
    playoffs: 16,
    roundOf16: 16,
    quarterFinals: 8,
    semiFinals: 4,
    final: 1,
  },
}

const EXPECTED_KNOCKOUT_SERIES: Record<ConmebolCompetitionType, Record<Exclude<ConmebolPhaseKey, 'groups'>, number>> = {
  libertadores: {
    playoffs: 0,
    roundOf16: 8,
    quarterFinals: 4,
    semiFinals: 2,
    final: 1,
  },
  sudamericana: {
    playoffs: 8,
    roundOf16: 8,
    quarterFinals: 4,
    semiFinals: 2,
    final: 1,
  },
}

function isMissingOptionalBracketTable(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('conmebol_bracket_series') ||
    message.includes('schema cache')
  )
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCompetitionInfo(competition: ConmebolCompetitionType, leagueExternalId?: number | null) {
  const info = CONMEBOL_COMPETITIONS[competition]

  return {
    ...info,
    leagueExternalId: leagueExternalId ?? info.leagueExternalId,
  }
}

function normalizeManualPhase(phase: string, competition: ConmebolCompetitionType): ConmebolPhaseKey | null {
  const normalized = normalizeText(phase)

  if (competition === 'sudamericana' && (normalized === 'playoffs' || normalized === 'playoff')) {
    return 'playoffs'
  }

  if (
    normalized === 'octavos' ||
    normalized === 'octavos de final' ||
    normalized === 'round of 16' ||
    normalized === 'roundof16'
  ) {
    return 'roundOf16'
  }

  if (
    normalized === 'cuartos' ||
    normalized === 'cuartos de final' ||
    normalized === 'quarter finals' ||
    normalized === 'quarterfinals'
  ) {
    return 'quarterFinals'
  }

  if (normalized === 'semifinales' || normalized === 'semi finals' || normalized === 'semifinals') {
    return 'semiFinals'
  }

  if (normalized === 'final') return 'final'

  return null
}

async function getLeagueByExternalId(
  supabase: SupabaseClient,
  leagueExternalId: number,
  season: number
) {
  const exactResponse = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season')
    .eq('external_id', String(leagueExternalId))
    .eq('season', season)
    .order('season', { ascending: false })
    .limit(1)

  if (exactResponse.error) throw exactResponse.error
  if (exactResponse.data?.[0]) return exactResponse.data[0] as LeagueRow

  const fallbackResponse = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season')
    .eq('external_id', String(leagueExternalId))
    .order('season', { ascending: false })
    .limit(1)

  if (fallbackResponse.error) throw fallbackResponse.error

  return (fallbackResponse.data?.[0] as LeagueRow | undefined) ?? null
}

async function getTeamsByIds(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, TeamRow>()

  const response = await supabase
    .from('teams')
    .select('id, external_id, name, logo_url')
    .in('id', ids)

  if (response.error) throw response.error

  return new Map(((response.data ?? []) as TeamRow[]).map((team) => [String(team.id), team]))
}

async function getTeamByExternalId(
  supabase: SupabaseClient,
  externalId: string | number | null | undefined
) {
  if (externalId === null || externalId === undefined || externalId === '') return null

  const response = await supabase
    .from('teams')
    .select('id, external_id, name, logo_url')
    .eq('external_id', String(externalId))
    .maybeSingle()

  if (response.error) throw response.error

  return (response.data as TeamRow | null) ?? null
}

const CONMEBOL_DRAW_TEAM_ALIASES: Record<string, string[]> = {
  'estudiantes': ['estudiantes lp', 'estudiantes l p', 'estudiantes de la plata'],
  'estudiantes lp': ['estudiantes', 'estudiantes l p', 'estudiantes de la plata'],
  'estudiantes l p': ['estudiantes', 'estudiantes lp', 'estudiantes de la plata'],
  'estudiantes de la plata': ['estudiantes', 'estudiantes lp', 'estudiantes l p'],
  'universidad catolica': ['u catolica', 'universidad catolica chile'],
  'u catolica': ['universidad catolica', 'universidad catolica chile'],
  'liga de quito': ['ldu quito', 'ldu de quito', 'liga deportiva universitaria'],
  'ldu quito': ['liga de quito', 'ldu de quito', 'liga deportiva universitaria'],
  'ldu de quito': ['liga de quito', 'ldu quito', 'liga deportiva universitaria'],
  'independiente rivadavia': ['independ rivadavia', 'indep rivadavia'],
  'independ rivadavia': ['independiente rivadavia', 'indep rivadavia'],
  'indep rivadavia': ['independiente rivadavia', 'independ rivadavia'],
  'deportes tolima': ['tolima'],
  'tolima': ['deportes tolima'],
  'independiente del valle': ['idv', 'ind del valle'],
  'idv': ['independiente del valle', 'ind del valle'],
  'ind del valle': ['independiente del valle', 'idv'],
  'cerro porteno': ['cerro porteño'],
  'cerro porteño': ['cerro porteno'],
  'coquimbo unido': ['coquimbo'],
  'coquimbo': ['coquimbo unido'],
  'rosario central': ['central'],
  'central': ['rosario central'],
}

type ConmebolDrawTeamResolution = {
  id: string
  externalId: string | number | null
  name: string | null
  logoUrl: string | null
  requestedName?: string | null
}

function getConmebolDrawNameCandidates(name: string) {
  const normalized = normalizeText(name)

  return [
    normalized,
    ...(CONMEBOL_DRAW_TEAM_ALIASES[normalized] ?? []),
  ].filter(Boolean)
}

function getStandingParticipantRows(standings: LeagueStandingGroup[]) {
  return getConmebolGroupTables(standings).flatMap((group) => group.rows)
}

function getParticipantExternalIds(rows: LeagueStandingRow[]) {
  return new Set(
    rows
      .map((row) => row.teamId)
      .filter((id): id is number => id !== null && id !== undefined)
      .map(String)
  )
}

async function getConmebolDrawParticipantRows(input: {
  competition: ConmebolCompetitionType
  season: number
}) {
  const info = getCompetitionInfo(input.competition)
  const targetStandings = await getLeagueStandings(info.leagueExternalId, input.season)
  const standings = [...targetStandings]

  if (input.competition === 'sudamericana') {
    const libertadoresStandings = await getLeagueStandings(
      CONMEBOL_COMPETITIONS.libertadores.leagueExternalId,
      input.season
    ).catch(() => [] as LeagueStandingGroup[])

    standings.push(...libertadoresStandings)
  }

  return getStandingParticipantRows(standings)
}

function findStandingParticipantByName(rows: LeagueStandingRow[], name: string) {
  const candidates = getConmebolDrawNameCandidates(name)
  const exactMatches = rows.filter((row) =>
    candidates.includes(normalizeText(row.teamName))
  )

  if (exactMatches.length === 1) return exactMatches[0]
  if (exactMatches.length > 1) {
    throw new Error(
      `El nombre "${name}" matchea mas de un participante: ${exactMatches.map((row) => row.teamName).join(', ')}.`
    )
  }

  return null
}

async function fetchTeamsByExternalIds(
  supabase: SupabaseClient,
  externalIds: string[]
) {
  if (!externalIds.length) return new Map<string, TeamRow>()

  const response = await supabase
    .from('teams')
    .select('id, external_id, name, logo_url')
    .in('external_id', externalIds)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as TeamRow[]).map((team) => [String(team.external_id), team])
  )
}

export async function resolveConmebolDrawTeam(input: {
  name?: string | null
  externalId?: string | number | null
  competition: ConmebolCompetitionType
  season: number
  participantRows?: LeagueStandingRow[]
  teamsByExternalId?: Map<string, TeamRow>
  supabase?: SupabaseClient
}): Promise<ConmebolDrawTeamResolution | null> {
  const supabase = input.supabase ?? getSupabaseAdminClient()
  const participantRows =
    input.participantRows ?? await getConmebolDrawParticipantRows({
      competition: input.competition,
      season: input.season,
    })
  const allowedExternalIds = getParticipantExternalIds(participantRows)
  let team: TeamRow | null = null
  let requestedName = input.name?.trim() || null

  if (input.externalId !== null && input.externalId !== undefined && input.externalId !== '') {
    const externalKey = String(input.externalId)

    if (allowedExternalIds.size && !allowedExternalIds.has(externalKey)) {
      throw new Error(`El equipo external_id ${externalKey} no figura como participante Conmebol ${input.season}.`)
    }

    team = input.teamsByExternalId?.get(externalKey) ?? await getTeamByExternalId(supabase, externalKey)
    requestedName = requestedName ?? team?.name ?? null
  } else if (input.name?.trim()) {
    const participant = findStandingParticipantByName(participantRows, input.name.trim())

    if (!participant?.teamId) {
      throw new Error(`No se pudo resolver el equipo "${input.name}" entre participantes Conmebol ${input.season}.`)
    }

    team = input.teamsByExternalId?.get(String(participant.teamId)) ?? await getTeamByExternalId(supabase, participant.teamId)
    requestedName = input.name.trim()
  } else {
    return null
  }

  if (!team) {
    throw new Error(
      requestedName
        ? `No se encontro equipo en Supabase para "${requestedName}".`
        : 'No se encontro equipo en Supabase para el sorteo Conmebol.'
    )
  }

  return {
    id: String(team.id),
    externalId: team.external_id,
    name: team.name,
    logoUrl: team.logo_url ?? null,
    requestedName,
  }
}

function mapSeriesRow(row: BracketSeriesRow, teamsById: Map<string, TeamRow>): StoredConmebolBracketSeries | null {
  const phase = row.phase as ConmebolPhaseKey

  if (!['playoffs', 'roundOf16', 'quarterFinals', 'semiFinals', 'final'].includes(phase)) {
    return null
  }

  const teamA = row.team_a_id ? teamsById.get(String(row.team_a_id)) : null
  const teamB = row.team_b_id ? teamsById.get(String(row.team_b_id)) : null

  return {
    id: row.id,
    phase,
    slot: row.slot,
    homeSeed: row.home_seed,
    awaySeed: row.away_seed,
    teamA: teamA
      ? {
          id: teamA.external_id ?? teamA.id,
          name: teamA.name,
          logo: teamA.logo_url ?? null,
        }
      : null,
    teamB: teamB
      ? {
          id: teamB.external_id ?? teamB.id,
          name: teamB.name,
          logo: teamB.logo_url ?? null,
        }
      : null,
    source: row.source,
    status: row.status,
    leg1Date: row.leg1_date,
    leg2Date: row.leg2_date,
  }
}

export async function getConmebolStoredBracketSeries(input: {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
}) {
  const supabase = getSupabaseAdminClient()
  const info = getCompetitionInfo(input.competition, input.leagueExternalId)
  const response = await supabase
    .from('conmebol_bracket_series')
    .select('id, competition, league_id, league_external_id, season, phase, slot, home_seed, away_seed, team_a_id, team_b_id, source, status, leg1_date, leg2_date')
    .eq('competition', input.competition)
    .eq('league_external_id', String(info.leagueExternalId))
    .eq('season', input.season)
    .order('phase', { ascending: true })
    .order('slot', { ascending: true })

  if (response.error) {
    if (isMissingOptionalBracketTable(response.error)) return []
    throw response.error
  }

  const rows = (response.data ?? []) as BracketSeriesRow[]
  const teamIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.team_a_id, row.team_b_id])
        .filter((id): id is string => Boolean(id))
        .map(String)
    ),
  ]
  const teamsById = await getTeamsByIds(supabase, teamIds)
  const phaseOrder = getConmebolPhaseOrder(input.competition) as readonly ConmebolPhaseKey[]

  return rows
    .map((row) => mapSeriesRow(row, teamsById))
    .filter((row): row is StoredConmebolBracketSeries => Boolean(row))
    .sort((a, b) => {
      const phaseSort = phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase)
      if (phaseSort !== 0) return phaseSort

      return a.slot - b.slot
    })
}

export async function getConmebolQualifiedTeams(input: {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
  readMode?: FootballPublicReadMode
}): Promise<ConmebolQualifiedTeams> {
  const info = getCompetitionInfo(input.competition, input.leagueExternalId)
  const loadStandings =
    input.readMode === 'cache-only' ? readCachedLeagueStandings : getLeagueStandings
  const targetStandingsPromise = loadStandings(info.leagueExternalId, input.season).catch((error) => {
    console.warn('[conmebol-qualified-teams] target standings unavailable', error)
    return [] as LeagueStandingGroup[]
  })
  const libertadoresStandingsPromise = input.competition === 'libertadores'
    ? targetStandingsPromise
    : loadStandings(CONMEBOL_COMPETITIONS.libertadores.leagueExternalId, input.season).catch((error) => {
        console.warn('[conmebol-qualified-teams] libertadores standings unavailable', error)
        return [] as LeagueStandingGroup[]
      })
  const [targetStandings, libertadoresStandings] = await Promise.all([
    targetStandingsPromise,
    libertadoresStandingsPromise,
  ])
  const sudamericanaStandings = input.competition === 'sudamericana' ? targetStandings : []

  const libertadoresRoundOf16 = getQualifiedByRank(
    libertadoresStandings,
    [1, 2],
    'libertadores',
    'libertadores_round_of_16'
  )
  const libertadoresThirdsToSudamericana = getQualifiedByRank(
    libertadoresStandings,
    [3],
    'libertadores',
    'sudamericana_playoffs'
  )
  const sudamericanaRoundOf16Seeds = getQualifiedByRank(
    sudamericanaStandings,
    [1],
    'sudamericana',
    'sudamericana_round_of_16'
  )
  const sudamericanaPlayoffSeeds = [
    ...getQualifiedByRank(
      sudamericanaStandings,
      [2],
      'sudamericana',
      'sudamericana_playoffs'
    ),
    ...libertadoresThirdsToSudamericana,
  ]

  return {
    libertadoresRoundOf16,
    libertadoresThirdsToSudamericana,
    sudamericanaPlayoffs: sudamericanaPlayoffSeeds,
    sudamericanaRoundOf16: sudamericanaRoundOf16Seeds,
    sudamericanaPlayoffSeeds,
    sudamericanaRoundOf16Seeds,
  }
}

function getFixturePhase(fixture: LeagueFixtureSummary, competition: ConmebolCompetitionType) {
  return normalizeConmebolRound(fixture.round, competition)
}

function countMatchesByPhase(fixtures: LeagueFixtureSummary[], competition: ConmebolCompetitionType) {
  const counts = new Map<ConmebolPhaseKey, number>()

  for (const fixture of fixtures) {
    const phase = getFixturePhase(fixture, competition)
    if (!phase) continue

    counts.set(phase, (counts.get(phase) ?? 0) + 1)
  }

  return Object.fromEntries(
    ALL_CONMEBOL_PHASES.map((phase) => [phase, counts.get(phase) ?? 0])
  ) as Record<ConmebolPhaseKey, number>
}

function getTeamKey(id: number | string | null | undefined, name: string) {
  return id !== null && id !== undefined && id !== ''
    ? `id:${id}`
    : `name:${normalizeText(name)}`
}

function countSeriesByPhase(fixtures: LeagueFixtureSummary[], competition: ConmebolCompetitionType) {
  const seriesByPhase = new Map<ConmebolPhaseKey, Set<string>>()

  for (const fixture of fixtures) {
    const phase = getFixturePhase(fixture, competition)
    if (!phase || phase === 'groups') continue

    const key = [
      getTeamKey(fixture.homeId, fixture.home),
      getTeamKey(fixture.awayId, fixture.away),
    ].sort().join('__')
    const current = seriesByPhase.get(phase) ?? new Set<string>()

    current.add(key)
    seriesByPhase.set(phase, current)
  }

  return Object.fromEntries(
    getConmebolPhaseOrder(competition)
      .filter((phase) => phase !== 'groups')
      .map((phase) => [phase, seriesByPhase.get(phase)?.size ?? 0])
  )
}

function groupNameKey(name: string) {
  const normalized = normalizeText(name)
  const match = normalized.match(/\b(?:group|grupo)\s+([a-h])\b/)

  return match ? `Grupo ${match[1].toUpperCase()}` : name
}

function getGroupSortValue(groupName: string) {
  const index = EXPECTED_GROUPS.indexOf(groupNameKey(groupName))

  return index >= 0 ? index : 1000
}

function getConmebolGroupTables(standings: LeagueStandingGroup[]) {
  return standings
    .filter((group) => {
      const normalized = normalizeText(group.name)

      return normalized.includes('grupo') || normalized.includes('group')
    })
    .map((group) => ({
      ...group,
      name: groupNameKey(group.name),
    }))
    .sort((a, b) => {
      const sortA = getGroupSortValue(a.name)
      const sortB = getGroupSortValue(b.name)

      if (sortA !== sortB) return sortA - sortB

      return a.name.localeCompare(b.name, 'es-AR', { numeric: true })
    })
}

function formatQualifiedSeedLabel(row: LeagueStandingRow, groupName: string) {
  if (row.rank) return `${row.rank}\u00b0 ${groupName}`

  return `${row.rank}° ${groupName}: ${row.teamName}`
}

function mapQualifiedTeam(
  row: LeagueStandingRow,
  groupName: string,
  sourceCompetition: ConmebolCompetitionType,
  destination: ConmebolQualifiedTeam['destination']
): ConmebolQualifiedTeam {
  return {
    teamId: row.teamId ?? null,
    teamExternalId: row.teamId ?? null,
    teamName: row.teamName,
    teamLogo: row.teamLogo ?? null,
    logoUrl: row.teamLogo ?? null,
    group: groupName,
    rank: row.rank,
    position: row.rank,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
    won: row.won,
    seedLabel: formatQualifiedSeedLabel(row, groupName),
    sourceCompetition,
    destination,
  }
}

function getQualifiedByRank(
  standings: LeagueStandingGroup[],
  ranks: number[],
  sourceCompetition: ConmebolCompetitionType,
  destination: ConmebolQualifiedTeam['destination']
) {
  return getConmebolGroupTables(standings)
    .flatMap((group) =>
      group.rows
        .filter((row) => ranks.includes(row.rank))
        .sort((a, b) => a.rank - b.rank)
        .map((row) => mapQualifiedTeam(row, group.name, sourceCompetition, destination))
    )
}

function getQualifiedTeamCount(qualifiedTeams: ConmebolQualifiedTeams, competition: ConmebolCompetitionType) {
  return competition === 'libertadores'
    ? qualifiedTeams.libertadoresRoundOf16.length
    : qualifiedTeams.sudamericanaRoundOf16Seeds.length + qualifiedTeams.sudamericanaPlayoffSeeds.length
}

function getEmptyConmebolQualifiedTeams(): ConmebolQualifiedTeams {
  return {
    libertadoresRoundOf16: [],
    libertadoresThirdsToSudamericana: [],
    sudamericanaPlayoffs: [],
    sudamericanaRoundOf16: [],
    sudamericanaPlayoffSeeds: [],
    sudamericanaRoundOf16Seeds: [],
  }
}

function hasQualifiedTeamsFromStandings(qualifiedTeams: ConmebolQualifiedTeams, competition: ConmebolCompetitionType) {
  if (competition === 'libertadores') {
    return qualifiedTeams.libertadoresRoundOf16.length >= 16
  }

  return (
    qualifiedTeams.sudamericanaRoundOf16Seeds.length >= 8 &&
    qualifiedTeams.sudamericanaPlayoffSeeds.length >= 16
  )
}

function getGroupQualifiedLabel(
  qualifiedTeams: ConmebolQualifiedTeam[],
  groupName: string,
  fallback: string
) {
  const teams = qualifiedTeams
    .filter((team) => team.group === groupName)
    .sort((a, b) => a.rank - b.rank)

  if (!teams.length) return fallback

  return teams.map((team) => `${team.rank}° ${team.group} - ${team.teamName}`).join(' / ')
}

function getQualifiedByGroupRank(
  qualifiedTeams: ConmebolQualifiedTeam[],
  groupName: string,
  rank: number
) {
  return qualifiedTeams.find(
    (team) => groupNameKey(team.group) === groupName && team.rank === rank
  ) ?? null
}

function qualifiedTeamToBracketTeam(
  team: ConmebolQualifiedTeam | null | undefined
): StoredConmebolBracketSeries['teamA'] {
  if (!team) return null

  return {
    id: team.teamExternalId ?? team.teamId ?? null,
    name: team.teamName,
    logo: team.logoUrl ?? team.teamLogo ?? null,
  }
}

function compareQualifiedPerformance(a: ConmebolQualifiedTeam, b: ConmebolQualifiedTeam) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    b.won - a.won ||
    a.teamName.localeCompare(b.teamName, 'es-AR', { numeric: true })
  )
}

function getSudamericanaPlayoffSeedPairs(qualifiedTeams: ConmebolQualifiedTeams) {
  const sudamericanaSeconds = qualifiedTeams.sudamericanaPlayoffs
    .filter((team) => team.sourceCompetition === 'sudamericana')
    .sort(compareQualifiedPerformance)
  const libertadoresThirds = [...qualifiedTeams.libertadoresThirdsToSudamericana]
    .sort(compareQualifiedPerformance)

  return EXPECTED_GROUPS.map((_, index) => ({
    libertadoresThird: libertadoresThirds[index] ?? null,
    sudamericanaSecond: sudamericanaSeconds[sudamericanaSeconds.length - 1 - index] ?? null,
  }))
}

function buildConmebolBracketSlotPlaceholders(
  competition: ConmebolCompetitionType,
  qualifiedTeams: ConmebolQualifiedTeams
): ConmebolBracketViewModelPlaceholder[] {
  const placeholders: ConmebolBracketViewModelPlaceholder[] = []

  if (competition === 'libertadores') {
    EXPECTED_GROUPS.forEach((_, index) => {
      placeholders.push({
        phase: 'roundOf16',
        slot: index + 1,
        homeSeed: 'A definir',
        awaySeed: 'A definir',
        teamA: null,
        teamB: null,
        source: 'standings_placeholder',
      })
    })

    return placeholders
  }

  getSudamericanaPlayoffSeedPairs(qualifiedTeams).forEach((pair, index) => {
    const sudamericanaSecond = pair.sudamericanaSecond
    const libertadoresThird = pair.libertadoresThird

    placeholders.push({
      phase: 'playoffs',
      slot: index + 1,
      homeSeed: 'A definir',
      awaySeed: 'A definir',
      teamA: qualifiedTeamToBracketTeam(libertadoresThird),
      teamB: qualifiedTeamToBracketTeam(sudamericanaSecond),
      source: 'standings_placeholder',
    })
  })

  EXPECTED_GROUPS.forEach((groupName, index) => {
    const groupWinner = getQualifiedByGroupRank(qualifiedTeams.sudamericanaRoundOf16, groupName, 1)

    placeholders.push({
      phase: 'roundOf16',
      slot: index + 1,
      homeSeed: 'A definir',
      awaySeed: 'A definir',
      teamA: qualifiedTeamToBracketTeam(groupWinner),
      teamB: null,
      source: 'standings_placeholder',
    })
  })

  return placeholders
}

function buildConmebolBracketPlaceholders(
  competition: ConmebolCompetitionType,
  qualifiedTeams: ConmebolQualifiedTeams
): ConmebolBracketViewModelPlaceholder[] {
  const useSlotPlaceholders: boolean = true

  if (useSlotPlaceholders) {
    return buildConmebolBracketSlotPlaceholders(competition, qualifiedTeams)
  }

  const placeholders: ConmebolBracketViewModelPlaceholder[] = []

  if (competition === 'libertadores') {
    EXPECTED_GROUPS.forEach((groupName, index) => {
      placeholders.push({
        phase: 'roundOf16',
        slot: index + 1,
        homeSeed: getGroupQualifiedLabel(
          qualifiedTeams.libertadoresRoundOf16,
          groupName,
          `${groupName} - A definir`
        ),
        awaySeed: 'A definir',
      })
    })

    return placeholders
  }

  EXPECTED_GROUPS.forEach((groupName, index) => {
    placeholders.push({
      phase: 'playoffs',
      slot: index + 1,
      homeSeed: getGroupQualifiedLabel(
        qualifiedTeams.sudamericanaPlayoffs.filter((team) => team.sourceCompetition === 'sudamericana'),
        groupName,
        `2° ${groupName}`
      ),
      awaySeed: '3° Libertadores - A definir',
    })
  })

  EXPECTED_GROUPS.forEach((groupName, index) => {
    placeholders.push({
      phase: 'roundOf16',
      slot: index + 1,
      homeSeed: getGroupQualifiedLabel(
        qualifiedTeams.sudamericanaRoundOf16,
        groupName,
        `1° ${groupName}`
      ),
      awaySeed: `Ganador Playoff ${index + 1}`,
    })
  })

  return placeholders
}

function countPlaceholdersByPhase(placeholders: ConmebolBracketViewModelPlaceholder[]) {
  return placeholders.reduce<Record<string, number>>((accumulator, placeholder) => {
    accumulator[placeholder.phase] = (accumulator[placeholder.phase] ?? 0) + 1
    return accumulator
  }, {})
}

function hasRenderableSlot(
  team: StoredConmebolBracketSeries['teamA'],
  seed: string | null | undefined
) {
  return Boolean(team?.name?.trim() || seed?.trim())
}

function getPlaceholderSlotAudit(placeholders: ConmebolBracketViewModelPlaceholder[]) {
  const missingSlotSides: Array<{
    phase: ConmebolPhaseKey
    slot: number
    side: 'teamA' | 'teamB'
  }> = []
  let missingLogos = 0

  for (const placeholder of placeholders) {
    if (!hasRenderableSlot(placeholder.teamA, placeholder.homeSeed)) {
      missingSlotSides.push({ phase: placeholder.phase, slot: placeholder.slot, side: 'teamA' })
    }

    if (!hasRenderableSlot(placeholder.teamB, placeholder.awaySeed)) {
      missingSlotSides.push({ phase: placeholder.phase, slot: placeholder.slot, side: 'teamB' })
    }

    for (const team of [placeholder.teamA, placeholder.teamB]) {
      if (team?.name?.trim() && !team.logo?.trim()) missingLogos += 1
    }
  }

  return { missingSlotSides, missingLogos }
}

function getConmebolPhaseSourceUsed(input: {
  competition: ConmebolCompetitionType
  matchesByPhase: Record<ConmebolPhaseKey, number>
  manualSeriesDetected: Record<string, number>
  placeholderSeriesDetected: Record<string, number>
}) {
  return Object.fromEntries(
    getConmebolPhaseOrder(input.competition)
      .filter((phase) => phase !== 'groups')
      .map((phase) => {
        if ((input.matchesByPhase[phase] ?? 0) > 0) return [phase, 'official_fixture']
        if ((input.manualSeriesDetected[phase] ?? 0) > 0) return [phase, 'manual_official_draw']
        if ((input.placeholderSeriesDetected[phase] ?? 0) > 0) return [phase, 'standings_placeholder']

        return [phase, 'empty']
      })
  ) as Record<Exclude<ConmebolPhaseKey, 'groups'>, 'official_fixture' | 'manual_official_draw' | 'standings_placeholder' | 'empty'>
}

function getSeriesSlotAudit(series: StoredConmebolBracketSeries[]) {
  const missingSlotSides: Array<{
    phase: ConmebolPhaseKey
    slot: number
    side: 'teamA' | 'teamB'
  }> = []
  let missingLogos = 0

  for (const item of series) {
    if (!hasRenderableSlot(item.teamA ?? null, item.homeSeed)) {
      missingSlotSides.push({ phase: item.phase, slot: item.slot, side: 'teamA' })
    }

    if (!hasRenderableSlot(item.teamB ?? null, item.awaySeed)) {
      missingSlotSides.push({ phase: item.phase, slot: item.slot, side: 'teamB' })
    }

    for (const team of [item.teamA, item.teamB]) {
      if (team?.name?.trim() && !team.logo?.trim()) missingLogos += 1
    }
  }

  return { missingSlotSides, missingLogos }
}

function buildBracketSlotDetails(input: {
  competition: ConmebolCompetitionType
  bracketSlots: Record<Exclude<ConmebolPhaseKey, 'groups'>, number>
  officialSeriesDetected: Record<string, number>
  manualSeries: StoredConmebolBracketSeries[]
  placeholderSeriesDetected: Record<string, number>
  placeholderSlotAudit: ReturnType<typeof getPlaceholderSlotAudit>
  matchesByPhase: Record<ConmebolPhaseKey, number>
}) {
  const manualByPhase = input.manualSeries.reduce<Record<string, StoredConmebolBracketSeries[]>>((accumulator, item) => {
    accumulator[item.phase] = [...(accumulator[item.phase] ?? []), item]
    return accumulator
  }, {})
  const manualSlotAudit = getSeriesSlotAudit(input.manualSeries)

  return Object.fromEntries(
    getConmebolPhaseOrder(input.competition)
      .filter((phase) => phase !== 'groups')
      .map((phase) => {
        const knockoutPhase = phase as Exclude<ConmebolPhaseKey, 'groups'>
        const officialSeries = input.officialSeriesDetected[phase] ?? 0
        const phaseManual = manualByPhase[phase] ?? []
        const placeholderSeries = input.placeholderSeriesDetected[phase] ?? 0
        const source =
          (input.matchesByPhase[phase] ?? 0) > 0
            ? 'official_fixture'
            : phaseManual.length
              ? 'manual_official_draw'
              : placeholderSeries
                ? 'standings_placeholder'
                : 'empty'
        const missingSlotSides =
          source === 'manual_official_draw'
            ? manualSlotAudit.missingSlotSides.filter((item) => item.phase === phase).length
            : source === 'standings_placeholder'
              ? input.placeholderSlotAudit.missingSlotSides.filter((item) => item.phase === phase).length
              : 0
        const missingLogos =
          source === 'manual_official_draw'
            ? getSeriesSlotAudit(phaseManual).missingLogos
            : source === 'standings_placeholder'
              ? input.placeholderSlotAudit.missingLogos
              : 0

        return [
          phase,
          {
            totalSeries: input.bracketSlots[knockoutPhase] ?? 0,
            completeSeries:
              source === 'official_fixture'
                ? officialSeries
                : source === 'manual_official_draw'
                  ? phaseManual.filter((item) =>
                      hasRenderableSlot(item.teamA ?? null, item.homeSeed) &&
                      hasRenderableSlot(item.teamB ?? null, item.awaySeed)
                    ).length
                  : source === 'standings_placeholder'
                    ? placeholderSeries
                    : 0,
            missingSlotSides,
            missingLogos,
          },
        ]
      })
  )
}

function buildConmebolGroupCards(
  standings: LeagueStandingGroup[],
  fixtures: LeagueFixtureSummary[]
): ConmebolGroupCardViewModel[] {
  const groupTables = getConmebolGroupTables(standings)
  const groupByTeamKey = new Map<string, string>()

  for (const group of groupTables) {
    for (const row of group.rows) {
      groupByTeamKey.set(getTeamKey(row.teamId, row.teamName), group.name)
      groupByTeamKey.set(getTeamKey(null, row.teamName), group.name)
    }
  }

  const fixturesByGroup = new Map<string, LeagueFixtureSummary[]>()

  for (const fixture of fixtures) {
    if (!isConmebolGroupRound(fixture.round)) continue

    const homeGroup = groupByTeamKey.get(getTeamKey(fixture.homeId, fixture.home))
    const awayGroup = groupByTeamKey.get(getTeamKey(fixture.awayId, fixture.away))
    const groupName = homeGroup && homeGroup === awayGroup ? homeGroup : null

    if (!groupName) continue

    const current = fixturesByGroup.get(groupName) ?? []
    current.push(fixture)
    fixturesByGroup.set(groupName, current)
  }

  return groupTables.map((group, index) => ({
    id: `${group.name}-${index}`,
    title: group.name,
    rows: group.rows,
    fixtures: [...(fixturesByGroup.get(group.name) ?? [])].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
      const dateB = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER

      if (dateA !== dateB) return dateA - dateB

      return String(a.id).localeCompare(String(b.id), 'es-AR', { numeric: true })
    }),
  }))
}

function getAgendaPhases(fixtures: LeagueFixtureSummary[], competition: ConmebolCompetitionType) {
  const labels = new Set<string>()

  for (const fixture of fixtures) {
    const phase = getFixturePhase(fixture, competition)

    if (phase && phase !== 'groups') {
      labels.add(getConmebolPhaseLabel(phase))
      continue
    }

    if (isConmebolGroupRound(fixture.round)) {
      const roundNumber = getConmebolGroupRoundNumber(fixture.round)
      labels.add(roundNumber ? `Fase de grupos - Fecha ${roundNumber}` : 'Fase de grupos')
    }
  }

  return [...labels]
}

function hasValidFixtureDate(date: string | null | undefined) {
  if (!date) return false

  return Number.isFinite(new Date(date).getTime())
}

function buildConmebolAgendaAudit(input: {
  fixtures: LeagueFixtureSummary[]
  competition: ConmebolCompetitionType
  matchesByPhase: Record<ConmebolPhaseKey, number>
  manualSeriesDetected: Record<string, number>
  placeholderSeriesDetected: Record<string, number>
}) {
  const scheduledMatchesByPhase = Object.fromEntries(
    ALL_CONMEBOL_PHASES.map((phase) => [phase, 0])
  ) as Record<ConmebolPhaseKey, number>

  for (const fixture of input.fixtures) {
    const phase = getFixturePhase(fixture, input.competition)
    if (!phase || !hasValidFixtureDate(fixture.date)) continue

    scheduledMatchesByPhase[phase] += 1
  }

  const labels: string[] = []
  const addLabel = (label: string) => {
    if (!labels.includes(label)) labels.push(label)
  }
  const itemsByPhase = Object.fromEntries(
    ALL_CONMEBOL_PHASES.map((phase) => [phase, input.matchesByPhase[phase] ?? 0])
  ) as Record<ConmebolPhaseKey, number>
  let scheduledItems = 0
  let unscheduledItems = 0
  let usesManualDrawAsAgenda = false
  let usesPlaceholdersAsAgenda = false
  const warnings: string[] = []

  for (const phase of getConmebolPhaseOrder(input.competition)) {
    if (phase === 'groups') {
      const total = input.matchesByPhase.groups ?? 0
      const scheduled = scheduledMatchesByPhase.groups ?? 0

      scheduledItems += scheduled
      unscheduledItems += Math.max(total - scheduled, 0)
      continue
    }

    const officialMatches = input.matchesByPhase[phase] ?? 0
    const manualSeries = input.manualSeriesDetected[phase] ?? 0
    const placeholderSeries = input.placeholderSeriesDetected[phase] ?? 0
    const scheduledOfficialMatches = scheduledMatchesByPhase[phase] ?? 0

    if (officialMatches > 0) {
      itemsByPhase[phase] = officialMatches
      scheduledItems += scheduledOfficialMatches
      unscheduledItems += Math.max(officialMatches - scheduledOfficialMatches, 0)
      addLabel(getConmebolPhaseLabel(phase))
      continue
    }

    if (manualSeries > 0) {
      itemsByPhase[phase] = manualSeries
      unscheduledItems += manualSeries
      usesManualDrawAsAgenda = true
      addLabel(getConmebolPhaseLabel(phase))
      continue
    }

    if (placeholderSeries > 0) {
      itemsByPhase[phase] = placeholderSeries
      unscheduledItems += placeholderSeries
      usesPlaceholdersAsAgenda = true
      addLabel(getConmebolPhaseLabel(phase))
    }
  }

  for (const label of getAgendaPhases(input.fixtures, input.competition)) {
    addLabel(label)
  }

  if (usesManualDrawAsAgenda) {
    warnings.push('La agenda usa series manuales oficiales sin fecha; se muestran como A programar.')
  }

  if (usesPlaceholdersAsAgenda) {
    warnings.push('La agenda usa placeholders de bracket sin fecha; se muestran como A programar.')
  }

  return {
    phasesAvailable: labels,
    itemsByPhase,
    scheduledItems,
    unscheduledItems,
    usesManualDrawAsAgenda,
    warnings,
  }
}

async function readRawMatchAuditRows(supabase: SupabaseClient, leagueId: DbId | null) {
  if (!leagueId) return []

  const response = await supabase
    .from('matches')
    .select('id, external_id, round, match_date, home_team_id, away_team_id')
    .eq('league_id', String(leagueId))
    .limit(2000)

  if (response.error) throw response.error

  return (response.data ?? []) as MatchAuditRow[]
}

function findDuplicateFixtures(rows: MatchAuditRow[]) {
  const byExternalId = new Map<string, MatchAuditRow[]>()
  const byNaturalKey = new Map<string, MatchAuditRow[]>()

  for (const row of rows) {
    if (row.external_id !== null && row.external_id !== undefined) {
      const key = String(row.external_id)
      const current = byExternalId.get(key) ?? []
      current.push(row)
      byExternalId.set(key, current)
    }

    const naturalKey = [
      normalizeText(row.round),
      row.match_date ?? 'sin-fecha',
      row.home_team_id ?? 'sin-local',
      row.away_team_id ?? 'sin-visitante',
    ].join('|')
    const current = byNaturalKey.get(naturalKey) ?? []
    current.push(row)
    byNaturalKey.set(naturalKey, current)
  }

  return [
    ...[...byExternalId.entries()]
      .filter(([, duplicates]) => duplicates.length > 1)
      .map(([externalId, duplicates]) => ({
        type: 'external_id',
        key: externalId,
        matchIds: duplicates.map((row) => row.id),
      })),
    ...[...byNaturalKey.entries()]
      .filter(([key, duplicates]) => !key.includes('sin-local') && !key.includes('sin-visitante') && duplicates.length > 1)
      .map(([key, duplicates]) => ({
        type: 'round_date_teams',
        key,
        matchIds: duplicates.map((row) => row.id),
      })),
  ]
}

function detectLeaguePhaseSignal(fixtures: LeagueFixtureSummary[]) {
  return fixtures.some((fixture) => {
    const normalized = normalizeText(fixture.round)

    return normalized.includes('league phase') || normalized.includes('fase liga')
  })
}

export async function buildConmebolBracketViewModel(input: {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
  readMode?: FootballPublicReadMode
}): Promise<ConmebolBracketViewModel> {
  const info = getCompetitionInfo(input.competition, input.leagueExternalId)
  const loadStandings =
    input.readMode === 'cache-only' ? readCachedLeagueStandings : getLeagueStandings
  const [fixtures, standings, series, qualifiedTeams] = await Promise.all([
    getLeagueFixtures(info.leagueExternalId, input.season).catch((error) => {
      console.warn('[conmebol-view-model] fixtures unavailable', error)
      return [] as LeagueFixtureSummary[]
    }),
    loadStandings(info.leagueExternalId, input.season).catch((error) => {
      console.warn('[conmebol-view-model] standings unavailable', error)
      return [] as LeagueStandingGroup[]
    }),
    getConmebolStoredBracketSeries({
      competition: input.competition,
      leagueExternalId: info.leagueExternalId,
      season: input.season,
    }).catch((error) => {
      console.warn('[conmebol-view-model] stored series unavailable', error)
      return [] as StoredConmebolBracketSeries[]
    }),
    getConmebolQualifiedTeams({
      competition: input.competition,
      leagueExternalId: info.leagueExternalId,
      season: input.season,
      readMode: input.readMode,
    }),
  ])
  const phases = getConmebolPhaseOrder(input.competition)
  const matchesByPhase = countMatchesByPhase(fixtures, input.competition)
  const officialFixturesFound = phases
    .filter((phase) => phase !== 'groups')
    .some((phase) => matchesByPhase[phase] > 0)
  const manualSeriesDetected = series.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.phase] = (accumulator[row.phase] ?? 0) + 1
    return accumulator
  }, {})
  const bracketPlaceholders = buildConmebolBracketPlaceholders(input.competition, qualifiedTeams)
  const placeholderSeriesDetected = countPlaceholdersByPhase(bracketPlaceholders)
  const agendaAudit = buildConmebolAgendaAudit({
    fixtures,
    competition: input.competition,
    matchesByPhase,
    manualSeriesDetected,
    placeholderSeriesDetected,
  })
  const warnings: string[] = []

  if (!officialFixturesFound) warnings.push('No hay fixtures eliminatorios oficiales; se usan placeholders.')
  if (!hasQualifiedTeamsFromStandings(qualifiedTeams, input.competition)) {
    warnings.push('No estan completos los clasificados desde standings.')
  }
  if (detectLeaguePhaseSignal(fixtures)) {
    warnings.push('Se detecto una fase liga que no corresponde al formato Conmebol.')
  }

  return {
    competition: input.competition,
    season: input.season,
    leagueExternalId: info.leagueExternalId,
    bracket: {
      phases,
      series,
      placeholders: bracketPlaceholders,
      officialFixturesFound,
    },
    agenda: {
      phases: agendaAudit.phasesAvailable,
      selectedPhase:
        phases
          .filter((phase) => phase !== 'groups')
          .map(getConmebolPhaseLabel)
          .find((phaseLabel) => agendaAudit.phasesAvailable.includes(phaseLabel)) ??
        getConmebolPhaseLabel(phases.find((phase) => phase !== 'groups') ?? 'groups'),
      matchesByPhase,
      itemsByPhase: agendaAudit.itemsByPhase,
      scheduledItems: agendaAudit.scheduledItems,
      unscheduledItems: agendaAudit.unscheduledItems,
      usesManualDrawAsAgenda: agendaAudit.usesManualDrawAsAgenda,
    },
    groups: {
      groupCards: buildConmebolGroupCards(standings, fixtures),
    },
    qualifiedTeams,
    warnings,
  }
}

export async function getConmebolBracketAudit(input: {
  competition: ConmebolCompetitionType
  leagueExternalId?: number | null
  season: number
}) {
  const supabase = getSupabaseAdminClient()
  const info = getCompetitionInfo(input.competition, input.leagueExternalId)
  const league = await getLeagueByExternalId(supabase, info.leagueExternalId, input.season)
  const [
    fixturesResult,
    standingsResult,
    manualSeriesResult,
    rawRows,
    qualifiedTeamsResult,
    rawApiRoundsResult,
  ] = await Promise.all([
    getLeagueFixtures(info.leagueExternalId, input.season).catch((error) => {
      console.warn('[conmebol-bracket-audit] fixtures unavailable', error)
      return [] as LeagueFixtureSummary[]
    }),
    getLeagueStandings(info.leagueExternalId, input.season).catch((error) => {
      console.warn('[conmebol-bracket-audit] standings unavailable', error)
      return []
    }),
    getConmebolStoredBracketSeries({
      competition: input.competition,
      leagueExternalId: info.leagueExternalId,
      season: input.season,
    }).catch((error) => {
      console.warn('[conmebol-bracket-audit] manual series unavailable', error)
      return [] as StoredConmebolBracketSeries[]
    }),
    readRawMatchAuditRows(supabase, league?.id ?? null),
    getConmebolQualifiedTeams({
      competition: input.competition,
      leagueExternalId: info.leagueExternalId,
      season: input.season,
    }).catch((error) => {
      console.warn('[conmebol-bracket-audit] qualified teams unavailable', error)
      return getEmptyConmebolQualifiedTeams()
    }),
    getConmebolRawRoundsAudit({
      competition: input.competition,
      leagueExternalId: info.leagueExternalId,
      season: input.season,
    }).catch((error) => {
      console.warn('[conmebol-bracket-audit] raw API rounds unavailable', error)
      return null
    }),
  ])
  const groupTables = getConmebolGroupTables(standingsResult)
  const groupNames = groupTables.map((group) => groupNameKey(group.name))
  const missingGroups = EXPECTED_GROUPS.filter((group) => !groupNames.includes(group))
  const teamsByGroup = groupTables.map((group) => ({
    group: groupNameKey(group.name),
    teams: group.rows.length,
  }))
  const matchesByPhase = countMatchesByPhase(fixturesResult, input.competition)
  const phasesExpected = getConmebolPhaseOrder(input.competition)
    .filter((phase) => phase !== 'groups')
    .map((phase) => getConmebolPhaseLabel(phase))
  const phasesFound = getConmebolPhaseOrder(input.competition)
    .filter((phase) => phase !== 'groups' && matchesByPhase[phase] > 0)
    .map((phase) => getConmebolPhaseLabel(phase))
  const expectedFixtures = EXPECTED_KNOCKOUT_FIXTURES[input.competition]
  const missingFixtures = Object.entries(expectedFixtures)
    .filter(([phase, expected]) => expected > 0 && (matchesByPhase[phase as ConmebolPhaseKey] ?? 0) < expected)
    .map(([phase, expected]) => ({
      phase: getConmebolPhaseLabel(phase as ConmebolPhaseKey),
      expected,
      found: matchesByPhase[phase as ConmebolPhaseKey] ?? 0,
    }))
  const duplicatedFixtures = findDuplicateFixtures(rawRows)
  const matchesWithoutTeams = rawRows
    .filter((row) => !row.home_team_id || !row.away_team_id)
    .map((row) => row.id)
  const matchesWithoutDate = rawRows
    .filter((row) => !row.match_date)
    .map((row) => row.id)
  const officialSeriesDetected = countSeriesByPhase(fixturesResult, input.competition)
  const manualSeriesDetected = manualSeriesResult.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.phase] = (accumulator[row.phase] ?? 0) + 1
    return accumulator
  }, {})
  const bracketPlaceholders = buildConmebolBracketPlaceholders(input.competition, qualifiedTeamsResult)
  const placeholderSeriesDetected = countPlaceholdersByPhase(bracketPlaceholders)
  const placeholderSlotAudit = getPlaceholderSlotAudit(bracketPlaceholders)
  const bracketSlots = Object.fromEntries(
    Object.entries(EXPECTED_KNOCKOUT_SERIES[input.competition]).map(([phase, expected]) => [
      phase,
      Math.max(
        expected,
        officialSeriesDetected[phase] ?? 0,
        manualSeriesDetected[phase] ?? 0,
        placeholderSeriesDetected[phase] ?? 0
      ),
    ])
  ) as Record<Exclude<ConmebolPhaseKey, 'groups'>, number>
  const sourceUsedByPhase = getConmebolPhaseSourceUsed({
    competition: input.competition,
    matchesByPhase,
    manualSeriesDetected,
    placeholderSeriesDetected,
  })
  const agendaAudit = buildConmebolAgendaAudit({
    fixtures: fixturesResult,
    competition: input.competition,
    matchesByPhase,
    manualSeriesDetected,
    placeholderSeriesDetected,
  })
  const bracketSlotDetails = buildBracketSlotDetails({
    competition: input.competition,
    bracketSlots,
    officialSeriesDetected,
    manualSeries: manualSeriesResult,
    placeholderSeriesDetected,
    placeholderSlotAudit,
    matchesByPhase,
  })
  const officialKnockoutMatches = getConmebolPhaseOrder(input.competition)
    .filter((phase) => phase !== 'groups')
    .reduce((sum, phase) => sum + (matchesByPhase[phase] ?? 0), 0)
  const placeholdersNeeded = officialKnockoutMatches === 0 || missingFixtures.length > 0
  const warnings: string[] = []

  if (!league) warnings.push('No hay liga Conmebol resuelta en Supabase para ese external_id/temporada.')
  if (detectLeaguePhaseSignal(fixturesResult)) warnings.push('Se detecto formato tipo Champions/fase liga en una copa Conmebol.')
  if (input.competition === 'sudamericana' && matchesByPhase.playoffs === 0 && !manualSeriesResult.some((row) => row.phase === 'playoffs')) {
    warnings.push('Sudamericana no tiene playoffs / eliminatoria de octavos cargada.')
  }
  if (officialKnockoutMatches === 0) warnings.push('Fases eliminatorias oficiales vacias; se necesitan placeholders.')
  if (!hasQualifiedTeamsFromStandings(qualifiedTeamsResult, input.competition)) {
    warnings.push('Clasificados desde standings incompletos para armar seeds/placeholders.')
  }
  if (missingGroups.length) warnings.push(`Faltan grupos: ${missingGroups.join(', ')}.`)
  if (!groupTables.length) warnings.push('Faltan standings para detectar clasificados.')
  if (rawApiRoundsResult && !rawApiRoundsResult.knockoutCandidates.length) {
    warnings.push('API-Football no trae rounds eliminatorios crudos todavia.')
  }
  if (rawApiRoundsResult?.unmatchedRounds.some((round) => round.knockoutCandidate)) {
    warnings.push('Hay rounds crudos candidatos a eliminatoria sin normalizar.')
  }
  if (duplicatedFixtures.length) warnings.push('Hay partidos duplicados en Supabase.')
  if (matchesWithoutTeams.length) warnings.push('Hay partidos sin equipos.')
  if (matchesWithoutDate.length) warnings.push('Hay partidos sin fecha.')

  return {
    ok: true,
    competition: input.competition,
    leagueExternalId: info.leagueExternalId,
    season: input.season,
    officialFixturesFound: officialKnockoutMatches > 0,
    reason:
      officialKnockoutMatches > 0
        ? 'official_fixtures_found'
        : rawApiRoundsResult && !rawApiRoundsResult.knockoutCandidates.length
          ? 'api_not_loaded_yet'
          : 'no_official_knockout_fixtures',
    manualDrawFound: manualSeriesResult.length > 0,
    rawRoundsFound: rawApiRoundsResult?.rawRoundsFromApi ?? [],
    normalizedPhasesFound: rawApiRoundsResult?.normalizedKnockoutPhases ?? phasesFound,
    matchesByPhase,
    qualifiedTeams: qualifiedTeamsResult,
    standingsFound: groupTables.length > 0,
    placeholdersNeeded,
    missingFixtures,
    manualDrawSeries: manualSeriesResult,
    sourceUsedByPhase,
    bracketSlotCounts: bracketSlots,
    bracketSlots: bracketSlotDetails,
    missingSlotSides: placeholderSlotAudit.missingSlotSides,
    missingLogos: placeholderSlotAudit.missingLogos,
    visibleSeedLabels: false,
    qualifiedTeamsUsedInsideBracket: bracketPlaceholders.length > 0 && hasQualifiedTeamsFromStandings(qualifiedTeamsResult, input.competition),
    separateQualifiedCardRendered: false,
    groupStage: {
      groupsFound: groupNames,
      teamsByGroup,
      missingGroups,
      standingsReady:
        missingGroups.length === 0 &&
        teamsByGroup.length >= EXPECTED_GROUPS.length &&
        teamsByGroup.every((group) => group.teams >= 4),
      qualifiedTeams: qualifiedTeamsResult,
    },
    knockout: {
      phasesExpected,
      phasesFound,
      officialFixturesFound: officialKnockoutMatches > 0,
      matchesByPhase,
      seriesDetected: {
        official: officialSeriesDetected,
        manual: manualSeriesDetected,
        placeholders: placeholderSeriesDetected,
      },
      placeholdersNeeded,
      missingFixtures,
      duplicatedFixtures,
      matchesWithoutTeams,
      matchesWithoutDate,
    },
    agenda: {
      ...agendaAudit,
      matchesByPhase,
    },
    warnings,
  }
}

async function fetchConmebolApiFixtures(options: SyncConmebolKnockoutsOptions) {
  const info = getCompetitionInfo(options.competition, options.leagueExternalId)
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      league: info.leagueExternalId,
      season: options.season,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-conmebol-knockouts:${options.competition}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) throw new Error(apiErrors.join(' | '))

  return payload.response ?? []
}

function getRawRound(fixture: ApiFixture) {
  return fixture.league.round?.trim() || 'Sin round'
}

function countApiFixturesByRound(fixtures: ApiFixture[]) {
  const counts = new Map<string, number>()

  for (const fixture of fixtures) {
    const round = getRawRound(fixture)
    counts.set(round, (counts.get(round) ?? 0) + 1)
  }

  return Object.fromEntries(
    [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]

      return a[0].localeCompare(b[0], 'es-AR', { numeric: true })
    })
  )
}

function countApiMatchesByPhase(fixtures: ApiFixture[], competition: ConmebolCompetitionType) {
  const counts = new Map<ConmebolPhaseKey, number>()

  for (const fixture of fixtures) {
    const phase = getApiFixturePhase(fixture, competition)
    if (!phase) continue

    counts.set(phase, (counts.get(phase) ?? 0) + 1)
  }

  return Object.fromEntries(
    ALL_CONMEBOL_PHASES.map((phase) => [phase, counts.get(phase) ?? 0])
  ) as Record<ConmebolPhaseKey, number>
}

function isPotentialKnockoutRound(round: string) {
  const normalized = normalizeText(round)

  return (
    normalized.includes('round of 16') ||
    normalized.includes('8th finals') ||
    normalized.includes('eighth finals') ||
    normalized.includes('last 16') ||
    normalized.includes('octavos') ||
    normalized.includes('quarter') ||
    normalized.includes('cuartos') ||
    normalized.includes('semi') ||
    normalized.includes('final') ||
    normalized.includes('knockout') ||
    normalized.includes('playoff') ||
    normalized.includes('play off') ||
    normalized.includes('play offs') ||
    normalized.includes('eliminatoria')
  )
}

function buildRawRoundsSummary(fixtures: ApiFixture[], competition: ConmebolCompetitionType) {
  const rawFixturesCountByRound = countApiFixturesByRound(fixtures)
  const normalizedRounds = Object.entries(rawFixturesCountByRound).map(([round, count]) => {
    const audit = auditConmebolRound(round, competition)

    return {
      round,
      count,
      normalized: audit.normalized,
      includedInBracket: audit.includedInBracket,
      reason: audit.reason,
    }
  })
  const unmatchedRounds = normalizedRounds
    .filter((round) => !round.normalized)
    .map((round) => ({
      round: round.round,
      count: round.count,
      reason: round.reason,
      knockoutCandidate: isPotentialKnockoutRound(round.round),
    }))
  const knockoutCandidates = normalizedRounds
    .filter((round) => round.includedInBracket || isPotentialKnockoutRound(round.round))
    .map((round) => ({
      round: round.round,
      count: round.count,
      normalized: round.normalized,
      includedInBracket: round.includedInBracket,
      reason: round.reason,
    }))

  return {
    rawRoundsFromApi: Object.keys(rawFixturesCountByRound),
    rawFixturesCountByRound,
    normalizedRounds,
    unmatchedRounds,
    knockoutCandidates,
  }
}

export async function getConmebolRawRoundsAudit(input: SyncConmebolKnockoutsOptions) {
  const info = getCompetitionInfo(input.competition, input.leagueExternalId)
  const fixtures = await fetchConmebolApiFixtures({
    ...input,
    leagueExternalId: info.leagueExternalId,
  })
  const summary = buildRawRoundsSummary(fixtures, input.competition)
  const normalizedKnockoutPhases = [
    ...new Set(
      summary.normalizedRounds
        .filter((round) => round.includedInBracket && round.normalized && round.normalized !== 'groups')
        .map((round) => round.normalized as ConmebolPhaseKey)
    ),
  ]
  const candidateRoundsWithoutNormalization = summary.knockoutCandidates
    .filter((round) => !round.normalized)
    .map((round) => round.round)
  const warnings: string[] = []

  if (!summary.knockoutCandidates.length) {
    warnings.push('API-Football no devolvio rounds con pinta de fase eliminatoria para esta copa/temporada.')
  }
  if (candidateRoundsWithoutNormalization.length) {
    warnings.push(`Hay candidatos eliminatorios sin normalizar: ${candidateRoundsWithoutNormalization.join(', ')}.`)
  }

  return {
    ok: true,
    competition: input.competition,
    leagueExternalId: info.leagueExternalId,
    season: input.season,
    rawRoundsFromApi: summary.rawRoundsFromApi,
    rawFixturesCountByRound: summary.rawFixturesCountByRound,
    normalizedRounds: summary.normalizedRounds,
    normalizedKnockoutPhases,
    unmatchedRounds: summary.unmatchedRounds,
    knockoutCandidates: summary.knockoutCandidates,
    warnings,
  }
}

function getApiFixturePhase(fixture: ApiFixture, competition: ConmebolCompetitionType) {
  return normalizeConmebolRound(fixture.league.round, competition)
}

function summarizeApiFixture(fixture: ApiFixture) {
  return {
    fixtureId: fixture.fixture.id,
    round: fixture.league.round ?? null,
    date: fixture.fixture.date,
    home: fixture.teams.home.name ?? 'A definir',
    away: fixture.teams.away.name ?? 'A definir',
  }
}

export async function syncConmebolKnockouts(options: SyncConmebolKnockoutsOptions) {
  const info = getCompetitionInfo(options.competition, options.leagueExternalId)
  const warnings: string[] = []
  const [fixtures, qualifiedTeams] = await Promise.all([
    fetchConmebolApiFixtures(options),
    getConmebolQualifiedTeams({
      competition: options.competition,
      leagueExternalId: info.leagueExternalId,
      season: options.season,
    }).catch((error) => {
      warnings.push(`No se pudieron resolver clasificados desde standings: ${error instanceof Error ? error.message : String(error)}`)

      return getEmptyConmebolQualifiedTeams()
    }),
  ])
  const rawRoundsSummary = buildRawRoundsSummary(fixtures, options.competition)
  const matchesByPhase = countApiMatchesByPhase(fixtures, options.competition)
  const knockoutFixtures = fixtures.filter((fixture) => {
    const phase = getApiFixturePhase(fixture, options.competition)
    return Boolean(phase && phase !== 'groups')
  })
  const normalizedPhasesFound = [
    ...new Set(
      knockoutFixtures
        .map((fixture) => getApiFixturePhase(fixture, options.competition))
        .filter((phase): phase is ConmebolPhaseKey => Boolean(phase && phase !== 'groups'))
    ),
  ]
  const phasesFound = normalizedPhasesFound.map(getConmebolPhaseLabel)
  const officialFixturesFound = knockoutFixtures.length > 0
  const qualifiedTeamsFromStandings = hasQualifiedTeamsFromStandings(qualifiedTeams, options.competition)
  const shouldSync = !options.dryRun && officialFixturesFound
  let syncResult: Awaited<ReturnType<typeof syncCompetitionFull>> | null = null

  if (!officialFixturesFound) {
    warnings.push('API-Football todavia no devolvio cruces eliminatorios oficiales.')
  }
  const unmatchedKnockoutCandidates = rawRoundsSummary.knockoutCandidates
    .filter((round) => !round.normalized)
    .map((round) => round.round)
  if (unmatchedKnockoutCandidates.length) {
    warnings.push(`API-Football devolvio rounds candidatos no normalizados: ${unmatchedKnockoutCandidates.join(', ')}.`)
  }
  if (!officialFixturesFound && !qualifiedTeamsFromStandings) {
    warnings.push('Standings incompletos: no se pueden mostrar todos los seeds clasificados.')
  }

  if (shouldSync) {
    const supabase = getSupabaseAdminClient()

    syncResult = await syncCompetitionFull(supabase, {
      competition: info.slug,
      leagueExternalId: String(info.leagueExternalId),
      season: options.season,
      syncEvents: false,
      debug: false,
    })

    if (syncResult.errors.length) {
      warnings.push(...syncResult.errors.slice(0, 5))
    }
  }

  return {
    ok: !syncResult || syncResult.errors.length === 0,
    competition: options.competition,
    leagueExternalId: info.leagueExternalId,
    season: options.season,
    rawRoundsFound: rawRoundsSummary.rawRoundsFromApi,
    rawFixturesCountByRound: rawRoundsSummary.rawFixturesCountByRound,
    officialFixturesFound,
    reason:
      officialFixturesFound
        ? 'official_fixtures_found'
        : rawRoundsSummary.knockoutCandidates.length === 0
          ? 'api_not_loaded_yet'
          : 'no_official_knockout_fixtures',
    normalizedPhasesFound,
    phasesFound,
    matchesByPhase,
    matchesSynced: shouldSync ? knockoutFixtures.length : 0,
    unmatchedRounds: rawRoundsSummary.unmatchedRounds,
    placeholdersNeeded: !officialFixturesFound,
    qualifiedTeamsFromStandings,
    qualifiedTeamsFound: getQualifiedTeamCount(qualifiedTeams, options.competition),
    warnings,
    sample: knockoutFixtures.slice(0, 8).map(summarizeApiFixture),
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
  }
}

export async function syncConmebolStandings(options: SyncConmebolStandingsOptions) {
  const supabase = getSupabaseAdminClient()
  const info = getCompetitionInfo(options.competition, options.leagueExternalId)
  const targets = [
    {
      competition: options.competition,
      leagueExternalId: info.leagueExternalId,
    },
  ]

  if (options.competition === 'sudamericana') {
    targets.push({
      competition: 'libertadores',
      leagueExternalId: CONMEBOL_COMPETITIONS.libertadores.leagueExternalId,
    })
  }

  const results = await Promise.all(
    targets.map((target) =>
      syncLeagueStandingsCache(supabase, {
        leagueExternalId: target.leagueExternalId,
        season: options.season,
        logContext: `sync-conmebol-standings:${target.competition}`,
      }).then((result) => ({
        competition: target.competition,
        leagueExternalId: target.leagueExternalId,
        ...result,
      }))
    )
  )
  const warnings = results.flatMap((result) => result.warnings)
  const errors = results.flatMap((result) => result.errors)

  return {
    ok: errors.length === 0,
    competition: options.competition,
    leagueExternalId: info.leagueExternalId,
    season: options.season,
    standingsChecked: results.reduce((sum, result) => sum + result.standingsChecked, 0),
    standingsSynced: results.reduce((sum, result) => sum + result.standingsSynced, 0),
    groupsDetected: [...new Set(results.flatMap((result) => result.groupsDetected))],
    targets: results,
    warnings,
    errors,
  }
}

export async function upsertConmebolDraw(input: UpsertConmebolDrawInput) {
  const info = getCompetitionInfo(input.competition)
  const phase = normalizeManualPhase(input.phase, input.competition)

  if (!phase || phase === 'groups') {
    throw new Error('Fase invalida para carga manual Conmebol.')
  }

  if (input.competition === 'libertadores' && phase === 'playoffs') {
    throw new Error('Libertadores no tiene fase playoffs en el cuadro principal.')
  }

  const supabase = getSupabaseAdminClient()
  const league = await getLeagueByExternalId(supabase, info.leagueExternalId, input.season)
  const warnings: string[] = []
  const source = input.source?.trim() || 'manual_official_draw'
  const rows = []
  const participantRows = await getConmebolDrawParticipantRows({
    competition: input.competition,
    season: input.season,
  })
  const teamsByExternalId = await fetchTeamsByExternalIds(
    supabase,
    [...getParticipantExternalIds(participantRows)]
  )
  const resolvedTeams: ConmebolDrawTeamResolution[] = []
  const unresolvedTeams: string[] = []

  for (const item of input.series) {
    if (!Number.isFinite(Number(item.slot)) || Number(item.slot) <= 0) {
      throw new Error('Cada serie debe tener slot positivo.')
    }

    let teamA: ConmebolDrawTeamResolution | null = null
    let teamB: ConmebolDrawTeamResolution | null = null

    try {
      teamA = await resolveConmebolDrawTeam({
        name: item.teamAName,
        externalId: item.teamAExternalId,
        competition: input.competition,
        season: input.season,
        participantRows,
        teamsByExternalId,
        supabase,
      })
    } catch (error) {
      unresolvedTeams.push(item.teamAName ?? String(item.teamAExternalId ?? `slot ${item.slot} equipo A`))
      warnings.push(error instanceof Error ? error.message : String(error))
    }

    try {
      teamB = await resolveConmebolDrawTeam({
        name: item.teamBName,
        externalId: item.teamBExternalId,
        competition: input.competition,
        season: input.season,
        participantRows,
        teamsByExternalId,
        supabase,
      })
    } catch (error) {
      unresolvedTeams.push(item.teamBName ?? String(item.teamBExternalId ?? `slot ${item.slot} equipo B`))
      warnings.push(error instanceof Error ? error.message : String(error))
    }

    if (unresolvedTeams.length) continue

    if (teamA) resolvedTeams.push(teamA)
    if (teamB) resolvedTeams.push(teamB)

    rows.push({
      competition: input.competition,
      league_id: league?.id ? String(league.id) : null,
      league_external_id: String(info.leagueExternalId),
      season: input.season,
      phase,
      slot: Number(item.slot),
      home_seed: teamA ? null : 'A definir',
      away_seed: teamB ? null : 'A definir',
      team_a_id: teamA?.id ?? null,
      team_b_id: teamB?.id ?? null,
      source,
      status: 'official_draw',
      leg1_date: item.leg1Date || null,
      leg2_date: item.leg2Date || null,
    })
  }

  if (unresolvedTeams.length) {
    throw new Error(`No se pudieron resolver equipos del sorteo: ${[...new Set(unresolvedTeams)].join(', ')}.`)
  }

  if (!rows.length) {
    return {
      ok: true,
      competition: input.competition,
      season: input.season,
      phase,
      upserted: 0,
      resolvedTeams,
      unresolvedTeams,
      warnings,
    }
  }

  const response = await supabase
    .from('conmebol_bracket_series')
    .upsert(rows, { onConflict: 'league_external_id,season,phase,slot' })
    .select('id, phase, slot')

  if (response.error) throw response.error

  return {
    ok: true,
    competition: input.competition,
    season: input.season,
    phase,
    upserted: response.data?.length ?? rows.length,
    resolvedTeams,
    unresolvedTeams,
    warnings,
    series: response.data ?? [],
  }
}

export function parseConmebolCompetition(value: string | null | undefined): ConmebolCompetitionType | null {
  const normalized = normalizeText(value)

  if (normalized.includes('libertadores')) return 'libertadores'
  if (normalized.includes('sudamericana')) return 'sudamericana'

  return null
}

export function getDefaultConmebolLeagueExternalId(competition: ConmebolCompetitionType) {
  return CONMEBOL_COMPETITIONS[competition].leagueExternalId
}
