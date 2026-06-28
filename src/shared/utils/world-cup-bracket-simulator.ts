import type { LeagueFixtureSummary, LeagueStandingGroup, LeagueStandingRow } from '@/lib/api-football'
import { isFinishedStatus, isPostponedStatus } from '@/shared/utils/match-status'
import {
  WORLD_CUP_GROUP_KEYS,
  getWorldCupGroupKey,
  sortWorldCupGroupKeys,
  type WorldCupGroupKey,
} from '@/shared/utils/world-cup-groups'

export const WORLD_CUP_BRACKET_STORAGE_KEY_PREFIX =
  'hay-fulbo:world-cup-bracket-simulator:v1'
export const WORLD_CUP_FULL_SIMULATOR_STORAGE_KEY =
  'hayfulbo_world_cup_2026_full_simulator_v2'

export type WorldCupBracketRoundKey = 'r32' | 'r16' | 'qf' | 'sf' | 'final'
export type WorldCupBracketSeedKey =
  | `W${WorldCupGroupKey}`
  | `R${WorldCupGroupKey}`
  | `T${WorldCupGroupKey}`
  | `T${number}`

export type WorldCupBracketTeam = {
  key: string
  name: string
  logo?: string
  seedLabel: string
  placeholder: boolean
  source?: 'calculated' | 'manual' | 'official' | 'placeholder'
}

export type WorldCupBracketMatch = {
  id: string
  roundKey: WorldCupBracketRoundKey
  slot: number
  home: WorldCupBracketTeam
  away: WorldCupBracketTeam
  fixtureId?: number | string | null
  date?: string | null
  statusShort?: string | null
  goalsHome?: number | null
  goalsAway?: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}

export type WorldCupBracketRound = {
  key: WorldCupBracketRoundKey
  label: string
  matches: WorldCupBracketMatch[]
}

export type WorldCupBracketBuildResult = {
  rounds: WorldCupBracketRound[]
  thirdPlace: WorldCupBracketMatch | null
  champion: WorldCupBracketTeam | null
  qualifiedTeams: WorldCupBracketTeam[]
  firstRoundSource: 'official-fixtures' | 'standings-projection' | 'group-simulation' | 'placeholders'
  warnings?: string[]
  thirdPlaceAssignments?: WorldCupThirdPlaceAssignmentResult
}

export type WorldCupBracketWinnerSelection = Record<string, string>
export type WorldCupBracketSeedOverrides = Partial<Record<WorldCupBracketSeedKey, string>>
export type WorldCupBracketMatchResult = {
  goalsHome?: number | null
  goalsAway?: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}
export type WorldCupBracketMatchResults = Record<string, WorldCupBracketMatchResult>
export type WorldCupKnockoutResolutionStatus =
  | 'incomplete'
  | 'placeholder'
  | 'winner'
  | 'needs_penalties'
  | 'penalty_tie'

export type WorldCupKnockoutResolution = {
  status: WorldCupKnockoutResolutionStatus
  winner: WorldCupBracketTeam | null
  loser: WorldCupBracketTeam | null
  message?: string
}

export type WorldCupGroupSimulationScore = {
  goalsHome?: number | null
  goalsAway?: number | null
}

export type WorldCupGroupSimulationResults = Record<string, WorldCupGroupSimulationScore>
export type WorldCupManualTiebreakers = Partial<Record<WorldCupGroupKey, string[]>>

export type WorldCupSimulatedStandingRow = LeagueStandingRow & {
  groupKey: WorldCupGroupKey
  teamKey: string
  simulated: boolean
  provisional: boolean
  manualTiebreaker: boolean
  tiebreakerPending: boolean
}

export type WorldCupGroupFixtureSimulation = {
  fixture: LeagueFixtureSummary
  groupKey: WorldCupGroupKey
  official: boolean
  simulated: boolean
  pending: boolean
  complete: boolean
  goalsHome: number | null
  goalsAway: number | null
}

export type WorldCupSimulatedGroup = {
  groupKey: WorldCupGroupKey
  label: string
  rows: WorldCupSimulatedStandingRow[]
  fixtures: WorldCupGroupFixtureSimulation[]
  missingFixtures: string[]
  pendingFixtureIds: string[]
  simulatedFixtureIds: string[]
  unresolvedTiebreakerTeamKeys: string[]
  manualTiebreaker: boolean
  complete: boolean
  provisional: boolean
}

export type WorldCupThirdPlacedTeam = {
  groupKey: WorldCupGroupKey
  row: WorldCupSimulatedStandingRow
  qualified: boolean
  rank: number
  provisional: boolean
  orderReason: string
}

export type WorldCupThirdPlaceRanking = {
  rows: WorldCupThirdPlacedTeam[]
  qualified: WorldCupThirdPlacedTeam[]
  eliminated: WorldCupThirdPlacedTeam[]
  complete: boolean
  provisional: boolean
  unresolvedTeamKeys: string[]
}

export type WorldCupGroupSimulationModel = {
  groups: WorldCupSimulatedGroup[]
  standingsGroups: LeagueStandingGroup[]
  thirdPlaceRanking: WorldCupThirdPlaceRanking
  complete: boolean
  provisional: boolean
  totalFixtures: number
  completedFixtures: number
  warnings: string[]
}

export type WorldCupThirdPlaceAssignmentResult = {
  qualifiedGroups: WorldCupGroupKey[]
  slotAssignments: Partial<Record<number, WorldCupGroupKey>>
  assignmentKey: string
  unresolvedSlots: number[]
  warnings: string[]
}

type Accumulator = Omit<LeagueStandingRow, 'rank'> & {
  groupKey: WorldCupGroupKey
  teamKey: string
  simulated: boolean
  provisional: boolean
  manualTiebreaker: boolean
  tiebreakerPending: boolean
  inputOrder: number
}

type RankingFixture = {
  id: string
  homeKey: string
  awayKey: string
  goalsHome: number
  goalsAway: number
  simulated: boolean
}

type TieRankResult = {
  rows: Accumulator[]
  unresolved: string[]
  manualKeys: Set<string>
}

const ROUND_LABELS: Record<WorldCupBracketRoundKey, string> = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  final: 'Final',
}

const ROUND_OF_32_PAIRINGS: Array<{
  slot: number
  home: WorldCupBracketSeedKey
  away: WorldCupBracketSeedKey | { candidates: WorldCupGroupKey[] }
}> = [
  // FIFA 2026 round-of-32 slots. W = 1st, R = runner-up, T = third-placed team.
  { slot: 73, home: 'RA', away: 'RB' },
  { slot: 74, home: 'WE', away: { candidates: ['A', 'B', 'C', 'D', 'F'] } },
  { slot: 75, home: 'WF', away: 'RC' },
  { slot: 76, home: 'WC', away: 'RF' },
  { slot: 77, home: 'WI', away: { candidates: ['C', 'D', 'F', 'G', 'H'] } },
  { slot: 78, home: 'RE', away: 'RI' },
  { slot: 79, home: 'WA', away: { candidates: ['C', 'E', 'F', 'H', 'I'] } },
  { slot: 80, home: 'WL', away: { candidates: ['E', 'H', 'I', 'J', 'K'] } },
  { slot: 81, home: 'WD', away: { candidates: ['B', 'E', 'F', 'I', 'J'] } },
  { slot: 82, home: 'WG', away: { candidates: ['A', 'E', 'H', 'I', 'J'] } },
  { slot: 83, home: 'RK', away: 'RL' },
  { slot: 84, home: 'WH', away: 'RJ' },
  { slot: 85, home: 'WB', away: { candidates: ['E', 'F', 'G', 'I', 'J'] } },
  { slot: 86, home: 'WJ', away: 'RH' },
  { slot: 87, home: 'WK', away: { candidates: ['D', 'E', 'I', 'J', 'L'] } },
  { slot: 88, home: 'RD', away: 'RG' },
]

