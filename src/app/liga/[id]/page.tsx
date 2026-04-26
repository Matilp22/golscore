import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import CurrentRoundNavigator from '@/frontend/components/CurrentRoundNavigator'
import CopaArgentinaMatchList from '@/frontend/components/CopaArgentinaMatchList'
import LeaderListInteractive from '@/frontend/components/LeaderListInteractive'
import {
  ApiFootballError,
  getLeagueFixtures,
  getLeagueLeaders,
  getLeagueStandings,
  resolveTournament,
  type LeagueFixtureSummary,
  type LeagueStandingGroup,
  type LeagueStandingRow,
  type ResolvedTournament,
  type TopPlayerRow,
} from '@/lib/api-football'
import { getTournamentConfig } from '@/lib/tournament-pages'

type PageProps = {
  params: Promise<{ id: string }>
}

function formatAverage(value: number) {
  return value.toFixed(2)
}

function normalizeRoundName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getRoundPriority(round: string) {
  const normalized = normalizeRoundName(round)

  if (normalized.includes('third place') || normalized.includes('3rd place') || normalized.includes('tercer puesto')) return 95
  if (normalized.includes('final') && !normalized.includes('semi')) return 90
  if (normalized.includes('semi')) return 80
  if (normalized.includes('quarter')) return 70
  if (normalized.includes('round of 16') || normalized.includes('16th finals') || normalized.includes('dieciseisavos')) return 60
  if (normalized.includes('octavos') || normalized.includes('round of 16')) return 60
  if (normalized.includes('round of 32') || normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) return 50
  if (normalized.includes('round of 64') || normalized.includes('64th finals') || normalized.includes('sesentaicuatroavos')) return 40
  if (normalized.includes('play-off') || normalized.includes('playoff')) return 30
  return 10
}

function getRoundDisplayName(round: string) {
  const normalized = normalizeRoundName(round)

  if (normalized.includes('third place') || normalized.includes('3rd place') || normalized.includes('tercer puesto')) {
    return '3ER PUESTO'
  }
  if (normalized.includes('final') && !normalized.includes('semi')) return 'FINAL'
  if (normalized.includes('semi')) return 'SEMIFINALES'
  if (normalized.includes('quarter')) return 'CUARTOS DE FINAL'
  if (normalized.includes('octavos') || normalized.includes('round of 16')) return 'OCTAVOS DE FINAL'
  if (normalized.includes('round of 32') || normalized.includes('16th finals') || normalized.includes('dieciseisavos')) {
    return '16AVOS DE FINAL'
  }
  if (normalized.includes('round of 64') || normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) {
    return '32AVOS DE FINAL'
  }

  return round.toUpperCase()
}

function getRoundBadge(round: string) {
  const normalized = normalizeRoundName(round)

  if (normalized.includes('third place') || normalized.includes('3rd place') || normalized.includes('tercer puesto')) {
    return {
      label: '3er puesto',
      className: 'border-[#7fb36b] bg-[#6d8f57] text-white',
    }
  }

  if (normalized.includes('final') && !normalized.includes('semi')) {
    return {
      label: 'FINAL',
      className: 'border-[#f0c643] bg-[#ffcc33] text-[#3f3410]',
    }
  }

  return null
}

type BracketStageKey = 'r64' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'

type BracketParticipant = {
  team: string
  teamId?: number
  logo?: string
  goals: number | null
  isPlaceholder?: boolean
  isWinner?: boolean
}

type BracketMatchCard = {
  id: string | number
  rowStart: number
  bracketPosition: number
  date?: string
  participants: [BracketParticipant, BracketParticipant]
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}

type BracketColumn = {
  key: BracketStageKey
  label: string
  matches: BracketMatchCard[]
}

type BracketSlot = {
  phase: BracketStageKey
  slotIndex: number
  sourceSlotA: number | null
  sourceSlotB: number | null
  match: BracketMatchCard
  winner: string | null
}

const BRACKET_STAGE_ORDER: BracketStageKey[] = ['r64', 'r32', 'r16', 'qf', 'sf', 'final']
const BRACKET_CARD_HEIGHT = 48
const BRACKET_GRID_UNIT = BRACKET_CARD_HEIGHT / 2
const BRACKET_STAGE_MATCH_COUNTS: Record<BracketStageKey, number> = {
  r64: 32,
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
}

const COPA_ARGENTINA_2026_R64_FIXTURE_ORDER = [
  1503675,
  1503666,
  1503682,
  1503689,
  1503677,
  1503686,
  1503673,
  1502449,
  1503680,
  1503684,
  1503667,
  1503678,
  1503688,
  1503687,
  1503690,
  1503672,
  1503670,
  1503669,
  1502446,
  1503671,
  1503664,
  1503676,
  1503683,
  1503679,
  1503663,
  1503674,
  1503685,
  1502447,
  1502448,
  1503668,
  1503665,
  1503681,
]

const COPA_ARGENTINA_2026_R64_POSITION_BY_FIXTURE_ID = new Map(
  COPA_ARGENTINA_2026_R64_FIXTURE_ORDER.map((fixtureId, index) => [fixtureId, index])
)

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getParticipantKey(participant: Pick<BracketParticipant, 'team' | 'teamId'>) {
  return participant.teamId ? `id:${participant.teamId}` : `name:${normalizeTeamName(participant.team)}`
}

function getBracketStageKey(round: string): BracketStageKey | null {
  const normalized = normalizeRoundName(round)

  if (normalized.includes('final') && !normalized.includes('semi')) return 'final'
  if (normalized.includes('semi')) return 'sf'
  if (normalized.includes('quarter')) return 'qf'
  if (normalized.includes('octavos') || normalized.includes('round of 16')) return 'r16'
  if (normalized.includes('round of 32') || normalized.includes('16th finals') || normalized.includes('dieciseisavos')) return 'r32'
  if (normalized.includes('round of 64') || normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) return 'r64'

  return null
}

