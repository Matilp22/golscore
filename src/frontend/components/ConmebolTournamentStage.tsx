'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueFixtureSummary } from '@/lib/api-football'
import {
  getConmebolGroupRoundNumber,
  getConmebolPhaseLabel,
  getConmebolPhaseOrder,
  isConmebolGroupRound,
  normalizeConmebolRound,
  type ConmebolCompetitionType,
  type ConmebolPhaseKey,
} from '@/shared/utils/conmebol-rounds'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'

export type ConmebolBracketTeamRef = {
  id?: number | string | null
  name?: string | null
  logo?: string | null
}

export type ConmebolBracketSeriesInput = {
  id?: string | number | null
  phase: ConmebolPhaseKey
  slot: number
  homeSeed?: string | null
  awaySeed?: string | null
  teamA?: ConmebolBracketTeamRef | null
  teamB?: ConmebolBracketTeamRef | null
  source?: string | null
  status?: string | null
  leg1Date?: string | null
  leg2Date?: string | null
  matches?: LeagueFixtureSummary[]
}

export type ConmebolBracketPlaceholder = {
  phase: ConmebolPhaseKey
  slot: number
  homeSeed?: string | null
  awaySeed?: string | null
  teamA?: ConmebolBracketTeamRef | null
  teamB?: ConmebolBracketTeamRef | null
  source?: string | null
}

type ConmebolPhaseConfig = {
  key: Exclude<ConmebolPhaseKey, 'groups'>
  label: string
  slotCount: number
  rowStarts: number[]
}

type ConmebolTeamRef = {
  key: string
  id?: number | string | null
  name: string
  logo?: string | null
  seedLabel?: string | null
  placeholder?: boolean
}

type ConmebolTie = {
  id: string
  phaseKey: Exclude<ConmebolPhaseKey, 'groups'>
  phaseLabel: string
  slot: number
  teams: [ConmebolTeamRef, ConmebolTeamRef]
  fixtures: LeagueFixtureSummary[]
  aggregate: [number | null, number | null]
  winnerKey: string | null
  statusLabel: string
  aggregateLabel: string
  isFinal: boolean
  source?: string | null
  leg1Date?: string | null
  leg2Date?: string | null
}

type ConmebolPlacedTie = ConmebolTie & {
  rowStart: number
}

type ConmebolBracketColumn = {
  key: Exclude<ConmebolPhaseKey, 'groups'>
  label: string
  ties: ConmebolPlacedTie[]
}

type AgendaMatchItem = {
  type: 'match'
  id: string
  match: LeagueFixtureSummary
}

type AgendaSeriesPlaceholderItem = {
  type: 'series_placeholder'
  id: string
  phaseKey: Exclude<ConmebolPhaseKey, 'groups'>
  source?: string | null
  teams: [ConmebolTeamRef, ConmebolTeamRef]
  dateLabel: 'A programar'
  timeLabel: 'A programar'
  statusLabel: 'A programar'
  sortValue: number
}

type AgendaItem = AgendaMatchItem | AgendaSeriesPlaceholderItem

type AgendaOption = {
  key: string
  label: string
  emptyLabel: string
  sortValue: number
  items: AgendaItem[]
}

const LIBERTADORES_PHASES: ConmebolPhaseConfig[] = [
  { key: 'roundOf16', label: 'Octavos', slotCount: 8, rowStarts: [1, 3, 5, 7, 9, 11, 13, 15] },
  { key: 'quarterFinals', label: 'Cuartos', slotCount: 4, rowStarts: [2, 6, 10, 14] },
  { key: 'semiFinals', label: 'Semifinales', slotCount: 2, rowStarts: [4, 12] },
  { key: 'final', label: 'Final', slotCount: 1, rowStarts: [8] },
]

const SUDAMERICANA_PHASES: ConmebolPhaseConfig[] = [
  { key: 'playoffs', label: 'Playoffs', slotCount: 8, rowStarts: [1, 3, 5, 7, 9, 11, 13, 15] },
  { key: 'roundOf16', label: 'Octavos', slotCount: 8, rowStarts: [1, 3, 5, 7, 9, 11, 13, 15] },
  { key: 'quarterFinals', label: 'Cuartos', slotCount: 4, rowStarts: [2, 6, 10, 14] },
  { key: 'semiFinals', label: 'Semifinales', slotCount: 2, rowStarts: [4, 12] },
  { key: 'final', label: 'Final', slotCount: 1, rowStarts: [8] },
]

const PHASE_INDEX = new Map(
  [...SUDAMERICANA_PHASES, ...LIBERTADORES_PHASES].map((phase, index) => [phase.key, index])
)
const TOTAL_ROWS = 16
const CARD_HEIGHT = 84
const GRID_UNIT = 48
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const NOT_PLAYED_STATUSES = new Set(['NS', 'TBD', 'PST', 'CANC', 'ABD'])
function getPhaseConfigs(competitionType: ConmebolCompetitionType) {
  return competitionType === 'sudamericana' ? SUDAMERICANA_PHASES : LIBERTADORES_PHASES
}