const ROUND_TOPOLOGY: Record<Exclude<WorldCupBracketRoundKey, 'r32'>, Array<{
  slot: number
  sources: [number, number]
}>> = {
  r16: [
    { slot: 89, sources: [73, 75] },
    { slot: 90, sources: [74, 77] },
    { slot: 91, sources: [76, 78] },
    { slot: 92, sources: [79, 80] },
    { slot: 93, sources: [83, 84] },
    { slot: 94, sources: [81, 82] },
    { slot: 95, sources: [86, 88] },
    { slot: 96, sources: [85, 87] },
  ],
  qf: [
    { slot: 97, sources: [89, 90] },
    { slot: 98, sources: [93, 94] },
    { slot: 99, sources: [91, 92] },
    { slot: 100, sources: [95, 96] },
  ],
  sf: [
    { slot: 101, sources: [97, 98] },
    { slot: 102, sources: [99, 100] },
  ],
  final: [
    { slot: 104, sources: [101, 102] },
  ],
}

const THIRD_PLACE_SLOT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87]

function getSeedPlaceholderLabel(seedKey: WorldCupBracketSeedKey) {
  const seedType = seedKey[0]
  const seedGroup = seedKey.slice(1)

  if (seedType === 'W') return `1.º Grupo ${seedGroup}`
  if (seedType === 'R') return `2.º Grupo ${seedGroup}`
  if (seedType === 'T' && WORLD_CUP_GROUP_KEYS.includes(seedGroup as WorldCupGroupKey)) {
    return `3.º Grupo ${seedGroup}`
  }

  return 'Mejor tercero'
}

function normalizeTeamKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getTeamIdentityKeys(input: { teamId?: number | null; teamName: string }) {
  const keys = [`name:${normalizeTeamKey(input.teamName)}`]

  if (input.teamId !== null && input.teamId !== undefined) {
    keys.push(`id:${input.teamId}`)
  }

  return keys
}

function getTeamKey(input: { teamId?: number | null; teamName: string; seedLabel: string }) {
  return input.teamId
    ? `team:${input.teamId}`
    : `seed:${input.seedLabel}:${normalizeTeamKey(input.teamName)}`
}

function getFixtureTeamKey(input: {
  teamId?: number
  teamName: string
  side: 'home' | 'away'
  fixtureId: number | string
}) {
  return input.teamId
    ? `team:${input.teamId}`
    : `fixture:${input.fixtureId}:${input.side}:${normalizeTeamKey(input.teamName)}`
}

function createPlaceholder(seedLabel: string): WorldCupBracketTeam {
  return {
    key: `placeholder:${seedLabel}`,
    name: seedLabel,
    seedLabel,
    placeholder: true,
    source: 'placeholder',
  }
}

function toBracketTeam(
  row: Pick<LeagueStandingRow, 'teamId' | 'teamName' | 'teamLogo'>,
  seedLabel: string,
  source: WorldCupBracketTeam['source'] = 'calculated'
): WorldCupBracketTeam {
  return {
    key: getTeamKey({ teamId: row.teamId ?? null, teamName: row.teamName, seedLabel }),
    name: row.teamName,
    logo: row.teamLogo,
    seedLabel,
    placeholder: false,
    source,
  }
}

function compareStandingRows(a: LeagueStandingRow, b: LeagueStandingRow) {
  const rankA = a.rank || Number.MAX_SAFE_INTEGER
  const rankB = b.rank || Number.MAX_SAFE_INTEGER

  if (rankA !== rankB) return rankA - rankB
  if (b.points !== a.points) return b.points - a.points
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst
  if (b.won !== a.won) return b.won - a.won

  return 0
}

function getSortedWorldCupGroups(groups: LeagueStandingGroup[]) {
  return groups
    .map((group) => {
      const groupKey = getWorldCupGroupKey(group.name)

      return groupKey
        ? {
            groupKey,
            rows: [...group.rows].sort(compareStandingRows),
          }
        : null
    })
    .filter((group): group is { groupKey: WorldCupGroupKey; rows: LeagueStandingRow[] } =>
      Boolean(group)
    )
    .sort((a, b) => sortWorldCupGroupKeys([a.groupKey, b.groupKey])[0] === a.groupKey ? -1 : 1)
}

function buildTeamOptionIndex(groups: LeagueStandingGroup[]) {
  const index = new Map<string, WorldCupBracketTeam>()

  for (const group of getSortedWorldCupGroups(groups)) {
    for (const row of group.rows) {
      const team = toBracketTeam(row, `${group.groupKey}-${row.rank || row.teamName}`)
      index.set(team.key, team)
    }
  }

  return index
}

function getSeedTeam(
  seedMap: Map<WorldCupBracketSeedKey, WorldCupBracketTeam>,
  seedKey: WorldCupBracketSeedKey
) {
  return seedMap.get(seedKey) ?? createPlaceholder(getSeedPlaceholderLabel(seedKey))
}

function getFixtureIdKey(fixture: LeagueFixtureSummary) {
  return String(fixture.id)
}

function isCompleteScore(value: WorldCupGroupSimulationScore | undefined) {
  return (
    value?.goalsHome !== null &&
    value?.goalsHome !== undefined &&
    value.goalsAway !== null &&
    value.goalsAway !== undefined
  )
}

function isOfficialFinalFixture(fixture: LeagueFixtureSummary) {
  return (
    isFinishedStatus(fixture.statusShort) &&
    !isPostponedStatus(fixture.statusShort) &&
    fixture.goalsHome !== null &&
    fixture.goalsHome !== undefined &&
    fixture.goalsAway !== null &&
    fixture.goalsAway !== undefined
  )
}

function buildTeamGroupIndex(groups: LeagueStandingGroup[]) {
  const index = new Map<string, WorldCupGroupKey>()

  for (const group of getSortedWorldCupGroups(groups)) {
    for (const row of group.rows) {
      for (const key of getTeamIdentityKeys({ teamId: row.teamId, teamName: row.teamName })) {
        index.set(key, group.groupKey)
      }
    }
  }

  return index
}

function getFixtureSideGroup(
  fixture: LeagueFixtureSummary,
  side: 'home' | 'away',
  teamGroupIndex: Map<string, WorldCupGroupKey>
) {
  const teamId = side === 'home' ? fixture.homeId : fixture.awayId
  const teamName = side === 'home' ? fixture.home : fixture.away

  for (const key of getTeamIdentityKeys({ teamId, teamName })) {
    const groupKey = teamGroupIndex.get(key)
    if (groupKey) return groupKey
  }

  return null
}

function getFixtureGroupKey(
  fixture: LeagueFixtureSummary,
  teamGroupIndex: Map<string, WorldCupGroupKey>
) {
  const roundGroup = getWorldCupGroupKey(fixture.round)
  if (roundGroup) return roundGroup

  const homeGroup = getFixtureSideGroup(fixture, 'home', teamGroupIndex)
  const awayGroup = getFixtureSideGroup(fixture, 'away', teamGroupIndex)

  return homeGroup && homeGroup === awayGroup ? homeGroup : null
}

function makeAccumulator(row: LeagueStandingRow, groupKey: WorldCupGroupKey, inputOrder: number): Accumulator {
  return {
    teamId: row.teamId,
    teamName: row.teamName,
    teamLogo: row.teamLogo,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    form: '',
    description: null,
    groupKey,
    teamKey: getTeamKey({ teamId: row.teamId ?? null, teamName: row.teamName, seedLabel: groupKey }),
    simulated: false,
    provisional: true,
    manualTiebreaker: false,
    tiebreakerPending: false,
    inputOrder,
  }
}

