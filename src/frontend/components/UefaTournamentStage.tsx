'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueFixtureSummary, LeagueStandingRow } from '@/lib/api-football'
import {
  getUefaKnockoutRoundLabel,
  getUefaLeaguePhaseRoundNumber,
  isUefaLeaguePhaseRound,
  normalizeUefaKnockoutRound,
} from '@/shared/utils/uefa-rounds'

type UefaPhaseKey = 'playoffs' | 'roundOf16' | 'quarterFinals' | 'semiFinals' | 'final'

type UefaPhaseConfig = {
  key: UefaPhaseKey
  label: string
  slotCount: number
  rowStarts: number[]
}

type UefaTeamRef = {
  key: string
  id?: number
  name: string
  logo?: string
}

type UefaTie = {
  id: string
  phaseKey: UefaPhaseKey
  phaseLabel: string
  teams: [UefaTeamRef, UefaTeamRef]
  fixtures: LeagueFixtureSummary[]
  aggregate: [number | null, number | null]
  winnerKey: string | null
  statusLabel: string
  aggregateLabel: string
  isFinal: boolean
}

type UefaPlacedTie = UefaTie & {
  slotIndex: number
  rowStart: number
}

type UefaBracketColumn = {
  key: UefaPhaseKey
  label: string
  ties: UefaPlacedTie[]
}

type MatchOption = {
  key: string
  label: string
  sortValue: number
  matches: LeagueFixtureSummary[]
}

const UEFA_PHASES: UefaPhaseConfig[] = [
  { key: 'playoffs', label: 'Playoffs', slotCount: 8, rowStarts: [1, 3, 5, 7, 9, 11, 13, 15] },
  { key: 'roundOf16', label: 'Octavos de final', slotCount: 8, rowStarts: [1, 3, 5, 7, 9, 11, 13, 15] },
  { key: 'quarterFinals', label: 'Cuartos de final', slotCount: 4, rowStarts: [2, 6, 10, 14] },
  { key: 'semiFinals', label: 'Semifinales', slotCount: 2, rowStarts: [4, 12] },
  { key: 'final', label: 'Final', slotCount: 1, rowStarts: [8] },
]

const UEFA_PHASE_INDEX = new Map(UEFA_PHASES.map((phase, index) => [phase.key, index]))
const UEFA_TOTAL_ROWS = 16
const UEFA_CARD_HEIGHT = 68
const UEFA_GRID_UNIT = 40
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const NOT_PLAYED_STATUSES = new Set(['NS', 'TBD', 'PST', 'CANC', 'ABD'])

