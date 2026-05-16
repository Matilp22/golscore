import type { SupabaseClient } from '@supabase/supabase-js'

import { getMatchWinner } from '@/shared/utils/copa-argentina'
import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
  normalizeRoundText,
  type LeagueFinalPhaseKey,
} from '@/shared/utils/league-rounds'
import { isFinalMatchStatus } from '@/shared/utils/match-status'

type DbId = string | number

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  season: number | null
}

type TeamRow = {
  id: DbId
  name: string | null
}

export type LigaProfesionalPlayoffMatchRow = {
  id: DbId
  external_id: DbId | null
  round: string | null
  match_date: string | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  source?: string | null
  is_derived?: boolean | null
  derived_from_round?: string | null
  bracket_phase?: string | null
  bracket_slot?: number | null
  source_match_a_id?: string | null
  source_match_b_id?: string | null
}

type Winner = {
  teamId: DbId
  teamName: string
  sourceMatchId: DbId
}

type PhasePlan = {
  previousPhase: LeagueFinalPhaseKey
  nextPhase: LeagueFinalPhaseKey
  nextRound: string
  nextPhaseLabel: string
  pairings: Array<[number, number]>
}

type GeneratedCrossing = {
  phase: LeagueFinalPhaseKey
  round: string
  bracketSlot: number
  homeTeamId: DbId
  awayTeamId: DbId
  homeTeam: string
  awayTeam: string
  sourceMatchAId: DbId
  sourceMatchBId: DbId
  existingMatchId?: DbId | null
  createdMatchId?: DbId | null
  official: boolean
  derived: boolean
  action: 'dry-run' | 'created' | 'skipped-existing'
}

export type GenerateLigaProfesionalPlayoffsResult = {
  ok: true
  dryRun: boolean
  league: LeagueRow | null
  currentPhases: Array<{
    phase: LeagueFinalPhaseKey
    label: string
    matches: number
    officialMatches: number
    derivedMatches: number
  }>
  generatedQuarterFinals: GeneratedCrossing[]
  generatedSemiFinals: GeneratedCrossing[]
  generatedFinal: GeneratedCrossing[]
  skippedBecauseAlreadyExists: GeneratedCrossing[]
  missingWinners: Array<{
    phase: LeagueFinalPhaseKey
    nextPhase: LeagueFinalPhaseKey
    bracketSlot: number
    sourceSlots: [number, number]
    reason: string
  }>
  roundsDetected: Array<{
    round: string
    phase: LeagueFinalPhaseKey | null
    matches: number
  }>
  winnersByPhase: Array<{
    phase: LeagueFinalPhaseKey
    round: string | null
    bracketSlot: number
    fixtureId: DbId
    winner: string | null
  }>
  sample: GeneratedCrossing[]
}

const PHASE_PLANS: PhasePlan[] = [
  {
    previousPhase: 'octavos',
    nextPhase: 'cuartos',
    nextRound: 'Cuartos de final - Apertura',
    nextPhaseLabel: 'Cuartos de final - Apertura',
    pairings: [[0, 1], [2, 3], [4, 5], [6, 7]],
  },
  {
    previousPhase: 'cuartos',
    nextPhase: 'semifinal',
    nextRound: 'Semifinal - Apertura',
    nextPhaseLabel: 'Semifinal - Apertura',
    pairings: [[0, 1], [2, 3]],
  },
  {
    previousPhase: 'semifinal',
    nextPhase: 'final',
    nextRound: 'Final - Apertura',
    nextPhaseLabel: 'Final - Apertura',
    pairings: [[0, 1]],
  },
]

const PHASE_ORDER: LeagueFinalPhaseKey[] = ['octavos', 'cuartos', 'semifinal', 'final']

function getPhaseLabel(phase: LeagueFinalPhaseKey) {
  if (phase === 'octavos') return 'Octavos de final - Apertura'
  if (phase === 'cuartos') return 'Cuartos de final - Apertura'
  if (phase === 'semifinal') return 'Semifinal - Apertura'
  return 'Final - Apertura'
}