function findAccumulator(
  table: Map<string, Accumulator>,
  fixture: LeagueFixtureSummary,
  side: 'home' | 'away'
) {
  const teamId = side === 'home' ? fixture.homeId : fixture.awayId
  const teamName = side === 'home' ? fixture.home : fixture.away

  for (const key of getTeamIdentityKeys({ teamId, teamName })) {
    const row = table.get(key)
    if (row) return row
  }

  return null
}

function addAccumulatorAliases(table: Map<string, Accumulator>, row: LeagueStandingRow, accumulator: Accumulator) {
  for (const key of getTeamIdentityKeys({ teamId: row.teamId, teamName: row.teamName })) {
    table.set(key, accumulator)
  }
}

function applyResult(home: Accumulator, away: Accumulator, goalsHome: number, goalsAway: number, simulated: boolean) {
  home.played += 1
  away.played += 1
  home.goalsFor += goalsHome
  home.goalsAgainst += goalsAway
  away.goalsFor += goalsAway
  away.goalsAgainst += goalsHome
  home.goalDifference = home.goalsFor - home.goalsAgainst
  away.goalDifference = away.goalsFor - away.goalsAgainst
  home.simulated = home.simulated || simulated
  away.simulated = away.simulated || simulated

  if (goalsHome > goalsAway) {
    home.won += 1
    away.lost += 1
    home.points += 3
    return
  }

  if (goalsAway > goalsHome) {
    away.won += 1
    home.lost += 1
    away.points += 3
    return
  }

  home.drawn += 1
  away.drawn += 1
  home.points += 1
  away.points += 1
}

function getHeadToHeadStats(rows: Accumulator[], fixtures: RankingFixture[]) {
  const keySet = new Set(rows.map((row) => row.teamKey))
  const stats = new Map<string, { points: number; gd: number; gf: number }>()

  for (const row of rows) {
    stats.set(row.teamKey, { points: 0, gd: 0, gf: 0 })
  }

  for (const fixture of fixtures) {
    if (!keySet.has(fixture.homeKey) || !keySet.has(fixture.awayKey)) continue

    const home = stats.get(fixture.homeKey)
    const away = stats.get(fixture.awayKey)
    if (!home || !away) continue

    home.gf += fixture.goalsHome
    home.gd += fixture.goalsHome - fixture.goalsAway
    away.gf += fixture.goalsAway
    away.gd += fixture.goalsAway - fixture.goalsHome

    if (fixture.goalsHome > fixture.goalsAway) home.points += 3
    else if (fixture.goalsAway > fixture.goalsHome) away.points += 3
    else {
      home.points += 1
      away.points += 1
    }
  }

  return stats
}

function splitByMetric(rows: Accumulator[], metric: (row: Accumulator) => number, direction: 'asc' | 'desc') {
  const sorted = [...rows].sort((a, b) => {
    const diff = metric(a) - metric(b)
    return direction === 'asc' ? diff : -diff
  })
  const groups: Accumulator[][] = []

  for (const row of sorted) {
    const previous = groups[groups.length - 1]

    if (!previous || metric(previous[0]) !== metric(row)) {
      groups.push([row])
    } else {
      previous.push(row)
    }
  }

  return groups
}

function rankTieRows(
  rows: Accumulator[],
  fixtures: RankingFixture[],
  fairPlay: Record<string, number> | undefined,
  fifaRankings: Record<string, number> | undefined,
  manualOrder: string[] | undefined
): TieRankResult {
  if (rows.length <= 1) return { rows, unresolved: [], manualKeys: new Set() }

  const headToHead = getHeadToHeadStats(rows, fixtures)
  const headToHeadMetrics: Array<(row: Accumulator) => number> = [
    (row) => headToHead.get(row.teamKey)?.points ?? 0,
    (row) => headToHead.get(row.teamKey)?.gd ?? 0,
    (row) => headToHead.get(row.teamKey)?.gf ?? 0,
  ]

  for (const metric of headToHeadMetrics) {
    const groups = splitByMetric(rows, metric, 'desc')
    if (groups.length <= 1) continue

    return mergeTieGroups(groups, fixtures, fairPlay, fifaRankings, manualOrder)
  }

  const allMatchMetrics: Array<{ metric: (row: Accumulator) => number; direction: 'asc' | 'desc' }> = [
    { metric: (row) => row.goalDifference, direction: 'desc' },
    { metric: (row) => row.goalsFor, direction: 'desc' },
    { metric: (row) => fairPlay?.[row.teamKey] ?? Number.NEGATIVE_INFINITY, direction: 'desc' },
    { metric: (row) => fifaRankings?.[row.teamKey] ?? Number.MAX_SAFE_INTEGER, direction: 'asc' },
  ]

  for (const { metric, direction } of allMatchMetrics) {
    const values = rows.map(metric)
    if (values.every((value) => value === Number.NEGATIVE_INFINITY || value === Number.MAX_SAFE_INTEGER)) continue

    const groups = splitByMetric(rows, metric, direction)
    if (groups.length <= 1) continue

    return mergeTieGroups(groups, fixtures, fairPlay, fifaRankings, manualOrder)
  }

  const manualIndex = new Map((manualOrder ?? []).map((teamKey, index) => [teamKey, index]))
  const manualCoversTie = rows.every((row) => manualIndex.has(row.teamKey))

  if (manualCoversTie) {
    const manualRows = [...rows].sort((a, b) => manualIndex.get(a.teamKey)! - manualIndex.get(b.teamKey)!)

    return {
      rows: manualRows,
      unresolved: [],
      manualKeys: new Set(manualRows.map((row) => row.teamKey)),
    }
  }

  return {
    rows: [...rows].sort((a, b) => a.inputOrder - b.inputOrder),
    unresolved: rows.map((row) => row.teamKey),
    manualKeys: new Set(),
  }
}

function mergeTieGroups(
  groups: Accumulator[][],
  fixtures: RankingFixture[],
  fairPlay: Record<string, number> | undefined,
  fifaRankings: Record<string, number> | undefined,
  manualOrder: string[] | undefined
): TieRankResult {
  const rows: Accumulator[] = []
  const unresolved: string[] = []
  const manualKeys = new Set<string>()

  for (const group of groups) {
    const ranked = rankTieRows(group, fixtures, fairPlay, fifaRankings, manualOrder)
    rows.push(...ranked.rows)
    unresolved.push(...ranked.unresolved)
    for (const key of ranked.manualKeys) manualKeys.add(key)
  }

  return { rows, unresolved, manualKeys }
}

export function rankWorldCup2026Group({
  teams,
  fixtures,
  fairPlay,
  fifaRankings,
  manualOrder,
  groupKey,
}: {
  teams: Accumulator[]
  fixtures: RankingFixture[]
  fairPlay?: Record<string, number>
  fifaRankings?: Record<string, number>
  manualOrder?: string[]
  groupKey: WorldCupGroupKey
}) {
  const byPoints = splitByMetric(teams, (row) => row.points, 'desc')
  const rows: Accumulator[] = []
  const unresolved: string[] = []
  const manualKeys = new Set<string>()

  for (const pointGroup of byPoints) {
    const ranked = rankTieRows(pointGroup, fixtures, fairPlay, fifaRankings, manualOrder)
    rows.push(...ranked.rows)
    unresolved.push(...ranked.unresolved)
    for (const key of ranked.manualKeys) manualKeys.add(key)
  }

  return {
    rows: rows.map((row, index): WorldCupSimulatedStandingRow => ({
      rank: index + 1,
      teamId: row.teamId,
      teamName: row.teamName,
      teamLogo: row.teamLogo,
      points: row.points,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      form: row.form,
      description: row.description,
      groupKey,
      teamKey: row.teamKey,
      simulated: row.simulated,
      provisional: row.provisional,
      manualTiebreaker: manualKeys.has(row.teamKey),
      tiebreakerPending: unresolved.includes(row.teamKey),
    })),
    unresolvedTeamKeys: unresolved,
    manualTeamKeys: [...manualKeys],
  }
}