function getBracketStageLabel(stageKey: BracketStageKey) {
  if (stageKey === 'r64') return '32AVOS DE FINAL'
  if (stageKey === 'r32') return '16AVOS DE FINAL'
  if (stageKey === 'r16') return 'OCTAVOS DE FINAL'
  if (stageKey === 'qf') return 'CUARTOS DE FINAL'
  if (stageKey === 'sf') return 'SEMIFINALES'
  return 'FINAL'
}

function getPlaceholderParticipant(): BracketParticipant {
  return {
    team: 'A confirmar',
    goals: null,
    isPlaceholder: true,
  }
}

function createPlaceholderMatch(
  id: string,
  participants?: [BracketParticipant, BracketParticipant]
): BracketMatchCard {
  return {
    id,
    rowStart: 1,
    bracketPosition: 0,
    participants: participants || [getPlaceholderParticipant(), getPlaceholderParticipant()],
  }
}

function getBracketMatchWinnerKey(match: BracketMatchCard) {
  const [home, away] = match.participants

  if (
    home.goals !== null &&
    away.goals !== null &&
    home.goals !== away.goals
  ) {
    return getParticipantKey(home.goals > away.goals ? home : away)
  }

  if (
    home.goals !== null &&
    away.goals !== null &&
    home.goals === away.goals &&
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined &&
    match.homePenaltyScore !== match.awayPenaltyScore
  ) {
    return getParticipantKey(match.homePenaltyScore > match.awayPenaltyScore ? home : away)
  }

  return null
}

function applyWinnerToMatch(match: BracketMatchCard, winnerKey?: string | null): BracketMatchCard {
  const resolvedWinnerKey = winnerKey || getBracketMatchWinnerKey(match)

  return {
    ...match,
    participants: match.participants.map((participant) => ({
      ...participant,
      isWinner: Boolean(resolvedWinnerKey && getParticipantKey(participant) === resolvedWinnerKey),
    })) as [BracketParticipant, BracketParticipant],
  }
}

function toBracketMatch(fixture: LeagueFixtureSummary): BracketMatchCard {
  return {
    id: fixture.id,
    rowStart: 1,
    bracketPosition: 0,
    date: fixture.date,
    homePenaltyScore: fixture.homePenaltyScore ?? null,
    awayPenaltyScore: fixture.awayPenaltyScore ?? null,
    participants: [
      {
        team: fixture.home,
        teamId: fixture.homeId,
        logo: fixture.homeLogo,
        goals: fixture.goalsHome,
      },
      {
        team: fixture.away,
        teamId: fixture.awayId,
        logo: fixture.awayLogo,
        goals: fixture.goalsAway,
      },
    ],
  }
}

function sortBracketMatchesByDate(matches: BracketMatchCard[]) {
  return [...matches].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    if (dateA !== dateB) return dateA - dateB

    if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id
    return String(a.id).localeCompare(String(b.id))
  })
}

type BracketTree = {
  columns: BracketColumn[]
  slotsByPhase: Map<BracketStageKey, BracketSlot[]>
  unpositioned: Array<{
    stageKey: BracketStageKey
    match: BracketMatchCard
  }>
}

function groupBracketMatchesByStage(fixtures: LeagueFixtureSummary[]) {
  const groupedByStage = new Map<BracketStageKey, BracketMatchCard[]>()
  for (const fixture of fixtures) {
    const stageKey = getBracketStageKey(fixture.round)
    if (!stageKey) continue

    const current = groupedByStage.get(stageKey) || []
    current.push(toBracketMatch(fixture))
    groupedByStage.set(stageKey, current)
  }

  return groupedByStage
}

function getMatchCandidateAdvancerKeys(match: BracketMatchCard) {
  const winnerKey = getBracketMatchWinnerKey(match)
  if (winnerKey) return new Set([winnerKey])

  return new Set(
    match.participants
      .filter((participant) => !participant.isPlaceholder)
      .map((participant) => getParticipantKey(participant))
  )
}

function matchBelongsInParentSlot(
  match: BracketMatchCard,
  childSlots: BracketSlot[],
  parentPosition: number
) {
  const firstChild = childSlots[parentPosition * 2]?.match
  const secondChild = childSlots[parentPosition * 2 + 1]?.match
  if (!firstChild || !secondChild) return false

  const childKeys = new Set([
    ...getMatchCandidateAdvancerKeys(firstChild),
    ...getMatchCandidateAdvancerKeys(secondChild),
  ])
  const participantKeys = match.participants
    .filter((participant) => !participant.isPlaceholder)
    .map((participant) => getParticipantKey(participant))

  return participantKeys.length === 2 && participantKeys.every((key) => childKeys.has(key))
}

function placeStageMatches(
  stageKey: BracketStageKey,
  matches: BracketMatchCard[],
  childSlots?: BracketSlot[]
) {
  const matchSlots = Array<BracketMatchCard | null>(BRACKET_STAGE_MATCH_COUNTS[stageKey]).fill(null)
  const unpositioned: BracketMatchCard[] = []

  for (const match of matches) {
    let bracketPosition: number | null = null

    if (stageKey === 'r64' && typeof match.id === 'number') {
      bracketPosition = COPA_ARGENTINA_2026_R64_POSITION_BY_FIXTURE_ID.get(match.id) ?? null
    } else if (childSlots) {
      bracketPosition = matchSlots.findIndex(
        (slot, position) =>
          slot === null && matchBelongsInParentSlot(match, childSlots, position)
      )
      if (bracketPosition < 0) bracketPosition = null
    }

    if (bracketPosition === null || bracketPosition < 0 || bracketPosition >= matchSlots.length) {
      unpositioned.push(match)
      continue
    }

    matchSlots[bracketPosition] = {
      ...applyWinnerToMatch(match),
      bracketPosition,
    }
  }

  return { matchSlots, unpositioned }
}