function getMatchPhase(match: Pick<LigaProfesionalPlayoffMatchRow, 'round' | 'bracket_phase'>) {
  if (match.bracket_phase) {
    const normalizedPhase = normalizeRoundText(match.bracket_phase)
    if (normalizedPhase === 'octavos') return 'octavos'
    if (normalizedPhase === 'cuartos') return 'cuartos'
    if (normalizedPhase === 'semifinal') return 'semifinal'
    if (normalizedPhase === 'final') return 'final'
  }

  return getLeagueFinalPhaseKey(match.round)
}

function compareDbIds(a: DbId, b: DbId) {
  return String(a).localeCompare(String(b), 'es-AR', { numeric: true })
}

function getMatchTimestamp(match: LigaProfesionalPlayoffMatchRow) {
  if (!match.match_date) return Number.MAX_SAFE_INTEGER

  const timestamp = new Date(match.match_date).getTime()

  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function sortPhaseMatches(matches: LigaProfesionalPlayoffMatchRow[]) {
  return [...matches].sort((a, b) => {
    const slotA = Number.isFinite(a.bracket_slot) ? Number(a.bracket_slot) : null
    const slotB = Number.isFinite(b.bracket_slot) ? Number(b.bracket_slot) : null

    if (slotA !== null && slotB !== null && slotA !== slotB) return slotA - slotB
    if (slotA !== null && slotB === null) return -1
    if (slotA === null && slotB !== null) return 1

    const dateCompare = getMatchTimestamp(a) - getMatchTimestamp(b)
    if (dateCompare !== 0) return dateCompare

    return compareDbIds(a.id, b.id)
  })
}

function getTeamName(teamId: DbId | null, teamsById: Map<string, TeamRow>) {
  if (teamId === null || teamId === undefined) return 'A confirmar'

  return teamsById.get(String(teamId))?.name || 'A confirmar'
}

function getWinnerForMatch(
  match: LigaProfesionalPlayoffMatchRow,
  teamsById: Map<string, TeamRow>
): Winner | null {
  if (!isFinalMatchStatus(match.status)) return null
  if (match.home_team_id === null || match.away_team_id === null) return null

  const winner = getMatchWinner({
    homePenaltyScore: match.home_penalty_score ?? null,
    awayPenaltyScore: match.away_penalty_score ?? null,
    participants: [
      {
        team: getTeamName(match.home_team_id, teamsById),
        teamId: match.home_team_id,
        goals: match.home_score,
      },
      {
        team: getTeamName(match.away_team_id, teamsById),
        teamId: match.away_team_id,
        goals: match.away_score,
      },
    ],
  })

  if (!winner?.teamId) return null

  return {
    teamId: winner.teamId,
    teamName: winner.team,
    sourceMatchId: match.id,
  }
}

function matchHasTeams(
  match: LigaProfesionalPlayoffMatchRow,
  homeTeamId: DbId,
  awayTeamId: DbId
) {
  const home = String(homeTeamId)
  const away = String(awayTeamId)
  const matchHome = String(match.home_team_id)
  const matchAway = String(match.away_team_id)

  return (
    (matchHome === home && matchAway === away) ||
    (matchHome === away && matchAway === home)
  )
}

function findExistingNextMatch(
  matches: LigaProfesionalPlayoffMatchRow[],
  phase: LeagueFinalPhaseKey,
  bracketSlot: number,
  homeTeamId: DbId,
  awayTeamId: DbId
) {
  const phaseMatches = matches.filter((match) => getMatchPhase(match) === phase)
  const exactMatch = phaseMatches.find((match) => {
    if (getMatchPhase(match) !== phase) return false
    if (Number.isFinite(match.bracket_slot) && Number(match.bracket_slot) === bracketSlot) return true

    return matchHasTeams(match, homeTeamId, awayTeamId)
  })

  if (exactMatch) return exactMatch

  const officialPhaseMatches = phaseMatches.filter((match) =>
    match.external_id !== null && match.external_id !== undefined
  )

  if (officialPhaseMatches.length) {
    return sortPhaseMatches(officialPhaseMatches)[bracketSlot - 1] ?? null
  }

  return null
}

function isMissingPlayoffMetadataColumn(error: { code?: string; message?: string } | unknown) {
  const errorObject =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : {}
  const message = (errorObject.message ?? String(error)).toLowerCase()

  return (
    errorObject.code === '42703' ||
    errorObject.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('source') ||
    message.includes('is_derived') ||
    message.includes('bracket') ||
    message.includes('derived_from_round')
  )
}

function serializeCurrentPhases(matches: LigaProfesionalPlayoffMatchRow[]) {
  return PHASE_ORDER.map((phase) => {
    const phaseMatches = matches.filter((match) => getMatchPhase(match) === phase)

    return {
      phase,
      label: getPhaseLabel(phase),
      matches: phaseMatches.length,
      officialMatches: phaseMatches.filter((match) => match.external_id !== null && match.external_id !== undefined).length,
      derivedMatches: phaseMatches.filter((match) => Boolean(match.is_derived)).length,
    }
  }).filter((phase) => phase.matches > 0)
}

function serializeRoundsDetected(matches: LigaProfesionalPlayoffMatchRow[]) {
  const rounds = new Map<string, { round: string; phase: LeagueFinalPhaseKey | null; matches: number }>()

  for (const match of matches) {
    const round = match.round?.trim() || 'Sin ronda'
    const current = rounds.get(round) ?? {
      round,
      phase: getMatchPhase(match),
      matches: 0,
    }

    current.matches += 1
    rounds.set(round, current)
  }

  return [...rounds.values()]
}

async function fetchLeague(
  supabase: SupabaseClient,
  leagueExternalId: number,
  season?: number | null
) {
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', leagueExternalId)
    .order('season', { ascending: false })

  if (season) query = query.eq('season', season)

  const { data, error } = await query.limit(5)

  if (error) throw error

  return ((data ?? []) as LeagueRow[])[0] ?? null
}

async function fetchMatches(supabase: SupabaseClient, leagueId: DbId) {
  const optionalColumns =
    'id, external_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, source, is_derived, derived_from_round, bracket_phase, bracket_slot, source_match_a_id, source_match_b_id'
  const baseColumns =
    'id, external_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score'

  const primary = await supabase
    .from('matches')
    .select(optionalColumns)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true, nullsFirst: false })

  if (!primary.error) return (primary.data ?? []) as LigaProfesionalPlayoffMatchRow[]

  const message = primary.error.message.toLowerCase()
  const missingOptionalColumn =
    primary.error.code === '42703' ||
    primary.error.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('source') ||
    message.includes('is_derived') ||
    message.includes('bracket')

  if (!missingOptionalColumn) throw primary.error

  const fallback = await supabase
    .from('matches')
    .select(baseColumns)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true, nullsFirst: false })

  if (fallback.error) throw fallback.error

  return (fallback.data ?? []) as LigaProfesionalPlayoffMatchRow[]
}