function normalizeText(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTeamKey(id: number | string | null | undefined, name: string) {
  return id !== null && id !== undefined && id !== '' ? `id:${id}` : `name:${normalizeText(name)}`
}

function getFixtureTimestamp(date: string | null | undefined) {
  if (!date) return Number.MAX_SAFE_INTEGER

  const timestamp = new Date(date).getTime()

  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function compareFixtureIds(a: number | string, b: number | string) {
  if (typeof a === 'number' && typeof b === 'number') return a - b

  return String(a).localeCompare(String(b), 'es-AR', { numeric: true })
}

function compareFixtures(a: LeagueFixtureSummary, b: LeagueFixtureSummary) {
  const dateA = getFixtureTimestamp(a.date)
  const dateB = getFixtureTimestamp(b.date)

  if (dateA !== dateB) return dateA - dateB

  return compareFixtureIds(a.id, b.id)
}

function isPlayed(match: LeagueFixtureSummary) {
  return !NOT_PLAYED_STATUSES.has(match.statusShort)
}

function getFixtureTeam(fixture: LeagueFixtureSummary, side: 'home' | 'away'): ConmebolTeamRef {
  const isHome = side === 'home'
  const id = isHome ? fixture.homeId : fixture.awayId
  const name = isHome ? fixture.home : fixture.away

  return {
    key: getTeamKey(id, name),
    id,
    name,
    logo: isHome ? fixture.homeLogo : fixture.awayLogo,
  }
}

function getInputTeam(
  team: ConmebolBracketTeamRef | null | undefined,
  fallbackName: string,
  seedLabel?: string | null
): ConmebolTeamRef {
  const name = team?.name?.trim() || fallbackName
  const cleanSeedLabel = seedLabel?.trim()

  return {
    key: getTeamKey(team?.id, name),
    id: team?.id,
    name,
    logo: team?.logo ?? null,
    seedLabel: cleanSeedLabel && cleanSeedLabel !== name ? cleanSeedLabel : null,
    placeholder: !team?.name,
  }
}

function getMatchScoreLabel(match: LeagueFixtureSummary) {
  if (match.goalsHome !== null || match.goalsAway !== null) {
    return formatMatchScoreWithPenalties({
      goalsHome: match.goalsHome,
      goalsAway: match.goalsAway,
      homePenaltyScore: match.homePenaltyScore,
      awayPenaltyScore: match.awayPenaltyScore,
      separator: '-',
    })
  }

  return 'vs'
}

function getStatusLabel(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') return 'Programado'
  if (match.statusShort === 'TBD') return 'A confirmar'
  if (match.statusShort === 'FT' || match.statusShort === 'AET') return 'Finalizado'
  if (match.statusShort === 'PEN') return 'Finalizado por penales'
  if (match.statusShort === 'HT') return 'Entretiempo'
  if (match.statusShort === 'PST') return 'Postergado'
  if (match.statusShort === 'CANC') return 'Cancelado'
  if (LIVE_STATUSES.has(match.statusShort)) return match.minute ? `${match.minute}'` : 'En vivo'

  return match.statusShort || 'A confirmar'
}

function getCompactStatusLabel(tie: ConmebolTie) {
  if (tie.fixtures.some((fixture) => LIVE_STATUSES.has(fixture.statusShort))) return 'En vivo'
  if (!tie.fixtures.length) return 'A definir'

  if (tie.isFinal) return getStatusLabel(tie.fixtures[0])

  const playedCount = tie.fixtures.filter(isPlayed).length

  if (playedCount >= 2) return 'Final'
  if (playedCount === 1) return 'Ida'

  return 'Programado'
}

function formatDateTime(date: string | null | undefined) {
  if (!date) {
    return { day: 'Fecha a confirmar', time: 'Hora a confirmar' }
  }

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return { day: 'Fecha a confirmar', time: 'Hora a confirmar' }
  }

  const day = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
    .format(parsedDate)
    .replace('.', '')

  const time = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(parsedDate)

  return { day, time }
}

function formatMatchDayLabel(date: string | null | undefined) {
  if (!date) return 'Fecha a confirmar'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) return 'Fecha a confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
    .format(parsedDate)
    .replace('.', '')
}

function getTieStatusLabel(tie: Pick<ConmebolTie, 'fixtures' | 'isFinal'>) {
  if (tie.fixtures.some((fixture) => LIVE_STATUSES.has(fixture.statusShort))) return 'En vivo'

  const playedCount = tie.fixtures.filter(isPlayed).length

  if (tie.isFinal) {
    const finalMatch = tie.fixtures[0]
    return finalMatch ? getStatusLabel(finalMatch) : 'A definir'
  }

  if (playedCount >= 2) return 'Finalizado'
  if (playedCount === 1) return 'Programado'
  if (tie.fixtures.length) return 'Programado'

  return 'A definir'
}

