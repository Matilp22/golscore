'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type WheelEvent,
} from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import type { LeagueFixtureSummary, LeagueStandingGroup } from '@/lib/api-football'
import {
  buildWorldCupBracketSimulation,
  buildWorldCupOfficialBracket,
  buildWorldCupSimulatedGroupFixtures,
  clearAffectedKnockoutDescendants,
  clearWorldCupSimulation,
  getMatchRealWinner,
  getSelectedWinner,
  getLegacyWorldCupBracketStorageKey,
  getWorldCupBracketSeedOptions,
  getWorldCupBracketStorageKey,
  reconcileKnockoutAfterScoreChange,
  resolveKnockoutMatchWinner,
  resolveWorldCupThirdPlaceAssignments,
  type WorldCupBracketMatch,
  type WorldCupBracketMatchResult,
  type WorldCupBracketMatchResults,
  type WorldCupBracketRound,
  type WorldCupBracketRoundKey,
  type WorldCupBracketSeedKey,
  type WorldCupBracketSeedOverrides,
  type WorldCupBracketWinnerSelection,
  type WorldCupGroupFixtureSimulation,
  type WorldCupGroupSimulationResults,
  type WorldCupManualTiebreakers,
  type WorldCupSimulatedGroup,
  type WorldCupSimulatedStandingRow,
} from '@/shared/utils/world-cup-bracket-simulator'
import { WORLD_CUP_GROUP_KEYS, type WorldCupGroupKey } from '@/shared/utils/world-cup-groups'
import { translateCountryName } from '@/shared/utils/country-names'
import type { AppLocale } from '@/shared/i18n/locales'

type WorldCupKnockoutSectionProps = {
  groups: LeagueStandingGroup[]
  fixtures: LeagueFixtureSummary[]
  leagueExternalId?: number | null
  season?: number | null
  locale?: AppLocale
}

type StoredSimulatorState = {
  schemaVersion: 2
  winners: WorldCupBracketWinnerSelection
  results: WorldCupBracketMatchResults
  seedOverrides: WorldCupBracketSeedOverrides
  groupResults: WorldCupGroupSimulationResults
  manualTiebreakers: WorldCupManualTiebreakers
  selectedGroup: WorldCupGroupKey
  simulatorView: 'groups' | 'bracket'
  selectedRound: WorldCupBracketRoundKey
  updatedAt: string
}

type TeamSide = 'home' | 'away'
type ResultField = keyof WorldCupBracketMatchResult
type WorldCupKnockoutTab = 'official' | 'simulator'

const WORLD_CUP_SIMULATOR_HASH = '#simulador-mundial'

function getInitialWorldCupKnockoutTab(): WorldCupKnockoutTab {
  return typeof window !== 'undefined' && window.location.hash === WORLD_CUP_SIMULATOR_HASH
    ? 'simulator'
    : 'official'
}

function createEmptySimulatorState(): StoredSimulatorState {
  return clearWorldCupSimulation()
}

function parseStoredSimulatorState(raw: string | null, legacyRaw: string | null): StoredSimulatorState {
  if (!raw && !legacyRaw) return createEmptySimulatorState()

  const source = raw ?? legacyRaw

  if (!source) return createEmptySimulatorState()

  const parsed = JSON.parse(source)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return createEmptySimulatorState()
  }

  const record = parsed as Record<string, unknown>
  const base = createEmptySimulatorState()

  if (record.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      winners: isStringRecord(record.winners) ? record.winners : base.winners,
      results: isResultRecord(record.results) ? record.results : base.results,
      seedOverrides: isStringRecord(record.seedOverrides)
        ? record.seedOverrides as WorldCupBracketSeedOverrides
        : base.seedOverrides,
      groupResults: isGroupResultRecord(record.groupResults)
        ? record.groupResults
        : base.groupResults,
      manualTiebreakers: isManualTiebreakerRecord(record.manualTiebreakers)
        ? record.manualTiebreakers
        : base.manualTiebreakers,
      selectedGroup: isWorldCupGroupKey(record.selectedGroup) ? record.selectedGroup : base.selectedGroup,
      simulatorView: record.simulatorView === 'bracket' ? 'bracket' : 'groups',
      selectedRound: isWorldCupRoundKey(record.selectedRound) ? record.selectedRound : base.selectedRound,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
    }
  }

  if ('winners' in record || 'results' in record || 'seedOverrides' in record) {
    return {
      ...base,
      winners: isStringRecord(record.winners) ? record.winners : base.winners,
      results: isResultRecord(record.results) ? record.results : base.results,
      seedOverrides: isStringRecord(record.seedOverrides)
        ? record.seedOverrides as WorldCupBracketSeedOverrides
        : base.seedOverrides,
    }
  }

  return isStringRecord(record)
    ? {
        ...base,
        winners: record,
      }
    : base
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string')
  )
}

function isResultRecord(value: unknown): value is WorldCupBracketMatchResults {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isGroupResultRecord(value: unknown): value is WorldCupGroupSimulationResults {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.values(value as Record<string, unknown>).every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const record = item as Record<string, unknown>

    return (
      isNullableNumber(record.goalsHome) &&
      isNullableNumber(record.goalsAway)
    )
  })
}

function isManualTiebreakerRecord(value: unknown): value is WorldCupManualTiebreakers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.entries(value as Record<string, unknown>).every(([key, item]) =>
    isWorldCupGroupKey(key) &&
    Array.isArray(item) &&
    item.every((entry) => typeof entry === 'string')
  )
}

function isNullableNumber(value: unknown) {
  return value === null || value === undefined || typeof value === 'number'
}

function isWorldCupGroupKey(value: unknown): value is WorldCupGroupKey {
  return typeof value === 'string' && WORLD_CUP_GROUP_KEYS.includes(value as WorldCupGroupKey)
}

function isWorldCupRoundKey(value: unknown): value is WorldCupBracketRoundKey {
  return value === 'r32' || value === 'r16' || value === 'qf' || value === 'sf' || value === 'final'
}

function withUpdatedAt(state: StoredSimulatorState): StoredSimulatorState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  }
}

function getDisplayTeamName(
  team: WorldCupBracketMatch[TeamSide],
  locale: AppLocale
) {
  return team.placeholder ? team.name : translateCountryName(team.name, locale) || team.name
}

function getMatchStatusLabel(match: WorldCupBracketMatch) {
  if (!match.date && !match.statusShort) return null

  const dateLabel = match.date
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date(match.date))
    : null

  return [dateLabel, match.statusShort].filter(Boolean).join(' · ')
}

function formatScore(goals?: number | null, penalties?: number | null) {
  if (goals === null || goals === undefined) return '-'

  return penalties === null || penalties === undefined ? String(goals) : `${goals} (${penalties})`
}

function sanitizeScoreInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 2)
}

function parseScoreInput(value: string) {
  const sanitized = sanitizeScoreInput(value)

  return sanitized === '' ? null : Number(sanitized)
}

function getResultForSide(
  match: WorldCupBracketMatch,
  side: TeamSide,
  result?: WorldCupBracketMatchResult
) {
  const goalsField = side === 'home' ? 'goalsHome' : 'goalsAway'
  const penaltyField = side === 'home' ? 'homePenaltyScore' : 'awayPenaltyScore'

  return {
    goals: result?.[goalsField] ?? match[goalsField] ?? null,
    penalties: result?.[penaltyField] ?? match[penaltyField] ?? null,
  }
}