async function fetchTeams(supabase: SupabaseClient, matches: LigaProfesionalPlayoffMatchRow[]) {
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map(String)
    ),
  ]
  const teams: TeamRow[] = []

  for (let index = 0; index < teamIds.length; index += 100) {
    const chunk = teamIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', chunk)

    if (error) throw error
    teams.push(...((data ?? []) as TeamRow[]))
  }

  return new Map(teams.map((team) => [String(team.id), team]))
}

async function insertDerivedMatch(
  supabase: SupabaseClient,
  leagueId: DbId,
  plan: PhasePlan,
  bracketSlot: number,
  home: Winner,
  away: Winner
) {
  const basePayload = {
    league_id: leagueId,
    round: plan.nextRound,
    match_date: null,
    home_team_id: home.teamId,
    away_team_id: away.teamId,
    status: 'TBD',
    home_score: null,
    away_score: null,
  }
  const primary = await supabase
    .from('matches')
    .insert({
      ...basePayload,
      source: 'derived',
      is_derived: true,
      derived_from_round: getPhaseLabel(plan.previousPhase),
      bracket_phase: plan.nextPhase,
      bracket_slot: bracketSlot,
      source_match_a_id: String(home.sourceMatchId),
      source_match_b_id: String(away.sourceMatchId),
    })
    .select('id')
    .single()

  if (!primary.error) return (primary.data as { id: DbId }).id

  if (!isMissingPlayoffMetadataColumn(primary.error)) throw primary.error

  const fallback = await supabase
    .from('matches')
    .insert(basePayload)
    .select('id')
    .single()

  if (fallback.error) throw fallback.error

  return (fallback.data as { id: DbId }).id
}