function getTieAggregateLabel(fixtures: LeagueFixtureSummary[], isFinal: boolean) {
  if (isFinal) return 'Partido unico'

  const playedCount = fixtures.filter(isPlayed).length
  const completedScores = fixtures.filter(
    (fixture) => fixture.goalsHome !== null && fixture.goalsAway !== null
  ).length

  if (!fixtures.length || !playedCount || !completedScores) return 'Global a definir'
  if (playedCount < 2 || fixtures.length < 2) return 'Global parcial'

  return 'Global'
}

function getPenaltyWinnerKey(fixtures: LeagueFixtureSummary[]) {
  const penaltyMatch = [...fixtures]
    .reverse()
    .find((fixture) => fixture.homePenaltyScore !== null || fixture.awayPenaltyScore !== null)

  if (!penaltyMatch) return null

  const homePenalty = penaltyMatch.homePenaltyScore
  const awayPenalty = penaltyMatch.awayPenaltyScore

  if (homePenalty == null || awayPenalty == null || homePenalty === awayPenalty) return null

  return homePenalty > awayPenalty
    ? getTeamKey(penaltyMatch.homeId, penaltyMatch.home)
    : getTeamKey(penaltyMatch.awayId, penaltyMatch.away)
}

function getPenaltyText(fixtures: LeagueFixtureSummary[]) {
  const penaltyMatch = [...fixtures]
    .reverse()
    .find((fixture) => fixture.homePenaltyScore !== null || fixture.awayPenaltyScore !== null)

  if (!penaltyMatch) return null
  if (penaltyMatch.homePenaltyScore == null || penaltyMatch.awayPenaltyScore == null) return null

  return `Pen. ${penaltyMatch.homePenaltyScore}-${penaltyMatch.awayPenaltyScore}`
}

function buildTieAggregate(
  fixtures: LeagueFixtureSummary[],
  teams: [ConmebolTeamRef, ConmebolTeamRef]
): [number | null, number | null] {
  let hasScore = false
  const totals = new Map(teams.map((team) => [team.key, 0]))

  for (const fixture of fixtures) {
    if (fixture.goalsHome === null || fixture.goalsAway === null) continue

    hasScore = true
    const homeKey = getTeamKey(fixture.homeId, fixture.home)
    const awayKey = getTeamKey(fixture.awayId, fixture.away)

    totals.set(homeKey, (totals.get(homeKey) || 0) + fixture.goalsHome)
    totals.set(awayKey, (totals.get(awayKey) || 0) + fixture.goalsAway)
  }

  if (!hasScore) return [null, null]

  return [totals.get(teams[0].key) || 0, totals.get(teams[1].key) || 0]
}

function getTieWinnerKey(
  aggregate: [number | null, number | null],
  teams: [ConmebolTeamRef, ConmebolTeamRef],
  fixtures: LeagueFixtureSummary[]
) {
  if (aggregate[0] === null || aggregate[1] === null) return null
  if (aggregate[0] > aggregate[1]) return teams[0].key
  if (aggregate[1] > aggregate[0]) return teams[1].key

  return getPenaltyWinnerKey(fixtures)
}

function buildTieFromFixtures(
  id: string,
  phaseKey: Exclude<ConmebolPhaseKey, 'groups'>,
  fixtures: LeagueFixtureSummary[],
  slot: number
): ConmebolTie {
  const sortedFixtures = [...fixtures].sort(compareFixtures)
  const firstFixture = sortedFixtures[0]
  const teams: [ConmebolTeamRef, ConmebolTeamRef] = [
    getFixtureTeam(firstFixture, 'home'),
    getFixtureTeam(firstFixture, 'away'),
  ]
  const isFinal = phaseKey === 'final'
  const aggregate = buildTieAggregate(sortedFixtures, teams)

  return {
    id,
    phaseKey,
    phaseLabel: getConmebolPhaseLabel(phaseKey),
    slot,
    teams,
    fixtures: sortedFixtures,
    aggregate,
    winnerKey: getTieWinnerKey(aggregate, teams, sortedFixtures),
    statusLabel: getTieStatusLabel({ fixtures: sortedFixtures, isFinal }),
    aggregateLabel: getTieAggregateLabel(sortedFixtures, isFinal),
    isFinal,
    source: 'api-football',
  }
}