export function buildWorldCupSimulatedGroupFixtures(
  groups: LeagueStandingGroup[],
  fixtures: LeagueFixtureSummary[],
  simulatedResults: WorldCupGroupSimulationResults = {},
  manualTiebreakers: WorldCupManualTiebreakers = {}
): WorldCupGroupSimulationModel {
  const teamGroupIndex = buildTeamGroupIndex(groups)
  const groupedFixtures = new Map<WorldCupGroupKey, WorldCupGroupFixtureSimulation[]>()
  const warnings: string[] = []

  for (const groupKey of WORLD_CUP_GROUP_KEYS) groupedFixtures.set(groupKey, [])

  for (const fixture of fixtures) {
    if (getKnockoutRoundKey(fixture)) continue

    const groupKey = getFixtureGroupKey(fixture, teamGroupIndex)
    if (!groupKey) continue

    const fixtureKey = getFixtureIdKey(fixture)
    const simulatedScore = simulatedResults[fixtureKey]
    const official = isOfficialFinalFixture(fixture)
    const simulated = !official && isCompleteScore(simulatedScore)
    const goalsHome = official
      ? fixture.goalsHome!
      : simulated
        ? simulatedScore.goalsHome!
        : null
    const goalsAway = official
      ? fixture.goalsAway!
      : simulated
        ? simulatedScore.goalsAway!
        : null

    groupedFixtures.get(groupKey)!.push({
      fixture,
      groupKey,
      official,
      simulated,
      pending: !official && !simulated,
      complete: official || simulated,
      goalsHome,
      goalsAway,
    })
  }

  const simulatedGroups: WorldCupSimulatedGroup[] = []
  let completedFixtures = 0
  let totalFixtures = 0

  for (const group of getSortedWorldCupGroups(groups)) {
    const table = new Map<string, Accumulator>()
    const rankingFixtures: RankingFixture[] = []
    const groupFixtures = (groupedFixtures.get(group.groupKey) ?? [])
      .sort((a, b) => compareLeagueFixturesByStableSlot(a.fixture, b.fixture))
    const missingFixtures =
      groupFixtures.length === 6
        ? []
        : [`Grupo ${group.groupKey}: se esperaban 6 partidos y hay ${groupFixtures.length}.`]
    const pendingFixtureIds: string[] = []
    const simulatedFixtureIds: string[] = []

    if (missingFixtures.length) warnings.push(...missingFixtures)

    for (const [index, row] of group.rows.entries()) {
      const accumulator = makeAccumulator(row, group.groupKey, index)
      addAccumulatorAliases(table, row, accumulator)
    }

    for (const groupFixture of groupFixtures) {
      totalFixtures += 1

      if (!groupFixture.complete) {
        pendingFixtureIds.push(getFixtureIdKey(groupFixture.fixture))
        continue
      }

      completedFixtures += 1
      if (groupFixture.simulated) simulatedFixtureIds.push(getFixtureIdKey(groupFixture.fixture))

      const home = findAccumulator(table, groupFixture.fixture, 'home')
      const away = findAccumulator(table, groupFixture.fixture, 'away')

      if (!home || !away || groupFixture.goalsHome === null || groupFixture.goalsAway === null) continue

      applyResult(home, away, groupFixture.goalsHome, groupFixture.goalsAway, groupFixture.simulated)
      rankingFixtures.push({
        id: getFixtureIdKey(groupFixture.fixture),
        homeKey: home.teamKey,
        awayKey: away.teamKey,
        goalsHome: groupFixture.goalsHome,
        goalsAway: groupFixture.goalsAway,
        simulated: groupFixture.simulated,
      })
    }

    const uniqueRows = [...new Set(table.values())]
    for (const row of uniqueRows) row.provisional = Boolean(pendingFixtureIds.length || missingFixtures.length)

    const ranked = rankWorldCup2026Group({
      teams: uniqueRows,
      fixtures: rankingFixtures,
      groupKey: group.groupKey,
      manualOrder: manualTiebreakers[group.groupKey],
    })

    simulatedGroups.push({
      groupKey: group.groupKey,
      label: `Grupo ${group.groupKey}`,
      rows: ranked.rows,
      fixtures: groupFixtures,
      missingFixtures,
      pendingFixtureIds,
      simulatedFixtureIds,
      unresolvedTiebreakerTeamKeys: ranked.unresolvedTeamKeys,
      manualTiebreaker: ranked.manualTeamKeys.length > 0,
      complete: groupFixtures.length === 6 && pendingFixtureIds.length === 0,
      provisional: pendingFixtureIds.length > 0 || missingFixtures.length > 0,
    })
  }

  const standingsGroups = simulatedGroups.map((group) => ({
    name: group.label,
    rows: group.rows,
  }))
  const thirdPlaceRanking = rankWorldCupThirdPlacedTeams(simulatedGroups)

  return {
    groups: simulatedGroups,
    standingsGroups,
    thirdPlaceRanking,
    complete: simulatedGroups.length === 12 && simulatedGroups.every((group) => group.complete),
    provisional: simulatedGroups.some((group) => group.provisional),
    totalFixtures,
    completedFixtures,
    warnings,
  }
}

export function calculateWorldCupGroupTable({
  group,
  fixtures,
  simulatedResults,
  manualTiebreakers,
}: {
  group: LeagueStandingGroup
  fixtures: LeagueFixtureSummary[]
  simulatedResults?: WorldCupGroupSimulationResults
  manualTiebreakers?: WorldCupManualTiebreakers
}) {
  return buildWorldCupSimulatedGroupFixtures([group], fixtures, simulatedResults, manualTiebreakers).groups[0] ?? null
}

export function rankWorldCupThirdPlacedTeams(groups: WorldCupSimulatedGroup[]): WorldCupThirdPlaceRanking {
  const thirdRows = groups
    .map((group) => group.rows[2] ? { group, row: group.rows[2] } : null)
    .filter((entry): entry is { group: WorldCupSimulatedGroup; row: WorldCupSimulatedStandingRow } => Boolean(entry))
  const sorted = [...thirdRows].sort((a, b) => {
    if (b.row.points !== a.row.points) return b.row.points - a.row.points
    if (b.row.goalDifference !== a.row.goalDifference) return b.row.goalDifference - a.row.goalDifference
    if (b.row.goalsFor !== a.row.goalsFor) return b.row.goalsFor - a.row.goalsFor

    return WORLD_CUP_GROUP_KEYS.indexOf(a.group.groupKey) - WORLD_CUP_GROUP_KEYS.indexOf(b.group.groupKey)
  })
  const unresolvedTeamKeys: string[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]

    if (
      previous.row.points === current.row.points &&
      previous.row.goalDifference === current.row.goalDifference &&
      previous.row.goalsFor === current.row.goalsFor
    ) {
      unresolvedTeamKeys.push(previous.row.teamKey, current.row.teamKey)
    }
  }

  const rows = sorted.map((entry, index): WorldCupThirdPlacedTeam => ({
    groupKey: entry.group.groupKey,
    row: entry.row,
    qualified: index < 8,
    rank: index + 1,
    provisional: entry.group.provisional,
    orderReason: index < 8 ? 'Top 8 por puntos, DG y GF' : 'Fuera del top 8',
  }))

  return {
    rows,
    qualified: rows.slice(0, 8),
    eliminated: rows.slice(8),
    complete: groups.length === 12 && groups.every((group) => group.complete),
    provisional: groups.some((group) => group.provisional),
    unresolvedTeamKeys: [...new Set(unresolvedTeamKeys)],
  }
}