export function WorldCupBracketMatchCard({
  match,
  mode,
  locale,
  selection,
  result,
  onResultChange,
  interactive = true,
}: {
  match: WorldCupBracketMatch
  mode: 'official' | 'simulator'
  locale: AppLocale
  selection?: string
  result?: WorldCupBracketMatchResult
  onResultChange?: (matchId: string, field: ResultField, value: number | null) => void
  interactive?: boolean
}) {
  const statusLabel = getMatchStatusLabel(match)
  const href = mode === 'official' && match.fixtureId ? `/partido/${match.fixtureId}` : null
  const officialWinnerKey = mode === 'official' ? getMatchRealWinner(match)?.key : undefined
  const knockoutResolution = mode === 'simulator'
    ? resolveKnockoutMatchWinner(match, result)
    : null
  const selectedWinnerKey = knockoutResolution?.winner?.key ?? selection
  const showPenaltyInputs = mode === 'simulator' && interactive && isKnockoutScoreTie(match, result)
  const card = (
    <div
      className="rounded-lg border border-[#2a5c46] bg-[linear-gradient(180deg,#161d24_0%,#10171d_100%)] p-2 shadow-[inset_0_0_0_1px_rgba(127,240,178,0.06)]"
      data-world-cup-bracket-card={`M${match.slot}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#6f7d8b]">
        <span>Partido {match.slot}</span>
        {statusLabel ? <span className="truncate text-right">{statusLabel}</span> : null}
      </div>
      <div className="space-y-1">
        <TeamRow
          match={match}
          side="home"
          mode={mode}
          locale={locale}
          selected={selectedWinnerKey === match.home.key || officialWinnerKey === match.home.key}
          result={result}
          onResultChange={onResultChange}
          interactive={interactive}
          showPenaltyInput={showPenaltyInputs}
        />
        <TeamRow
          match={match}
          side="away"
          mode={mode}
          locale={locale}
          selected={selectedWinnerKey === match.away.key || officialWinnerKey === match.away.key}
          result={result}
          onResultChange={onResultChange}
          interactive={interactive}
          showPenaltyInput={showPenaltyInputs}
        />
      </div>
      {mode === 'simulator' && knockoutResolution?.message ? (
        <p className={`mt-1 text-[10px] font-bold ${
          knockoutResolution.status === 'penalty_tie' ? 'text-[#ffb4b4]' : 'text-[#f6d88a]'
        }`}>
          {knockoutResolution.message}
        </p>
      ) : null}
    </div>
  )

  return href ? (
    <Link href={href} className="block transition hover:brightness-110">
      {card}
    </Link>
  ) : card
}

function TeamRow({
  match,
  side,
  mode,
  locale,
  selected,
  result,
  onResultChange,
  interactive,
  showPenaltyInput,
}: {
  match: WorldCupBracketMatch
  side: TeamSide
  mode: 'official' | 'simulator'
  locale: AppLocale
  selected: boolean
  result?: WorldCupBracketMatchResult
  onResultChange?: (matchId: string, field: ResultField, value: number | null) => void
  interactive: boolean
  showPenaltyInput: boolean
}) {
  const team = match[side]
  const displayName = getDisplayTeamName(team, locale)
  const sideResult = getResultForSide(match, side, result)
  const goalsField = side === 'home' ? 'goalsHome' : 'goalsAway'
  const penaltyField = side === 'home' ? 'homePenaltyScore' : 'awayPenaltyScore'

  return (
    <div
      className={`grid min-h-8 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md border px-1.5 py-1 ${
        selected
          ? 'border-[#7ff0b2]/70 bg-[#143624]'
          : 'border-white/7 bg-[#111820]'
      }`}
    >
      <TeamLogo
        src={team.logo}
        alt={displayName}
        size={22}
        className="h-[22px] w-[22px] object-contain"
        fallbackClassName="h-5 w-4"
        unoptimized
      />
      <div className="min-w-0">
        <p
          className={`truncate text-[12px] font-bold ${team.placeholder ? 'text-[#98a5b3]' : 'text-[#edf2f7]'}`}
          title={displayName}
        >
          {displayName}
        </p>
        <p className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-[#6f7d8b]">
          {team.seedLabel}
        </p>
      </div>
      {mode === 'simulator' && interactive ? (
        <div className="flex items-center gap-1">
          <WorldCupScoreInput
            label={`${displayName} goles`}
            value={sideResult.goals}
            onChange={(value) => onResultChange?.(match.id, goalsField, value)}
          />
          {showPenaltyInput ? (
            <>
              <span className="text-[10px] font-bold text-[#6f7d8b]">(</span>
              <WorldCupScoreInput
                label={`${displayName} penales`}
                value={sideResult.penalties}
                onChange={(value) => onResultChange?.(match.id, penaltyField, value)}
                size="penalty"
              />
              <span className="text-[10px] font-bold text-[#6f7d8b]">)</span>
            </>
          ) : null}
        </div>
      ) : (
        <span className={`min-w-9 text-right text-[14px] font-black ${selected ? 'text-[#7ff0b2]' : 'text-white'}`}>
          {formatScore(sideResult.goals, sideResult.penalties)}
        </span>
      )}
    </div>
  )
}

function isKnockoutScoreTie(match: WorldCupBracketMatch, result?: WorldCupBracketMatchResult) {
  const home = result?.goalsHome ?? match.goalsHome ?? null
  const away = result?.goalsAway ?? match.goalsAway ?? null

  return home !== null && away !== null && home === away
}

function WorldCupScoreInput({
  label,
  value,
  onChange,
  size = 'match',
}: {
  label: string
  value?: number | null
  onChange: (value: number | null) => void
  size?: 'match' | 'penalty' | 'group'
}) {
  const sizeClass =
    size === 'group'
      ? 'h-8 w-[30px] text-[13px] md:h-7 md:w-[27px] md:text-[12px]'
      : size === 'penalty'
        ? 'h-7 w-7 text-[12px]'
        : 'h-7 w-8 text-[12px]'

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(parseScoreInput(event.target.value))
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    onChange(parseScoreInput(event.clipboardData.getData('text')))
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onChange(parseScoreInput(event.currentTarget.value))
  }

  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur()
  }

  return (
    <input
      aria-label={label}
      inputMode="numeric"
      pattern="[0-9]*"
      type="text"
      value={value ?? ''}
      onChange={handleChange}
      onPaste={handlePaste}
      onBlur={handleBlur}
      onWheel={handleWheel}
      className={`${sizeClass} rounded-md border border-white/10 bg-[#0d1217] px-1 text-center font-black text-white outline-none transition focus:border-[#7ff0b2]/70`}
    />
  )
}

export function WorldCupBracketBoard({
  rounds,
  thirdPlace,
  mode,
  locale,
  selections = {},
  results = {},
  selectedRoundKey,
  onSelectedRoundChange,
  onResultChange,
  interactive = true,
}: {
  rounds: WorldCupBracketRound[]
  thirdPlace?: WorldCupBracketMatch | null
  mode: 'official' | 'simulator'
  locale: AppLocale
  selections?: WorldCupBracketWinnerSelection
  results?: WorldCupBracketMatchResults
  selectedRoundKey?: WorldCupBracketRoundKey
  onSelectedRoundChange?: (roundKey: WorldCupBracketRoundKey) => void
  onResultChange?: (matchId: string, field: ResultField, value: number | null) => void
  interactive?: boolean
}) {
  const [internalRoundKey, setInternalRoundKey] = useState<WorldCupBracketRoundKey>(
    rounds[0]?.key ?? 'r32'
  )
  const activeRoundKey = selectedRoundKey ?? internalRoundKey
  const currentRoundKey = rounds.some((round) => round.key === activeRoundKey)
    ? activeRoundKey
    : rounds[0]?.key ?? 'r32'
  const activeRound = rounds.find((round) => round.key === currentRoundKey) ?? rounds[0]
  const handleRoundChange = (roundKey: WorldCupBracketRoundKey) => {
    setInternalRoundKey(roundKey)
    onSelectedRoundChange?.(roundKey)
  }

  return (
    <div className="w-full">
      <div className="mb-3 md:hidden">
        <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#8d98a7]">
          Ronda
        </label>
        <select
          value={currentRoundKey}
          onChange={(event) => handleRoundChange(event.target.value as WorldCupBracketRoundKey)}
          className="h-10 w-full rounded-xl border border-white/10 bg-[#101820] px-3 text-sm font-bold text-white outline-none"
        >
          {rounds.map((round) => (
            <option key={round.key} value={round.key}>
              {round.label}
            </option>
          ))}
        </select>
      </div>

      <div className="md:hidden">
        {activeRound ? (
          <RoundColumn
            round={activeRound}
            thirdPlace={activeRound.key === 'final' ? thirdPlace : null}
            mode={mode}
            locale={locale}
            selections={selections}
            results={results}
            onResultChange={onResultChange}
            interactive={interactive}
          />
        ) : null}
      </div>

      <div className="hidden md:block">
        <div className="bracket-scroll overflow-x-auto pb-1">
          <div
            className="grid min-w-[1060px] grid-cols-5 gap-x-2"
            style={{ gridTemplateRows: `28px repeat(${BRACKET_GRID_ROW_COUNT}, ${BRACKET_ROW_UNIT_PX}px)` }}
          >
            {rounds.map((round) => (
              <BracketRoundColumn
                key={round.key}
                round={round}
                thirdPlace={round.key === 'final' ? thirdPlace : null}
                mode={mode}
                locale={locale}
                selections={selections}
                results={results}
                onResultChange={onResultChange}
                interactive={interactive}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const ROUND_COLUMN_INDEX: Record<WorldCupBracketRoundKey, number> = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
}

const ROUND_VISUAL_ORDER: Record<WorldCupBracketRoundKey, number[]> = {
  r32: [73, 75, 74, 77, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  r16: [89, 90, 93, 94, 91, 92, 95, 96],
  qf: [97, 98, 99, 100],
  sf: [101, 102],
  final: [104],
}

function buildSlotRowMap(slots: number[], start: number, step: number) {
  return Object.fromEntries(slots.map((slot, index) => [slot, start + index * step])) as Record<number, number>
}

const BRACKET_ROW_START = 2
const BRACKET_R32_ROW_STEP = 18
const BRACKET_MATCH_ROW_SPAN = 15
const BRACKET_ROW_UNIT_PX = 8

const ROUND_GRID_ROWS: Record<WorldCupBracketRoundKey, Record<number, number>> = {
  r32: buildSlotRowMap(ROUND_VISUAL_ORDER.r32, BRACKET_ROW_START, BRACKET_R32_ROW_STEP),
  r16: buildSlotRowMap(
    ROUND_VISUAL_ORDER.r16,
    BRACKET_ROW_START + BRACKET_R32_ROW_STEP / 2,
    BRACKET_R32_ROW_STEP * 2
  ),
  qf: buildSlotRowMap(
    ROUND_VISUAL_ORDER.qf,
    BRACKET_ROW_START + (BRACKET_R32_ROW_STEP * 3) / 2,
    BRACKET_R32_ROW_STEP * 4
  ),
  sf: buildSlotRowMap(
    ROUND_VISUAL_ORDER.sf,
    BRACKET_ROW_START + (BRACKET_R32_ROW_STEP * 7) / 2,
    BRACKET_R32_ROW_STEP * 8
  ),
  final: { 104: BRACKET_ROW_START + (BRACKET_R32_ROW_STEP * 15) / 2 },
}

const THIRD_PLACE_GRID_ROW = ROUND_GRID_ROWS.final[104] + BRACKET_MATCH_ROW_SPAN + 12
const BRACKET_GRID_ROW_COUNT =
  BRACKET_ROW_START + BRACKET_R32_ROW_STEP * ROUND_VISUAL_ORDER.r32.length + BRACKET_MATCH_ROW_SPAN

function getVisualMatches(round: WorldCupBracketRound) {
  const visualIndex = new Map(ROUND_VISUAL_ORDER[round.key].map((slot, index) => [slot, index]))

  return [...round.matches].sort((a, b) => {
    const aIndex = visualIndex.get(a.slot) ?? Number.MAX_SAFE_INTEGER
    const bIndex = visualIndex.get(b.slot) ?? Number.MAX_SAFE_INTEGER

    return aIndex - bIndex || a.slot - b.slot
  })
}

function getBracketGridRow(roundKey: WorldCupBracketRoundKey, slot: number) {
  return ROUND_GRID_ROWS[roundKey][slot] ?? 2
}

function BracketRoundColumn({
  round,
  thirdPlace,
  mode,
  locale,
  selections,
  results,
  onResultChange,
  interactive,
}: {
  round: WorldCupBracketRound
  thirdPlace?: WorldCupBracketMatch | null
  mode: 'official' | 'simulator'
  locale: AppLocale
  selections: WorldCupBracketWinnerSelection
  results: WorldCupBracketMatchResults
  onResultChange?: (matchId: string, field: ResultField, value: number | null) => void
  interactive: boolean
}) {
  const gridColumn = ROUND_COLUMN_INDEX[round.key]

  return (
    <>
      <h3
        className="self-start rounded-xl border border-white/7 bg-[#101820] py-2 text-center text-[11px] font-black uppercase leading-tight tracking-[0.08em] text-[#7ff0b2]"
        style={{ gridColumn, gridRow: 1 }}
      >
        {round.label}
      </h3>
      {getVisualMatches(round).map((match) => (
        <div
          key={match.id}
          style={{
            gridColumn,
            gridRow: `${getBracketGridRow(round.key, match.slot)} / span ${BRACKET_MATCH_ROW_SPAN}`,
          }}
        >
          <WorldCupBracketMatchCard
            match={match}
            mode={mode}
            locale={locale}
            selection={getSelectedWinner(match, selections)?.key}
            result={results[match.id]}
            onResultChange={onResultChange}
            interactive={interactive}
          />
        </div>
      ))}
      {thirdPlace ? (
        <div
          className="border-t border-[#d6a84f]/20 pt-2"
          style={{ gridColumn, gridRow: `${THIRD_PLACE_GRID_ROW} / span ${BRACKET_MATCH_ROW_SPAN}` }}
        >
          <h4 className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#d6a84f]">
            3er puesto
          </h4>
          <WorldCupBracketMatchCard
            match={thirdPlace}
            mode={mode}
            locale={locale}
            selection={getSelectedWinner(thirdPlace, selections)?.key}
            result={results[thirdPlace.id]}
            onResultChange={onResultChange}
            interactive={interactive}
          />
        </div>
      ) : null}
    </>
  )
}

function RoundColumn({
  round,
  thirdPlace,
  mode,
  locale,
  selections,
  results,
  onResultChange,
  interactive,
}: {
  round: WorldCupBracketRound
  thirdPlace?: WorldCupBracketMatch | null
  mode: 'official' | 'simulator'
  locale: AppLocale
  selections: WorldCupBracketWinnerSelection
  results: WorldCupBracketMatchResults
  onResultChange?: (matchId: string, field: ResultField, value: number | null) => void
  interactive: boolean
}) {
  return (
    <div className="flex min-w-[216px] flex-1 flex-col rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-2">
      <h3 className="mb-2 min-h-7 text-center text-[11px] font-black uppercase leading-tight tracking-[0.08em] text-[#7ff0b2]">
        {round.label}
      </h3>
      <div className="space-y-2">
        {getVisualMatches(round).map((match) => (
          <WorldCupBracketMatchCard
            key={match.id}
            match={match}
            mode={mode}
            locale={locale}
            selection={getSelectedWinner(match, selections)?.key}
            result={results[match.id]}
            onResultChange={onResultChange}
            interactive={interactive}
          />
        ))}
      </div>
      {thirdPlace ? (
        <div className="mt-3 border-t border-white/7 pt-3">
          <h4 className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#d6a84f]">
            3er puesto
          </h4>
          <WorldCupBracketMatchCard
            match={thirdPlace}
            mode={mode}
            locale={locale}
            selection={getSelectedWinner(thirdPlace, selections)?.key}
            result={results[thirdPlace.id]}
            onResultChange={onResultChange}
            interactive={interactive}
          />
        </div>
      ) : null}
    </div>
  )
}

export function WorldCupOfficialBracket({
  groups,
  fixtures,
  locale,
}: {
  groups: LeagueStandingGroup[]
  fixtures: LeagueFixtureSummary[]
  locale: AppLocale
}) {
  const officialBracket = useMemo(
    () => buildWorldCupOfficialBracket(groups, fixtures),
    [fixtures, groups]
  )

  return (
    <WorldCupBracketBoard
      rounds={officialBracket.rounds}
      thirdPlace={officialBracket.thirdPlace}
      mode="official"
      locale={locale}
    />
  )
}

export function WorldCupKnockoutSimulator({
  groups,
  fixtures,
  leagueExternalId,
  season = 2026,
  locale,
}: {
  groups: LeagueStandingGroup[]
  fixtures: LeagueFixtureSummary[]
  leagueExternalId?: number | null
  season?: number | null
  locale: AppLocale
}) {
  const storageKey = getWorldCupBracketStorageKey()
  const legacyStorageKey = useMemo(
    () => getLegacyWorldCupBracketStorageKey({ leagueExternalId, season }),
    [leagueExternalId, season]
  )
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<StoredSimulatorState>(() => createEmptySimulatorState())
  const groupSimulation = useMemo(
    () => buildWorldCupSimulatedGroupFixtures(
      groups,
      fixtures,
      state.groupResults,
      state.manualTiebreakers
    ),
    [fixtures, groups, state.groupResults, state.manualTiebreakers]
  )
  const thirdPlaceAssignments = useMemo(
    () => resolveWorldCupThirdPlaceAssignments(
      groupSimulation.thirdPlaceRanking.qualified.map((entry) => entry.groupKey)
    ),
    [groupSimulation.thirdPlaceRanking.qualified]
  )
  const simulation = useMemo(
    () => buildWorldCupBracketSimulation(
      groups,
      fixtures,
      state.winners,
      state.seedOverrides,
      groupSimulation.standingsGroups,
      thirdPlaceAssignments
    ),
    [
      fixtures,
      groups,
      groupSimulation.standingsGroups,
      state.seedOverrides,
      state.winners,
      thirdPlaceAssignments,
    ]
  )
  const seedOptions = useMemo(() => getWorldCupBracketSeedOptions(groups), [groups])
  const allSeedRows = seedOptions.flatMap((group) => group.rows)

  useEffect(() => {
    try {
      setState(parseStoredSimulatorState(
        window.localStorage.getItem(storageKey),
        window.localStorage.getItem(legacyStorageKey)
      ))
    } catch {
      setState(createEmptySimulatorState())
    } finally {
      setLoaded(true)
    }
  }, [legacyStorageKey, storageKey])

  useEffect(() => {
    if (!loaded) return

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
      if (window.localStorage.getItem(legacyStorageKey)) {
        window.localStorage.removeItem(legacyStorageKey)
      }
    } catch {
      // El simulador no tiene persistencia alternativa.
    }
  }, [legacyStorageKey, loaded, state, storageKey])

  const handleResultChange = (matchId: string, field: ResultField, value: number | null) => {
    setState((current) => {
      const nextResults = {
        ...current.results,
        [matchId]: {
          ...current.results[matchId],
          [field]: value,
        },
      }
      const nextMatchResult = nextResults[matchId]
      const home = nextMatchResult.goalsHome
      const away = nextMatchResult.goalsAway

      if (field === 'goalsHome' || field === 'goalsAway') {
        if (home === null || home === undefined || away === null || away === undefined || home !== away) {
          nextMatchResult.homePenaltyScore = null
          nextMatchResult.awayPenaltyScore = null
        }
      }

      if (
        nextMatchResult.goalsHome == null &&
        nextMatchResult.goalsAway == null &&
        nextMatchResult.homePenaltyScore == null &&
        nextMatchResult.awayPenaltyScore == null
      ) {
        delete nextResults[matchId]
      }

      const reconciled = reconcileKnockoutAfterScoreChange(
        simulation.rounds,
        current.winners,
        nextResults,
        simulation.thirdPlace
      )

      return withUpdatedAt({
        ...current,
        winners: reconciled.winners,
        results: reconciled.results,
      })
    })
  }

  const reconcileAfterGroupChange = (
    current: StoredSimulatorState,
    nextGroupResults: WorldCupGroupSimulationResults,
    nextManualTiebreakers = current.manualTiebreakers,
    nextSeedOverrides = current.seedOverrides
  ) => {
    const nextGroupSimulation = buildWorldCupSimulatedGroupFixtures(
      groups,
      fixtures,
      nextGroupResults,
      nextManualTiebreakers
    )
    const nextThirdAssignments = resolveWorldCupThirdPlaceAssignments(
      nextGroupSimulation.thirdPlaceRanking.qualified.map((entry) => entry.groupKey)
    )
    const nextBracket = buildWorldCupBracketSimulation(
      groups,
      fixtures,
      current.winners,
      nextSeedOverrides,
      nextGroupSimulation.standingsGroups,
      nextThirdAssignments
    )
    const affectedCleaned = clearAffectedKnockoutDescendants(
      simulation.rounds,
      nextBracket.rounds,
      current.winners,
      current.results,
      simulation.thirdPlace,
      nextBracket.thirdPlace
    )
    const reconciled = reconcileKnockoutAfterScoreChange(
      nextBracket.rounds,
      affectedCleaned.winners,
      affectedCleaned.results,
      nextBracket.thirdPlace
    )

    return withUpdatedAt({
      ...current,
      groupResults: nextGroupResults,
      manualTiebreakers: nextManualTiebreakers,
      seedOverrides: nextSeedOverrides,
      winners: reconciled.winners,
      results: reconciled.results,
    })
  }

  const handleGroupResultChange = (
    fixtureId: string,
    side: 'goalsHome' | 'goalsAway',
    value: number | null
  ) => {
    setState((current) => {
      const nextGroupResults = {
        ...current.groupResults,
        [fixtureId]: {
          ...current.groupResults[fixtureId],
          [side]: value,
        },
      }

      if (
        nextGroupResults[fixtureId].goalsHome === null &&
        nextGroupResults[fixtureId].goalsAway === null
      ) {
        delete nextGroupResults[fixtureId]
      }

      return reconcileAfterGroupChange(current, nextGroupResults)
    })
  }

  const handleClearGroupResult = (fixtureId: string) => {
    setState((current) => {
      const nextGroupResults = { ...current.groupResults }
      delete nextGroupResults[fixtureId]

      return reconcileAfterGroupChange(current, nextGroupResults)
    })
  }

  const handleManualTiebreakerChange = (groupKey: WorldCupGroupKey, teamKeys: string[]) => {
    setState((current) => {
      const nextManualTiebreakers = { ...current.manualTiebreakers }

      if (teamKeys.length) nextManualTiebreakers[groupKey] = teamKeys
      else delete nextManualTiebreakers[groupKey]

      return reconcileAfterGroupChange(current, current.groupResults, nextManualTiebreakers)
    })
  }

  const handleSeedOverride = (seedKey: WorldCupBracketSeedKey, teamKey: string) => {
    setState((current) => {
      const nextOverrides = { ...current.seedOverrides }

      if (teamKey) {
        nextOverrides[seedKey] = teamKey
      } else {
        delete nextOverrides[seedKey]
      }

      return reconcileAfterGroupChange(current, current.groupResults, current.manualTiebreakers, nextOverrides)
    })
  }

  const handleSimulatorViewChange = (view: StoredSimulatorState['simulatorView']) => {
    setState((current) => withUpdatedAt({ ...current, simulatorView: view }))
  }

  const handleSelectedGroupChange = (groupKey: WorldCupGroupKey) => {
    setState((current) => withUpdatedAt({ ...current, selectedGroup: groupKey }))
  }

  const handleSelectedRoundChange = (roundKey: WorldCupBracketRoundKey) => {
    setState((current) => withUpdatedAt({ ...current, selectedRound: roundKey }))
  }

  const resetSimulation = () => {
    if (!window.confirm('¿Reiniciar simulación? Se borran solo los datos guardados en este navegador.')) {
      return
    }

    setState(createEmptySimulatorState())

    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // No hay persistencia alternativa: si falla localStorage, solo se limpia el estado en memoria.
    }
  }

  const champion = simulation.champion
    ? getDisplayTeamName(simulation.champion, locale)
    : 'A confirmar'
  const shareTargetId = 'world-cup-simulation-share-bracket'
  const shareFileName = 'hay-fulbo-mundial-2026-llaves-simuladas.png'
  const shareTitle = 'Copa del Mundo 2026 - Simulacion'
  const shareText = 'Copa del Mundo 2026 - Llaves simuladas en Hay Fulbo'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between" data-share-ignore="true">
        <div className="grid grid-cols-2 gap-2 sm:inline-grid sm:min-w-[360px]">
          <button
            type="button"
            onClick={() => handleSimulatorViewChange('groups')}
            className={`min-h-9 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.08em] transition ${
              state.simulatorView === 'groups'
                ? 'border-[#7ff0b2]/65 bg-[#143624] text-[#7ff0b2]'
                : 'border-white/8 bg-[#0d1217] text-[#8d98a7] hover:text-white'
            }`}
          >
            Simular grupos
          </button>
          <button
            type="button"
            onClick={() => handleSimulatorViewChange('bracket')}
            className={`min-h-9 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.08em] transition ${
              state.simulatorView === 'bracket'
                ? 'border-[#7ff0b2]/65 bg-[#143624] text-[#7ff0b2]'
                : 'border-white/8 bg-[#0d1217] text-[#8d98a7] hover:text-white'
            }`}
          >
            Ver llaves simuladas
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ShareCardButton
            targetId={shareTargetId}
            fileName={shareFileName}
            title={shareTitle}
            text={shareText}
            url="/liga/selecciones-mundial#simulador-mundial"
            ariaLabel="Compartir simulación"
            buttonTitle="Compartir simulación"
          />
          <button
            type="button"
            onClick={resetSimulation}
            className="min-h-9 rounded-xl border border-[#7a2e2e] bg-[#2a1414] px-3 text-xs font-black uppercase tracking-[0.08em] text-[#ffd5d5] transition hover:border-[#ff8f8f]"
          >
            Reiniciar simulación
          </button>
        </div>
      </div>

      {state.simulatorView === 'bracket' && simulation.champion ? (
        <div className="inline-flex rounded-xl border border-white/8 bg-[#101820] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
          Campeón: {champion}
        </div>
      ) : null}

      <details className="rounded-xl border border-white/8 bg-[#0d1217]" data-share-ignore="true">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#dce5ef] transition hover:text-white">
          Editar clasificados manualmente
        </summary>
        <SeedEditor
          seedOptions={seedOptions}
          allSeedRows={allSeedRows}
          seedOverrides={state.seedOverrides}
          onChange={handleSeedOverride}
          locale={locale}
        />
      </details>

      {state.simulatorView === 'groups' ? (
        <WorldCupGroupSimulator
          model={groupSimulation}
          selectedGroup={state.selectedGroup}
          groupResults={state.groupResults}
          manualTiebreakers={state.manualTiebreakers}
          locale={locale}
          onSelectedGroupChange={handleSelectedGroupChange}
          onGroupResultChange={handleGroupResultChange}
          onClearGroupResult={handleClearGroupResult}
          onManualTiebreakerChange={handleManualTiebreakerChange}
        />
      ) : (
        <>
          {simulation.warnings?.length ? (
            <div className="rounded-xl border border-[#d6a84f]/25 bg-[#2a2112] px-3 py-2 text-xs font-semibold text-[#f6d88a]">
              {simulation.warnings[0]}
            </div>
          ) : null}
          <WorldCupBracketBoard
            rounds={simulation.rounds}
            thirdPlace={simulation.thirdPlace}
            mode="simulator"
            locale={locale}
            selections={state.winners}
            results={state.results}
            selectedRoundKey={state.selectedRound}
            onSelectedRoundChange={handleSelectedRoundChange}
            onResultChange={handleResultChange}
          />
        </>
      )}
      <WorldCupSimulationShareSnapshot
        targetId={shareTargetId}
        bracket={simulation}
        results={state.results}
        winners={state.winners}
        champion={simulation.champion ? champion : null}
        locale={locale}
      />
    </div>
  )
}

function WorldCupSimulationShareSnapshot({
  targetId,
  bracket,
  results,
  winners,
  champion,
  locale,
}: {
  targetId: string
  bracket: ReturnType<typeof buildWorldCupBracketSimulation>
  results: WorldCupBracketMatchResults
  winners: WorldCupBracketWinnerSelection
  champion: string | null
  locale: AppLocale
}) {
  return (
    <div
      id={targetId}
      aria-hidden="true"
      className="pointer-events-none fixed left-[-10000px] top-0 bg-[#07100d] text-white"
      style={{ width: 1440 }}
    >
      <div className="rounded-3xl border border-[#2a5c46] bg-[#07100d] p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7ff0b2]">
              Hay Fulbo
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Copa del Mundo 2026
            </h2>
            <p className="mt-1 text-sm font-bold text-[#9aa7b5]">
              Llaves simuladas completas
            </p>
          </div>
          {champion ? (
            <div className="rounded-2xl border border-[#7ff0b2]/35 bg-[#143624] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
              Campeón: {champion}
            </div>
          ) : null}
        </div>

        <WorldCupBracketShareSnapshot
          bracket={bracket}
          results={results}
          winners={winners}
          locale={locale}
        />
      </div>
    </div>
  )
}

const SHARE_BRACKET_ROW_START = 2
const SHARE_BRACKET_R32_ROW_STEP = 6
const SHARE_BRACKET_MATCH_ROW_SPAN = 5
const SHARE_BRACKET_ROW_UNIT_PX = 8
const SHARE_BRACKET_GRID_ROW_COUNT =
  SHARE_BRACKET_ROW_START + SHARE_BRACKET_R32_ROW_STEP * ROUND_VISUAL_ORDER.r32.length + SHARE_BRACKET_MATCH_ROW_SPAN
const SHARE_BRACKET_GRID_ROWS: Record<WorldCupBracketRoundKey, Record<number, number>> = {
  r32: buildSlotRowMap(ROUND_VISUAL_ORDER.r32, SHARE_BRACKET_ROW_START, SHARE_BRACKET_R32_ROW_STEP),
  r16: buildSlotRowMap(
    ROUND_VISUAL_ORDER.r16,
    SHARE_BRACKET_ROW_START + SHARE_BRACKET_R32_ROW_STEP / 2,
    SHARE_BRACKET_R32_ROW_STEP * 2
  ),
  qf: buildSlotRowMap(
    ROUND_VISUAL_ORDER.qf,
    SHARE_BRACKET_ROW_START + (SHARE_BRACKET_R32_ROW_STEP * 3) / 2,
    SHARE_BRACKET_R32_ROW_STEP * 4
  ),
  sf: buildSlotRowMap(
    ROUND_VISUAL_ORDER.sf,
    SHARE_BRACKET_ROW_START + (SHARE_BRACKET_R32_ROW_STEP * 7) / 2,
    SHARE_BRACKET_R32_ROW_STEP * 8
  ),
  final: { 104: SHARE_BRACKET_ROW_START + (SHARE_BRACKET_R32_ROW_STEP * 15) / 2 },
}
const SHARE_THIRD_PLACE_GRID_ROW =
  SHARE_BRACKET_GRID_ROWS.final[104] + SHARE_BRACKET_MATCH_ROW_SPAN + 6

function getShareBracketGridRow(roundKey: WorldCupBracketRoundKey, slot: number) {
  return SHARE_BRACKET_GRID_ROWS[roundKey][slot] ?? SHARE_BRACKET_ROW_START
}

function WorldCupBracketShareSnapshot({
  bracket,
  results,
  winners,
  locale,
}: {
  bracket: ReturnType<typeof buildWorldCupBracketSimulation>
  results: WorldCupBracketMatchResults
  winners: WorldCupBracketWinnerSelection
  locale: AppLocale
}) {
  return (
    <div
      className="grid grid-cols-5 gap-x-3"
      style={{ gridTemplateRows: `24px repeat(${SHARE_BRACKET_GRID_ROW_COUNT}, ${SHARE_BRACKET_ROW_UNIT_PX}px)` }}
    >
      {bracket.rounds.map((round) => (
        <WorldCupBracketShareRound
          key={round.key}
          round={round}
          thirdPlace={round.key === 'final' ? bracket.thirdPlace : null}
          results={results}
          winners={winners}
          locale={locale}
        />
      ))}
    </div>
  )
}

function WorldCupBracketShareRound({
  round,
  thirdPlace,
  results,
  winners,
  locale,
}: {
  round: WorldCupBracketRound
  thirdPlace?: WorldCupBracketMatch | null
  results: WorldCupBracketMatchResults
  winners: WorldCupBracketWinnerSelection
  locale: AppLocale
}) {
  const gridColumn = ROUND_COLUMN_INDEX[round.key]

  return (
    <>
      <h3
        className="self-start rounded-lg border border-white/7 bg-[#101820] py-1 text-center text-[9px] font-black uppercase leading-tight tracking-[0.08em] text-[#7ff0b2]"
        style={{ gridColumn, gridRow: 1 }}
      >
        {round.label}
      </h3>
      {getVisualMatches(round).map((match) => (
        <div
          key={match.id}
          style={{
            gridColumn,
            gridRow: `${getShareBracketGridRow(round.key, match.slot)} / span ${SHARE_BRACKET_MATCH_ROW_SPAN}`,
          }}
        >
          <WorldCupBracketShareMatchCard
            match={match}
            locale={locale}
            result={results[match.id]}
            selection={getSelectedWinner(match, winners)?.key}
          />
        </div>
      ))}
      {thirdPlace ? (
        <div
          className="border-t border-[#d6a84f]/20 pt-1"
          style={{
            gridColumn,
            gridRow: `${SHARE_THIRD_PLACE_GRID_ROW} / span ${SHARE_BRACKET_MATCH_ROW_SPAN + 1}`,
          }}
        >
          <h4 className="mb-1 text-center text-[8px] font-black uppercase tracking-[0.08em] text-[#d6a84f]">
            3er puesto
          </h4>
          <WorldCupBracketShareMatchCard
            match={thirdPlace}
            locale={locale}
            result={results[thirdPlace.id]}
            selection={getSelectedWinner(thirdPlace, winners)?.key}
          />
        </div>
      ) : null}
    </>
  )
}

function WorldCupBracketShareMatchCard({
  match,
  locale,
  result,
  selection,
}: {
  match: WorldCupBracketMatch
  locale: AppLocale
  result?: WorldCupBracketMatchResult
  selection?: string
}) {
  const selectedWinnerKey = resolveKnockoutMatchWinner(match, result).winner?.key ?? selection

  return (
    <div
      className="h-full overflow-hidden rounded-md border border-[#2a5c46] bg-[#111820] px-1.5 py-1 shadow-[inset_0_0_0_1px_rgba(127,240,178,0.05)]"
      data-world-cup-share-bracket-card={`M${match.slot}`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-1 text-[7px] font-black uppercase leading-none tracking-[0.08em] text-[#6f7d8b]">
        <span>Partido {match.slot}</span>
      </div>
      <WorldCupBracketShareTeamRow
        match={match}
        side="home"
        locale={locale}
        result={result}
        selected={selectedWinnerKey === match.home.key}
      />
      <WorldCupBracketShareTeamRow
        match={match}
        side="away"
        locale={locale}
        result={result}
        selected={selectedWinnerKey === match.away.key}
      />
    </div>
  )
}

function WorldCupBracketShareTeamRow({
  match,
  side,
  locale,
  result,
  selected,
}: {
  match: WorldCupBracketMatch
  side: TeamSide
  locale: AppLocale
  result?: WorldCupBracketMatchResult
  selected: boolean
}) {
  const team = match[side]
  const displayName = getDisplayTeamName(team, locale)
  const sideResult = getResultForSide(match, side, result)
  const teamMark = getShareTeamMark(displayName, team.placeholder)

  return (
    <div className={`grid h-[13px] grid-cols-[14px_minmax(0,1fr)_30px] items-center gap-1 rounded px-0.5 ${
      selected ? 'bg-[#143624] text-[#7ff0b2]' : 'text-[#edf2f7]'
    }`}>
      <span
        aria-hidden="true"
        className={`grid h-3 w-3 place-items-center rounded-[3px] border text-[5px] font-black leading-none ${
          team.placeholder
            ? 'border-[#5c6875] bg-[#1b2530] text-[#9aa7b5]'
            : 'border-[#2a5c46] bg-[#132019] text-[#7ff0b2]'
        }`}
      >
        {teamMark}
      </span>
      <span className={`truncate text-[9px] font-bold leading-none ${team.placeholder ? 'text-[#98a5b3]' : ''}`} title={displayName}>
        {displayName}
      </span>
      <span className="text-right text-[10px] font-black leading-none">
        {formatScore(sideResult.goals, sideResult.penalties)}
      </span>
    </div>
  )
}

function getShareTeamMark(displayName: string, placeholder: boolean) {
  if (placeholder) return '?'

  const letters = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return letters || displayName.slice(0, 1).toUpperCase() || '?'
}

function WorldCupGroupSimulator({
  model,
  selectedGroup,
  groupResults,
  manualTiebreakers,
  locale,
  onSelectedGroupChange,
  onGroupResultChange,
  onClearGroupResult,
  onManualTiebreakerChange,
}: {
  model: ReturnType<typeof buildWorldCupSimulatedGroupFixtures>
  selectedGroup: WorldCupGroupKey
  groupResults: WorldCupGroupSimulationResults
  manualTiebreakers: WorldCupManualTiebreakers
  locale: AppLocale
  onSelectedGroupChange: (groupKey: WorldCupGroupKey) => void
  onGroupResultChange: (fixtureId: string, side: 'goalsHome' | 'goalsAway', value: number | null) => void
  onClearGroupResult: (fixtureId: string) => void
  onManualTiebreakerChange: (groupKey: WorldCupGroupKey, teamKeys: string[]) => void
}) {
  const currentIndex = Math.max(0, WORLD_CUP_GROUP_KEYS.indexOf(selectedGroup))
  const group = model.groups.find((entry) => entry.groupKey === selectedGroup) ?? model.groups[0]
  const previousGroup = WORLD_CUP_GROUP_KEYS[Math.max(0, currentIndex - 1)]
  const nextGroup = WORLD_CUP_GROUP_KEYS[Math.min(WORLD_CUP_GROUP_KEYS.length - 1, currentIndex + 1)]

  if (!group) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#101820] p-3 text-sm text-[#8d98a7]">
        No hay grupos disponibles para simular.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end" data-share-ignore="true">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-white/8 bg-[#101820] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
            {model.complete ? 'Simulacion de grupos completa' : 'Clasificacion provisional'}
          </span>
          <span className="rounded-xl border border-white/8 bg-[#101820] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
            {model.groups.filter((entry) => entry.complete).length}/12 grupos
          </span>
        </div>
        <label className="grid gap-1 text-xs font-bold text-[#dce5ef]">
          Grupo
          <select
            value={group.groupKey}
            onChange={(event) => onSelectedGroupChange(event.target.value as WorldCupGroupKey)}
            className="h-10 min-w-[180px] rounded-xl border border-white/10 bg-[#101820] px-3 text-sm font-black text-white outline-none focus:border-[#7ff0b2]/70"
          >
            {WORLD_CUP_GROUP_KEYS.map((groupKey) => (
              <option key={groupKey} value={groupKey}>
                Grupo {groupKey}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => onSelectedGroupChange(previousGroup)}
            disabled={currentIndex === 0}
            className="min-h-9 rounded-xl border border-white/10 bg-[#0d1217] px-3 text-xs font-black uppercase tracking-[0.08em] text-[#dce5ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Grupo anterior
          </button>
          <button
            type="button"
            onClick={() => onSelectedGroupChange(nextGroup)}
            disabled={currentIndex === WORLD_CUP_GROUP_KEYS.length - 1}
            className="min-h-9 rounded-xl border border-white/10 bg-[#0d1217] px-3 text-xs font-black uppercase tracking-[0.08em] text-[#dce5ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Grupo siguiente →
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
          <div className="border-b border-white/8 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
            Partidos del grupo
          </div>
          {group.fixtures.length ? (
            group.fixtures.map((fixture) => (
              <WorldCupGroupFixtureRow
                key={fixture.fixture.id}
                groupFixture={fixture}
                result={groupResults[String(fixture.fixture.id)]}
                locale={locale}
                onChange={onGroupResultChange}
                onClear={onClearGroupResult}
              />
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-[#8d98a7]">
              No hay fixtures oficiales guardados para este grupo.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <WorldCupSimulatedStandings group={group} locale={locale} />
          <ManualTiebreakerEditor
            group={group}
            manualOrder={manualTiebreakers[group.groupKey] ?? []}
            onChange={(teamKeys) => onManualTiebreakerChange(group.groupKey, teamKeys)}
            locale={locale}
          />
        </div>
      </div>

      {group.missingFixtures.length ? (
        <div className="rounded-xl border border-[#d6a84f]/25 bg-[#2a2112] px-3 py-2 text-xs font-semibold text-[#f6d88a]">
          {group.missingFixtures[0]}
        </div>
      ) : null}

      <WorldCupThirdPlaceSimulation model={model} locale={locale} />
    </div>
  )
}

function WorldCupGroupFixtureRow({
  groupFixture,
  result,
  locale,
  onChange,
  onClear,
}: {
  groupFixture: WorldCupGroupFixtureSimulation
  result?: WorldCupGroupSimulationResults[string]
  locale: AppLocale
  onChange: (fixtureId: string, side: 'goalsHome' | 'goalsAway', value: number | null) => void
  onClear: (fixtureId: string) => void
}) {
  const fixture = groupFixture.fixture
  const fixtureId = String(fixture.id)
  const homeName = translateCountryName(fixture.home, locale) || fixture.home
  const awayName = translateCountryName(fixture.away, locale) || fixture.away
  const homeGoals = groupFixture.official ? groupFixture.goalsHome : result?.goalsHome ?? null
  const awayGoals = groupFixture.official ? groupFixture.goalsAway : result?.goalsAway ?? null
  const hasSimulatedValue = !groupFixture.official && (homeGoals != null || awayGoals != null)
  const incomplete =
    !groupFixture.official &&
    ((homeGoals !== null && homeGoals !== undefined && (awayGoals === null || awayGoals === undefined)) ||
      (awayGoals !== null && awayGoals !== undefined && (homeGoals === null || homeGoals === undefined)))
  const dateLabel = formatGroupFixtureDate(fixture.date)
  const statusBadge = (
    <span className={`inline-flex h-6 w-[66px] shrink-0 items-center justify-center rounded-md border px-1 text-[8px] font-black uppercase tracking-[0.04em] ${
      groupFixture.official
        ? 'border-[#7ff0b2]/25 bg-[#143624] text-[#7ff0b2]'
        : 'border-[#d6a84f]/25 bg-[#2a2112] text-[#f6d88a]'
    }`}>
      {groupFixture.official ? 'Oficial' : 'Simulado'}
    </span>
  )
  const clearControl = hasSimulatedValue ? (
    <button
      type="button"
      onClick={() => onClear(fixtureId)}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#7a2e2e]/70 bg-[#2a1414] text-[#ffd5d5] transition hover:border-[#ff8f8f] hover:text-white"
      aria-label="Borrar resultado simulado"
      title="Borrar resultado"
      data-share-ignore="true"
    >
      <TrashIcon />
    </button>
  ) : (
    <span aria-hidden="true" className="h-8 w-8 shrink-0" />
  )
  const renderTeam = (name: string, logo?: string | null) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <TeamLogo
        src={logo}
        alt={name}
        size={18}
        className="h-[18px] w-[18px] shrink-0 object-contain md:h-4 md:w-4"
        fallbackClassName="h-4 w-3.5"
      />
      <span className="min-w-0 truncate text-[12px] font-semibold text-[#dce5ef] md:text-[11px]" title={name}>
        {name}
      </span>
    </div>
  )
  const scoreControl = groupFixture.official ? (
    <div className="grid grid-cols-[30px_8px_30px] items-center justify-center gap-0 text-center md:grid-cols-[27px_8px_27px]">
      <span className="rounded-md border border-white/10 bg-[#0d1217] py-1 text-[13px] font-black text-white md:text-[12px]">
        {groupFixture.goalsHome ?? '-'}
      </span>
      <span className="text-[11px] font-bold text-[#6f7d8b]">-</span>
      <span className="rounded-md border border-white/10 bg-[#0d1217] py-1 text-[13px] font-black text-white md:text-[12px]">
        {groupFixture.goalsAway ?? '-'}
      </span>
    </div>
  ) : (
    <div className="grid grid-cols-[30px_8px_30px] items-center justify-center gap-0 text-center md:grid-cols-[27px_8px_27px]">
      <WorldCupScoreInput
        label={`${homeName} goles`}
        value={homeGoals}
        onChange={(value) => onChange(fixtureId, 'goalsHome', value)}
        size="group"
      />
      <span className="text-[11px] font-bold text-[#6f7d8b]">-</span>
      <WorldCupScoreInput
        label={`${awayName} goles`}
        value={awayGoals}
        onChange={(value) => onChange(fixtureId, 'goalsAway', value)}
        size="group"
      />
    </div>
  )

  return (
    <div className="border-b border-white/8 px-2 py-2 text-xs last:border-b-0">
      <div className="grid gap-1.5 md:grid-cols-[72px_minmax(0,1fr)_62px_minmax(0,1fr)_66px_32px] md:items-center">
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="min-w-0 text-[10px] font-semibold text-[#8fa0b1]">{dateLabel}</div>
          <div className="flex shrink-0 items-center gap-1">
            {statusBadge}
            {clearControl}
          </div>
        </div>

        <div className="hidden text-[10px] font-semibold text-[#8fa0b1] md:block">{dateLabel}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:contents">
          {renderTeam(homeName, fixture.homeLogo)}
          <div className="flex justify-center">{scoreControl}</div>
          {renderTeam(awayName, fixture.awayLogo)}
        </div>
        <div className="hidden md:flex md:justify-center">{statusBadge}</div>
        <div className="hidden md:flex md:justify-center">{clearControl}</div>
      </div>
      {incomplete ? (
        <div className="mt-1 text-[10px] font-semibold text-[#f6d88a] md:ml-[72px]">
          Completá ambos goles para contar el partido.
        </div>
      ) : null}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  )
}

function WorldCupSimulatedStandings({
  group,
  locale,
}: {
  group: WorldCupSimulatedGroup
  locale: AppLocale
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
          Tabla simulada
        </h3>
        {group.simulatedFixtureIds.length ? (
          <span className="rounded-lg border border-[#d6a84f]/25 bg-[#2a2112] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#f6d88a]">
            Simulado
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-[10px] sm:text-xs">
          <colgroup>
            <col className="w-[30px]" />
            <col />
            <col className="w-[34px]" />
            <col className="w-[28px]" />
            <col className="w-[28px]" />
            <col className="w-[28px]" />
            <col className="w-[28px]" />
            <col className="w-[30px]" />
            <col className="w-[30px]" />
            <col className="w-[34px]" />
          </colgroup>
          <thead className="text-[#8fa0b1]">
            <tr className="border-b border-white/8">
              {['Pos', 'Equipo', 'Pts', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG'].map((header) => (
                <th key={header} className="px-1 py-2 text-center first:text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.teamKey} className={`border-b border-white/6 last:border-b-0 ${getStandingRowTone(row.rank)}`}>
                <td className="px-1 py-2 text-center font-black text-white">{row.rank}</td>
                <td className="px-1 py-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <TeamLogo
                      src={row.teamLogo}
                      alt={row.teamName}
                      size={16}
                      className="h-4 w-4 object-contain"
                      fallbackClassName="h-3.5 w-3"
                    />
                    <span className="truncate font-bold text-[#dce5ef]" title={row.teamName}>
                      {translateCountryName(row.teamName, locale) || row.teamName}
                    </span>
                    {row.manualTiebreaker ? (
                      <span className="rounded border border-[#d6a84f]/25 px-1 text-[8px] font-black uppercase text-[#f6d88a]" title="Desempate manual">
                        M
                      </span>
                    ) : null}
                    {row.tiebreakerPending ? (
                      <span className="rounded border border-white/10 px-1 text-[8px] font-black uppercase text-[#8d98a7]" title="Desempate pendiente">
                        !
                      </span>
                    ) : null}
                  </div>
                </td>
                {[row.points, row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference].map((value, index) => (
                  <td key={`${row.teamKey}-${index}`} className={`px-1 py-2 text-center text-[#dce5ef] ${index === 0 ? 'font-black' : 'font-bold'}`}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ManualTiebreakerEditor({
  group,
  manualOrder,
  onChange,
  locale,
}: {
  group: WorldCupSimulatedGroup
  manualOrder: string[]
  onChange: (teamKeys: string[]) => void
  locale: AppLocale
}) {
  const pendingKeys = group.unresolvedTiebreakerTeamKeys
  const relevantKeys = manualOrder.length ? manualOrder : pendingKeys
  const relevantRows = relevantKeys
    .map((teamKey) => group.rows.find((row) => row.teamKey === teamKey))
    .filter((row): row is WorldCupSimulatedStandingRow => Boolean(row))

  if (!pendingKeys.length && !manualOrder.length) return null

  const move = (index: number, direction: -1 | 1) => {
    const next = relevantRows.map((row) => row.teamKey)
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-[#d6a84f]/25 bg-[#2a2112] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#f6d88a]">
          Desempate manual
        </h3>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#f6d88a]"
        >
          Volver a calculada
        </button>
      </div>
      <div className="space-y-1">
        {relevantRows.map((row, index) => (
          <div key={row.teamKey} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/8 bg-[#11161b] px-2 py-1">
            <span className="text-xs font-black text-white">{index + 1}</span>
            <span className="truncate text-xs font-bold text-[#dce5ef]">
              {translateCountryName(row.teamName, locale) || row.teamName}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} className="h-7 w-7 rounded-md border border-white/10 text-xs font-black text-white">↑</button>
              <button type="button" onClick={() => move(index, 1)} className="h-7 w-7 rounded-md border border-white/10 text-xs font-black text-white">↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorldCupThirdPlaceSimulation({
  model,
  locale,
}: {
  model: ReturnType<typeof buildWorldCupSimulatedGroupFixtures>
  locale: AppLocale
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#d6a84f]">
          Mejores terceros
        </h3>
        <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
          {model.thirdPlaceRanking.complete ? 'Completa' : 'Provisional'}
        </span>
      </div>
      <div className="grid gap-px bg-white/6 sm:grid-cols-2 lg:grid-cols-4">
        {model.thirdPlaceRanking.rows.map((entry) => (
          <div key={entry.row.teamKey} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 bg-[#11161b] px-3 py-2 text-xs">
            <span className="font-black text-white">{entry.rank}</span>
            <span className="truncate font-bold text-[#dce5ef]" title={entry.row.teamName}>
              {entry.groupKey} · {translateCountryName(entry.row.teamName, locale) || entry.row.teamName}
            </span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
              entry.qualified
                ? 'border-[#7ff0b2]/25 text-[#7ff0b2]'
                : 'border-white/10 text-[#8d98a7]'
            }`}>
              {entry.qualified ? 'Avanza' : 'Fuera'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatGroupFixtureDate(date: string | null) {
  if (!date) return 'Fecha a confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(date))
}

function getStandingRowTone(rank: number) {
  if (rank <= 2) return 'bg-[#143624]/35'
  if (rank === 3) return 'bg-[#2a2112]/45'
  return ''
}

function SeedEditor({
  seedOptions,
  allSeedRows,
  seedOverrides,
  onChange,
  locale,
}: {
  seedOptions: ReturnType<typeof getWorldCupBracketSeedOptions>
  allSeedRows: ReturnType<typeof getWorldCupBracketSeedOptions>[number]['rows']
  seedOverrides: WorldCupBracketSeedOverrides
  onChange: (seedKey: WorldCupBracketSeedKey, teamKey: string) => void
  locale: AppLocale
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#101820] p-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {seedOptions.map((group) => (
          <div key={group.groupKey} className="rounded-xl border border-white/7 bg-[#0d1217] p-2">
            <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
              Grupo {group.groupKey}
            </h4>
            <SeedSelect
              label="1.º"
              seedKey={`W${group.groupKey}` as WorldCupBracketSeedKey}
              rows={group.rows}
              value={seedOverrides[`W${group.groupKey}` as WorldCupBracketSeedKey] ?? ''}
              onChange={onChange}
              locale={locale}
            />
            <SeedSelect
              label="2.º"
              seedKey={`R${group.groupKey}` as WorldCupBracketSeedKey}
              rows={group.rows}
              value={seedOverrides[`R${group.groupKey}` as WorldCupBracketSeedKey] ?? ''}
              onChange={onChange}
              locale={locale}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/7 bg-[#0d1217] p-2">
        <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#d6a84f]">
          Mejores terceros
        </h4>
        <div className="grid gap-2 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => {
            const seedKey = `T${index + 1}` as WorldCupBracketSeedKey

            return (
              <SeedSelect
                key={seedKey}
                label={`T${index + 1}`}
                seedKey={seedKey}
                rows={allSeedRows}
                value={seedOverrides[seedKey] ?? ''}
                onChange={onChange}
                locale={locale}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SeedSelect({
  label,
  seedKey,
  rows,
  value,
  onChange,
  locale,
}: {
  label: string
  seedKey: WorldCupBracketSeedKey
  rows: ReturnType<typeof getWorldCupBracketSeedOptions>[number]['rows']
  value: string
  onChange: (seedKey: WorldCupBracketSeedKey, teamKey: string) => void
  locale: AppLocale
}) {
  return (
    <label className="mb-1 grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2 text-xs text-[#8d98a7]">
      <span className="font-black text-[#dce5ef]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(seedKey, event.target.value)}
        className="h-8 min-w-0 rounded-lg border border-white/10 bg-[#111820] px-2 text-xs font-bold text-white outline-none focus:border-[#7ff0b2]/70"
      >
        <option value="">Automático</option>
        {rows.map((row) => (
          <option key={`${seedKey}-${row.key}`} value={row.key}>
            {getDisplayTeamName(row, locale)}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function WorldCupKnockoutSection({
  groups,
  fixtures,
  leagueExternalId,
  season = 2026,
  locale = 'es',
}: WorldCupKnockoutSectionProps) {
  const [activeTab, setActiveTab] = useState<WorldCupKnockoutTab>(getInitialWorldCupKnockoutTab)

  useEffect(() => {
    const syncHashTab = () => {
      if (window.location.hash === WORLD_CUP_SIMULATOR_HASH) {
        setActiveTab('simulator')
      }
    }

    syncHashTab()
    window.addEventListener('hashchange', syncHashTab)

    return () => window.removeEventListener('hashchange', syncHashTab)
  }, [])

  return (
    <section id="simulador-mundial" className="hf-card w-full scroll-mt-20 overflow-hidden rounded-3xl">
      <div className="border-b border-white/7 bg-[#13181d] p-2">
        <div className="flex items-center justify-between gap-2" role="tablist" aria-label="Llaves Copa del Mundo 2026">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'official'}
            onClick={() => setActiveTab('official')}
            className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-black transition sm:max-w-[160px] ${
              activeTab === 'official'
                ? 'border-[#7ff0b2]/65 bg-[#143624] text-[#7ff0b2]'
                : 'border-white/8 bg-[#0d1217] text-[#8d98a7] hover:text-white'
            }`}
          >
            Llaves
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'simulator'}
            onClick={() => setActiveTab('simulator')}
            className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-black transition sm:max-w-[160px] ${
              activeTab === 'simulator'
                ? 'border-[#7ff0b2]/65 bg-[#143624] text-[#7ff0b2]'
                : 'border-white/8 bg-[#0d1217] text-[#8d98a7] hover:text-white'
            }`}
          >
            Simulador
          </button>
        </div>
      </div>
      <div className="p-3">
        {activeTab === 'official' ? (
          <WorldCupOfficialBracket
            groups={groups}
            fixtures={fixtures}
            locale={locale}
          />
        ) : (
          <WorldCupKnockoutSimulator
            groups={groups}
            fixtures={fixtures}
            leagueExternalId={leagueExternalId}
            season={season}
            locale={locale}
          />
        )}
      </div>
    </section>
  )
}