function createBracketSlot(
  phase: BracketStageKey,
  slotIndex: number,
  stageIndex: number,
  match: BracketMatchCard | null
): BracketSlot {
  const sourceSlotA = stageIndex === 0 ? null : slotIndex * 2
  const sourceSlotB = stageIndex === 0 ? null : slotIndex * 2 + 1
  const slotMatch = {
    ...(match || createPlaceholderMatch(`${phase}-${slotIndex}`)),
    bracketPosition: slotIndex,
    rowStart: 2 ** stageIndex + slotIndex * 2 ** (stageIndex + 1),
  }

  return {
    phase,
    slotIndex,
    sourceSlotA,
    sourceSlotB,
    match: slotMatch,
    winner: getBracketMatchWinnerKey(slotMatch),
  }
}

function buildBracketTree(fixtures: LeagueFixtureSummary[]): BracketTree {
  const groupedByStage = groupBracketMatchesByStage(fixtures)
  const actualStageKeys = BRACKET_STAGE_ORDER.filter((stageKey) => groupedByStage.has(stageKey))
  if (!actualStageKeys.length) {
    return {
      columns: [],
      slotsByPhase: new Map(),
      unpositioned: [],
    }
  }

  const stageKeys = BRACKET_STAGE_ORDER.slice(BRACKET_STAGE_ORDER.indexOf('r64'))
  const columns: BracketColumn[] = []
  const slotsByPhase = new Map<BracketStageKey, BracketSlot[]>()
  const unpositioned: BracketTree['unpositioned'] = []

  for (let stageIndex = 0; stageIndex < stageKeys.length; stageIndex += 1) {
    const stageKey = stageKeys[stageIndex]
    const previousStageKey = stageKeys[stageIndex - 1]
    const actualMatches = groupedByStage.get(stageKey) || []
    const placedStage = placeStageMatches(
      stageKey,
      actualMatches,
      previousStageKey ? slotsByPhase.get(previousStageKey) : undefined
    )
    const phaseSlots = placedStage.matchSlots.map((match, slotIndex) =>
      createBracketSlot(stageKey, slotIndex, stageIndex, match)
    )

    slotsByPhase.set(stageKey, phaseSlots)
    unpositioned.push(
      ...placedStage.unpositioned.map((match) => ({
        stageKey,
        match,
      }))
    )

    columns.push({
      key: stageKey,
      label: getBracketStageLabel(stageKey),
      matches: phaseSlots.map((slot) => slot.match),
    })
  }

  if (unpositioned.length) {
    console.warn('[copa-argentina:bracket] Fixtures sin posición en la llave', {
      fixtures: unpositioned.map(({ stageKey, match }) => ({
        stageKey,
        fixtureId: match.id,
        teams: match.participants.map((participant) => participant.team),
      })),
    })
  }

  return { columns, slotsByPhase, unpositioned }
}

function buildBracketColumns(fixtures: LeagueFixtureSummary[]): BracketColumn[] {
  return buildBracketTree(fixtures).columns
}

function buildGenericBracketColumns(fixtures: LeagueFixtureSummary[]): BracketColumn[] {
  const groupedByStage = groupBracketMatchesByStage(fixtures)
  const actualStageKeys = BRACKET_STAGE_ORDER.filter((stageKey) => groupedByStage.has(stageKey))
  if (!actualStageKeys.length) return []

  const firstStageIndex = BRACKET_STAGE_ORDER.findIndex((stageKey) => stageKey === actualStageKeys[0])
  const stageKeys = BRACKET_STAGE_ORDER.slice(firstStageIndex)
  const firstStageMatchesCount = groupedByStage.get(stageKeys[0])?.length || 0

  return stageKeys.map((stageKey, stageIndex) => {
    const actualMatches = sortBracketMatchesByDate(groupedByStage.get(stageKey) || [])
    const expectedMatchesCount = Math.max(1, Math.ceil(firstStageMatchesCount / 2 ** stageIndex))
    const columnMatches = [
      ...actualMatches.map((match, matchIndex) => ({
        ...applyWinnerToMatch(match),
        bracketPosition: matchIndex,
      })),
      ...Array.from(
        { length: Math.max(0, expectedMatchesCount - actualMatches.length) },
        (_, placeholderIndex) => ({
          ...createPlaceholderMatch(`${stageKey}-${placeholderIndex}`),
          bracketPosition: actualMatches.length + placeholderIndex,
        })
      ),
    ]

    return {
      key: stageKey,
      label: getBracketStageLabel(stageKey),
      matches: columnMatches.map((match, matchIndex) => ({
        ...match,
        rowStart: 2 ** stageIndex + matchIndex * 2 ** (stageIndex + 1),
      })),
    }
  })
}

function dedupeRows(rows: LeagueStandingRow[]) {
  const rowMap = new Map<string, LeagueStandingRow>()

  for (const row of rows) {
    const key = String(row.teamId || row.teamName)
    const current = rowMap.get(key)

    if (!current) {
      rowMap.set(key, row)
      continue
    }

    const candidateScore = row.played * 1000 + row.points
    const currentScore = current.played * 1000 + current.points

    if (candidateScore > currentScore) {
      rowMap.set(key, row)
    }
  }

  return [...rowMap.values()]
}

function normalizeGroupName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getDisplayGroupName(value: string) {
  const match = normalizeGroupName(value).match(/\b(?:group|grupo)\s+([a-z0-9]+)\b/)

  if (match) {
    return `Grupo ${match[1].toUpperCase()}`
  }

  return value
}

function splitPrimaryGroups(
  groups: Array<{ name: string; rows: LeagueStandingRow[] }>
) {
  const primary = groups.filter((group) => {
    const name = normalizeGroupName(group.name)
    return (
      name.includes('grupo a') ||
      name.includes('grupo b') ||
      name.includes('group a') ||
      name.includes('group b')
    )
  })

  if (primary.length >= 2) {
    const primaryNames = new Set(primary.map((group) => group.name))
    return {
      primaryGroups: [...primary].sort((a, b) => a.name.localeCompare(b.name)),
      secondaryGroups: groups.filter((group) => !primaryNames.has(group.name)),
    }
  }

  return {
    primaryGroups: groups,
    secondaryGroups: [] as Array<{ name: string; rows: LeagueStandingRow[] }>,
  }
}