export function resolveWorldCupThirdPlaceAssignments(
  qualifiedGroups: WorldCupGroupKey[]
): WorldCupThirdPlaceAssignmentResult {
  const sortedGroups = sortWorldCupGroupKeys([...new Set(qualifiedGroups)])
  const warnings: string[] = []

  if (sortedGroups.length !== 8) {
    return {
      qualifiedGroups: sortedGroups,
      slotAssignments: {},
      assignmentKey: sortedGroups.join(''),
      unresolvedSlots: THIRD_PLACE_SLOT_ORDER,
      warnings: ['Se necesitan exactamente 8 terceros clasificados para completar la matriz.'],
    }
  }

  const candidatesBySlot = new Map<number, WorldCupGroupKey[]>()
  for (const pairing of ROUND_OF_32_PAIRINGS) {
    if (typeof pairing.away === 'object') candidatesBySlot.set(pairing.slot, pairing.away.candidates)
  }

  const solution = assignThirdPlaceSlots(THIRD_PLACE_SLOT_ORDER, sortedGroups, candidatesBySlot)

  if (!solution) {
    warnings.push(`No hay asignacion de matriz para la combinacion ${sortedGroups.join('')}.`)
  }

  return {
    qualifiedGroups: sortedGroups,
    slotAssignments: solution ?? {},
    assignmentKey: sortedGroups.join(''),
    unresolvedSlots: solution ? [] : THIRD_PLACE_SLOT_ORDER,
    warnings,
  }
}

function assignThirdPlaceSlots(
  slots: number[],
  groups: WorldCupGroupKey[],
  candidatesBySlot: Map<number, WorldCupGroupKey[]>
) {
  const orderedSlots = [...slots].sort((a, b) => {
    const candidatesA = candidatesBySlot.get(a)?.filter((group) => groups.includes(group)).length ?? 99
    const candidatesB = candidatesBySlot.get(b)?.filter((group) => groups.includes(group)).length ?? 99
    return candidatesA - candidatesB
  })
  const assignments: Partial<Record<number, WorldCupGroupKey>> = {}
  const used = new Set<WorldCupGroupKey>()

  function backtrack(index: number): boolean {
    if (index >= orderedSlots.length) return true

    const slot = orderedSlots[index]
    const candidates = (candidatesBySlot.get(slot) ?? [])
      .filter((group) => groups.includes(group) && !used.has(group))

    for (const group of candidates) {
      assignments[slot] = group
      used.add(group)
      if (backtrack(index + 1)) return true
      used.delete(group)
      delete assignments[slot]
    }

    return false
  }

  return backtrack(0) ? assignments : null
}

function createQualifiedSeedMap(
  groups: LeagueStandingGroup[],
  seedOverrides: WorldCupBracketSeedOverrides = {},
  thirdPlaceAssignments?: WorldCupThirdPlaceAssignmentResult
) {
  const seedMap = new Map<WorldCupBracketSeedKey, WorldCupBracketTeam>()
  const qualifiedTeams: WorldCupBracketTeam[] = []
  const teamOptionIndex = buildTeamOptionIndex(groups)
  const thirdPlacedRows: Array<{
    groupKey: WorldCupGroupKey
    row: LeagueStandingRow
  }> = []

  for (const group of getSortedWorldCupGroups(groups)) {
    const winner = group.rows[0]
    const runnerUp = group.rows[1]
    const third = group.rows[2]
    const winnerSeed = `W${group.groupKey}` as WorldCupBracketSeedKey
    const runnerUpSeed = `R${group.groupKey}` as WorldCupBracketSeedKey

    if (winner) {
      const team = teamOptionIndex.get(seedOverrides[winnerSeed] || '') ?? toBracketTeam(winner, `1${group.groupKey}`)
      const seededTeam = {
        ...team,
        seedLabel: `1${group.groupKey}`,
        source: seedOverrides[winnerSeed] ? 'manual' as const : team.source,
      }
      seedMap.set(winnerSeed, seededTeam)
      qualifiedTeams.push(seededTeam)
    }

    if (runnerUp) {
      const team = teamOptionIndex.get(seedOverrides[runnerUpSeed] || '') ?? toBracketTeam(runnerUp, `2${group.groupKey}`)
      const seededTeam = {
        ...team,
        seedLabel: `2${group.groupKey}`,
        source: seedOverrides[runnerUpSeed] ? 'manual' as const : team.source,
      }
      seedMap.set(runnerUpSeed, seededTeam)
      qualifiedTeams.push(seededTeam)
    }

    if (third) thirdPlacedRows.push({ groupKey: group.groupKey, row: third })
  }

  const rankedThirds = [...thirdPlacedRows].sort((a, b) => compareStandingRows(a.row, b.row)).slice(0, 8)
  const assignmentGroups = thirdPlaceAssignments?.qualifiedGroups.length
    ? thirdPlaceAssignments.qualifiedGroups
    : rankedThirds.map((entry) => entry.groupKey)
  const thirdByGroup = new Map(rankedThirds.map((entry) => [entry.groupKey, entry.row]))

  assignmentGroups.forEach((groupKey, index) => {
    const row = thirdByGroup.get(groupKey)
    if (!row) return

    const seedKey = `T${groupKey}` as WorldCupBracketSeedKey
    const legacySeed = `T${index + 1}` as WorldCupBracketSeedKey
    const override = seedOverrides[seedKey] || seedOverrides[legacySeed] || ''
    const team = teamOptionIndex.get(override) ?? toBracketTeam(row, `3${groupKey}`)
    const seededTeam = {
      ...team,
      seedLabel: `3${groupKey}`,
      source: override ? 'manual' as const : team.source,
    }

    seedMap.set(seedKey, seededTeam)
    seedMap.set(legacySeed, seededTeam)
    qualifiedTeams.push(seededTeam)
  })

  return {
    seedMap,
    qualifiedTeams,
  }
}

function isRoundOf32Fixture(fixture: LeagueFixtureSummary) {
  return getKnockoutRoundKey(fixture) === 'r32'
}

function getKnockoutRoundKey(fixture: LeagueFixtureSummary): WorldCupBracketRoundKey | null {
  const normalized = fixture.round.toLowerCase()

  if (
    normalized.includes('round of 32') ||
    normalized.includes('16th finals') ||
    normalized.includes('dieciseisavos') ||
    normalized.includes('16avos')
  ) {
    return 'r32'
  }

  if (
    normalized.includes('round of 16') ||
    normalized.includes('8th finals') ||
    normalized.includes('octavos')
  ) {
    return 'r16'
  }

  if (normalized.includes('quarter') || normalized.includes('cuartos')) return 'qf'
  if (normalized.includes('semi')) return 'sf'
  if (normalized.includes('final') && !normalized.includes('semi')) return 'final'

  return null
}

function compareLeagueFixturesByStableSlot(a: LeagueFixtureSummary, b: LeagueFixtureSummary) {
  const slotA = Number((a as LeagueFixtureSummary & { bracket_slot?: number | string | null }).bracket_slot)
  const slotB = Number((b as LeagueFixtureSummary & { bracket_slot?: number | string | null }).bracket_slot)

  if (Number.isFinite(slotA) && Number.isFinite(slotB) && slotA !== slotB) return slotA - slotB
  if (typeof a.id === 'number' && typeof b.id === 'number' && a.id !== b.id) return a.id - b.id

  const idCompare = String(a.id).localeCompare(String(b.id), 'es-AR', { numeric: true })
  if (idCompare !== 0) return idCompare

  const dateA = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
  const dateB = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER

  return dateA - dateB
}

function isPlaceholderName(value: string) {
  const normalized = normalizeTeamKey(value)

  return (
    !normalized ||
    normalized === 'tbd' ||
    normalized === 'a-confirmar' ||
    normalized === 'por-confirmar' ||
    normalized === 'winner' ||
    normalized === 'ganador'
  )
}