function normalizeText(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTeamKey(id: number | undefined, name: string) {
  return id ? `id:${id}` : `name:${normalizeText(name)}`
}

function getFixtureTeam(fixture: LeagueFixtureSummary, side: 'home' | 'away'): UefaTeamRef {
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

function buildLeagueSeedMap(rows: LeagueStandingRow[]) {
  return new Map(
    rows
      .filter((row) => row.rank > 0)
      .map((row) => [getTeamKey(row.teamId, row.teamName), row.rank] as const)
  )
}

function compareFixtures(a: LeagueFixtureSummary, b: LeagueFixtureSummary) {
  const dateA = new Date(a.date).getTime()
  const dateB = new Date(b.date).getTime()

  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateA - dateB
  if (Number.isFinite(dateA) !== Number.isFinite(dateB)) return Number.isFinite(dateA) ? -1 : 1

  return a.id - b.id
}

function isPlayed(match: LeagueFixtureSummary) {
  return !NOT_PLAYED_STATUSES.has(match.statusShort)
}

function getMatchScoreLabel(match: LeagueFixtureSummary) {
  if (match.goalsHome !== null || match.goalsAway !== null) {
    return `${match.goalsHome ?? '-'}-${match.goalsAway ?? '-'}`
  }

  return 'vs'
}

function getStatusLabel(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') return 'Programado'
  if (match.statusShort === 'TBD') return 'A confirmar'
  if (match.statusShort === 'FT') return 'Finalizado'
  if (match.statusShort === 'AET') return 'Finalizado'
  if (match.statusShort === 'PEN') return 'Finalizado por penales'
  if (match.statusShort === 'HT') return 'Entretiempo'
  if (match.statusShort === 'PST') return 'Postergado'
  if (match.statusShort === 'CANC') return 'Cancelado'
  if (LIVE_STATUSES.has(match.statusShort)) return match.minute ? `${match.minute}'` : 'En vivo'

  return match.statusShort
}

function getCompactStatusLabel(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') return 'Proximo'
  if (match.statusShort === 'TBD') return 'A confirmar'
  if (match.statusShort === 'FT' || match.statusShort === 'AET') return 'Final'
  if (match.statusShort === 'PEN') return 'Penales'
  if (match.statusShort === 'HT') return 'ET'
  if (match.statusShort === 'PST') return 'Post.'
  if (match.statusShort === 'CANC') return 'Cancel.'
  if (LIVE_STATUSES.has(match.statusShort)) return match.minute ? `${match.minute}'` : 'En vivo'

  return match.statusShort
}

function getCompactStatusTone(match: LeagueFixtureSummary) {
  if (LIVE_STATUSES.has(match.statusShort)) return 'text-[#7ff0b2]'
  if (match.statusShort === 'NS' || match.statusShort === 'TBD') return 'text-[#aeb9c4]'

  return 'text-[#dce5ef]'
}

function formatDateTime(date: string) {
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

function formatMatchDayLabel(date: string) {
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

function groupMatchesByDay(matches: LeagueFixtureSummary[]) {
  const grouped = new Map<string, LeagueFixtureSummary[]>()

  for (const match of matches) {
    const key = formatMatchDayLabel(match.date)
    const current = grouped.get(key) || []

    current.push(match)
    grouped.set(key, current)
  }

  return [...grouped.entries()].map(([day, dayMatches]) => [
    day,
    [...dayMatches].sort(compareFixtures),
  ] as const)
}

function getLocationLabel(match: LeagueFixtureSummary) {
  const parts = [match.venueCity, match.venueCountry]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  if (!parts.length) return null

  return `Lugar: ${parts.join(', ')}`
}

function getTieParticipantKeys(tie: UefaTie) {
  return new Set(tie.teams.map((team) => team.key))
}

function getTieCandidateAdvancerKeys(tie: UefaTie) {
  return tie.winnerKey ? new Set([tie.winnerKey]) : getTieParticipantKeys(tie)
}

function getTieStatusLabel(tie: Pick<UefaTie, 'fixtures' | 'isFinal'>) {
  if (tie.fixtures.some((fixture) => LIVE_STATUSES.has(fixture.statusShort))) return 'En vivo'

  const playedCount = tie.fixtures.filter(isPlayed).length

  if (tie.isFinal) {
    const finalMatch = tie.fixtures[0]
    return finalMatch ? getStatusLabel(finalMatch) : 'A confirmar'
  }

  if (playedCount >= 2) return 'Serie finalizada'
  if (playedCount === 1) return 'Ida jugada'
  if (tie.fixtures.length) return 'Programado'

  return 'A confirmar'
}

function getCompactTieStatusLabel(tie: UefaTie) {
  if (tie.fixtures.some((fixture) => LIVE_STATUSES.has(fixture.statusShort))) return 'En vivo'
  if (tie.isFinal) return tie.fixtures[0] ? getCompactStatusLabel(tie.fixtures[0]) : 'A definir'

  const playedCount = tie.fixtures.filter(isPlayed).length

  if (playedCount >= 2) return 'Final'
  if (playedCount === 1) return 'Ida'
  if (tie.fixtures.length) return 'Prox.'

  return 'A definir'
}

function getTieAggregateLabel(fixtures: LeagueFixtureSummary[], isFinal: boolean) {
  if (isFinal) return 'Partido único'

  const playedCount = fixtures.filter(isPlayed).length
  const completedScores = fixtures.filter(
    (fixture) => fixture.goalsHome !== null && fixture.goalsAway !== null
  ).length

  if (!playedCount || !completedScores) return 'A definir'
  if (playedCount < 2 || fixtures.length < 2) return 'Global parcial'

  return 'Global'
}

function getTieAggregateText(tie: UefaTie) {
  if (tie.isFinal) return 'Partido único'
  if (tie.aggregate[0] === null || tie.aggregate[1] === null) return tie.aggregateLabel

  return `${tie.aggregateLabel} ${tie.aggregate[0]}-${tie.aggregate[1]}`
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

function buildTieAggregate(
  fixtures: LeagueFixtureSummary[],
  teams: [UefaTeamRef, UefaTeamRef]
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
  teams: [UefaTeamRef, UefaTeamRef],
  fixtures: LeagueFixtureSummary[]
) {
  if (aggregate[0] === null || aggregate[1] === null) return null
  if (aggregate[0] > aggregate[1]) return teams[0].key
  if (aggregate[1] > aggregate[0]) return teams[1].key

  return getPenaltyWinnerKey(fixtures)
}

function buildUefaTies(fixtures: LeagueFixtureSummary[]) {
  const grouped = new Map<string, LeagueFixtureSummary[]>()

  for (const fixture of fixtures) {
    const phaseKey = normalizeUefaKnockoutRound(fixture.round)
    if (!phaseKey) continue

    const homeKey = getTeamKey(fixture.homeId, fixture.home)
    const awayKey = getTeamKey(fixture.awayId, fixture.away)
    const tieKey = [homeKey, awayKey].sort().join('__')
    const groupKey = `${phaseKey}:${tieKey}`
    const current = grouped.get(groupKey) || []

    current.push(fixture)
    grouped.set(groupKey, current)
  }

  return [...grouped.entries()]
    .map(([id, tieFixtures]): UefaTie => {
      const sortedFixtures = [...tieFixtures].sort(compareFixtures)
      const firstFixture = sortedFixtures[0]
      const phaseKey = normalizeUefaKnockoutRound(firstFixture.round) || 'final'
      const teams: [UefaTeamRef, UefaTeamRef] = [
        getFixtureTeam(firstFixture, 'home'),
        getFixtureTeam(firstFixture, 'away'),
      ]
      const aggregate = buildTieAggregate(sortedFixtures, teams)
      const isFinal = phaseKey === 'final'

      return {
        id,
        phaseKey,
        phaseLabel: getUefaKnockoutRoundLabel(phaseKey),
        teams,
        fixtures: sortedFixtures,
        aggregate,
        winnerKey: getTieWinnerKey(aggregate, teams, sortedFixtures),
        statusLabel: getTieStatusLabel({ fixtures: sortedFixtures, isFinal }),
        aggregateLabel: getTieAggregateLabel(sortedFixtures, isFinal),
        isFinal,
      }
    })
    .sort((a, b) => {
      const firstDateA = a.fixtures[0]?.date || ''
      const firstDateB = b.fixtures[0]?.date || ''
      const dateCompare = firstDateA.localeCompare(firstDateB)

      if (dateCompare !== 0) return dateCompare

      return a.teams[0].name.localeCompare(b.teams[0].name, 'es-AR')
    })
}

function tieMatchesLinearSlot(tie: UefaTie, childTie?: UefaTie) {
  if (!childTie) return false

  const childKeys = getTieCandidateAdvancerKeys(childTie)

  return tie.teams.some((team) => childKeys.has(team.key))
}

function tieMatchesTreeSlot(tie: UefaTie, childSlots: Array<UefaTie | undefined>, slotIndex: number) {
  const firstChild = childSlots[slotIndex * 2]
  const secondChild = childSlots[slotIndex * 2 + 1]

  if (!firstChild || !secondChild) return false

  const childKeys = new Set([
    ...getTieCandidateAdvancerKeys(firstChild),
    ...getTieCandidateAdvancerKeys(secondChild),
  ])
  const participantKeys = tie.teams.map((team) => team.key)

  return participantKeys.length === 2 && participantKeys.every((key) => childKeys.has(key))
}

function placePhaseTies(
  phase: UefaPhaseConfig,
  ties: UefaTie[],
  previousSlots?: Array<UefaTie | undefined>
) {
  const slots = Array<UefaTie | undefined>(phase.slotCount).fill(undefined)
  const sortedTies = [...ties].sort((a, b) => compareFixtures(a.fixtures[0], b.fixtures[0]))

  for (const tie of sortedTies) {
    let slotIndex = -1

    if (previousSlots?.length) {
      const previousCount = previousSlots.length

      if (previousCount === phase.slotCount) {
        slotIndex = previousSlots.findIndex(
          (previousTie, index) =>
            !slots[index] && tieMatchesLinearSlot(tie, previousTie)
        )
      } else if (previousCount === phase.slotCount * 2) {
        slotIndex = slots.findIndex(
          (_slot, index) =>
            !slots[index] && tieMatchesTreeSlot(tie, previousSlots, index)
        )
      }
    }

    if (slotIndex < 0) {
      slotIndex = slots.findIndex((slot) => !slot)
    }

    if (slotIndex >= 0) {
      slots[slotIndex] = tie
    }
  }

  return slots
}

function buildBracketColumns(fixtures: LeagueFixtureSummary[]) {
  const ties = buildUefaTies(fixtures)
  const tiesByPhase = new Map<UefaPhaseKey, UefaTie[]>()

  for (const phase of UEFA_PHASES) {
    tiesByPhase.set(
      phase.key,
      ties.filter((tie) => tie.phaseKey === phase.key)
    )
  }

  const phaseIndexesWithData = UEFA_PHASES
    .filter((phase) => (tiesByPhase.get(phase.key) || []).length > 0)
    .map((phase) => UEFA_PHASE_INDEX.get(phase.key) || 0)

  if (!phaseIndexesWithData.length) return []

  const firstIndex = Math.min(...phaseIndexesWithData)
  const lastIndex = Math.max(...phaseIndexesWithData)
  const visiblePhases = UEFA_PHASES.slice(firstIndex, lastIndex + 1)
  const columns: UefaBracketColumn[] = []
  let previousSlots: Array<UefaTie | undefined> | undefined

  for (const phase of visiblePhases) {
    const phaseTies = tiesByPhase.get(phase.key) || []
    const slots = placePhaseTies(phase, phaseTies, previousSlots)

    columns.push({
      key: phase.key,
      label: phase.label,
      ties: slots
        .map((tie, slotIndex) =>
          tie
            ? {
                ...tie,
                slotIndex,
                rowStart: phase.rowStarts[slotIndex],
              }
            : null
        )
        .filter((tie): tie is UefaPlacedTie => Boolean(tie)),
    })

    previousSlots = slots
  }

  return columns
}

function TeamRow({
  team,
  score,
  active,
  seed,
}: {
  team: UefaTeamRef
  score: number | null
  active: boolean
  seed?: number
}) {
  return (
    <div
      className={`flex h-[19px] items-center justify-between gap-2 rounded-md px-1.5 py-0.5 ${
        active
          ? 'bg-[#143624] text-[#7ff0b2] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.2)]'
          : 'bg-[#121a20]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <TeamLogo
          src={team.logo}
          alt={team.name}
          size={12}
          className="h-[12px] w-[12px] object-contain"
          fallbackClassName="h-[12px] w-[10px]"
          unoptimized
        />
        {seed ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-white/10 bg-[#0e1419] px-1 text-[8px] font-black text-[#8d98a7]">
            {seed}
          </span>
        ) : null}
        <span
          className={`truncate text-[10.5px] font-semibold ${
            active ? 'text-[#7ff0b2]' : 'text-[#edf2f7]'
          }`}
        >
          {team.name}
        </span>
      </div>
      <span
        className={`text-[10.5px] font-black ${
          active ? 'text-[#7ff0b2]' : 'text-[#dce5ef]'
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
  seedByTeamKey,
}: {
  tie: UefaTie
  onSelect: (tie: UefaTie) => void
  seedByTeamKey: Map<string, number>
}) {
  const [scoreA, scoreB] =
    tie.isFinal && tie.fixtures[0]
      ? [tie.fixtures[0].goalsHome, tie.fixtures[0].goalsAway]
      : tie.aggregate
  const aggregateText = getTieAggregateText(tie)
  const compactStatus = getCompactTieStatusLabel(tie)

  return (
    <button
      type="button"
      onClick={() => onSelect(tie)}
      className="block w-full overflow-hidden rounded-xl border border-[#2a5c46] bg-[linear-gradient(180deg,#161d24_0%,#11181d_100%)] p-1 text-left shadow-[inset_0_0_0_1px_rgba(127,240,178,0.06)] transition hover:border-[#3a7c5f] hover:bg-[linear-gradient(180deg,#182128_0%,#121a20_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60"
      style={{ height: `${UEFA_CARD_HEIGHT}px` }}
    >
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
          {aggregateText}
        </span>
        <span className="truncate text-[8px] font-black uppercase text-[#8d98a7]">
          {compactStatus}
        </span>
      </div>
      <div className="flex h-[calc(100%-16px)] flex-col justify-center gap-[2px]">
        <TeamRow
          team={tie.teams[0]}
          score={scoreA}
          active={tie.winnerKey === tie.teams[0].key}
          seed={seedByTeamKey.get(tie.teams[0].key)}
        />
        <TeamRow
          team={tie.teams[1]}
          score={scoreB}
          active={tie.winnerKey === tie.teams[1].key}
          seed={seedByTeamKey.get(tie.teams[1].key)}
        />
      </div>
    </button>
  )
}

function SeriesMatchRow({ match, label }: { match: LeagueFixtureSummary; label: string }) {
  const dateTime = formatDateTime(match.date)
  const location = getLocationLabel(match)

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
        {dateTime.day} · {dateTime.time}
      </div>
      {location ? (
        <div className="mt-0.5 text-center text-[11px] text-[#7f8c98]">{location}</div>
      ) : null}
    </Link>
  )
}

function getNavigatorPrimaryLabel(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') {
    const parsedDate = new Date(match.date)

    if (Number.isNaN(parsedDate.getTime())) return 'A conf.'

    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(parsedDate)
  }

  return getCompactStatusLabel(match)
}

function getNavigatorSecondaryStatus(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') return 'Proximo'

  return getStatusLabel(match)
}

function CompactMatchRow({ match }: { match: LeagueFixtureSummary }) {
  return (
    <Link
      href={`/partido/${match.id}`}
      className="grid grid-cols-[62px_minmax(0,1fr)] items-center border-b border-white/8 text-xs transition hover:bg-[#151b21] focus-visible:bg-[#151b21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60 focus-visible:ring-inset last:border-b-0 md:grid-cols-[68px_minmax(0,1fr)]"
    >
      <div
        className={`border-r border-white/8 px-2 py-1.5 text-center text-[10px] font-bold md:text-[11px] ${getCompactStatusTone(match)}`}
      >
        {getNavigatorPrimaryLabel(match)}
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

          <div className="text-center text-sm font-black text-white">
            {getMatchScoreLabel(match)}
          </div>

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
          {getNavigatorSecondaryStatus(match)}
        </div>
      </div>
    </Link>
  )
}

function SeriesModal({
  tie,
  onClose,
}: {
  tie: UefaTie | null
  onClose: () => void
}) {
  if (!tie) return null

  const shouldShowSecondLegPlaceholder = !tie.isFinal && tie.fixtures.length < 2

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uefa-series-title"
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
              <h2 id="uefa-series-title" className="mt-1 truncate text-base font-bold text-white md:text-lg">
                {tie.teams[0].name} vs {tie.teams[1].name}
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#9eacb8]">
                {tie.isFinal
                  ? 'Partido único'
                  : `${tie.aggregateLabel} ${tie.aggregate[0] ?? '-'}-${tie.aggregate[1] ?? '-'} · ${tie.statusLabel}`}
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
          {tie.fixtures.map((match, index) => (
            <SeriesMatchRow
              key={match.id}
              match={match}
              label={tie.isFinal ? 'Final' : index === 0 ? 'Ida' : 'Vuelta'}
            />
          ))}

          {shouldShowSecondLegPlaceholder ? (
            <div className="rounded-xl border border-white/8 bg-[#10151a] p-3 text-center text-xs font-semibold text-[#8d98a7]">
              Vuelta a confirmar
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function UefaKnockoutBracket({
  fixtures,
  standingsRows = [],
}: {
  fixtures: LeagueFixtureSummary[]
  standingsRows?: LeagueStandingRow[]
}) {
  const [selectedTie, setSelectedTie] = useState<UefaTie | null>(null)
  const columns = useMemo(() => buildBracketColumns(fixtures), [fixtures])
  const seedByTeamKey = useMemo(() => buildLeagueSeedMap(standingsRows), [standingsRows])

  if (!columns.length) {
    return (
      <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
        <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
          <h2 className="text-base font-bold text-white md:text-lg">Cuadro de llaves</h2>
          <p className="mt-0.5 text-xs text-[#8d98a7]">
            El cuadro principal arranca en los knockout phase play-offs de los puestos 9 a 24.
          </p>
        </div>
        <div className="p-3 text-sm text-[#8d98a7]">
          No hay cruces eliminatorios disponibles para este torneo.
        </div>
      </section>
    )
  }

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
        <h2 className="text-base font-bold text-white md:text-lg">Cuadro de llaves</h2>
        <p className="mt-0.5 text-xs text-[#8d98a7]">
          El cuadro principal arranca en los knockout phase play-offs de los puestos 9 a 24; desde ahí sigue a octavos, cuartos, semifinales y final.
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
                    style={{
                      gridTemplateRows: `repeat(${UEFA_TOTAL_ROWS}, ${UEFA_GRID_UNIT}px)`,
                    }}
                  >
                    {column.ties.map((tie) => (
                      <div
                        key={tie.id}
                        className="relative"
                        style={{
                          gridRow: `${tie.rowStart} / span 2`,
                        }}
                      >
                        {columnIndex > 0 ? (
                          <span className="pointer-events-none absolute left-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}
                        {columnIndex < columns.length - 1 ? (
                          <span className="pointer-events-none absolute right-[-10px] top-1/2 h-px w-[10px] bg-[#2a5c46]" />
                        ) : null}

                        <TieCard
                          tie={tie}
                          onSelect={setSelectedTie}
                          seedByTeamKey={seedByTeamKey}
                        />
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

function getLeaguePhaseOptionLabel(round: string) {
  const roundNumber = getUefaLeaguePhaseRoundNumber(round)

  if (roundNumber) return `Fase liga - Fecha ${roundNumber}`

  return 'Fase liga'
}

function buildMatchOptions(fixtures: LeagueFixtureSummary[]) {
  const grouped = new Map<string, MatchOption>()

  for (const fixture of fixtures) {
    const phaseKey = normalizeUefaKnockoutRound(fixture.round)
    const isLeaguePhaseRound = isUefaLeaguePhaseRound(fixture.round)

    if (!phaseKey && !isLeaguePhaseRound) continue

    const roundNumber = getUefaLeaguePhaseRoundNumber(fixture.round)
    const optionKey = phaseKey || `league-${roundNumber || normalizeText(fixture.round)}`
    const label = phaseKey
      ? getUefaKnockoutRoundLabel(phaseKey)
      : getLeaguePhaseOptionLabel(fixture.round)
    const sortValue = phaseKey
      ? 1000 + (UEFA_PHASE_INDEX.get(phaseKey) || 0) * 100
      : roundNumber || 0
    const current = grouped.get(optionKey) || {
      key: optionKey,
      label,
      sortValue,
      matches: [],
    }

    current.matches.push(fixture)
    grouped.set(optionKey, current)
  }

  return [...grouped.values()]
    .map((option) => ({
      ...option,
      matches: [...option.matches].sort(compareFixtures),
    }))
    .sort((a, b) => {
      if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue

      return a.label.localeCompare(b.label, 'es-AR')
    })
}

export function UefaMatchPhaseNavigator({ fixtures }: { fixtures: LeagueFixtureSummary[] }) {
  const options = useMemo(() => buildMatchOptions(fixtures), [fixtures])
  const [selectedKey, setSelectedKey] = useState(options[0]?.key || '')
  const selectedOption = options.find((option) => option.key === selectedKey) || options[0]
  const dayGroups = useMemo(
    () => groupMatchesByDay(selectedOption?.matches || []),
    [selectedOption]
  )

  if (!options.length || !selectedOption) {
    return (
      <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
        <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
          <h2 className="text-base font-bold text-white md:text-lg">Partidos</h2>
        </div>
        <div className="p-3 text-sm text-[#8d98a7]">No hay partidos disponibles.</div>
      </section>
    )
  }

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white md:text-lg">Partidos</h2>
            <p className="mt-0.5 text-xs text-[#8d98a7]">Fase liga y eliminatorias</p>
          </div>
          <select
            value={selectedOption.key}
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
        <div className="w-full overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
          {dayGroups.map(([day, dayMatches]) => (
            <div key={day} className="border-b border-white/10 last:border-b-0">
              <div className="border-b border-white/8 bg-[#141a20] px-3 py-1.5 text-center text-xs font-bold text-white">
                {day}
              </div>

              {dayMatches.map((match) => (
                <CompactMatchRow key={match.id} match={match} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