function buildOfficialTies(
  matches: LeagueFixtureSummary[],
  competitionType: ConmebolCompetitionType
) {
  const grouped = new Map<string, {
    phaseKey: Exclude<ConmebolPhaseKey, 'groups'>
    matches: LeagueFixtureSummary[]
  }>()

  for (const match of matches) {
    const phaseKey = normalizeConmebolRound(match.round, competitionType)
    if (!phaseKey || phaseKey === 'groups') continue

    const homeKey = getTeamKey(match.homeId, match.home)
    const awayKey = getTeamKey(match.awayId, match.away)
    const tieKey = [homeKey, awayKey].sort().join('__')
    const groupKey = `${phaseKey}:${tieKey}`
    const current = grouped.get(groupKey) || { phaseKey, matches: [] }

    current.matches.push(match)
    grouped.set(groupKey, current)
  }

  const slotsByPhase = new Map<Exclude<ConmebolPhaseKey, 'groups'>, number>()

  return [...grouped.values()]
    .sort((a, b) => {
      const phaseCompare =
        (PHASE_INDEX.get(a.phaseKey) || 0) - (PHASE_INDEX.get(b.phaseKey) || 0)
      if (phaseCompare !== 0) return phaseCompare

      return compareFixtures(
        [...a.matches].sort(compareFixtures)[0],
        [...b.matches].sort(compareFixtures)[0]
      )
    })
    .map((group) => {
      const slot = (slotsByPhase.get(group.phaseKey) || 0) + 1
      slotsByPhase.set(group.phaseKey, slot)
      const id = `${group.phaseKey}:${slot}:${group.matches
        .map((match) => String(match.id))
        .sort()
        .join('-')}`

      return buildTieFromFixtures(id, group.phaseKey, group.matches, slot)
    })
}

function buildManualTie(series: ConmebolBracketSeriesInput): ConmebolTie | null {
  if (series.phase === 'groups') return null

  const fallbackA = series.homeSeed?.trim() || 'A definir'
  const fallbackB = series.awaySeed?.trim() || 'A definir'
  const teams: [ConmebolTeamRef, ConmebolTeamRef] = [
    getInputTeam(series.teamA, fallbackA, series.homeSeed),
    getInputTeam(series.teamB, fallbackB, series.awaySeed),
  ]
  const fixtures = [...(series.matches ?? [])].sort(compareFixtures)
  const isFinal = series.phase === 'final'
  const aggregate = buildTieAggregate(fixtures, teams)
  const id = String(series.id ?? `${series.phase}:${series.slot}:manual`)

  return {
    id,
    phaseKey: series.phase,
    phaseLabel: getConmebolPhaseLabel(series.phase),
    slot: series.slot,
    teams,
    fixtures,
    aggregate,
    winnerKey: getTieWinnerKey(aggregate, teams, fixtures),
    statusLabel: fixtures.length
      ? getTieStatusLabel({ fixtures, isFinal })
      : series.status || 'A definir',
    aggregateLabel: getTieAggregateLabel(fixtures, isFinal),
    isFinal,
    source: series.source,
    leg1Date: series.leg1Date,
    leg2Date: series.leg2Date,
  }
}

function createPlaceholderTie(
  competitionType: ConmebolCompetitionType,
  phaseKey: Exclude<ConmebolPhaseKey, 'groups'>,
  slot: number
): ConmebolTie {
  const homeSeed = 'A definir'
  const awaySeed = 'A definir'

  const teams: [ConmebolTeamRef, ConmebolTeamRef] = [
    getInputTeam(null, homeSeed, homeSeed),
    getInputTeam(null, awaySeed, awaySeed),
  ]

  return {
    id: `placeholder:${competitionType}:${phaseKey}:${slot}`,
    phaseKey,
    phaseLabel: getConmebolPhaseLabel(phaseKey),
    slot,
    teams,
    fixtures: [],
    aggregate: [null, null],
    winnerKey: null,
    statusLabel: 'A definir',
    aggregateLabel: phaseKey === 'final' ? 'Partido unico' : 'Global a definir',
    isFinal: phaseKey === 'final',
    source: 'placeholder',
  }
}

function getTiePairKey(tie: ConmebolTie) {
  return tie.teams.map((team) => team.key).sort().join('__')
}

function mergeConmebolSeries(
  series: ConmebolBracketSeriesInput[] = [],
  placeholders?: ConmebolBracketPlaceholder[]
) {
  if (!placeholders?.length) return series

  const existingKeys = new Set(series.map((item) => `${item.phase}:${item.slot}`))
  const placeholderSeries: ConmebolBracketSeriesInput[] = placeholders
    .filter((item) => item.phase !== 'groups' && !existingKeys.has(`${item.phase}:${item.slot}`))
    .map((item) => ({
      phase: item.phase,
      slot: item.slot,
      homeSeed: item.homeSeed,
      awaySeed: item.awaySeed,
      teamA: item.teamA,
      teamB: item.teamB,
      source: item.source ?? 'standings_placeholder',
    }))

  return [...series, ...placeholderSeries]
}

