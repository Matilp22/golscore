import {
  isRedCardEvent,
  isYellowCardEvent,
  normalizeFootballEventText,
  type FootballEventLike,
} from '@/shared/utils/football-events'

type StatTeamRef = {
  id?: number | string | null
  name?: string | null
}

export type RawMatchStatistic = {
  type?: string | null
  value?: string | number | null
}

export type RawMatchStatisticsTeam = {
  team?: StatTeamRef | null
  statistics?: RawMatchStatistic[] | null
}

export type NormalizedMatchStatisticPair = {
  type: string
  homeValue: string | number | null
  awayValue: string | number | null
  source?: 'official' | 'events'
  corrected?: boolean
}

function normalizeTeamName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bjrs\b/gi, 'juniors')
    .replace(/\bjunior\b/gi, 'juniors')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\b(ca|club|de|del|la|el|fc|ac)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isSameTeam(candidate?: StatTeamRef | null, target?: StatTeamRef | null) {
  if (!candidate || !target) return false
  if (
    candidate.id !== null &&
    candidate.id !== undefined &&
    target.id !== null &&
    target.id !== undefined &&
    String(candidate.id) === String(target.id)
  ) {
    return true
  }

  const candidateName = normalizeTeamName(candidate.name)
  const targetName = normalizeTeamName(target.name)

  if (!candidateName || !targetName) return false

  return (
    candidateName === targetName ||
    candidateName.includes(targetName) ||
    targetName.includes(candidateName)
  )
}

function getEventTeamSide(
  event: FootballEventLike,
  homeTeam: StatTeamRef,
  awayTeam: StatTeamRef
) {
  if (isSameTeam(event.team, homeTeam)) return 'home'
  if (isSameTeam(event.team, awayTeam)) return 'away'

  return null
}

function hasStatValue(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (value === null || value === undefined) return false

  const normalized = String(value).trim().toLowerCase()

  return Boolean(
    normalized &&
    normalized !== 'null' &&
    normalized !== 'undefined' &&
    normalized !== 'nan'
  )
}

function normalizeStatValue(value: string | number | null | undefined) {
  return hasStatValue(value) ? value ?? null : null
}

function getStatsForTeam(
  stats: RawMatchStatisticsTeam[],
  team: StatTeamRef,
  fallbackIndex: number
) {
  return stats.find((statTeam) => isSameTeam(statTeam.team, team)) ?? stats[fallbackIndex] ?? null
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!hasStatValue(value)) return null

  const parsed = Number(String(value).replace('%', '').replace(',', '.').trim())

  return Number.isFinite(parsed) ? parsed : null
}

function isStatType(type: string, candidates: string[]) {
  const normalized = normalizeFootballEventText(type)

  return candidates.some((candidate) => normalized === normalizeFootballEventText(candidate))
}

export function deriveDisciplineStatsFromEvents(
  events: FootballEventLike[],
  homeTeam: StatTeamRef,
  awayTeam: StatTeamRef
) {
  const cards = {
    yellowCards: {
      home: 0,
      away: 0,
    },
    redCards: {
      home: 0,
      away: 0,
    },
  }

  for (const event of events) {
    const side = getEventTeamSide(event, homeTeam, awayTeam)
    if (!side) continue

    if (isYellowCardEvent(event)) {
      cards.yellowCards[side] += 1
      continue
    }

    if (isRedCardEvent(event)) {
      cards.redCards[side] += 1
    }
  }

  return cards
}

function upsertDisciplineStat(
  pairs: NormalizedMatchStatisticPair[],
  input: {
    type: string
    home: number
    away: number
  }
) {
  const index = pairs.findIndex((pair) =>
    isStatType(pair.type, [input.type])
  )
  const existing = index >= 0 ? pairs[index] : null
  const existingHome = parseNumber(existing?.homeValue)
  const existingAway = parseNumber(existing?.awayValue)
  const shouldUseDerived =
    input.home > 0 ||
    input.away > 0 ||
    existing === null

  if (!shouldUseDerived) return pairs

  const nextPair: NormalizedMatchStatisticPair = {
    type: input.type,
    homeValue: input.home,
    awayValue: input.away,
    source: 'events',
    corrected:
      existing !== null &&
      (existingHome !== input.home || existingAway !== input.away),
  }

  if (index >= 0) {
    const nextPairs = [...pairs]
    nextPairs[index] = nextPair
    return nextPairs
  }

  return [...pairs, nextPair]
}

export function normalizeMatchStatistics(
  stats: RawMatchStatisticsTeam[],
  homeTeam: StatTeamRef,
  awayTeam: StatTeamRef,
  events: FootballEventLike[] = []
): NormalizedMatchStatisticPair[] {
  const homeStats = getStatsForTeam(stats, homeTeam, 0)?.statistics ?? []
  const awayStats = getStatsForTeam(stats, awayTeam, 1)?.statistics ?? []
  const statTypes = [
    ...homeStats.map((stat) => stat.type),
    ...awayStats.map((stat) => stat.type),
  ]
    .map((type) => (typeof type === 'string' ? type.trim() : ''))
    .filter((type, index, allTypes) => Boolean(type) && allTypes.indexOf(type) === index)

  const officialPairs = statTypes.flatMap((type) => {
    const homeValue = normalizeStatValue(
      homeStats.find((stat) => stat.type === type)?.value
    )
    const awayValue = normalizeStatValue(
      awayStats.find((stat) => stat.type === type)?.value
    )

    if (!hasStatValue(homeValue) && !hasStatValue(awayValue)) return []

    return [{
      type,
      homeValue,
      awayValue,
      source: 'official' as const,
    }]
  })

  if (!events.length) return officialPairs

  const discipline = deriveDisciplineStatsFromEvents(events, homeTeam, awayTeam)
  const withYellows = upsertDisciplineStat(officialPairs, {
    type: 'Yellow Cards',
    home: discipline.yellowCards.home,
    away: discipline.yellowCards.away,
  })

  return upsertDisciplineStat(withYellows, {
    type: 'Red Cards',
    home: discipline.redCards.home,
    away: discipline.redCards.away,
  })
}