function toFixtureTeam(
  fixture: LeagueFixtureSummary,
  side: 'home' | 'away'
): WorldCupBracketTeam {
  const teamName = side === 'home' ? fixture.home : fixture.away
  const teamId = side === 'home' ? fixture.homeId : fixture.awayId
  const logo = side === 'home' ? fixture.homeLogo : fixture.awayLogo
  const seedLabel = teamName || 'A confirmar'
  const placeholder = isPlaceholderName(seedLabel)

  return {
    key: placeholder
      ? `placeholder:${fixture.id}:${side}`
      : getFixtureTeamKey({
          fixtureId: fixture.id,
          side,
          teamId,
          teamName: seedLabel,
        }),
    name: placeholder ? 'A confirmar' : seedLabel,
    logo,
    seedLabel,
    placeholder,
    source: 'official',
  }
}

function toOfficialBracketMatch(
  fixture: LeagueFixtureSummary,
  roundKey: WorldCupBracketRoundKey,
  slot: number
): WorldCupBracketMatch {
  const bracketSlot = Number((fixture as LeagueFixtureSummary & { bracket_slot?: number | string | null }).bracket_slot)

  return {
    id: `${roundKey}-${Number.isFinite(bracketSlot) ? bracketSlot : slot}`,
    roundKey,
    slot: Number.isFinite(bracketSlot) ? bracketSlot : slot,
    home: toFixtureTeam(fixture, 'home'),
    away: toFixtureTeam(fixture, 'away'),
    fixtureId: fixture.id,
    date: fixture.date,
    statusShort: fixture.statusShort,
    goalsHome: fixture.goalsHome,
    goalsAway: fixture.goalsAway,
    homePenaltyScore: fixture.homePenaltyScore ?? null,
    awayPenaltyScore: fixture.awayPenaltyScore ?? null,
  }
}

function buildOfficialFirstRound(fixtures: LeagueFixtureSummary[]) {
  const officialMatches = fixtures
    .filter(isRoundOf32Fixture)
    .sort(compareLeagueFixturesByStableSlot)
    .slice(0, 16)

  if (officialMatches.length < 16) return []

  return officialMatches.map((fixture, index) => toOfficialBracketMatch(fixture, 'r32', 73 + index))
}

function getThirdPlaceTeamForSlot(
  seedMap: Map<WorldCupBracketSeedKey, WorldCupBracketTeam>,
  thirdPlaceAssignments: WorldCupThirdPlaceAssignmentResult | undefined,
  slot: number,
  candidates: WorldCupGroupKey[]
) {
  const assignedGroup = thirdPlaceAssignments?.slotAssignments[slot]
  if (assignedGroup) return getSeedTeam(seedMap, `T${assignedGroup}` as WorldCupBracketSeedKey)

  return createPlaceholder(`Mejor tercero ${candidates.join('/')}`)
}

export function buildWorldCupRoundOf32(
  seedMap: Map<WorldCupBracketSeedKey, WorldCupBracketTeam>,
  thirdPlaceAssignments?: WorldCupThirdPlaceAssignmentResult
) {
  return ROUND_OF_32_PAIRINGS.map((pairing) => ({
    id: `r32-${pairing.slot}`,
    roundKey: 'r32' as const,
    slot: pairing.slot,
    home: getSeedTeam(seedMap, pairing.home),
    away: typeof pairing.away === 'string'
      ? getSeedTeam(seedMap, pairing.away)
      : getThirdPlaceTeamForSlot(seedMap, thirdPlaceAssignments, pairing.slot, pairing.away.candidates),
  }))
}

function getMatchBySlot(round: WorldCupBracketRound, slot: number) {
  return round.matches.find((match) => match.slot === slot)
}

function buildNextRound(
  previousRound: WorldCupBracketRound,
  nextRoundKey: Exclude<WorldCupBracketRoundKey, 'r32'>,
  selections: WorldCupBracketWinnerSelection,
  useOfficialWinners = false
) {
  const matches = ROUND_TOPOLOGY[nextRoundKey].map((pairing) => {
    const homeSource = getMatchBySlot(previousRound, pairing.sources[0])
    const awaySource = getMatchBySlot(previousRound, pairing.sources[1])
    const home = useOfficialWinners ? getMatchRealWinner(homeSource) : getSelectedWinner(homeSource, selections)
    const away = useOfficialWinners ? getMatchRealWinner(awaySource) : getSelectedWinner(awaySource, selections)

    return {
      id: `${nextRoundKey}-${pairing.slot}`,
      roundKey: nextRoundKey,
      slot: pairing.slot,
      home: home ?? createPlaceholder(`Ganador Partido ${pairing.sources[0]}`),
      away: away ?? createPlaceholder(`Ganador Partido ${pairing.sources[1]}`),
    }
  })

  return {
    key: nextRoundKey,
    label: ROUND_LABELS[nextRoundKey],
    matches,
  }
}

function mergeOfficialMatchesIntoRound(
  baseRound: WorldCupBracketRound,
  officialMatches: WorldCupBracketMatch[]
): WorldCupBracketRound {
  if (!officialMatches.length) return baseRound

  const officialBySlot = new Map(officialMatches.map((match) => [match.slot, match]))
  const mergedMatches = baseRound.matches.map((match) => officialBySlot.get(match.slot) ?? match)
  const baseSlots = new Set(baseRound.matches.map((match) => match.slot))
  const extraOfficialMatches = officialMatches.filter((match) => !baseSlots.has(match.slot))

  return {
    ...baseRound,
    matches: [...mergedMatches, ...extraOfficialMatches],
  }
}

export function getSelectedWinner(
  match: WorldCupBracketMatch | undefined,
  selections: WorldCupBracketWinnerSelection
) {
  if (!match) return null

  const selectedKey = selections[match.id]
  if (!selectedKey) return null

  if (match.home.key === selectedKey) return match.home
  if (match.away.key === selectedKey) return match.away

  return null
}

export function getSelectedLoser(
  match: WorldCupBracketMatch | undefined,
  selections: WorldCupBracketWinnerSelection
) {
  const winner = getSelectedWinner(match, selections)
  if (!match || !winner) return null

  if (match.home.key === winner.key) return match.away
  if (match.away.key === winner.key) return match.home

  return null
}

export function getMatchRealWinner(match: WorldCupBracketMatch | undefined) {
  if (!match) return null
  if (match.goalsHome === null || match.goalsHome === undefined) return null
  if (match.goalsAway === null || match.goalsAway === undefined) return null

  if (match.goalsHome > match.goalsAway) return match.home
  if (match.goalsAway > match.goalsHome) return match.away

  if (
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
  ) {
    if (match.homePenaltyScore > match.awayPenaltyScore) return match.home
    if (match.awayPenaltyScore > match.homePenaltyScore) return match.away
  }

  return null
}

function getResolvedMatchResult(
  match: WorldCupBracketMatch,
  result?: WorldCupBracketMatchResult
) {
  return {
    goalsHome: result?.goalsHome ?? match.goalsHome ?? null,
    goalsAway: result?.goalsAway ?? match.goalsAway ?? null,
    homePenaltyScore: result?.homePenaltyScore ?? match.homePenaltyScore ?? null,
    awayPenaltyScore: result?.awayPenaltyScore ?? match.awayPenaltyScore ?? null,
  }
}

function hasAnyMatchResultValue(result?: WorldCupBracketMatchResult) {
  if (!result) return false

  return (
    (result.goalsHome !== null && result.goalsHome !== undefined) ||
    (result.goalsAway !== null && result.goalsAway !== undefined) ||
    (result.homePenaltyScore !== null && result.homePenaltyScore !== undefined) ||
    (result.awayPenaltyScore !== null && result.awayPenaltyScore !== undefined)
  )
}