export async function generateLigaProfesionalPlayoffs(
  supabase: SupabaseClient,
  options: {
    leagueExternalId?: number
    season?: number | null
    dryRun?: boolean
  } = {}
): Promise<GenerateLigaProfesionalPlayoffsResult> {
  const leagueExternalId = options.leagueExternalId ?? LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
  const dryRun = options.dryRun ?? true
  const league = await fetchLeague(supabase, leagueExternalId, options.season)

  if (!league) {
    return {
      ok: true,
      dryRun,
      league: null,
      currentPhases: [],
      generatedQuarterFinals: [],
      generatedSemiFinals: [],
      generatedFinal: [],
      skippedBecauseAlreadyExists: [],
      missingWinners: [],
      roundsDetected: [],
      winnersByPhase: [],
      sample: [],
    }
  }

  const matches = await fetchMatches(supabase, league.id)
  const teamsById = await fetchTeams(supabase, matches)
  const generatedQuarterFinals: GeneratedCrossing[] = []
  const generatedSemiFinals: GeneratedCrossing[] = []
  const generatedFinal: GeneratedCrossing[] = []
  const skippedBecauseAlreadyExists: GeneratedCrossing[] = []
  const missingWinners: GenerateLigaProfesionalPlayoffsResult['missingWinners'] = []
  const winnersByPhase: GenerateLigaProfesionalPlayoffsResult['winnersByPhase'] = []

  for (const phase of PHASE_ORDER) {
    const phaseMatches = sortPhaseMatches(matches.filter((match) => getMatchPhase(match) === phase))

    phaseMatches.forEach((match, index) => {
      winnersByPhase.push({
        phase,
        round: match.round,
        bracketSlot: match.bracket_slot ?? index + 1,
        fixtureId: match.external_id ?? match.id,
        winner: getWinnerForMatch(match, teamsById)?.teamName ?? null,
      })
    })
  }

  for (const plan of PHASE_PLANS) {
    const previousMatches = sortPhaseMatches(
      matches.filter((match) => getMatchPhase(match) === plan.previousPhase)
    )

    if (!previousMatches.length) continue

    for (let pairingIndex = 0; pairingIndex < plan.pairings.length; pairingIndex += 1) {
      const bracketSlot = pairingIndex + 1
      const [sourceAIndex, sourceBIndex] = plan.pairings[pairingIndex]
      const sourceA = previousMatches[sourceAIndex]
      const sourceB = previousMatches[sourceBIndex]
      const winnerA = sourceA ? getWinnerForMatch(sourceA, teamsById) : null
      const winnerB = sourceB ? getWinnerForMatch(sourceB, teamsById) : null

      if (!winnerA || !winnerB) {
        missingWinners.push({
          phase: plan.previousPhase,
          nextPhase: plan.nextPhase,
          bracketSlot,
          sourceSlots: [sourceAIndex + 1, sourceBIndex + 1],
          reason: !sourceA || !sourceB ? 'missing_source_match' : 'missing_winner',
        })
        continue
      }

      const existing = findExistingNextMatch(
        matches,
        plan.nextPhase,
        bracketSlot,
        winnerA.teamId,
        winnerB.teamId
      )
      const crossing: GeneratedCrossing = {
        phase: plan.nextPhase,
        round: plan.nextRound,
        bracketSlot,
        homeTeamId: winnerA.teamId,
        awayTeamId: winnerB.teamId,
        homeTeam: winnerA.teamName,
        awayTeam: winnerB.teamName,
        sourceMatchAId: winnerA.sourceMatchId,
        sourceMatchBId: winnerB.sourceMatchId,
        existingMatchId: existing?.id ?? null,
        official: Boolean(existing?.external_id),
        derived: !existing?.external_id,
        action: existing ? 'skipped-existing' : dryRun ? 'dry-run' : 'created',
      }

      if (existing) {
        skippedBecauseAlreadyExists.push(crossing)
      } else if (!dryRun) {
        crossing.createdMatchId = await insertDerivedMatch(
          supabase,
          league.id,
          plan,
          bracketSlot,
          winnerA,
          winnerB
        )
      }

      if (!existing) {
        if (plan.nextPhase === 'cuartos') generatedQuarterFinals.push(crossing)
        if (plan.nextPhase === 'semifinal') generatedSemiFinals.push(crossing)
        if (plan.nextPhase === 'final') generatedFinal.push(crossing)
      }
    }
  }

  return {
    ok: true,
    dryRun,
    league,
    currentPhases: serializeCurrentPhases(matches),
    generatedQuarterFinals,
    generatedSemiFinals,
    generatedFinal,
    skippedBecauseAlreadyExists,
    missingWinners,
    roundsDetected: serializeRoundsDetected(matches),
    winnersByPhase,
    sample: [...generatedQuarterFinals, ...generatedSemiFinals, ...generatedFinal].slice(0, 8),
  }
}