function isDerivedTableGroup(name: string) {
  const normalized = normalizeGroupName(name)

  return (
    normalized.includes('anual') ||
    normalized.includes('annual') ||
    normalized.includes('promedio') ||
    normalized.includes('average') ||
    normalized.includes('relegation') ||
    normalized.includes('descenso') ||
    normalized.includes('overall')
  )
}

function buildAnnualTable(rows: LeagueStandingRow[]) {
  return dedupeRows(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  }).map((row, index) => ({
    ...row,
    rank: index + 1,
  }))
}

function buildPromediosTable(rows: LeagueStandingRow[]) {
  return dedupeRows(rows)
    .filter((row) => row.played > 0)
    .map((row) => ({
      ...row,
      average: row.points / row.played,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average
      return b.points - a.points
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
}

type PromedioSeasonValue = {
  season: number
  points: number
  played: number
}

type PromedioRow = {
  rank: number
  teamId?: number
  teamName: string
  teamLogo?: string
  average: number
  totalPoints: number
  totalPlayed: number
  seasonValues: PromedioSeasonValue[]
}

function getBaseRowsFromStandings(groups: Array<{ name: string; rows: LeagueStandingRow[] }>) {
  const { primaryGroups } = splitPrimaryGroups(groups)
  return primaryGroups.flatMap((group) => group.rows)
}

function buildHistoricalPromediosTable(
  standingsBySeason: Array<{
    season: number
    standings: Array<{ name: string; rows: LeagueStandingRow[] }>
  }>
) {
  const teamMap = new Map<
    string,
    {
      teamId?: number
      teamName: string
      teamLogo?: string
      seasonValues: Map<number, { points: number; played: number }>
    }
  >()

  for (const seasonEntry of standingsBySeason) {
    const annualRows = buildAnnualTable(getBaseRowsFromStandings(seasonEntry.standings))

    for (const row of annualRows) {
      const key = String(row.teamId || row.teamName)
      const current =
        teamMap.get(key) ||
        {
          teamId: row.teamId,
          teamName: row.teamName,
          teamLogo: row.teamLogo,
          seasonValues: new Map<number, { points: number; played: number }>(),
        }

      current.seasonValues.set(seasonEntry.season, {
        points: row.points,
        played: row.played,
      })

      if (!current.teamLogo && row.teamLogo) {
        current.teamLogo = row.teamLogo
      }

      teamMap.set(key, current)
    }
  }

  const orderedSeasons = [...standingsBySeason]
    .map((entry) => entry.season)
    .sort((a, b) => a - b)

  return [...teamMap.values()]
    .map((team): PromedioRow | null => {
      const seasonValues = orderedSeasons.map((season) => {
        const seasonValue = team.seasonValues.get(season)

        return {
          season,
          points: seasonValue?.points || 0,
          played: seasonValue?.played || 0,
        }
      })

      const totalPoints = seasonValues.reduce((sum, item) => sum + item.points, 0)
      const totalPlayed = seasonValues.reduce((sum, item) => sum + item.played, 0)

      if (totalPlayed <= 0) return null

      return {
        rank: 0,
        teamId: team.teamId,
        teamName: team.teamName,
        teamLogo: team.teamLogo,
        average: totalPoints / totalPlayed,
        totalPoints,
        totalPlayed,
        seasonValues,
      }
    })
    .filter((row): row is PromedioRow => Boolean(row))
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      return a.teamName.localeCompare(b.teamName)
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
}

type StandingsVariant = 'positions' | 'annual' | 'promedios'

function getRowAccent(
  row: LeagueStandingRow,
  index: number,
  rowsLength: number,
  variant: StandingsVariant,
  relegatedTeamIds: Set<string> = new Set()
) {
  if (variant === 'annual') {
    if (index === 0) return 'border-l-[#39e67a] bg-[#10301f]'
    if (index >= 1 && index <= 4) return 'border-l-[#f1cc4a] bg-[#2d2610]'
    if (index >= 5 && index <= 10) return 'border-l-sky-400 bg-sky-950/25'
    if (relegatedTeamIds.has(String(row.teamId || row.teamName))) {
      return 'border-l-[#ff5d73] bg-[#35141a]'
    }
    return 'border-l-transparent'
  }

  if (variant === 'promedios') {
    if (relegatedTeamIds.has(String(row.teamId || row.teamName))) {
      return 'border-l-[#ff5d73] bg-[#35141a]'
    }

    return 'border-l-transparent'
  }

  const description = (row.description || '').toLowerCase()

  if (
    description.includes('libertadores') ||
    description.includes('champions') ||
    description.includes('qualification') ||
    description.includes('play-offs') ||
    description.includes('playoffs')
  ) {
    return 'border-l-[#46d98e] bg-[#10261c]'
  }

  if (description.includes('sudamericana') || description.includes('europa') || description.includes('conference')) {
    return 'border-l-sky-400 bg-sky-950/25'
  }

  if (description.includes('relegation') || description.includes('descenso')) {
    return 'border-l-[#ff7e7e] bg-[#2a1616]'
  }

  if (rowsLength >= 14 && index < 8) {
    return 'border-l-[#46d98e] bg-[#10261c]'
  }

  return 'border-l-transparent'
}

function TableLegend({
  items,
}: {
  items: Array<{ label: string; tone: string }>
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-white/6 pt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-[#dce5ef]">
          <span className={`h-3 w-3 rounded-full ${item.tone}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function getAnnualRelegatedTeamId(rows: LeagueStandingRow[]) {
  if (!rows.length) return null
  const lastRow = rows[rows.length - 1]
  return String(lastRow.teamId || lastRow.teamName)
}

function getPromediosRelegatedTeamId(
  rows: Array<{ teamId?: number; teamName: string }>,
  annualRelegatedTeamId: string | null
) {
  if (!rows.length) return null

  const reversedRows = [...rows].reverse()
  const candidate = reversedRows.find(
    (row) => String(row.teamId || row.teamName) !== annualRelegatedTeamId
  )

  if (candidate) {
    return String(candidate.teamId || candidate.teamName)
  }

  const lastRow = rows[rows.length - 1]
  return lastRow ? String(lastRow.teamId || lastRow.teamName) : null
}

function PromediosTable({
  rows,
  compact = false,
  relegatedTeamIds,
}: {
  rows: PromedioRow[]
  compact?: boolean
  relegatedTeamIds?: Set<string>
}) {
  const seasons = rows[0]?.seasonValues.map((entry) => entry.season) || []

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full ${compact ? 'text-[12px]' : 'text-sm'}`}>
        <thead className="text-left text-[#8d98a7]">
          <tr className="border-b border-white/6">
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>#</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>Equipos</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}>Prom</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}>Pts</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}>PJ</th>
            {seasons.map((season) => (
              <th
                key={season}
                className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}
              >
                {String(season).slice(-2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.teamId || row.teamName}-${index}`}
              className={`border-b border-l-2 border-white/6 text-[#dce5ef] last:border-b-0 ${getRowAccent(
                {
                  rank: row.rank,
                  teamId: row.teamId,
                  teamName: row.teamName,
                  teamLogo: row.teamLogo,
                  points: row.totalPoints,
                  played: row.totalPlayed,
                  won: 0,
                  drawn: 0,
                  lost: 0,
                  goalsFor: 0,
                  goalsAgainst: 0,
                  goalDifference: 0,
                },
                index,
                rows.length,
                'promedios',
                relegatedTeamIds
              )}`}
            >
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>{row.rank}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'}`}>
                <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                  {row.teamLogo ? (
                    <Image
                      src={row.teamLogo}
                      alt={row.teamName}
                      width={compact ? 18 : 24}
                      height={compact ? 18 : 24}
                      className={`${compact ? 'h-[18px] w-[18px]' : 'h-6 w-6'} object-contain`}
                    />
                  ) : null}
                  <span className={`font-medium ${compact ? 'text-[12px]' : ''}`}>{row.teamName}</span>
                </div>
              </td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-bold`}>
                {row.average.toFixed(3)}
              </td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}>
                {row.totalPoints}
              </td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>
                {row.totalPlayed}
              </td>
              {row.seasonValues.map((seasonValue) => (
                <td
                  key={`${row.teamId || row.teamName}-${seasonValue.season}`}
                  className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}
                >
                  {seasonValue.points}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildKnockoutRounds(fixtures: LeagueFixtureSummary[]) {
  const knockoutFixtures = fixtures.filter((fixture) => {
    const round = normalizeRoundName(fixture.round)
    return (
      round.includes('final') ||
      round.includes('semi') ||
      round.includes('quarter') ||
      round.includes('octavos') ||
      round.includes('round of 16') ||
      round.includes('round of 32') ||
      round.includes('round of 64') ||
      round.includes('dieciseisavos') ||
      round.includes('32nd finals') ||
      round.includes('treintaidosavos') ||
      round.includes('64th finals') ||
      round.includes('sesentaicuatroavos')
    )
  })

  const grouped = new Map<string, LeagueFixtureSummary[]>()

  for (const fixture of knockoutFixtures) {
    const existing = grouped.get(fixture.round) || []
    existing.push(fixture)
    grouped.set(fixture.round, existing)
  }

  return [...grouped.entries()]
    .map(([round, matches]) => ({
      round,
      matches: [...matches].sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return a.id - b.id
      }),
    }))
    .sort((a, b) => getRoundPriority(a.round) - getRoundPriority(b.round))
}

function buildCopaArgentinaMatchRounds(rounds: ReturnType<typeof buildKnockoutRounds>) {
  return rounds.map((round) => ({
    round: round.round,
    label: getRoundDisplayName(round.round),
    matches: round.matches,
  }))
}

function isKnockoutRound(round: string) {
  const normalized = normalizeRoundName(round)

  return (
    normalized.includes('final') ||
    normalized.includes('semi') ||
    normalized.includes('quarter') ||
    normalized.includes('octavos') ||
    normalized.includes('round of 16') ||
    normalized.includes('round of 32') ||
    normalized.includes('round of 64') ||
    normalized.includes('dieciseisavos') ||
    normalized.includes('32nd finals') ||
    normalized.includes('treintaidosavos') ||
    normalized.includes('64th finals') ||
    normalized.includes('sesentaicuatroavos') ||
    normalized.includes('play-off') ||
    normalized.includes('playoff')
  )
}

function getRoundLabel(round: string) {
  const numericMatch = round.match(/(\d+)/)
  if (numericMatch) return `Fecha ${numericMatch[1]}`

  const normalized = normalizeRoundName(round)
  if (normalized.includes('regular season')) return 'Fecha'

  return getRoundDisplayName(round)
}

function getRoundNumber(round: string) {
  const match = round.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

function getRoundBlocks(fixtures: LeagueFixtureSummary[]) {
  const leagueFixtures = fixtures.filter((fixture) => {
    if (isKnockoutRound(fixture.round)) return false

    const normalized = normalizeRoundName(fixture.round)
    const roundNumber = getRoundNumber(fixture.round)

    if (normalized.includes('apertura') && roundNumber) {
      return roundNumber >= 1 && roundNumber <= 16
    }

    return normalized.includes('regular season') && Boolean(roundNumber)
  })
  if (!leagueFixtures.length) return { blocks: [], initialIndex: 0 }

  const grouped = new Map<string, LeagueFixtureSummary[]>()

  for (const fixture of leagueFixtures) {
    const current = grouped.get(fixture.round) || []
    current.push(fixture)
    grouped.set(fixture.round, current)
  }

  const now = Date.now()
  const rounds = [...grouped.entries()].map(([round, matches]) => {
    const sortedMatches = [...matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const liveMatches = sortedMatches.filter((match) =>
      ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(match.statusShort)
    )
    const upcomingMatches = sortedMatches.filter(
      (match) => new Date(match.date).getTime() >= now && match.statusShort === 'NS'
    )
    const latestTimestamp = Math.max(...sortedMatches.map((match) => new Date(match.date).getTime()))
    const nextTimestamp = upcomingMatches.length
      ? new Date(upcomingMatches[0].date).getTime()
      : Number.POSITIVE_INFINITY

    return {
      round,
      matches: sortedMatches,
      liveCount: liveMatches.length,
      nextTimestamp,
      latestTimestamp,
    }
  })

  rounds.sort((a, b) => {
    if (a.liveCount !== b.liveCount) return b.liveCount - a.liveCount
    if (a.nextTimestamp !== b.nextTimestamp) return a.nextTimestamp - b.nextTimestamp
    return b.latestTimestamp - a.latestTimestamp
  })

  const selected = rounds[0]
  if (!selected) return { blocks: [], initialIndex: 0 }

  const orderedRounds = [...grouped.entries()]
    .map(([round, matches]) => ({
      round,
      matches: [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }))
    .sort((a, b) => {
      const aMatch = a.round.match(/(\d+)/)
      const bMatch = b.round.match(/(\d+)/)

      if (aMatch && bMatch) return Number(aMatch[1]) - Number(bMatch[1])

      return a.matches[0]?.date.localeCompare(b.matches[0]?.date || '') || 0
    })

  const blocks = orderedRounds.map((entry) => {
    const days = new Map<string, LeagueFixtureSummary[]>()

    for (const match of entry.matches) {
      const key = new Intl.DateTimeFormat('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date(match.date))

      const current = days.get(key) || []
      current.push(match)
      days.set(key, current)
    }

    return {
      round: entry.round,
      label: getRoundLabel(entry.round),
      days: [...days.entries()],
    }
  })

  return {
    blocks,
    initialIndex: Math.max(
      0,
      blocks.findIndex((block) => block.round === selected.round)
    ),
  }
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-4 py-3">
        <h2 className="text-base font-bold text-white md:text-lg">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-[#8d98a7]">{subtitle}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function StandingsTable({
  rows,
  showAverage = false,
  compact = false,
  variant = 'positions',
  relegatedTeamIds,
}: {
  rows: Array<LeagueStandingRow & { average?: number }>
  showAverage?: boolean
  compact?: boolean
  variant?: StandingsVariant
  relegatedTeamIds?: Set<string>
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full ${compact ? 'text-[12px]' : 'text-sm'}`}>
        <thead className="text-left text-[#8d98a7]">
          <tr className="border-b border-white/6">
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>Pos</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>Equipo</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>PJ</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>PG</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>PE</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>PP</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>GF</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>GC</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>DG</th>
            <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>PTS</th>
            {showAverage ? (
              <th className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold text-center`}>Prom.</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.teamId || row.teamName}-${index}`}
              className={`border-b border-l-2 border-white/6 text-[#dce5ef] last:border-b-0 ${getRowAccent(row, index, rows.length, variant, relegatedTeamIds)}`}
            >
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} font-semibold`}>{row.rank || index + 1}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'}`}>
                <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                  {row.teamLogo ? (
                    <Image
                      src={row.teamLogo}
                      alt={row.teamName}
                      width={compact ? 18 : 24}
                      height={compact ? 18 : 24}
                      className={`${compact ? 'h-[18px] w-[18px]' : 'h-6 w-6'} object-contain`}
                    />
                  ) : null}
                  <span className={`font-medium ${compact ? 'text-[12px]' : ''}`}>{row.teamName}</span>
                </div>
              </td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.played}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.won}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.drawn}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.lost}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.goalsFor}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.goalsAgainst}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center`}>{row.goalDifference}</td>
              <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-bold`}>{row.points}</td>
              {showAverage ? (
                <td className={`${compact ? 'px-2 py-2.5' : 'px-3 py-3'} text-center font-semibold`}>
                  {formatAverage(row.average || 0)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BracketView({
  rounds,
  useCopaArgentinaTree = false,
}: {
  rounds: ReturnType<typeof buildKnockoutRounds>
  useCopaArgentinaTree?: boolean
}) {
  const bracketFixtures = rounds.flatMap((round) =>
    round.matches.map((match) => ({
      ...match,
      round: round.round,
    }))
  )
  const columns = useCopaArgentinaTree
    ? buildBracketColumns(bracketFixtures)
    : buildGenericBracketColumns(bracketFixtures)

  if (!columns.length) return null

  const totalRows = Math.max(
    2,
    ...columns.flatMap((column) => column.matches.map((match) => match.rowStart + 1))
  )

  return (
    <SectionCard
      title="Cuadro de llaves"
      subtitle="Cruces eliminatorios del torneo"
    >
      <div className="bracket-scroll overflow-x-auto pb-3">
        <div className="min-w-max rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#11161b_0%,#0d1217_100%)] p-3 shadow-[inset_0_0_0_1px_rgba(127,240,178,0.05)]">
          <div className="mb-3 text-center text-xl font-black tracking-tight text-white">
            Cuadro
          </div>

          <div className="flex items-start gap-3">
            {columns.map((column, columnIndex) => {
              const badge = columnIndex === columns.length - 1 ? getRoundBadge(column.label) : null

              return (
                <div
                  key={column.key}
                  className={`flex w-[191px] flex-shrink-0 flex-col rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.02)_100%)] py-2.5 ${
                    columnIndex === 0 ? 'pl-0 pr-2.5' : 'px-2.5'
                  }`}
                >
                  <div className={`mb-2 min-h-8 ${columnIndex === 0 ? 'pl-1 pr-1.5' : 'px-1'}`}>
                    <h3 className="text-center text-[12px] font-black uppercase tracking-[0.04em] text-white">
                      {column.label}
                    </h3>
                  </div>

                  <div
                    className="grid"
                    style={{
                      gridTemplateRows: `repeat(${totalRows}, ${BRACKET_GRID_UNIT}px)`,
                    }}
                  >
                    {column.matches.map((match) => (
                      <div
                        key={match.id}
                        className="relative"
                        style={{
                          gridRow: `${match.rowStart} / span 2`,
                        }}
                      >
                        {columnIndex > 0 ? (
                          <span className="pointer-events-none absolute left-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}
                        {columnIndex < columns.length - 1 ? (
                          <span className="pointer-events-none absolute right-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}

                        {badge ? (
                          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] shadow-[0_4px_14px_rgba(0,0,0,0.25)] ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        ) : null}

                        <Link
                          href={typeof match.id === 'number' ? `/partido/${match.id}` : '#'}
                          aria-disabled={typeof match.id !== 'number'}
                          className={`block h-[48px] overflow-hidden rounded-xl border border-[#2a5c46] bg-[linear-gradient(180deg,#161d24_0%,#11181d_100%)] p-1 shadow-[inset_0_0_0_1px_rgba(127,240,178,0.06)] transition ${
                            typeof match.id === 'number'
                              ? 'cursor-pointer hover:border-[#3a7c5f] hover:bg-[linear-gradient(180deg,#182128_0%,#121a20_100%)]'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="flex h-full flex-col justify-center gap-[2px]">
                            {match.participants.map((team, participantIndex) => (
                              <div
                                key={`${match.id}-${participantIndex}`}
                                className={`flex h-[17px] items-center justify-between gap-2 rounded-md px-1.5 py-0.5 ${
                                  team.isWinner
                                    ? 'bg-[#143624] text-[#7ff0b2] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.2)]'
                                    : 'bg-[#121a20]'
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  {team.logo ? (
                                    <Image
                                      src={team.logo}
                                      alt={team.team}
                                      width={12}
                                      height={12}
                                      className="h-[12px] w-[12px] object-contain"
                                    />
                                  ) : (
                                    <span className="h-[12px] w-[12px] rounded-full border border-white/10 bg-white/5" />
                                  )}
                                  <span className={`truncate text-[10.5px] font-semibold ${team.isPlaceholder ? 'text-[#98a5b3]' : team.isWinner ? 'text-[#7ff0b2]' : 'text-[#edf2f7]'}`}>
                                    {team.team}
                                  </span>
                                </div>
                                <span className={`text-[10.5px] font-black ${team.isPlaceholder ? 'text-[#6f7d8b]' : team.isWinner ? 'text-[#7ff0b2]' : 'text-[#dce5ef]'}`}>
                                  {team.isPlaceholder ? '' : team.goals ?? '-'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

export default async function LigaPage({ params }: PageProps) {
  const { id } = await params
  const tournament = getTournamentConfig(id)

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#0a0d0b] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/8 bg-[#111418] p-6">
          <h1 className="text-2xl font-black">Torneo no encontrado</h1>
          <p className="mt-2 text-[#8d98a7]">No existe una configuracion para este torneo.</p>
        </div>
      </div>
    )
  }

  let errorMessage: string | null = null
  let resolvedTournament: ResolvedTournament | null = null
  let standings: LeagueStandingGroup[] = []
  let scorers: TopPlayerRow[] = []
  let assists: TopPlayerRow[] = []
  let yellowCards: TopPlayerRow[] = []
  let redCards: TopPlayerRow[] = []
  let fixtures: LeagueFixtureSummary[] = []
  let promedioTable: PromedioRow[] = []

  try {
    resolvedTournament = await resolveTournament(
      tournament.searchTerms,
      tournament.country
    )

    if (!resolvedTournament) {
      errorMessage = 'No se pudo resolver este torneo en la API.'
    } else {
      const [standingsResult, leadersResult, fixturesResult] = await Promise.allSettled([
        getLeagueStandings(resolvedTournament.leagueId, resolvedTournament.season),
        getLeagueLeaders(resolvedTournament.leagueId, resolvedTournament.season),
        getLeagueFixtures(resolvedTournament.leagueId, resolvedTournament.season),
      ])

      if (standingsResult.status === 'fulfilled') {
        standings = standingsResult.value
      }

      if (leadersResult.status === 'fulfilled') {
        scorers = leadersResult.value.scorers
        assists = leadersResult.value.assists
        yellowCards = leadersResult.value.yellowCards
        redCards = leadersResult.value.redCards
      }

      if (fixturesResult.status === 'fulfilled') {
        fixtures = fixturesResult.value
      }

      if (tournament.showPromedios && resolvedTournament.season >= 2026) {
        const currentTournament = resolvedTournament
        const promedioSeasons = [resolvedTournament.season - 2, resolvedTournament.season - 1, resolvedTournament.season]
        const historicalResults = await Promise.allSettled(
          promedioSeasons.map((season) =>
            getLeagueStandings(currentTournament.leagueId, season).then((seasonStandings) => ({
              season,
              standings: seasonStandings,
            }))
          )
        )

        const successfulHistoricalStandings = historicalResults
          .filter((result): result is PromiseFulfilledResult<{
            season: number
            standings: Array<{ name: string; rows: LeagueStandingRow[] }>
          }> => result.status === 'fulfilled')
          .map((result) => result.value)

        if (successfulHistoricalStandings.length) {
          promedioTable = buildHistoricalPromediosTable(successfulHistoricalStandings)
        }
      }

      if (
        standingsResult.status === 'rejected' &&
        leadersResult.status === 'rejected' &&
        fixturesResult.status === 'rejected'
      ) {
        throw standingsResult.reason
      }
    }
  } catch (error) {
    errorMessage =
      error instanceof ApiFootballError
        ? error.message
        : 'No se pudo cargar la informacion del torneo.'
  }

  const { primaryGroups, secondaryGroups } = splitPrimaryGroups(standings)
  const visibleSecondaryGroups = secondaryGroups.filter(
    (group) => !isDerivedTableGroup(group.name)
  )
  const baseRows = primaryGroups.flatMap((group) => group.rows)
  const annualTable = tournament.showAnnualTable ? buildAnnualTable(baseRows) : []
  if (!promedioTable.length && tournament.showPromedios) {
    promedioTable = buildPromediosTable(baseRows).map((row) => ({
      rank: row.rank,
      teamId: row.teamId,
      teamName: row.teamName,
      teamLogo: row.teamLogo,
      average: row.average || 0,
      totalPoints: row.points,
      totalPlayed: row.played,
      seasonValues: resolvedTournament
        ? [
            {
              season: resolvedTournament.season,
              points: row.points,
              played: row.played,
            },
          ]
        : [],
    }))
  }
  const knockoutRounds = buildKnockoutRounds(fixtures)
  const { blocks: currentRoundBlocks, initialIndex: currentRoundInitialIndex } =
    getRoundBlocks(fixtures)
  const compactGroups = primaryGroups.length === 2
  const annualRelegatedTeamId = getAnnualRelegatedTeamId(annualTable)
  const promedioRelegatedTeamId = getPromediosRelegatedTeamId(
    promedioTable,
    annualRelegatedTeamId
  )
  const annualRelegatedTeamIds = annualRelegatedTeamId
    ? new Set([annualRelegatedTeamId])
    : new Set<string>()
  const promedioRelegatedTeamIds = promedioRelegatedTeamId
    ? new Set([promedioRelegatedTeamId])
    : new Set<string>()
  const compactSummaryTables = annualTable.length > 0 && promedioTable.length > 0

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-5 md:py-6">
        <main className="min-w-0 space-y-4">
          <header className="overflow-hidden rounded-3xl border border-white/8 bg-[#111418]/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {resolvedTournament?.logo ? (
                  <div className="flex h-16 w-16 items-center justify-center">
                    <Image
                      src={resolvedTournament.logo}
                      alt={resolvedTournament.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain"
                    />
                  </div>
                ) : null}

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
                    {resolvedTournament?.country || tournament.country || 'Torneo'}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                    {tournament.title}
                  </h1>
                  <p className="mt-1 text-sm text-[#8d98a7]">
                    {resolvedTournament
                      ? `Temporada ${resolvedTournament.season}`
                      : 'Buscando informacion del torneo'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {errorMessage ? (
            <div className="rounded-3xl border border-[#5a2a2a] bg-[#3b1919] p-6">
              <p className="text-sm font-medium text-[#ffd5d5]">{errorMessage}</p>
            </div>
          ) : null}

          {knockoutRounds.length ? (
            <BracketView
              rounds={knockoutRounds}
              useCopaArgentinaTree={tournament.key === 'argentina-copa-argentina'}
            />
          ) : null}

          {tournament.key === 'argentina-copa-argentina' && knockoutRounds.length ? (
            <SectionCard
              title="Partidos de Copa Argentina"
              subtitle="Listado completo por fase"
            >
              <CopaArgentinaMatchList rounds={buildCopaArgentinaMatchRounds(knockoutRounds)} />
            </SectionCard>
          ) : null}

          {currentRoundBlocks.length ? (
            <CurrentRoundNavigator
              rounds={currentRoundBlocks}
              initialIndex={currentRoundInitialIndex}
            />
          ) : null}

          {primaryGroups.length ? (
            <div className={compactGroups ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
              {primaryGroups.map((group) => (
                <SectionCard
                  key={group.name}
                  title={getDisplayGroupName(group.name)}
                  subtitle="Tabla de posiciones"
                >
                  <StandingsTable rows={group.rows} compact={compactGroups} />
                </SectionCard>
              ))}
            </div>
          ) : (
            <SectionCard
              title="Tabla de posiciones"
              subtitle="Algunos torneos de copa no publican tabla tradicional."
            >
              <p className="text-sm text-[#8d98a7]">
                No hay tabla de posiciones disponible para este torneo.
              </p>
            </SectionCard>
          )}

          {visibleSecondaryGroups.length ? (
            <div className="space-y-4">
              {visibleSecondaryGroups.map((group) => (
                <SectionCard
                  key={group.name}
                  title={getDisplayGroupName(group.name)}
                  subtitle="Tabla complementaria"
                >
                  <StandingsTable rows={group.rows} />
                </SectionCard>
              ))}
            </div>
          ) : null}

          {tournament.showAnnualTable || tournament.showPromedios ? (
            <div className={compactSummaryTables ? 'grid gap-4 xl:grid-cols-2' : 'space-y-4'}>
              {tournament.showAnnualTable && annualTable.length ? (
                <SectionCard
                  title="Tabla anual"
                  subtitle="Referencia armada con los puntos de la temporada disponible."
                >
                  <StandingsTable
                    rows={annualTable}
                    variant="annual"
                    compact={compactSummaryTables}
                    relegatedTeamIds={annualRelegatedTeamIds}
                  />
                  <TableLegend
                    items={[
                      { label: 'Campeon de liga', tone: 'bg-[#39e67a]' },
                      { label: 'Clasificacion a Copa Libertadores', tone: 'bg-[#f1cc4a]' },
                      { label: 'Clasificacion a Copa Sudamericana', tone: 'bg-sky-400' },
                      { label: 'Descenso', tone: 'bg-[#ff5d73]' },
                    ]}
                  />
                </SectionCard>
              ) : null}

              {tournament.showPromedios && promedioTable.length ? (
                <SectionCard
                  title="Promedios"
                  subtitle="Promedio armado con los puntos y partidos acumulados de las ultimas temporadas disponibles."
                >
                  <PromediosTable
                    rows={promedioTable}
                    compact={compactSummaryTables}
                    relegatedTeamIds={promedioRelegatedTeamIds}
                  />
                  <TableLegend
                    items={[
                      { label: 'Descenso', tone: 'bg-[#ff5d73]' },
                    ]}
                  />
                </SectionCard>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <LeaderListInteractive
              title="Goleadores"
              rows={scorers}
              accentClass="text-[#7ff0b2]"
              statType="scorers"
              leagueId={resolvedTournament?.leagueId}
              season={resolvedTournament?.season}
            />
            <LeaderListInteractive
              title="Asistencias"
              rows={assists}
              accentClass="text-sky-300"
              statType="assists"
              leagueId={resolvedTournament?.leagueId}
              season={resolvedTournament?.season}
            />
            <LeaderListInteractive
              title="Tarjetas amarillas"
              rows={yellowCards}
              accentClass="text-[#f3d36c]"
              statType="yellowCards"
              leagueId={resolvedTournament?.leagueId}
              season={resolvedTournament?.season}
            />
            <LeaderListInteractive
              title="Tarjetas rojas"
              rows={redCards}
              accentClass="text-[#ff8f8f]"
              statType="redCards"
              leagueId={resolvedTournament?.leagueId}
              season={resolvedTournament?.season}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