export function resolveKnockoutMatchWinner(
  match: WorldCupBracketMatch | undefined,
  result?: WorldCupBracketMatchResult
): WorldCupKnockoutResolution {
  if (!match) {
    return { status: 'incomplete', winner: null, loser: null }
  }

  if (match.home.placeholder || match.away.placeholder) {
    return {
      status: 'placeholder',
      winner: null,
      loser: null,
      message: 'Esperando clasificados',
    }
  }

  const resolved = getResolvedMatchResult(match, result)

  if (resolved.goalsHome === null || resolved.goalsAway === null) {
    return { status: 'incomplete', winner: null, loser: null }
  }

  if (resolved.goalsHome > resolved.goalsAway) {
    return { status: 'winner', winner: match.home, loser: match.away }
  }

  if (resolved.goalsAway > resolved.goalsHome) {
    return { status: 'winner', winner: match.away, loser: match.home }
  }

  if (resolved.homePenaltyScore === null || resolved.awayPenaltyScore === null) {
    return {
      status: 'needs_penalties',
      winner: null,
      loser: null,
      message: 'Definir penales',
    }
  }

  if (resolved.homePenaltyScore === resolved.awayPenaltyScore) {
    return {
      status: 'penalty_tie',
      winner: null,
      loser: null,
      message: 'Penales no pueden empatar',
    }
  }

  return resolved.homePenaltyScore > resolved.awayPenaltyScore
    ? { status: 'winner', winner: match.home, loser: match.away }
    : { status: 'winner', winner: match.away, loser: match.home }
}

function getMatchParticipantSignature(match: WorldCupBracketMatch | undefined) {
  return match ? `${match.home.key}|${match.away.key}` : ''
}

function getAllKnockoutMatches(
  rounds: WorldCupBracketRound[],
  thirdPlace?: WorldCupBracketMatch | null
) {
  return [
    ...rounds.flatMap((round) => round.matches),
    ...(thirdPlace ? [thirdPlace] : []),
  ]
}

function buildMatchMaps(
  rounds: WorldCupBracketRound[],
  thirdPlace?: WorldCupBracketMatch | null
) {
  const byId = new Map<string, WorldCupBracketMatch>()
  const bySlot = new Map<number, WorldCupBracketMatch>()

  for (const match of getAllKnockoutMatches(rounds, thirdPlace)) {
    byId.set(match.id, match)
    bySlot.set(match.slot, match)
  }

  return { byId, bySlot }
}

function getDirectDescendantSlots(slot: number) {
  const descendants: number[] = []

  for (const pairings of Object.values(ROUND_TOPOLOGY)) {
    for (const pairing of pairings) {
      if (pairing.sources.includes(slot)) descendants.push(pairing.slot)
    }
  }

  if (slot === 101 || slot === 102) descendants.push(103)

  return descendants
}

function collectDescendantSlots(slot: number, collected = new Set<number>()) {
  for (const descendant of getDirectDescendantSlots(slot)) {
    if (collected.has(descendant)) continue

    collected.add(descendant)
    collectDescendantSlots(descendant, collected)
  }

  return collected
}

function clearMatchStateBySlot(
  slot: number,
  matchesBySlot: Map<number, WorldCupBracketMatch>,
  winners: WorldCupBracketWinnerSelection,
  results: WorldCupBracketMatchResults
) {
  const match = matchesBySlot.get(slot)
  if (!match) return

  delete winners[match.id]
  delete results[match.id]
}

export function clearAffectedKnockoutDescendants(
  previousRounds: WorldCupBracketRound[],
  nextRounds: WorldCupBracketRound[],
  winners: WorldCupBracketWinnerSelection,
  results: WorldCupBracketMatchResults,
  previousThirdPlace?: WorldCupBracketMatch | null,
  nextThirdPlace?: WorldCupBracketMatch | null
) {
  const nextWinners = { ...winners }
  const nextResults = { ...results }
  const previousMaps = buildMatchMaps(previousRounds, previousThirdPlace)
  const nextMaps = buildMatchMaps(nextRounds, nextThirdPlace)
  const changedSlots = new Set<number>()

  for (const nextMatch of nextMaps.byId.values()) {
    const previousMatch = previousMaps.byId.get(nextMatch.id)

    if (!previousMatch) continue

    if (getMatchParticipantSignature(previousMatch) !== getMatchParticipantSignature(nextMatch)) {
      changedSlots.add(nextMatch.slot)
    }
  }

  for (const slot of changedSlots) {
    clearMatchStateBySlot(slot, nextMaps.bySlot, nextWinners, nextResults)

    for (const descendantSlot of collectDescendantSlots(slot)) {
      clearMatchStateBySlot(descendantSlot, nextMaps.bySlot, nextWinners, nextResults)
    }
  }

  return {
    winners: nextWinners,
    results: nextResults,
  }
}

export function reconcileKnockoutAfterScoreChange(
  rounds: WorldCupBracketRound[],
  previousWinners: WorldCupBracketWinnerSelection,
  results: WorldCupBracketMatchResults,
  thirdPlace?: WorldCupBracketMatch | null
) {
  const matches = getAllKnockoutMatches(rounds, thirdPlace)
  const matchesBySlot = new Map(matches.map((match) => [match.slot, match]))
  const nextResults = { ...results }
  const nextWinners: WorldCupBracketWinnerSelection = {}
  const changedSlots = new Set<number>()

  for (const match of matches) {
    const result = nextResults[match.id]
    const resolution = resolveKnockoutMatchWinner(match, result)
    const previousWinner = previousWinners[match.id] ?? null
    const nextWinner = resolution.winner?.key ?? null

    if (match.home.placeholder || match.away.placeholder) {
      delete nextResults[match.id]
    }

    if (previousWinner && previousWinner !== nextWinner) {
      changedSlots.add(match.slot)
    }

    if (nextWinner) {
      nextWinners[match.id] = nextWinner
    }
  }

  for (const slot of changedSlots) {
    for (const descendantSlot of collectDescendantSlots(slot)) {
      clearMatchStateBySlot(descendantSlot, matchesBySlot, nextWinners, nextResults)
    }
  }

  for (const match of matches) {
    if (!hasAnyMatchResultValue(nextResults[match.id])) {
      delete nextResults[match.id]
      delete nextWinners[match.id]
      continue
    }

    const resolution = resolveKnockoutMatchWinner(match, nextResults[match.id])

    if (resolution.winner) {
      nextWinners[match.id] = resolution.winner.key
    } else {
      delete nextWinners[match.id]
    }
  }

  return {
    winners: nextWinners,
    results: nextResults,
  }
}

export function propagateKnockoutWinner(
  rounds: WorldCupBracketRound[],
  previousWinners: WorldCupBracketWinnerSelection,
  results: WorldCupBracketMatchResults,
  thirdPlace?: WorldCupBracketMatch | null
) {
  return reconcileKnockoutAfterScoreChange(rounds, previousWinners, results, thirdPlace).winners
}