export async function findDerivedLigaProfesionalMatchForOfficialFixture(
  supabase: SupabaseClient,
  input: {
    leagueId: DbId
    round?: string | null
    homeTeamId: DbId
    awayTeamId: DbId
    bracketSlot?: number | null
  }
) {
  const phase = getLeagueFinalPhaseKey(input.round)

  if (!phase) return null

  const { data, error } = await supabase
    .from('matches')
    .select('id, external_id, round, home_team_id, away_team_id, is_derived, bracket_phase, bracket_slot')
    .eq('league_id', input.leagueId)
    .is('external_id', null)

  if (error) {
    if (!isMissingPlayoffMetadataColumn(error)) throw error

    const fallback = await supabase
      .from('matches')
      .select('id, external_id, round, home_team_id, away_team_id')
      .eq('league_id', input.leagueId)
      .is('external_id', null)

    if (fallback.error) throw fallback.error

    const fallbackMatches = (fallback.data ?? []) as LigaProfesionalPlayoffMatchRow[]
    const fallbackTeamMatch = fallbackMatches.find((match) => {
      if (getMatchPhase(match) !== phase) return false

      return matchHasTeams(match, input.homeTeamId, input.awayTeamId)
    })

    if (fallbackTeamMatch) return fallbackTeamMatch

    return null
  }

  const derivedMatches = ((data ?? []) as LigaProfesionalPlayoffMatchRow[]).filter((match) => {
    if (getMatchPhase(match) !== phase) return false
    if (!match.is_derived) return false

    return matchHasTeams(match, input.homeTeamId, input.awayTeamId)
  })

  if (derivedMatches[0]) return derivedMatches[0]

  if (input.bracketSlot !== null && input.bracketSlot !== undefined) {
    return ((data ?? []) as LigaProfesionalPlayoffMatchRow[]).find((match) => {
      if (getMatchPhase(match) !== phase) return false
      if (!match.is_derived) return false

      return Number(match.bracket_slot) === input.bracketSlot
    }) ?? null
  }

  return null
}

export async function markLigaProfesionalDerivedMatchAsOfficial(
  supabase: SupabaseClient,
  matchId: DbId
) {
  const { error } = await supabase
    .from('matches')
    .update({
      source: 'api',
      is_derived: false,
    })
    .eq('id', matchId)

  if (error) {
    if (isMissingPlayoffMetadataColumn(error)) return
    throw error
  }
}