function buildBracketColumns(
  competitionType: ConmebolCompetitionType,
  matches: LeagueFixtureSummary[],
  series: ConmebolBracketSeriesInput[] = []
): ConmebolBracketColumn[] {
  const phaseConfigs = getPhaseConfigs(competitionType)
  const officialTies = buildOfficialTies(matches, competitionType)
  const manualTies = series
    .map(buildManualTie)
    .filter((tie): tie is ConmebolTie => Boolean(tie))
  const officialKeys = new Set(officialTies.map(getTiePairKey))
  const officialPhases = new Set(officialTies.map((tie) => tie.phaseKey))

  return phaseConfigs.map((phase) => {
    const slots = Array<ConmebolTie | null>(phase.slotCount).fill(null)
    const phaseOfficial = officialTies
      .filter((tie) => tie.phaseKey === phase.key)
      .sort((a, b) => a.slot - b.slot)
    const phaseManual = manualTies
      .filter((tie) => {
        if (tie.phaseKey !== phase.key) return false
        if (officialPhases.has(tie.phaseKey)) return false

        return !officialKeys.has(getTiePairKey(tie))
      })
      .sort((a, b) => a.slot - b.slot)

    for (const tie of phaseOfficial) {
      const slotIndex = Math.min(Math.max(tie.slot - 1, 0), phase.slotCount - 1)
      const targetIndex = slots[slotIndex] ? slots.findIndex((slot) => !slot) : slotIndex

      if (targetIndex >= 0) slots[targetIndex] = { ...tie, slot: targetIndex + 1 }
    }

    for (const tie of phaseManual) {
      const slotIndex = Math.min(Math.max(tie.slot - 1, 0), phase.slotCount - 1)
      const targetIndex = slots[slotIndex] ? slots.findIndex((slot) => !slot) : slotIndex

      if (targetIndex >= 0) slots[targetIndex] = { ...tie, slot: targetIndex + 1 }
    }

    return {
      key: phase.key,
      label: phase.label,
      ties: slots.map((tie, index) => ({
        ...(tie || createPlaceholderTie(competitionType, phase.key, index + 1)),
        rowStart: phase.rowStarts[index],
      })),
    }
  })
}

function getTieScoreValues(tie: ConmebolTie) {
  if (tie.isFinal && tie.fixtures[0]) {
    return [tie.fixtures[0].goalsHome, tie.fixtures[0].goalsAway] as const
  }

  return tie.aggregate
}

function getTieAggregateText(tie: ConmebolTie) {
  const penaltyText = getPenaltyText(tie.fixtures)

  if (tie.isFinal) {
    if (tie.fixtures[0]) {
      return penaltyText ? `Partido unico - ${penaltyText}` : 'Partido unico'
    }

    return 'Partido unico'
  }

  if (tie.aggregate[0] === null || tie.aggregate[1] === null) return tie.aggregateLabel

  return `${tie.aggregateLabel} ${tie.aggregate[0]}-${tie.aggregate[1]}${penaltyText ? ` - ${penaltyText}` : ''}`
}