export function buildWorldCupBracketSimulation(
  groups: LeagueStandingGroup[],
  fixtures: LeagueFixtureSummary[],
  selections: WorldCupBracketWinnerSelection = {},
  seedOverrides: WorldCupBracketSeedOverrides = {},
  simulatedSourceGroups?: LeagueStandingGroup[],
  thirdPlaceAssignments?: WorldCupThirdPlaceAssignmentResult
): WorldCupBracketBuildResult {
  const sourceGroups = simulatedSourceGroups ?? groups
  const inferredAssignments =
    thirdPlaceAssignments ??
    resolveWorldCupThirdPlaceAssignments(
      getSortedWorldCupGroups(sourceGroups)
        .map((group) => group.rows[2] ? group.groupKey : null)
        .filter((groupKey): groupKey is WorldCupGroupKey => Boolean(groupKey))
        .slice(0, 8)
    )
  const { seedMap, qualifiedTeams } = createQualifiedSeedMap(sourceGroups, seedOverrides, inferredAssignments)
  const officialFirstRound = simulatedSourceGroups ? [] : buildOfficialFirstRound(fixtures)
  const hasProjectedSeeds = qualifiedTeams.length > 0
  const firstRound = officialFirstRound.length
    ? officialFirstRound
    : buildWorldCupRoundOf32(seedMap, inferredAssignments)
  const firstRoundSource = officialFirstRound.length
    ? 'official-fixtures'
    : simulatedSourceGroups
      ? 'group-simulation'
      : hasProjectedSeeds
        ? 'standings-projection'
        : 'placeholders'
  const r32: WorldCupBracketRound = {
    key: 'r32',
    label: ROUND_LABELS.r32,
    matches: firstRound,
  }
  const r16 = buildNextRound(r32, 'r16', selections)
  const qf = buildNextRound(r16, 'qf', selections)
  const sf = buildNextRound(qf, 'sf', selections)
  const final = buildNextRound(sf, 'final', selections)
  const thirdPlace: WorldCupBracketMatch = {
    id: 'third-place-103',
    roundKey: 'final',
    slot: 103,
    home: getSelectedLoser(sf.matches[0], selections) ?? createPlaceholder('Perdedor Semifinal 101'),
    away: getSelectedLoser(sf.matches[1], selections) ?? createPlaceholder('Perdedor Semifinal 102'),
  }
  const champion = getSelectedWinner(final.matches[0], selections)

  return {
    rounds: [r32, r16, qf, sf, final],
    thirdPlace,
    champion,
    qualifiedTeams,
    firstRoundSource,
    warnings: inferredAssignments.warnings,
    thirdPlaceAssignments: inferredAssignments,
  }
}

function groupOfficialKnockoutFixtures(fixtures: LeagueFixtureSummary[]) {
  const byRound = new Map<WorldCupBracketRoundKey, LeagueFixtureSummary[]>()

  for (const fixture of fixtures) {
    const roundKey = getKnockoutRoundKey(fixture)
    if (!roundKey) continue

    const current = byRound.get(roundKey) ?? []
    current.push(fixture)
    byRound.set(roundKey, current)
  }

  return byRound
}

export function buildWorldCupOfficialBracket(
  groups: LeagueStandingGroup[],
  fixtures: LeagueFixtureSummary[]
): WorldCupBracketBuildResult {
  const projected = buildWorldCupBracketSimulation(groups, fixtures)
  const officialFixturesByRound = groupOfficialKnockoutFixtures(fixtures)
  const rounds: WorldCupBracketRound[] = []

  for (const roundKey of ['r32', 'r16', 'qf', 'sf', 'final'] as const) {
    const baseSlot = roundKey === 'r32' ? 73 : roundKey === 'r16' ? 89 : roundKey === 'qf' ? 97 : roundKey === 'sf' ? 101 : 104
    const officialMatches = (officialFixturesByRound.get(roundKey) ?? [])
      .sort(compareLeagueFixturesByStableSlot)
      .map((fixture, index) => toOfficialBracketMatch(fixture, roundKey, baseSlot + index))

    if (roundKey === 'r32') {
      rounds.push(mergeOfficialMatchesIntoRound(projected.rounds[0], officialMatches))
      continue
    }

    const baseRound = buildNextRound(rounds[rounds.length - 1], roundKey, {}, true)
    rounds.push(mergeOfficialMatchesIntoRound(baseRound, officialMatches))
  }

  const semiFinalRound = rounds.find((round) => round.key === 'sf')
  const finalRound = rounds.find((round) => round.key === 'final')
  const thirdPlaceFixture = fixtures
    .filter((fixture) => {
      const normalized = fixture.round.toLowerCase()

      return normalized.includes('third place') || normalized.includes('3rd place') || normalized.includes('tercer')
    })
    .sort(compareLeagueFixturesByStableSlot)[0]
  const thirdPlace =
    thirdPlaceFixture
      ? toOfficialBracketMatch(thirdPlaceFixture, 'final', 103)
      : {
          id: 'third-place-103',
          roundKey: 'final' as const,
          slot: 103,
          home: semiFinalRound
            ? getMatchRealWinner(semiFinalRound.matches[0]) ?? createPlaceholder('Perdedor Semifinal 101')
            : createPlaceholder('Perdedor Semifinal 101'),
          away: semiFinalRound
            ? getMatchRealWinner(semiFinalRound.matches[1]) ?? createPlaceholder('Perdedor Semifinal 102')
            : createPlaceholder('Perdedor Semifinal 102'),
        }

  return {
    rounds,
    thirdPlace,
    champion: getMatchRealWinner(finalRound?.matches[0]),
    qualifiedTeams: projected.qualifiedTeams,
    firstRoundSource: projected.firstRoundSource,
    thirdPlaceAssignments: projected.thirdPlaceAssignments,
  }
}

export function reconcileKnockoutSimulationAfterGroupChanges(
  rounds: WorldCupBracketRound[],
  winners: WorldCupBracketWinnerSelection,
  results: WorldCupBracketMatchResults
) {
  return reconcileKnockoutAfterScoreChange(rounds, winners, results)
}

export function clearWorldCupSimulation() {
  return {
    schemaVersion: 2 as const,
    winners: {},
    results: {},
    seedOverrides: {},
    groupResults: {},
    manualTiebreakers: {},
    selectedGroup: 'A' as WorldCupGroupKey,
    simulatorView: 'groups' as const,
    selectedRound: 'r32' as WorldCupBracketRoundKey,
    updatedAt: new Date().toISOString(),
  }
}

export function validateWorldCupSimulation(model: WorldCupGroupSimulationModel, bracket: WorldCupBracketBuildResult) {
  const firstRoundTeams = bracket.rounds[0]?.matches.flatMap((match) => [match.home, match.away]) ?? []
  const realTeams = firstRoundTeams.filter((team) => !team.placeholder)
  const uniqueTeamKeys = new Set(realTeams.map((team) => team.key))

  return {
    groupCount: model.groups.length,
    completeGroupCount: model.groups.filter((group) => group.complete).length,
    firstCount: model.groups.filter((group) => group.rows[0]).length,
    secondCount: model.groups.filter((group) => group.rows[1]).length,
    thirdQualifiedCount: model.thirdPlaceRanking.qualified.length,
    roundOf32Count: bracket.rounds[0]?.matches.length ?? 0,
    uniqueQualifiedCount: uniqueTeamKeys.size,
    warnings: [
      ...model.warnings,
      ...(bracket.warnings ?? []),
      ...(realTeams.length !== uniqueTeamKeys.size ? ['Hay equipos duplicados en dieciseisavos.'] : []),
    ],
  }
}

export function getWorldCupBracketStorageKey() {
  return WORLD_CUP_FULL_SIMULATOR_STORAGE_KEY
}

export function getLegacyWorldCupBracketStorageKey(input: {
  leagueExternalId?: number | null
  season?: number | null
}) {
  return [
    WORLD_CUP_BRACKET_STORAGE_KEY_PREFIX,
    input.leagueExternalId ?? 'world-cup',
    input.season ?? 2026,
  ].join(':')
}

export function getWorldCupBracketQualifiedCount(groups: LeagueStandingGroup[]) {
  const { qualifiedTeams } = createQualifiedSeedMap(groups)

  return qualifiedTeams.length
}

export function getWorldCupBracketSeedOptions(groups: LeagueStandingGroup[]) {
  return getSortedWorldCupGroups(groups).map((group) => ({
    groupKey: group.groupKey,
    rows: group.rows.map((row) => toBracketTeam(row, `${row.rank || '-'}${group.groupKey}`)),
  }))
}

export function getExpectedWorldCupGroupKeys() {
  return WORLD_CUP_GROUP_KEYS
}