function TeamRow({
  team,
  score,
  active,
}: {
  team: ConmebolTeamRef
  score: number | null
  active: boolean
}) {
  return (
    <div
      className={`flex min-h-[30px] items-center justify-between gap-2 rounded-md px-1.5 py-1 ${
        active
          ? 'bg-[#143624] text-[#7ff0b2] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.2)]'
          : 'bg-[#121a20]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <TeamLogo
          src={team.logo || undefined}
          alt={team.name}
          size={15}
          className="h-[15px] w-[15px] shrink-0 object-contain"
          fallbackClassName="h-[14px] w-[12px] shrink-0"
          unoptimized
        />
        <span className="min-w-0 leading-[1.05]">
          <span
            className={`block truncate text-[10.5px] font-semibold ${
              team.placeholder ? 'text-[#98a5b3]' : active ? 'text-[#7ff0b2]' : 'text-[#edf2f7]'
            }`}
          >
            {team.name}
          </span>
        </span>
      </div>
      <span
        className={`shrink-0 text-[10.5px] font-black ${
          team.placeholder ? 'text-[#6f7d8b]' : active ? 'text-[#7ff0b2]' : 'text-[#dce5ef]'
        }`}
      >
        {score ?? '-'}
      </span>
    </div>
  )
}

function TieCard({
  tie,
  onSelect,
}: {
  tie: ConmebolTie
  onSelect: (tie: ConmebolTie) => void
}) {
  const [scoreA, scoreB] = getTieScoreValues(tie)

  return (
    <button
      type="button"
      onClick={() => onSelect(tie)}
      className="block w-full overflow-hidden rounded-xl border border-[#2a5c46] bg-[linear-gradient(180deg,#161d24_0%,#11181d_100%)] p-1 text-left shadow-[inset_0_0_0_1px_rgba(127,240,178,0.06)] transition hover:border-[#3a7c5f] hover:bg-[linear-gradient(180deg,#182128_0%,#121a20_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60"
      style={{ height: `${CARD_HEIGHT}px` }}
    >
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
          {getTieAggregateText(tie)}
        </span>
        <span className="truncate text-[8px] font-black uppercase text-[#8d98a7]">
          {getCompactStatusLabel(tie)}
        </span>
      </div>
      <div className="flex h-[calc(100%-16px)] flex-col justify-center gap-[2px]">
        <TeamRow team={tie.teams[0]} score={scoreA} active={tie.winnerKey === tie.teams[0].key} />
        <TeamRow team={tie.teams[1]} score={scoreB} active={tie.winnerKey === tie.teams[1].key} />
      </div>
    </button>
  )
}

function SeriesMatchRow({ match, label }: { match: LeagueFixtureSummary; label: string }) {
  const dateTime = formatDateTime(match.date)

  return (
    <Link
      href={`/partido/${match.id}`}
      className="block rounded-xl border border-white/8 bg-[#10151a] p-2 transition hover:border-[#2a5c46] hover:bg-[#141b20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/8 bg-[#0b1015] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
          {label}
        </span>
        <span className="text-[11px] font-semibold text-[#9eacb8]">{getStatusLabel(match)}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-2 text-xs">
        <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
          <span className="truncate font-semibold text-[#dce5ef]">{match.home}</span>
          <TeamLogo
            src={match.homeLogo}
            alt={match.home}
            size={16}
            className="h-4 w-4 object-contain"
            fallbackClassName="h-3.5 w-3"
            unoptimized
          />
        </div>
        <span className="text-center text-sm font-black text-white">{getMatchScoreLabel(match)}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <TeamLogo
            src={match.awayLogo}
            alt={match.away}
            size={16}
            className="h-4 w-4 object-contain"
            fallbackClassName="h-3.5 w-3"
            unoptimized
          />
          <span className="truncate font-semibold text-[#dce5ef]">{match.away}</span>
        </div>
      </div>
      <div className="mt-2 text-center text-[11px] font-semibold text-[#aeb9c4]">
        {dateTime.day} - {dateTime.time}
      </div>
    </Link>
  )
}

function PendingSeriesDates({ tie }: { tie: ConmebolTie }) {
  const dates = tie.isFinal
    ? [{ label: 'Final', date: tie.leg1Date }]
    : [
        { label: 'Ida', date: tie.leg1Date },
        { label: 'Vuelta', date: tie.leg2Date },
      ]

  return (
    <>
      {dates.map((item) => {
        const dateTime = formatDateTime(item.date)

        return (
          <div
            key={item.label}
            className="rounded-xl border border-white/8 bg-[#10151a] p-3 text-center text-xs font-semibold text-[#8d98a7]"
          >
            {item.label}: {item.date ? `${dateTime.day} - ${dateTime.time}` : 'Fixture no confirmado'}
          </div>
        )
      })}
    </>
  )
}

function SeriesModal({
  tie,
  onClose,
}: {
  tie: ConmebolTie | null
  onClose: () => void
}) {
  if (!tie) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conmebol-series-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0f1317] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/8 bg-[#13181d] px-3 py-3 md:px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7ff0b2]">
                {tie.phaseLabel}
              </p>
              <h2 id="conmebol-series-title" className="mt-1 truncate text-base font-bold text-white md:text-lg">
                {tie.teams[0].name} vs {tie.teams[1].name}
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#9eacb8]">
                {getTieAggregateText(tie)} - {tie.statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-white/10 bg-[#10151a] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#182128] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="space-y-2 p-3 md:p-4">
          {tie.fixtures.length ? (
            tie.fixtures.map((match, index) => (
              <SeriesMatchRow
                key={match.id}
                match={match}
                label={tie.isFinal ? 'Final' : index === 0 ? 'Ida' : 'Vuelta'}
              />
            ))
          ) : (
            <PendingSeriesDates tie={tie} />
          )}
        </div>
      </div>
    </div>
  )
}

export function ConmebolKnockoutBracket({
  competitionType,
  season,
  phases,
  series = [],
  matches,
  placeholders,
}: {
  competitionType: ConmebolCompetitionType
  season: number
  phases?: readonly ConmebolPhaseKey[]
  series?: ConmebolBracketSeriesInput[]
  matches: LeagueFixtureSummary[]
  placeholders?: ConmebolBracketPlaceholder[]
}) {
  const [selectedTie, setSelectedTie] = useState<ConmebolTie | null>(null)
  const mergedSeries = useMemo(
    () => mergeConmebolSeries(series, placeholders),
    [placeholders, series]
  )
  const columns = useMemo(
    () => buildBracketColumns(competitionType, matches, mergedSeries),
    [competitionType, matches, mergedSeries]
  )
  const expectedPhases = phases ?? getConmebolPhaseOrder(competitionType)

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
        <h2 className="text-base font-bold text-white md:text-lg">Cuadro de llaves</h2>
        <p className="mt-0.5 text-xs text-[#8d98a7]">
          Temporada {season} - {expectedPhases.filter((phase) => phase !== 'groups').map(getConmebolPhaseLabel).join(', ')}
        </p>
      </div>

      <div className="p-2 md:p-3">
        <div className="bracket-scroll overflow-x-auto pb-1">
          <div className="w-full min-w-max max-w-none md:min-w-full">
            <div className="flex w-full items-start gap-3">
              {columns.map((column, columnIndex) => (
                <div
                  key={column.key}
                  className={`flex min-w-[198px] flex-1 flex-col rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.02)_100%)] py-2.5 ${
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
                    style={{ gridTemplateRows: `repeat(${TOTAL_ROWS}, ${GRID_UNIT}px)` }}
                  >
                    {column.ties.map((tie) => (
                      <div
                        key={tie.id}
                        className="relative"
                        style={{ gridRow: `${tie.rowStart} / span 2` }}
                      >
                        {columnIndex > 0 ? (
                          <span className="pointer-events-none absolute left-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}
                        {columnIndex < columns.length - 1 ? (
                          <span className="pointer-events-none absolute right-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}

                        <TieCard tie={tie} onSelect={setSelectedTie} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SeriesModal tie={selectedTie} onClose={() => setSelectedTie(null)} />
    </section>
  )
}

function getAgendaPhaseOptions(
  competitionType: ConmebolCompetitionType,
  matches: LeagueFixtureSummary[],
  series: ConmebolBracketSeriesInput[] = []
) {
  const phaseOrder = getConmebolPhaseOrder(competitionType).filter(
    (phase) => phase !== 'groups'
  ) as Array<Exclude<ConmebolPhaseKey, 'groups'>>
  const manualTies = series
    .map(buildManualTie)
    .filter((tie): tie is ConmebolTie => Boolean(tie))
  const options: AgendaOption[] = phaseOrder.map((phase, index) => ({
    key: phase,
    label: getConmebolPhaseLabel(phase),
    emptyLabel: phase === 'final' ? 'Fixture no confirmado' : 'Cruces a definir',
    sortValue: 1000 + index * 100,
    items: getAgendaItemsForPhase(
      phase,
      matches
        .filter((match) => normalizeConmebolRound(match.round, competitionType) === phase)
        .sort(compareFixtures),
      manualTies
    ),
  }))
  const groupOptionsByRound = new Map<string, AgendaOption>()

  for (const match of matches) {
    if (!isConmebolGroupRound(match.round)) continue

    const roundNumber = getConmebolGroupRoundNumber(match.round)
    const key = `groups:${roundNumber ?? normalizeText(match.round)}`
    const current = groupOptionsByRound.get(key) || {
      key,
      label: roundNumber ? `Fase de grupos - Fecha ${roundNumber}` : 'Fase de grupos',
      emptyLabel: 'Fixture no confirmado',
      sortValue: roundNumber ?? 900,
      items: [],
    }

    current.items.push({ type: 'match', id: `match:${match.id}`, match })
    groupOptionsByRound.set(key, current)
  }

  return [
    ...options,
    ...[...groupOptionsByRound.values()]
      .map((option) => ({
        ...option,
        items: [...option.items].sort(compareAgendaItems),
      }))
      .sort((a, b) => {
        if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue

        return a.label.localeCompare(b.label, 'es-AR', { numeric: true })
      }),
  ]
}

function getAgendaItemsForPhase(
  phase: Exclude<ConmebolPhaseKey, 'groups'>,
  matches: LeagueFixtureSummary[],
  manualTies: ConmebolTie[]
): AgendaItem[] {
  if (matches.length) {
    return matches.map((match) => ({
      type: 'match',
      id: `match:${match.id}`,
      match,
    }))
  }

  return manualTies
    .filter((tie) => tie.phaseKey === phase && isUsefulAgendaTie(tie))
    .sort((a, b) => a.slot - b.slot)
    .map((tie) => ({
      type: 'series_placeholder',
      id: `series:${tie.id}`,
      phaseKey: tie.phaseKey,
      source: tie.source,
      teams: tie.teams,
      dateLabel: 'A programar',
      timeLabel: 'A programar',
      statusLabel: 'A programar',
      sortValue: tie.slot,
    }))
}

function isUsefulAgendaTie(tie: ConmebolTie) {
  if (tie.source !== 'standings_placeholder') return true

  return tie.teams.some((team) => !team.placeholder && normalizeText(team.name) !== 'a definir')
}

function compareAgendaItems(a: AgendaItem, b: AgendaItem) {
  if (a.type === 'match' && b.type === 'match') return compareFixtures(a.match, b.match)
  if (a.type === 'match') return -1
  if (b.type === 'match') return 1

  if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue

  return a.id.localeCompare(b.id, 'es-AR', { numeric: true })
}

function groupAgendaItemsByDay(items: AgendaItem[]) {
  const grouped = new Map<string, AgendaItem[]>()

  for (const item of items) {
    const key = item.type === 'match' ? formatMatchDayLabel(item.match.date) : item.dateLabel
    const current = grouped.get(key) || []

    current.push(item)
    grouped.set(key, current)
  }

  return [...grouped.entries()].map(([day, dayItems]) => [
    day,
    [...dayItems].sort(compareAgendaItems),
  ] as const)
}

function AgendaMatchRow({ match }: { match: LeagueFixtureSummary }) {
  const dateTime = formatDateTime(match.date)

  return (
    <Link
      href={`/partido/${match.id}`}
      className="grid grid-cols-[72px_minmax(0,1fr)] items-center border-b border-white/8 text-xs transition hover:bg-[#151b21] focus-visible:bg-[#151b21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60 focus-visible:ring-inset last:border-b-0 md:grid-cols-[92px_minmax(0,1fr)]"
    >
      <div className="border-r border-white/8 px-2 py-1.5 text-center">
        <div className="text-[10px] font-black text-[#dce5ef] md:text-[11px]">{dateTime.day}</div>
        <div className="mt-0.5 text-[10px] font-bold text-[#8fa0b1]">{dateTime.time}</div>
      </div>

      <div className="px-2 py-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-1.5 md:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
            <span className="truncate font-semibold text-[#dce5ef]">{match.home}</span>
            <TeamLogo
              src={match.homeLogo}
              alt={match.home}
              size={16}
              className="h-4 w-4 object-contain"
              fallbackClassName="h-3.5 w-3"
              unoptimized
            />
          </div>

          <div className="text-center text-sm font-black text-white">{getMatchScoreLabel(match)}</div>

          <div className="flex min-w-0 items-center gap-1.5">
            <TeamLogo
              src={match.awayLogo}
              alt={match.away}
              size={16}
              className="h-4 w-4 object-contain"
              fallbackClassName="h-3.5 w-3"
              unoptimized
            />
            <span className="truncate font-semibold text-[#dce5ef]">{match.away}</span>
          </div>
        </div>
        <div className="mt-1 truncate text-center text-[10px] font-semibold text-[#8fa0b1]">
          {getStatusLabel(match)}
        </div>
      </div>
    </Link>
  )
}

function AgendaSeriesRow({ item }: { item: AgendaSeriesPlaceholderItem }) {
  const [teamA, teamB] = item.teams

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center border-b border-white/8 text-xs last:border-b-0 md:grid-cols-[92px_minmax(0,1fr)]">
      <div className="border-r border-white/8 px-2 py-1.5 text-center">
        <div className="text-[10px] font-black text-[#dce5ef] md:text-[11px]">{item.dateLabel}</div>
        <div className="mt-0.5 text-[10px] font-bold text-[#8fa0b1]">{item.timeLabel}</div>
      </div>

      <div className="px-2 py-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-1.5 md:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
            <span className="truncate font-semibold text-[#dce5ef]">{teamA.name}</span>
            <TeamLogo
              src={teamA.logo}
              alt={teamA.name}
              size={16}
              className="h-4 w-4 object-contain"
              fallbackClassName="h-3.5 w-3"
              unoptimized
            />
          </div>

          <div className="text-center text-sm font-black text-white">vs</div>

          <div className="flex min-w-0 items-center gap-1.5">
            <TeamLogo
              src={teamB.logo}
              alt={teamB.name}
              size={16}
              className="h-4 w-4 object-contain"
              fallbackClassName="h-3.5 w-3"
              unoptimized
            />
            <span className="truncate font-semibold text-[#dce5ef]">{teamB.name}</span>
          </div>
        </div>
        <div className="mt-1 truncate text-center text-[10px] font-semibold text-[#8fa0b1]">
          {item.statusLabel}
        </div>
      </div>
    </div>
  )
}

export function ConmebolFixtureAgenda({
  competitionType,
  matches,
  series = [],
  placeholders,
}: {
  competitionType: ConmebolCompetitionType
  matches: LeagueFixtureSummary[]
  series?: ConmebolBracketSeriesInput[]
  placeholders?: ConmebolBracketPlaceholder[]
}) {
  const mergedSeries = useMemo(
    () => mergeConmebolSeries(series, placeholders),
    [placeholders, series]
  )
  const options = useMemo(
    () => getAgendaPhaseOptions(competitionType, matches, mergedSeries),
    [competitionType, matches, mergedSeries]
  )
  const [selectedKey, setSelectedKey] = useState(options[0]?.key || '')
  const selectedOption = options.find((option) => option.key === selectedKey) || options[0]
  const dayGroups = useMemo(() => groupAgendaItemsByDay(selectedOption?.items || []), [selectedOption])

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white md:text-lg">Agenda</h2>
            <p className="mt-0.5 text-xs text-[#8d98a7]">Partidos por fase y fecha</p>
          </div>
          <select
            value={selectedOption?.key || ''}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="min-h-9 rounded-xl border border-white/8 bg-[#10151a] px-3 py-1.5 text-sm font-bold text-white outline-none transition hover:border-white/12 focus:border-[#7ff0b2]/55"
          >
            {options.map((option) => (
              <option key={option.key} value={option.key} className="bg-[#10151a] text-white">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-2 md:p-3">
        {!selectedOption || !selectedOption.items.length ? (
          <div className="rounded-xl border border-white/8 bg-[#10151a] px-3 py-4 text-center text-sm font-semibold text-[#8d98a7]">
            {selectedOption?.emptyLabel || 'Fixture no confirmado'}
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
            {dayGroups.map(([day, dayItems]) => (
              <div key={day} className="border-b border-white/10 last:border-b-0">
                <div className="border-b border-white/8 bg-[#141a20] px-3 py-1.5 text-center text-xs font-bold text-white">
                  {day}
                </div>

                {dayItems.map((item) => (
                  item.type === 'match' ? (
                    <AgendaMatchRow key={item.id} match={item.match} />
                  ) : (
                    <AgendaSeriesRow key={item.id} item={item} />
                  )
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
